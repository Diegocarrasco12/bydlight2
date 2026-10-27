import "server-only"
import { PLANS } from "@/lib/plans"
import { createTransaction } from "./config"
import { isValidOrderId, newOrderId, readOrder, withOrderLock, writeOrder } from "./store"
import type { Attempt, Order, PaymentKind } from "./types"

const PENDING_MAX_MIN = 15 // el formulario de Webpay dura 10 min en integracion y 4 en produccion

function log(event: string, f: Record<string, unknown> = {}) {
  // Nunca registrar tokens, tarjetas ni credenciales: solo identificadores de la orden.
  console.info(JSON.stringify({ at: new Date().toISOString(), scope: "payments", event, ...f }))
}

function addEvent(order: Order, type: string, detail?: string) {
  order.events.push({ at: new Date().toISOString(), type, detail })
}

/* ---------- Solicitud de contratacion ---------- */

export type SolicitudInput = {
  planId: string
  name: string
  email: string
  phone?: string
  company?: string
  message: string
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

export function parseSolicitud(body: Record<string, unknown>): { ok: true; data: SolicitudInput } | { ok: false; errors: string[] } {
  const s = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "")
  const errors: string[] = []
  const data: SolicitudInput = {
    planId: s("planId", 40),
    name: s("name", 80),
    email: s("email", 120).toLowerCase(),
    phone: s("phone", 30) || undefined,
    company: s("company", 80) || undefined,
    message: s("message", 1500),
  }
  if (!PLANS.some((p) => p.id === data.planId)) errors.push("Plan no válido.")
  if (data.name.length < 2) errors.push("Ingresa tu nombre.")
  if (!EMAIL_RE.test(data.email)) errors.push("Ingresa un correo válido.")
  if (data.phone && !/^[0-9+()\-\s]{6,30}$/.test(data.phone)) errors.push("El teléfono no es válido.")
  if (data.message.length < 10) errors.push("Cuéntanos brevemente qué necesitas (mínimo 10 caracteres).")
  if (body.accept !== true && body.accept !== "on" && body.accept !== "true") errors.push("Debes aceptar las condiciones de contratación.")
  return errors.length ? { ok: false, errors } : { ok: true, data }
}

export async function createOrder(input: SolicitudInput): Promise<Order> {
  const plan = PLANS.find((p) => p.id === input.planId)!
  const now = new Date().toISOString()
  const order: Order = {
    id: newOrderId(),
    createdAt: now,
    updatedAt: now,
    stage: "SOLICITADA",
    planId: plan.id,
    planName: plan.name,
    customer: { name: input.name, email: input.email, phone: input.phone, company: input.company },
    message: input.message,
    attempts: [],
    events: [],
  }
  addEvent(order, "SOLICITUD_CREADA", plan.id)
  await writeOrder(order)
  log("order_created", { orderId: order.id, planId: plan.id })
  return order
}

/* ---------- Inicio del pago ---------- */

export type StartResult =
  | { ok: true; url: string; token: string }
  | { ok: false; reason: string; code: "no-existe" | "sin-pago" | "vencida" | "pagado" | "en-curso" | "error" }

function paidAmountOf(order: Order, kind: PaymentKind) {
  return order.attempts.some((a) => a.kind === kind && a.status === "AUTORIZADO")
}

export function amountDue(order: Order, kind: PaymentKind): number | null {
  const q = order.quote
  if (!q) return null
  if (kind === "anticipo") return order.stage === "COTIZADA" ? q.depositAmount : null
  return order.stage === "SALDO_HABILITADO" ? q.balanceAmount : null
}

