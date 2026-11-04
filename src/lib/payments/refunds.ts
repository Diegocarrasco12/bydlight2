import "server-only"
import { randomBytes } from "node:crypto"
import { createTransaction } from "./config"
import { openDb } from "./db"
import { isValidOrderId, readOrder, rowToRefund, withOrderLock, writeOrder } from "./store"
import type { Attempt, Order, Refund } from "./types"

// Devolucion / anulacion de pagos de Webpay Plus (POST .../transactions/{token}/refunds).
//
// Reglas:
//  - Solo se invoca desde la capa administrativa autenticada (API firmada + interruptor `adminRefunds`).
//    No existe ninguna ruta publica ni formulario del cliente.
//  - El pago original debe estar AUTORIZADO y el monto cabe en lo disponible (autorizado - devuelto).
//  - Una devolucion se guarda como SOLICITADA ANTES de llamar a Transbank; un indice unico impide dos abiertas
//    para el mismo pago. Si la respuesta es incierta queda INCIERTA y bloquea nuevas devoluciones hasta conciliarla.
//  - Idempotencia: la misma `idempotencyKey` devuelve el resultado ya registrado y no vuelve a llamar a Transbank.
//  - Pagos en cuotas no admiten anulacion parcial (codigo 53 de Transbank): se rechaza antes de llamar.
//  - Cada paso queda en `refunds` y en `events` (solo-agregar). Nunca se registra token ni credenciales.

export type RefundResult<T = Refund> = { ok: true; data: T; replayed?: boolean } | { ok: false; error: string }
const fail = (error: string): RefundResult<never> => ({ ok: false, error })

export type RefundRequest = {
  orderId: string
  attemptId?: string // por defecto, el unico pago autorizado de la orden
  amount: number
  reason?: string
  idempotencyKey: string
  requestedBy: string
}

const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/

function event(order: Order, type: string, detail?: string) {
  order.events.push({ at: new Date().toISOString(), type, detail })
}

const safeError = (e: unknown) => String((e as Error)?.message ?? "error").replace(/\s+/g, " ").slice(0, 200)

function saveRefund(r: Refund) {
  const db = openDb()
  db.prepare(
    `INSERT INTO refunds (id, order_id, attempt_id, amount, status, type, nullified_amount, balance, authorization_code,
       authorization_date, response_code, idempotency_key, requested_by, reason, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, type = excluded.type, nullified_amount = excluded.nullified_amount,
       balance = excluded.balance, authorization_code = excluded.authorization_code, authorization_date = excluded.authorization_date,
       response_code = excluded.response_code, error = excluded.error, updated_at = excluded.updated_at`,
  ).run(
    r.id, r.orderId, r.attemptId, r.amount, r.status, r.type ?? null, r.nullifiedAmount ?? null, r.balance ?? null,
    r.authorizationCode ?? null, r.authorizationDate ?? null, r.responseCode ?? null, r.idempotencyKey, r.requestedBy,
    r.reason ?? null, r.error ?? null, r.createdAt, r.updatedAt,
  )
}

const refundsOf = (order: Order, attempt: Attempt) => (order.refunds ?? []).filter((r) => r.attemptId === attempt.id)
const sum = (rs: Refund[], st: Refund["status"][]) => rs.filter((r) => st.includes(r.status)).reduce((n, r) => n + r.amount, 0)

