import "server-only"
import { readOrder, withOrderLock, writeOrder, isValidOrderId } from "./store"
import { openDb } from "./db"
import { verifyOrder } from "./service"
import type { Order } from "./types"

// Operaciones administrativas. Solo las invoca la API firmada (adminAuth) o las pruebas.
// El cliente NUNCA llega aqui: no existe ruta publica que apruebe cotizaciones ni cambie montos.

export type AdminResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

const fail = (error: string): AdminResult<never> => ({ ok: false, error })

function ev(order: Order, type: string, detail?: string) {
  order.events.push({ at: new Date().toISOString(), type, detail })
}

export async function approveQuote(
  orderId: string,
  p: { amount: number; depositPercent?: number; validDays?: number; note?: string },
): Promise<AdminResult<{ amount: number; deposit: number; balance: number }>> {
  const pct = p.depositPercent ?? 50
  const days = p.validDays ?? 7
  if (!Number.isInteger(p.amount) || p.amount < 100 || p.amount > 50_000_000) return fail("amount debe ser entero en CLP (100 a 50.000.000).")
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) return fail("depositPercent debe estar entre 1 y 100.")
  if (!Number.isInteger(days) || days < 1 || days > 60) return fail("validDays debe estar entre 1 y 60.")
  if (p.note && p.note.length > 300) return fail("note es demasiado larga.")
  if (!isValidOrderId(orderId)) return fail("ID de orden invalido.")
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return fail("Orden no encontrada.")
    if (order.stage !== "SOLICITADA" && order.stage !== "COTIZADA") return fail(`No se puede cotizar una orden en estado ${order.stage}.`)
    if (order.attempts.some((a) => a.status === "AUTORIZADO" || a.status === "INICIADO")) {
      return fail("La orden tiene un pago autorizado o en curso; no se puede cambiar la cotizacion.")
    }
    const deposit = Math.round((p.amount * pct) / 100)
    const now = new Date()
    order.quote = {
      amount: p.amount,
      depositPercent: pct,
      depositAmount: deposit,
      balanceAmount: p.amount - deposit,
      approvedAt: now.toISOString(),
      validUntil: new Date(now.getTime() + days * 86_400_000).toISOString(),
      note: p.note,
    }
    order.stage = "COTIZADA"
    ev(order, "COTIZACION_APROBADA", `${p.amount} / anticipo ${deposit}`)
    await writeOrder(order)
    return { ok: true, data: { amount: p.amount, deposit, balance: p.amount - deposit } }
  })
}

export async function releaseBalance(orderId: string): Promise<AdminResult<null>> {
  if (!isValidOrderId(orderId)) return fail("ID de orden invalido.")
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return fail("Orden no encontrada.")
    if (order.stage !== "ANTICIPO_PAGADO") return fail(`Solo se habilita el saldo tras el anticipo (estado actual: ${order.stage}).`)
    order.stage = "SALDO_HABILITADO"
    ev(order, "SALDO_HABILITADO")
    await writeOrder(order)
    return { ok: true, data: null }
  })
}

export async function closeOrder(orderId: string): Promise<AdminResult<null>> {
  if (!isValidOrderId(orderId)) return fail("ID de orden invalido.")
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return fail("Orden no encontrada.")
    if (order.attempts.some((a) => a.status === "INICIADO" || a.status === "PENDIENTE")) return fail("Hay un pago en curso; reconcilia antes de cerrar.")
    order.stage = "CERRADA"
    ev(order, "ORDEN_CERRADA")
    await writeOrder(order)
    return { ok: true, data: null }
  })
}

/**
 * Resumen sin tokens ni mensajes del cliente. `q` (opcional) busca por codigo de orden, orden de compra (buyOrder), correo o nombre.
 * Incluye monto de la cotizacion, anticipo, saldo y lo efectivamente cobrado (intentos AUTORIZADO).
 */
export function listOrders(limit = 50, q?: string) {
  const db = openDb()
  const term = (q ?? "").trim().slice(0, 80)
  const like = `%${term.replace(/[!%_]/g, (c) => "!" + c)}%`
  return db
    .prepare(
      `SELECT o.id, o.stage, o.plan_name AS plan, o.cust_name AS name, o.created_at AS createdAt,
              qt.amount AS quoteAmount, qt.deposit_amount AS depositAmount, qt.balance_amount AS balanceAmount,
              (SELECT COALESCE(SUM(a.amount), 0) FROM attempts a WHERE a.order_id = o.id AND a.status = 'AUTORIZADO') AS paid,
              (SELECT COUNT(*) FROM attempts a WHERE a.order_id = o.id AND a.status = 'INICIADO') AS pending
         FROM orders o LEFT JOIN quotes qt ON qt.order_id = o.id
        WHERE (? = '' OR o.id LIKE ? ESCAPE '!' OR o.cust_email LIKE ? ESCAPE '!' OR o.cust_name LIKE ? ESCAPE '!'
               OR EXISTS (SELECT 1 FROM attempts a WHERE a.order_id = o.id AND a.buy_order LIKE ? ESCAPE '!'))
        ORDER BY o.created_at DESC LIMIT ?`,
    )
    .all(term, like, like, like, like, Math.min(Math.max(1, limit), 200))
}

