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
  | "ERROR" // error tecnico o inconsistencia: requiere revision manual
  | "PENDIENTE" // confirmacion incierta: el resultado real es desconocido; NO es un rechazo

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
  installmentsAmount?: number
  transactionDate?: string
  responseCode?: number
  tbkStatus?: string
  note?: string
}

export type RefundStatus = "SOLICITADA" | "COMPLETADA" | "FALLIDA" | "INCIERTA"

export type Refund = {
  id: string
  orderId: string
  attemptId: string
  amount: number
  status: RefundStatus
  type?: string // REVERSED | NULLIFIED
  nullifiedAmount?: number
  balance?: number
  authorizationCode?: string
  authorizationDate?: string
  responseCode?: number
  idempotencyKey: string
  requestedBy: string
  reason?: string
  error?: string
  createdAt: string
  updatedAt: string
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

export type CustomerType = "persona" | "empresa"

/** Persona natural o empresa. `company` = razon social; `taxId` (RUT), `giro` y `address` solo aplican a empresas. */
export type CustomerData = {
  name: string
  email: string
  phone?: string
  company?: string
  type?: CustomerType // ausente = persona (ordenes anteriores a la migracion 4)
  taxId?: string
  giro?: string
  address?: string
}

export type Order = {
  id: string
  createdAt: string
  updatedAt: string
  stage: Stage
  planId: string
  planName: string
  customer: CustomerData
  message: string
  quote?: Quote
  attempts: Attempt[]
  refunds?: Refund[]
  events: { at: string; type: string; detail?: string }[]
}
