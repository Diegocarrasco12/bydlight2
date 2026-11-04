import type { Attempt, Order, Refund } from "./types"

// Comprobante de la transaccion. Solo contiene lo que Transbank informo y lo que el servidor guardo:
// nunca tokens, credenciales ni numero completo de tarjeta. Los campos que Transbank no entrega se omiten.

export const COMMERCE_NAME = "Byd Light Solutions SpA"

/** Codigos de tipo de pago de Webpay Plus (documentacion de Transbank). */
export function paymentTypeLabel(code?: string): string | undefined {
  switch (code) {
    case "VD":
      return "Débito (Redcompra)"
    case "VN":
      return "Crédito, sin cuotas"
    case "VC":
      return "Crédito, cuotas normales"
    case "SI":
    case "S2":
    case "NC":
      return "Crédito, cuotas sin interés"
    case "VP":
      return "Prepago"
    default:
      return undefined
  }
}

export type VoucherRow = { label: string; value: string }

export type Voucher = {
  title: string
  rows: VoucherRow[]
}

export const formatClp = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" })

/** Total devuelto (solo devoluciones completadas). */
export function refundedAmount(order: Order, attempt: Attempt): number {
  return (order.refunds ?? [])
    .filter((r: Refund) => r.attemptId === attempt.id && r.status === "COMPLETADA")
    .reduce((n, r) => n + r.amount, 0)
}

/** Comprobante de un pago aprobado. Devuelve null si el intento no esta autorizado. */
export function buildVoucher(order: Order, a: Attempt): Voucher | null {
  if (a.status !== "AUTORIZADO") return null
  const rows: VoucherRow[] = [
    { label: "Comercio", value: COMMERCE_NAME },
    { label: "Orden de compra", value: a.buyOrder },
    { label: "Descripción", value: `${order.planName} — ${a.kind === "anticipo" ? "anticipo" : "saldo"}` },
    { label: "Monto pagado", value: `${formatClp(a.amount)} (CLP)` },
    { label: "Fecha y hora", value: formatWhen(a.transactionDate ?? a.updatedAt) },
    { label: "Estado", value: "Aprobada" },
  ]
  if (a.authorizationCode) rows.push({ label: "Código de autorización", value: a.authorizationCode })
  const type = paymentTypeLabel(a.paymentType)
  if (type) rows.push({ label: "Tipo de pago", value: type })
  if (typeof a.installments === "number") {
    if (a.installments > 0) {
      rows.push({ label: "Cuotas", value: String(a.installments) })
      if (typeof a.installmentsAmount === "number" && a.installmentsAmount > 0) {
        rows.push({ label: "Monto de cada cuota", value: formatClp(a.installmentsAmount) })
      }
    } else {
      rows.push({ label: "Cuotas", value: "Sin cuotas" })
    }
  }
  if (a.cardLast4) rows.push({ label: "Tarjeta", value: `•••• ${a.cardLast4}` })
  const back = refundedAmount(order, a)
  if (back > 0) rows.push({ label: "Monto devuelto", value: formatClp(back) })
  return { title: "Comprobante de pago", rows }
}