export async function refundPayment(req: RefundRequest): Promise<RefundResult> {
  if (!isValidOrderId(req.orderId)) return fail("ID de orden invalido.")
  if (!KEY_RE.test(req.idempotencyKey)) return fail("idempotencyKey debe tener entre 16 y 64 caracteres (A-Z a-z 0-9 _ -).")
  if (!Number.isInteger(req.amount) || req.amount < 1) return fail("El monto debe ser un entero positivo en CLP.")
  if (req.reason && req.reason.length > 300) return fail("El motivo es demasiado largo.")
  if (!req.requestedBy) return fail("Falta el solicitante.")

  return withOrderLock(req.orderId, async () => {
    const order = await readOrder(req.orderId)
    if (!order) return fail("Orden no encontrada.")

    // Idempotencia: misma clave => mismo resultado, sin nueva llamada a Transbank.
    const dup = (order.refunds ?? []).find((r) => r.idempotencyKey === req.idempotencyKey)
    if (dup) {
      if (dup.amount !== req.amount || (req.attemptId && dup.attemptId !== req.attemptId)) {
        return fail("La idempotencyKey ya se usó con otros parámetros.")
      }
      return { ok: true, data: dup, replayed: true }
    }

    const paid = order.attempts.filter((a) => a.status === "AUTORIZADO")
    const attempt = req.attemptId ? paid.find((a) => a.id === req.attemptId) : paid.length === 1 ? paid[0] : undefined
    if (!attempt) return fail(paid.length > 1 && !req.attemptId ? "Hay más de un pago autorizado: indica attemptId." : "No hay un pago autorizado que devolver.")
    if (!attempt.token) return fail("El pago no tiene referencia en Transbank.")

    const rs = refundsOf(order, attempt)
    if (rs.some((r) => r.status === "SOLICITADA" || r.status === "INCIERTA")) {
      return fail("Hay una devolución en curso o de resultado incierto para este pago. Concíliala antes de crear otra.")
    }
    const available = attempt.amount - sum(rs, ["COMPLETADA"])
    if (available <= 0) return fail("Este pago ya fue devuelto en su totalidad.")
    if (req.amount > available) return fail(`El monto excede lo disponible para devolver (${available}).`)
    if (req.amount < available && (attempt.installments ?? 0) > 0) {
      return fail("Un pago en cuotas no admite anulación parcial (Transbank, código 53). Devuelve el monto total.")
    }

    const now = new Date().toISOString()
    const refund: Refund = {
      id: `RF${randomBytes(8).toString("hex")}`,
      orderId: order.id,
      attemptId: attempt.id,
      amount: req.amount,
      status: "SOLICITADA",
      idempotencyKey: req.idempotencyKey,
      requestedBy: req.requestedBy.slice(0, 60),
      reason: req.reason,
      createdAt: now,
      updatedAt: now,
    }
    // La intencion queda registrada ANTES de llamar a Transbank (si el proceso cae, queda SOLICITADA = por conciliar).
    try {
      saveRefund(refund)
    } catch {
      return fail("No se pudo registrar la devolución (posible devolución simultánea).")
    }
    event(order, "DEVOLUCION_SOLICITADA", `${refund.id} ${attempt.buyOrder} ${req.amount} por ${refund.requestedBy}`)
    await writeOrder(order)

    try {
      const res = (await createTransaction().refund(attempt.token, req.amount)) as Record<string, unknown>
      const type = String(res?.type ?? "")
      const code = typeof res?.response_code === "number" ? res.response_code : undefined
      const ok = type === "REVERSED" || (type === "NULLIFIED" && code === 0)
      refund.type = type || undefined
      refund.responseCode = code
      refund.updatedAt = new Date().toISOString()
      if (ok) {
        refund.status = "COMPLETADA"
        refund.nullifiedAmount = typeof res.nullified_amount === "number" ? res.nullified_amount : undefined
        refund.balance = typeof res.balance === "number" ? res.balance : undefined
        refund.authorizationCode = typeof res.authorization_code === "string" ? res.authorization_code : undefined
        refund.authorizationDate = typeof res.authorization_date === "string" ? res.authorization_date : undefined
      } else {
        refund.status = "INCIERTA" // respuesta inesperada: no se asume ni exito ni fracaso
        refund.error = `Respuesta inesperada de Transbank (type=${type || "?"}, response_code=${code ?? "?"}).`
      }
    } catch (e) {
      refund.status = "INCIERTA" // red o error de Transbank: puede haberse aplicado; se concilia con status()
      refund.error = safeError(e)
      refund.updatedAt = new Date().toISOString()
    }
    saveRefund(refund)
    event(order, `DEVOLUCION_${refund.status}`, refund.id)
    await writeOrder(order)
    console.info(JSON.stringify({ at: refund.updatedAt, scope: "payments", event: "refund_result", orderId: order.id, refundId: refund.id, status: refund.status }))
    return { ok: true, data: refund }
  })
}

/**
 * Concilia una devolucion SOLICITADA/INCIERTA consultando el estado del pago en Transbank:
 *  - el pago sigue AUTHORIZED y no hay otras devoluciones completadas -> la devolucion NO se aplico: FALLIDA (se puede reintentar);
 *  - REVERSED/NULLIFIED y el monto coincide con lo solicitado -> COMPLETADA;
 *  - cualquier otro caso -> sigue INCIERTA (revision manual en el portal de Transbank).
 */
export async function reconcileRefund(orderId: string, refundId: string): Promise<RefundResult> {
  if (!isValidOrderId(orderId)) return fail("ID de orden invalido.")
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    const refund = order?.refunds?.find((r) => r.id === refundId)
    if (!order || !refund) return fail("Devolución no encontrada.")
    if (refund.status !== "SOLICITADA" && refund.status !== "INCIERTA") return { ok: true, data: refund }
    const attempt = order.attempts.find((a) => a.id === refund.attemptId)
    if (!attempt?.token) return fail("El pago no tiene referencia en Transbank.")
    try {
      const res = (await createTransaction().status(attempt.token)) as Record<string, unknown>
      const st = String(res?.status ?? "")
      const others = sum(refundsOf(order, attempt), ["COMPLETADA"])
      if (st === "AUTHORIZED" && others === 0) {
        refund.status = "FALLIDA"
        refund.error = "Conciliada: el pago sigue autorizado en Transbank; la devolución no se aplicó."
      } else if ((st === "REVERSED" || st === "NULLIFIED") && refund.amount === attempt.amount - others) {
        refund.status = "COMPLETADA"
        refund.type = st
        refund.error = "Conciliada por estado de Transbank (sin código de autorización de la anulación)."
      } else {
        return { ok: true, data: refund } // sigue incierta
      }
    } catch {
      return fail("No se pudo consultar a Transbank. Reintenta más tarde.")
    }
    refund.updatedAt = new Date().toISOString()
    saveRefund(refund)
    event(order, `DEVOLUCION_CONCILIADA_${refund.status}`, refund.id)
    await writeOrder(order)
    return { ok: true, data: refund }
  })
}

/** Lista de devoluciones de una orden para la API administrativa (sin tokens). */
export function listRefunds(orderId: string): Refund[] {
  const rows = openDb().prepare("SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at, id").all(orderId) as Record<string, unknown>[]
  return rows.map(rowToRefund)
}
