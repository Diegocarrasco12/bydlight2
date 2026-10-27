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
    if (order.attempts.some((a) => a.status === "INICIADO")) return fail("Hay un pago en curso; reconcilia antes de cerrar.")
    order.stage = "CERRADA"
    ev(order, "ORDEN_CERRADA")
    await writeOrder(order)
    return { ok: true, data: null }
  })
}

/** Resumen sin tokens ni mensajes del cliente. */
export function listOrders(limit = 50) {
  const db = openDb()
  return db
    .prepare(
      `SELECT o.id, o.stage, o.plan_name AS plan, o.cust_name AS name, o.created_at AS createdAt,
              (SELECT COUNT(*) FROM attempts a WHERE a.order_id = o.id AND a.status = 'INICIADO') AS pending
         FROM orders o ORDER BY o.created_at DESC LIMIT ?`,
    )
    .all(Math.min(Math.max(1, limit), 200))
}

export async function showOrder(orderId: string) {
  const order = await readOrder(orderId)
  if (!order) return null
  return { ...order, attempts: order.attempts.map((a) => ({ ...a, token: undefined })) }
}

/** Consulta a Transbank todos los pagos que quedaron "en curso" (cierre, caida o retorno perdido). */
export async function reconcilePending(): Promise<{ checked: number }> {
  const db = openDb()
  const rows = db.prepare("SELECT DISTINCT order_id FROM attempts WHERE status = 'INICIADO'").all() as { order_id: string }[]
  for (const r of rows) await verifyOrder(r.order_id)
  return { checked: rows.length }
}
