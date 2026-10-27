export type Stage =
  | "SOLICITADA" // el cliente pidio el plan; falta revisar requisitos y confirmar cotizacion
  | "COTIZADA" // cotizacion aprobada por Bydlight; se puede pagar el anticipo
  | "ANTICIPO_PAGADO"
  | "SALDO_HABILITADO" // Bydlight habilito el cobro del saldo
  | "PAGADA" // anticipo y saldo pagados
  | "CERRADA" // cancelada o cerrada manualmente

export type PaymentKind = "anticipo" | "saldo"

export type AttemptStatus =
  | "INICIADO"
  | "AUTORIZADO"
  | "RECHAZADO"
  | "CANCELADO"
  | "EXPIRADO"
  | "ERROR"

export type Attempt = {
  id: string
  kind: PaymentKind
  buyOrder: string
  amount: number
  token: string | null
  status: AttemptStatus
  createdAt: string
  updatedAt: string
  authorizationCode?: string
  cardLast4?: string
  paymentType?: string
  installments?: number
  responseCode?: number
  tbkStatus?: string
  note?: string
}

export type Quote = {
  amount: number
  depositPercent: number
  depositAmount: number
  balanceAmount: number
  approvedAt: string
  validUntil: string
  note?: string
}

export type Order = {
  id: string
  createdAt: string
  updatedAt: string
  stage: Stage
  planId: string
  planName: string
  customer: { name: string; email: string; phone?: string; company?: string }
  message: string
  quote?: Quote
  attempts: Attempt[]
  events: { at: string; type: string; detail?: string }[]
}
