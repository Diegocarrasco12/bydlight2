import "server-only"
import { PLANS } from "@/lib/plans"
import { TERMS_VERSION, checkTerms, termsEventDetail } from "@/lib/terms"
import { createTransaction, tbkMode } from "./config"
import { isValidOrderId, newOrderId, readOrder, withOrderLock, writeOrder } from "./store"
import type { Attempt, Order, PaymentKind } from "./types"

/**
 * Vigencia de un intento abandonado. El token de Webpay vive 5 min y el formulario dura 4 min en produccion y
 * 10 min en integracion (transbankdevelopers.cl). Pasado este plazo (con margen) un intento ya no puede autorizarse:
 * se consulta el estado real a Transbank antes de cerrarlo o de permitir un reintento.
 */
export function abandonMinutes(): number {
  return tbkMode() === "production" ? 6 : 11
}
/** Transbank conserva la consulta de estado 7 dias; pasado ese plazo un resultado desconocido solo puede revisarse a mano. */
const STATUS_RETENTION_MS = 7 * 24 * 3_600_000

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
  termsVersion: string
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
    termsVersion: TERMS_VERSION,
  }
  if (!PLANS.some((p) => p.id === data.planId)) errors.push("Plan no válido.")
  if (data.name.length < 2) errors.push("Ingresa tu nombre.")
  if (!EMAIL_RE.test(data.email)) errors.push("Ingresa un correo válido.")
  if (data.phone && !/^[0-9+()\-\s]{6,30}$/.test(data.phone)) errors.push("El teléfono no es válido.")
  if (data.message.length < 10) errors.push("Cuéntanos brevemente qué necesitas (mínimo 10 caracteres).")
  if (body.accept !== true && body.accept !== "on" && body.accept !== "true") errors.push("Marca la casilla para confirmar que entiendes que esto es una solicitud de cotización.")
  const termsError = checkTerms(body.acceptTerms, body.termsVersion)
  if (termsError) errors.push(termsError)
  return errors.length ? { ok: false, errors } : { ok: true, data }
}