export async function startPayment(orderId: string, kind: PaymentKind, baseUrl: string): Promise<StartResult> {
  if (!isValidOrderId(orderId)) return { ok: false, reason: "Orden no encontrada.", code: "no-existe" }
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return { ok: false, reason: "Orden no encontrada.", code: "no-existe" }

    // El monto sale SIEMPRE de la cotizacion guardada en el servidor, nunca del navegador.
    const amount = amountDue(order, kind)
    if (!order.quote || amount === null || !Number.isInteger(amount) || amount < 50) {
      return { ok: false, reason: "Esta orden no tiene un pago disponible.", code: "sin-pago" }
    }
    if (kind === "anticipo" && new Date(order.quote.validUntil).getTime() < Date.now()) {
      return { ok: false, reason: "La cotización venció. Solicita una actualización.", code: "vencida" }
    }
    if (paidAmountOf(order, kind)) return { ok: false, reason: "Este pago ya fue realizado.", code: "pagado" }

    const pending = order.attempts.find(
      (a) => a.status === "INICIADO" && Date.now() - new Date(a.createdAt).getTime() < PENDING_MAX_MIN * 60_000,
    )
    if (pending) return { ok: false, reason: "Ya hay un pago en curso. Verifica su estado antes de reintentar.", code: "en-curso" }

    const n = order.attempts.length + 1
    const buyOrder = `BL${order.id}-${String(n).padStart(2, "0")}` // 17 caracteres (maximo 26)
    const returnUrl = `${baseUrl}/api/pagos/retorno/${order.id}`
    try {
      const res = await createTransaction().create(buyOrder, order.id, amount, returnUrl)
      if (!res?.token || !res?.url) throw new Error("respuesta sin token")
      const now = new Date().toISOString()
      const attempt: Attempt = {
        id: `${order.id}-${n}`,
        kind,
        buyOrder,
        amount,
        token: res.token,
        status: "INICIADO",
        createdAt: now,
        updatedAt: now,
      }
      order.attempts.push(attempt)
      addEvent(order, "PAGO_INICIADO", `${kind} ${buyOrder}`)
      await writeOrder(order)
      log("payment_started", { orderId: order.id, buyOrder, kind, amount })
      return { ok: true, url: res.url as string, token: res.token as string }
    } catch (e) {
      log("payment_start_error", { orderId: order.id, error: (e as Error).message })
      return { ok: false, reason: "No pudimos iniciar el pago. Intenta nuevamente en unos minutos.", code: "error" }
    }
  })
}

/* ---------- Retorno de Webpay ---------- */

export type ReturnParams = {
  tokenWs?: string
  tbkToken?: string
  tbkOrden?: string
  tbkSesion?: string
}

function applyAuthorized(order: Order, attempt: Attempt) {
  if (attempt.kind === "anticipo") {
    order.stage = order.quote && order.quote.balanceAmount === 0 ? "PAGADA" : "ANTICIPO_PAGADO"
  } else {
    order.stage = "PAGADA"
  }
}

/** Valida la respuesta de Transbank contra lo que guardamos y actualiza el intento. */
function evaluate(order: Order, attempt: Attempt, res: Record<string, unknown>) {
  attempt.tbkStatus = String(res.status ?? "")
  attempt.responseCode = typeof res.response_code === "number" ? res.response_code : undefined
  const approved = res.status === "AUTHORIZED" && res.response_code === 0
  if (!approved) {
    attempt.status = "RECHAZADO"
    return
  }
  const consistent =
    res.buy_order === attempt.buyOrder && res.session_id === order.id && Number(res.amount) === attempt.amount
  if (!consistent) {
    // Transbank autorizo pero los datos no coinciden con la orden: NO se marca como pagada.
    attempt.status = "ERROR"
    attempt.note = "Inconsistencia entre la respuesta de Transbank y la orden. Requiere revisión manual."
    addEvent(order, "REVISION_MANUAL", attempt.buyOrder)
    return
  }
  const card = res.card_detail as { card_number?: string } | undefined
  attempt.status = "AUTORIZADO"
  attempt.authorizationCode = typeof res.authorization_code === "string" ? res.authorization_code : undefined
  attempt.cardLast4 = card?.card_number ? String(card.card_number).slice(-4) : undefined
  attempt.paymentType = typeof res.payment_type_code === "string" ? res.payment_type_code : undefined
  attempt.installments = typeof res.installments_number === "number" ? res.installments_number : undefined
  applyAuthorized(order, attempt)
}

