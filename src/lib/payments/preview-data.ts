import "server-only"
import { previewMode } from "@/lib/preview"
import type { Attempt, Order, Refund } from "./types"

/**
 * Ordenes de DEMOSTRACION para la vista previa local (ver src/lib/preview.ts). Datos ficticios: no existen en
 * ninguna base, no corresponden a clientes ni a transacciones reales. Solo se sirven con previewMode() activo.
 */

const NOW = Date.now()
const iso = (ms: number) => new Date(ms).toISOString()
const HOUR = 3_600_000
const DAY = 24 * HOUR

const customer = { name: "Cliente de demostración", email: "demo@example.com" }

function attempt(id: string, kind: "anticipo" | "saldo", amount: number, status: Attempt["status"], extra: Partial<Attempt> = {}): Attempt {
  return {
    id,
    kind,
    buyOrder: `DEMO-${id}`,
    amount,
    token: null,
    status,
    createdAt: iso(NOW - 2 * HOUR),
    updatedAt: iso(NOW - 2 * HOUR + 60_000),
    ...extra,
  }
}

function quote(amount: number, validDays = 10) {
  const depositAmount = Math.round(amount / 2)
  return {
    amount,
    depositPercent: 50,
    depositAmount,
    balanceAmount: amount - depositAmount,
    approvedAt: iso(NOW - DAY),
    validUntil: iso(NOW + validDays * DAY),
  }
}

function base(id: string, stage: Order["stage"], planId = "profesional", planName = "Plan Profesional"): Order {
  return {
    id,
    createdAt: iso(NOW - 3 * DAY),
    updatedAt: iso(NOW - HOUR),
    stage,
    planId,
    planName,
    customer,
    message: "Solicitud de demostración para la vista previa del diseño.",
    attempts: [],
    events: [],
  }
}

const approved = (amount: number, extra: Partial<Attempt> = {}) =>
  attempt("a1", "anticipo", amount, "AUTORIZADO", {
    authorizationCode: "1213",
    cardLast4: "6623",
    paymentType: "VN",
    installments: 0,
    transactionDate: iso(NOW - 2 * HOUR),
    responseCode: 0,
    ...extra,
  })

function build(): Record<string, Order> {
  const q = quote(299_990)
  const out: Record<string, Order> = {}

  out.DEMOSOLICITA = base("DEMOSOLICITA", "SOLICITADA")
  out.DEMOCOTIZADA = { ...base("DEMOCOTIZADA", "COTIZADA"), quote: q }
  out.DEMOVENCIDA2 = { ...base("DEMOVENCIDA2", "COTIZADA"), quote: { ...q, validUntil: iso(NOW - 2 * DAY) } }

  out.DEMOAPROBADA = { ...base("DEMOAPROBADA", "ANTICIPO_PAGADO"), quote: q, attempts: [approved(q.depositAmount)] }
  const refund: Refund = {
    id: "r1",
    orderId: "DEMOCUOTAS22",
    attemptId: "a1",
    amount: 20_000,
    status: "COMPLETADA",
    idempotencyKey: "demo",
    requestedBy: "demo",
    createdAt: iso(NOW - HOUR),
    updatedAt: iso(NOW - HOUR),
  }
  out.DEMOCUOTAS22 = {
    ...base("DEMOCUOTAS22", "ANTICIPO_PAGADO"),
    quote: q,
    attempts: [approved(q.depositAmount, { paymentType: "VC", installments: 3, installmentsAmount: Math.round(q.depositAmount / 3) })],
    refunds: [{ ...refund }],
  }
  out.DEMOSALDO222 = {
    ...base("DEMOSALDO222", "SALDO_HABILITADO"),
    quote: q,
    attempts: [approved(q.depositAmount, { paymentType: "VD" })],
  }
  out.DEMOPAGADA22 = {
    ...base("DEMOPAGADA22", "PAGADA"),
    quote: q,
    attempts: [approved(q.depositAmount), { ...approved(q.balanceAmount, { id: "a2", kind: "saldo" }), id: "a2", buyOrder: "DEMO-a2" }],
  }

  out.DEMORECHAZOS = { ...base("DEMORECHAZOS", "COTIZADA"), quote: q, attempts: [attempt("a1", "anticipo", q.depositAmount, "RECHAZADO", { responseCode: -1 })] }
  out.DEMOCANCELAD = { ...base("DEMOCANCELAD", "COTIZADA"), quote: q, attempts: [attempt("a1", "anticipo", q.depositAmount, "CANCELADO")] }
  out.DEMOEXPIRADO = { ...base("DEMOEXPIRADO", "COTIZADA"), quote: q, attempts: [attempt("a1", "anticipo", q.depositAmount, "EXPIRADO")] }
  out.DEMOPENDIENT = {
    ...base("DEMOPENDIENT", "COTIZADA"),
    quote: q,
    // createdAt reciente (<2 min) para que la pagina no intente verificar con Transbank (en vista previa nunca se verifica).
    attempts: [attempt("a1", "anticipo", q.depositAmount, "PENDIENTE", { createdAt: iso(NOW), updatedAt: iso(NOW) })],
  }
  out.DEMOERROR222 = {
    ...base("DEMOERROR222", "COTIZADA"),
    quote: q,
    attempts: [attempt("a1", "anticipo", q.depositAmount, "ERROR", { note: "No pudimos validar la respuesta de Webpay." })],
  }
  return out
}

let cache: Record<string, Order> | null = null

/** Orden de demostracion, o null si no es una de las de demostracion o la vista previa esta apagada. */
export function previewOrder(id: string): Order | null {
  if (!previewMode()) return null
  cache ??= build()
  const o = cache[id]
  return o ? structuredClone(o) : null
}

/** Rutas de demostracion para el indice de la vista previa. */
export const PREVIEW_ORDERS: { id: string; label: string; group: string }[] = [
  { id: "DEMOSOLICITA", label: "Solicitud recibida", group: "Cotización" },
  { id: "DEMOCOTIZADA", label: "Cotización aprobada, lista para pagar", group: "Cotización" },
  { id: "DEMOVENCIDA2", label: "Cotización vencida", group: "Cotización" },
  { id: "DEMOAPROBADA", label: "Pago aprobado y comprobante", group: "Estados de pago" },
  { id: "DEMOCUOTAS22", label: "Aprobado en 3 cuotas con devolución parcial", group: "Estados de pago" },
  { id: "DEMORECHAZOS", label: "Pago rechazado", group: "Estados de pago" },
  { id: "DEMOCANCELAD", label: "Pago cancelado por el cliente", group: "Estados de pago" },
  { id: "DEMOEXPIRADO", label: "Pago expirado", group: "Estados de pago" },
  { id: "DEMOPENDIENT", label: "Pago pendiente de confirmación", group: "Estados de pago" },
  { id: "DEMOERROR222", label: "Error al confirmar", group: "Estados de pago" },
  { id: "DEMOSALDO222", label: "Saldo habilitado", group: "Saldo" },
  { id: "DEMOPAGADA22", label: "Proyecto pagado completo", group: "Saldo" },
]