export async function createOrder(input: SolicitudInput, opts: { pilot?: boolean } = {}): Promise<Order> {
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
  addEvent(order, "TERMINOS_ACEPTADOS", termsEventDetail("solicitud"))
  if (opts.pilot) addEvent(order, "ACCESO_PILOTO", "prueba productiva controlada")
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

/** `terms`: aceptacion de terminos validada por la ruta (checkTerms); se registra en la orden junto con el inicio del pago. */
export async function startPayment(orderId: string, kind: PaymentKind, baseUrl: string, terms?: { accepted: true }): Promise<StartResult> {
  if (!isValidOrderId(orderId)) return { ok: false, reason: "Orden no encontrada.", code: "no-existe" }
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return { ok: false, reason: "Orden no encontrada.", code: "no-existe" }

    // Antes de bloquear: los intentos vencidos se resuelven con el estado real de Transbank (nunca por suposicion).
    if (await settleStale(order)) await writeOrder(order)
    // El monto sale SIEMPRE de la cotizacion guardada en el servidor, nunca del navegador.
    const amount = amountDue(order, kind)
    if (!order.quote || amount === null || !Number.isInteger(amount) || amount < 50) {
      return { ok: false, reason: "Esta orden no tiene un pago disponible.", code: "sin-pago" }
    }
    if (kind === "anticipo" && new Date(order.quote.validUntil).getTime() < Date.now()) {
      return { ok: false, reason: "La cotización venció. Solicita una actualización.", code: "vencida" }
    }
    if (paidAmountOf(order, kind)) return { ok: false, reason: "Este pago ya fue realizado.", code: "pagado" }

    // Mientras exista un intento potencialmente vigente o de resultado desconocido no se crea otro cobro.
    const pending = order.attempts.find((a) => a.status === "INICIADO" || a.status === "PENDIENTE")
    if (pending) return { ok: false, reason: "Ya hay un pago en curso. Verifica su estado antes de reintentar.", code: "en-curso" }

    // En produccion el retorno de Webpay debe ser siempre https.
    if (tbkMode() === "production" && !baseUrl.startsWith("https://")) {
      log("payment_start_blocked", { orderId: order.id, reason: "base-url-no-https" })
      return { ok: false, reason: "No pudimos iniciar el pago. Intenta nuevamente en unos minutos.", code: "error" }
    }

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
      if (terms) addEvent(order, "TERMINOS_ACEPTADOS", termsEventDetail(`pago-${kind}`))
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

/**
 * Interpreta una respuesta de Transbank (commit o status) y actualiza el intento.
 *  - AUTHORIZED + response_code 0 + datos coincidentes -> AUTORIZADO
 *  - FAILED o response_code distinto de 0 sin autorizacion -> RECHAZADO
 *  - cualquier otra cosa -> PENDIENTE (resultado desconocido: NO es un rechazo)
 */
function evaluate(order: Order, attempt: Attempt, res: Record<string, unknown>) {
  const st = String(res.status ?? "")
  const code = typeof res.response_code === "number" ? res.response_code : undefined
  attempt.tbkStatus = st
  attempt.responseCode = code
  if (st === "AUTHORIZED" && code === 0) {
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
    attempt.installmentsAmount = typeof res.installments_amount === "number" ? res.installments_amount : undefined
    attempt.transactionDate = typeof res.transaction_date === "string" ? res.transaction_date : undefined
    attempt.note = undefined
    applyAuthorized(order, attempt)
    return
  }
  if (st === "FAILED" || (st !== "AUTHORIZED" && code !== undefined && code !== 0)) {
    attempt.status = "RECHAZADO"
    attempt.note = undefined
    return
  }
  if (st === "AUTHORIZED") {
    attempt.status = "ERROR"
    attempt.note = "Transbank informó AUTHORIZED con un código de respuesta inesperado. Requiere revisión manual."
    addEvent(order, "REVISION_MANUAL", attempt.buyOrder)
    return
  }
  attempt.status = "PENDIENTE"
  attempt.note = "Resultado de Transbank no concluyente; se confirmará automáticamente."
}

const ageMinutes = (a: Attempt) => (Date.now() - new Date(a.createdAt).getTime()) / 60_000

/**
 * Resuelve un intento INICIADO (vencido, o cualquiera si early) o PENDIENTE consultando el estado real a Transbank (status).
 * Devuelve true si el intento cambio. Una consulta fallida NUNCA cierra ni rechaza el intento.
 */
async function reconcileAttempt(order: Order, a: Attempt, early = false): Promise<boolean> {
  if (a.status !== "INICIADO" && a.status !== "PENDIENTE") return false
  const age = ageMinutes(a)
  if (!early && a.status === "INICIADO" && age <= abandonMinutes()) return false // el cliente puede seguir en Webpay
  if (!a.token) {
    a.status = "EXPIRADO"
    return true
  }
  let res: Record<string, unknown>
  try {
    res = (await createTransaction().status(a.token)) as Record<string, unknown>
  } catch {
    if (Date.now() - new Date(a.createdAt).getTime() > STATUS_RETENTION_MS) {
      a.status = "ERROR"
      a.note = "No fue posible confirmar el resultado con Transbank dentro de 7 días. Requiere revisión manual."
      return true
    }
    return false // sigue bloqueando reintentos hasta tener respuesta
  }
  const st = String(res?.status ?? "")
  if (st === "AUTHORIZED" || st === "FAILED") {
    evaluate(order, a, res)
    return true
  }
  a.tbkStatus = st
  if (["REVERSED", "NULLIFIED", "PARTIALLY_NULLIFIED", "CAPTURED"].includes(st)) {
    a.status = "ERROR"
    a.note = `Transbank informa el estado ${st} para un pago no registrado como autorizado. Requiere revisión manual.`
    addEvent(order, "REVISION_MANUAL", a.buyOrder)
    return true
  }
  // INITIALIZED u otro estado no final: sin autorizacion. Solo se cierra cuando el token ya no puede usarse.
  if (age > abandonMinutes()) {
    a.status = "EXPIRADO"
    return true
  }
  return false
}

/** Resuelve los intentos vencidos de una orden (con el bloqueo de la orden ya tomado). */
async function settleStale(order: Order, early = false): Promise<boolean> {
  let changed = false
  for (const a of order.attempts) {
    if (a.status !== "INICIADO" && a.status !== "PENDIENTE") continue
    const before = a.status
    if (await reconcileAttempt(order, a, early)) {
      a.updatedAt = new Date().toISOString()
      addEvent(order, `VERIFICADO_${a.status}`, `${a.buyOrder} (antes ${before})`)
      changed = true
    }
  }
  return changed
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
      if (attempt.status === "PENDIENTE") {
        // Retorno repetido de un pago de resultado incierto: NO se vuelve a confirmar; solo se consulta su estado.
        if (await reconcileAttempt(order, attempt)) {
          attempt.updatedAt = now
          addEvent(order, `PAGO_${attempt.status}`, attempt.buyOrder)
          await writeOrder(order)
        }
        return log("return_replayed_pending", { orderId, buyOrder: attempt.buyOrder, status: attempt.status })
      }
      if (attempt.status !== "INICIADO") return log("return_replayed", { orderId, buyOrder: attempt.buyOrder }) // idempotencia
      try {
        evaluate(order, attempt, await tx.commit(p.tokenWs))
      } catch {
        // El commit fallo (red, 422, etc.): el resultado es DESCONOCIDO, no un rechazo. Se consulta el estado real.
        attempt.status = "PENDIENTE"
        attempt.note = "No se pudo confirmar aún con Transbank; se verificará automáticamente."
        try {
          const res = (await tx.status(p.tokenWs)) as Record<string, unknown>
          const st = String(res?.status ?? "")
          attempt.tbkStatus = st
          if (st === "AUTHORIZED" || st === "FAILED") evaluate(order, attempt, res)
        } catch {
          /* queda PENDIENTE */
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
    if (await settleStale(order, true)) await writeOrder(order) // consulta explicita: tambien adelanta pagos recientes
  })
}