export async function handleReturn(orderId: string, p: ReturnParams): Promise<void> {
  if (!isValidOrderId(orderId)) return
  await withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return
    const tx = createTransaction()
    const now = new Date().toISOString()

    // Flujo normal: solo token_ws -> confirmar (commit) una unica vez.
    if (p.tokenWs && !p.tbkToken) {
      const attempt = order.attempts.find((a) => a.token === p.tokenWs)
      if (!attempt) return log("return_unknown_token", { orderId })
      if (attempt.status !== "INICIADO") return log("return_replayed", { orderId, buyOrder: attempt.buyOrder }) // idempotencia
      try {
        const res = await tx.commit(p.tokenWs)
        evaluate(order, attempt, res)
      } catch {
        // Si el commit falla (red, 422 por estado, etc.) se consulta el estado real a Transbank.
        try {
          const res = await tx.status(p.tokenWs)
          if (res?.status === "AUTHORIZED") evaluate(order, attempt, res)
          else {
            attempt.status = "ERROR"
            attempt.tbkStatus = String(res?.status ?? "")
            attempt.note = "No se pudo confirmar el pago."
          }
        } catch {
          attempt.note = "No se pudo confirmar aún. Verifica el estado en unos minutos."
        }
      }
      attempt.updatedAt = now
      addEvent(order, `PAGO_${attempt.status}`, attempt.buyOrder)
      await writeOrder(order)
      return log("payment_result", { orderId, buyOrder: attempt.buyOrder, status: attempt.status })
    }

    // Pago abortado por el cliente (boton "anular"): solo TBK_TOKEN. No se confirma.
    if (p.tbkToken && !p.tokenWs) {
      const attempt = order.attempts.find((a) => a.token === p.tbkToken && a.status === "INICIADO")
      if (attempt) {
        attempt.status = "CANCELADO"
        attempt.updatedAt = now
        addEvent(order, "PAGO_CANCELADO", attempt.buyOrder)
        await writeOrder(order)
        log("payment_cancelled", { orderId, buyOrder: attempt.buyOrder })
      }
      return
    }

    // Retorno invalido (token_ws + TBK_TOKEN): segun la documentacion no se confirma.
    if (p.tokenWs && p.tbkToken) {
      const attempt = order.attempts.find((a) => a.token === p.tokenWs && a.status === "INICIADO")
      if (attempt) {
        attempt.status = "ERROR"
        attempt.note = "Retorno inválido desde Webpay."
        attempt.updatedAt = now
        addEvent(order, "RETORNO_INVALIDO", attempt.buyOrder)
        await writeOrder(order)
        log("payment_invalid_return", { orderId, buyOrder: attempt.buyOrder })
      }
      return
    }

    // Tiempo excedido en el formulario: llegan TBK_ORDEN_COMPRA y TBK_ID_SESION, sin token.
    if (p.tbkOrden) {
      const attempt = order.attempts.find((a) => a.buyOrder === p.tbkOrden && a.status === "INICIADO")
      if (attempt) {
        attempt.status = "EXPIRADO"
        attempt.updatedAt = now
        addEvent(order, "PAGO_EXPIRADO", attempt.buyOrder)
        await writeOrder(order)
        log("payment_expired", { orderId, buyOrder: attempt.buyOrder })
      }
    }
  })
}

/* ---------- Consulta / reconciliacion ---------- */

export async function verifyOrder(orderId: string): Promise<void> {
  if (!isValidOrderId(orderId)) return
  await withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return
    let changed = false
    for (const attempt of order.attempts) {
      if (attempt.status !== "INICIADO" || !attempt.token) continue
      const ageMin = (Date.now() - new Date(attempt.createdAt).getTime()) / 60_000
      try {
        const res = await createTransaction().status(attempt.token)
        if (res?.status === "AUTHORIZED") {
          evaluate(order, attempt, res)
          changed = true
        } else if (ageMin > PENDING_MAX_MIN) {
          attempt.status = "EXPIRADO"
          attempt.tbkStatus = String(res?.status ?? "")
          changed = true
        }
      } catch {
        if (ageMin > PENDING_MAX_MIN) {
          attempt.status = "EXPIRADO"
          changed = true
        }
      }
      if (changed) {
        attempt.updatedAt = new Date().toISOString()
        addEvent(order, `VERIFICADO_${attempt.status}`, attempt.buyOrder)
      }
    }
    if (changed) await writeOrder(order)
  })
}