export type AuditFinding = {
  orderId: string
  severity: "alta" | "media" | "info"
  type: string
  detail: string
}

const PENDING_ALERT_MIN = 30 // un intento sin resolver pasados 30 min merece revision (la ventana normal de abandono es de 6)

/**
 * AUDITORIA de consistencia financiera. SOLO LECTURA: no modifica ordenes ni intentos, no llama a Transbank y no crea cobros.
 * Detecta: pago autorizado no reflejado en la etapa de la orden, monto autorizado distinto del esperado, pago duplicado,
 * intentos pendientes demasiado tiempo (retorno interrumpido), intentos en ERROR (revision manual) y cotizaciones incoherentes.
 * La correccion siempre es una decision humana (o la conciliacion contra Transbank: `reconcile`).
 */
export async function auditPayments(limit = 5000): Promise<{ checkedOrders: number; findings: AuditFinding[] }> {
  const db = openDb()
  const ids = db.prepare("SELECT id FROM orders ORDER BY created_at DESC LIMIT ?").all(Math.min(Math.max(1, limit), 5000)) as { id: string }[]
  const findings: AuditFinding[] = []
  const add = (orderId: string, severity: AuditFinding["severity"], type: string, detail: string) => findings.push({ orderId, severity, type, detail })
  for (const { id } of ids) {
    const o = await readOrder(id)
    if (!o) continue
    const q = o.quote
    if (q && (q.depositAmount + q.balanceAmount !== q.amount || q.depositAmount > q.amount)) add(id, "alta", "COTIZACION_INCOHERENTE", "anticipo + saldo no suman el total de la cotización")
    for (const kind of ["anticipo", "saldo"] as const) {
      const ok = o.attempts.filter((a) => a.kind === kind && a.status === "AUTORIZADO")
      if (ok.length > 1) add(id, "alta", "PAGO_DUPLICADO", `${ok.length} pagos autorizados de ${kind}: ${ok.map((a) => a.buyOrder).join(", ")}`)
      for (const a of ok) {
        const expected = q ? (kind === "anticipo" ? q.depositAmount : q.balanceAmount) : undefined
        if (expected === undefined) add(id, "alta", "PAGO_SIN_COTIZACION", `${a.buyOrder} autorizado sin cotización registrada`)
        else if (a.amount !== expected) add(id, "alta", "MONTO_DISTINTO", `${a.buyOrder}: autorizado ${a.amount}, esperado ${expected}`)
        const reflected = kind === "anticipo" ? ["ANTICIPO_PAGADO", "SALDO_HABILITADO", "PAGADA", "CERRADA"] : ["PAGADA", "CERRADA"]
        if (!reflected.includes(o.stage)) add(id, "alta", "AUTORIZADO_NO_REFLEJADO", `${a.buyOrder} autorizado pero la orden está en ${o.stage}`)
        if (!a.authorizationCode) add(id, "info", "SIN_CODIGO_AUTORIZACION", `${a.buyOrder} sin código de autorización guardado`)
      }
    }
    for (const a of o.attempts) {
      if (a.status === "ERROR") add(id, "alta", "REVISION_MANUAL", `${a.buyOrder}: ${a.note ?? "intento en ERROR"}`)
      if (a.status === "INICIADO" || a.status === "PENDIENTE") {
        const min = Math.round((Date.now() - new Date(a.createdAt).getTime()) / 60_000)
        if (min > PENDING_ALERT_MIN) add(id, a.status === "PENDIENTE" ? "alta" : "media", "PENDIENTE_LARGO", `${a.buyOrder} ${a.status} hace ${min} min: ejecutar reconcile`)
      }
    }
    for (const r of o.refunds ?? []) if (r.status === "INCIERTA") add(id, "alta", "DEVOLUCION_INCIERTA", `${r.id} requiere conciliación`)
  }
  return { checkedOrders: ids.length, findings }
}

export async function showOrder(orderId: string) {
  const order = await readOrder(orderId)
  if (!order) return null
  return { ...order, attempts: order.attempts.map((a) => ({ ...a, token: undefined })) }
}

/** Consulta a Transbank todos los pagos que quedaron "en curso" (cierre, caida o retorno perdido). */
export async function reconcilePending(): Promise<{ checked: number }> {
  const db = openDb()
  const rows = db.prepare("SELECT DISTINCT order_id FROM attempts WHERE status IN ('INICIADO','PENDIENTE')").all() as { order_id: string }[]
  for (const r of rows) await verifyOrder(r.order_id)
  return { checked: rows.length }
}
