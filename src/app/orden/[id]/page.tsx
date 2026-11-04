import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import PrintButton from "@/components/checkout/PrintButton"
import { paymentsEnabled } from "@/lib/payments/config"
import { webpaySandbox } from "@/lib/payments/availability"
import { LEGAL_PAGES_PUBLISHED } from "@/lib/legal"
import { clientIp, rateLimited } from "@/lib/payments/http"
import { amountDue, verifyOrder } from "@/lib/payments/service"
import { isValidOrderId, readOrder } from "@/lib/payments/store"
import type { Attempt, Order } from "@/lib/payments/types"
import { buildVoucher, formatClp, formatWhen } from "@/lib/payments/voucher"
import { SITE, whatsappLink } from "@/lib/site"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Estado de tu orden",
  robots: { index: false, follow: false },
}

const clp = formatClp
function hasStalePending(o: Order) {
  return o.attempts.some((a) => (a.status === "INICIADO" || a.status === "PENDIENTE") && Date.now() - new Date(a.createdAt).getTime() > 2 * 60_000)
}
function maskEmail(e: string) {
  const [u, d] = e.split("@")
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`
}
const when = formatWhen

const AVISOS: Record<string, string> = {
  creada: "Recibimos tu solicitud. Guarda el código de esta orden.",
  "en-curso": "Ya hay un pago en curso. Usa «Verificar estado» antes de reintentar.",
  "sin-pago": "Esta orden no tiene un pago disponible en este momento.",
  vencida: "La cotización venció. Escríbenos para actualizarla.",
  pagado: "Este pago ya fue realizado.",
  error: "No pudimos iniciar el pago. Intenta nuevamente en unos minutos.",
}

const STEPS = ["Solicitud", "Cotización", "Anticipo", "Confirmación"]
function stepIndex(o: Order) {
  if (o.stage === "SOLICITADA") return 0
  if (o.stage === "COTIZADA") return 1
  if (o.stage === "ANTICIPO_PAGADO" || o.stage === "SALDO_HABILITADO") return 3
  return 3
}

// Estado visible de la cotizacion, derivado SOLO de los datos validados por el servidor (etapa y vigencia de la orden).
function quoteStatus(o: Order): { label: string; tone: "ok" | "warn" | "off" } {
  if (o.stage === "PAGADA") return { label: "Pagada", tone: "ok" }
  if (o.stage === "ANTICIPO_PAGADO") return { label: "Anticipo pagado", tone: "ok" }
  if (o.stage === "SALDO_HABILITADO") return { label: "Saldo disponible", tone: "warn" }
  if (o.quote && new Date(o.quote.validUntil).getTime() < Date.now()) return { label: "Cotización vencida", tone: "off" }
  return { label: "Cotización aprobada", tone: "ok" }
}

function Result({ a, order }: { a: Attempt; order: Order }) {
  const label = a.kind === "anticipo" ? "anticipo" : "saldo"
  switch (a.status) {
    case "AUTORIZADO": {
      const v = buildVoucher(order, a)!
      const refunded = (order.refunds ?? []).filter((x) => x.attemptId === a.id && x.status === "COMPLETADA")
      return (
        <div className="bd-result ok bd-voucher" role="status">
          <div className="bd-print-brand" aria-hidden="true">
            <img src={SITE.logoSmall} alt="" width={150} height={150} />
            <div>
              <strong>Byd Light Solutions SpA</strong>
              <span>{SITE.url.replace("https://", "")} · {SITE.email}</span>
              <span>Comprobante de pago · Orden {order.id}</span>
            </div>
          </div>
          <h2>Pago aprobado</h2>
          <p>Recibimos tu pago de {label} por {clp(a.amount)}. Guarda este comprobante.</p>
          <h3 className="bd-voucher-title">{v.title}</h3>
          <dl className="bd-dl">
            {v.rows.map((row) => (
              <div key={row.label} className="bd-dl-row"><dt>{row.label}</dt><dd>{row.value}</dd></div>
            ))}
          </dl>
          {refunded.length > 0 && <p className="bd-note">Se registró una devolución sobre este pago. Si tienes dudas, escríbenos con el código de la orden.</p>}
          <div className="bd-voucher-actions"><PrintButton /></div>
        </div>
      )
    }
    case "RECHAZADO":
      return <div className="bd-result bad" role="status"><h2>Pago rechazado</h2><p>Tu banco o Webpay no autorizó el pago. No se realizó ningún cobro. Puedes reintentar con otro medio de pago.</p></div>
    case "CANCELADO":
      return <div className="bd-result warn" role="status"><h2>Pago cancelado</h2><p>Anulaste el pago en Webpay. No se realizó ningún cobro. Puedes reintentar cuando quieras.</p></div>
    case "EXPIRADO":
      return <div className="bd-result warn" role="status"><h2>Pago expirado</h2><p>El tiempo para completar el pago terminó. No se realizó ningún cobro. Puedes iniciar un nuevo pago.</p></div>
    case "PENDIENTE":
      return <div className="bd-result warn" role="status"><h2>Estamos confirmando tu pago</h2><p>Aún no tenemos la confirmación final de Webpay. <strong>No vuelvas a pagar:</strong> consultaremos el estado automáticamente. Puedes usar «Verificar estado» en unos minutos. Si el cargo aparece en tu tarjeta, escríbenos con el código de esta orden.</p></div>
    case "ERROR":
      return <div className="bd-result bad" role="status"><h2>No pudimos confirmar el pago</h2><p>{a.note ?? "Ocurrió un problema al confirmar."} Si viste un cargo, escríbenos con el código de esta orden y lo revisamos.</p></div>
    default:
      return <div className="bd-result warn" role="status"><h2>Pago en curso</h2><p>Estamos esperando la confirmación de Webpay. Si ya terminaste el pago, usa «Verificar estado».</p></div>
  }
}

export default async function OrdenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aviso?: string }>
}) {
  const { id } = await params
  const { aviso } = await searchParams
  // Con los pagos apagados no se consulta ni se expone ninguna orden (ni se abre la base).
  if (!paymentsEnabled() || !isValidOrderId(id)) notFound()
  // Frena la busqueda de codigos al azar: cada IP puede consultar 40 ordenes por 10 min.
  if (rateLimited(`ord:${clientIp({ headers: await headers() })}`, 40, 10 * 60_000)) notFound()
  let order = await readOrder(id)
  if (!order) notFound()

  // Recuperacion: si quedo un pago "en curso" (cliente cerro la ventana, retorno perdido), se consulta a Transbank.
  if (hasStalePending(order) && paymentsEnabled()) {
    await verifyOrder(id)
    order = (await readOrder(id)) ?? order
  }

  const last = order.attempts[order.attempts.length - 1]
  const pending = order.attempts.some((a) => a.status === "INICIADO" || a.status === "PENDIENTE")
  const enabled = paymentsEnabled()
  const sandbox = webpaySandbox()
  const dueDeposit = amountDue(order, "anticipo")
  const dueBalance = amountDue(order, "saldo")
  const q = order.quote
  const step = stepIndex(order)
  const wa = whatsappLink(`Hola, consulto por mi orden ${order.id} (${order.planName}).`)

  return (
    <section className="bd-section" style={{ paddingTop: 120 }}>
      <div className="bd-container bd-checkout">
        <p className="bd-eyebrow">Orden {order.id}</p>
        <h1 className="bd-h2">{order.planName}</h1>

        <ol className="bd-flow" aria-label="Estado de la contratación">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "on" : ""}>{s}</li>
          ))}
        </ol>

        {aviso && AVISOS[aviso] && <p className="bd-banner" role="status">{AVISOS[aviso]}</p>}

        {last && last.status !== "INICIADO" && last.status !== "PENDIENTE" && <Result a={last} order={order} />}
        {pending && <Result a={order.attempts.find((a) => a.status === "INICIADO" || a.status === "PENDIENTE")!} order={order} />}

        {order.stage === "SOLICITADA" && (
          <div className="bd-panel">
            <h2>Solicitud recibida</h2>
            <p>Revisaremos tus requisitos y nuestra disponibilidad, y te enviaremos la cotización a <strong>{maskEmail(order.customer.email)}</strong>. Cuando esté aprobada podrás pagar el anticipo desde esta página.</p>
            <p className="bd-note">Guarda este código: <strong>{order.id}</strong></p>
          </div>
        )}

        {q && (
          <div className="bd-panel bd-quote">
            <div className="bd-panel-head">
              <h2>Resumen de la cotización</h2>
              <span className={`bd-status ${quoteStatus(order).tone}`}>{quoteStatus(order).label}</span>
            </div>
            <dl className="bd-dl">
              <dt>Plan</dt><dd>{order.planName}</dd>
              <dt>Total del proyecto</dt><dd>{clp(q.amount)}</dd>
              <dt>Anticipo ({q.depositPercent}%)</dt><dd>{clp(q.depositAmount)}</dd>
              <dt>Saldo</dt><dd>{clp(q.balanceAmount)}</dd>
              <dt>Cotización válida hasta</dt><dd>{when(q.validUntil)}</dd>
              {enabled && (<><dt>Método de pago</dt><dd>Webpay Plus · tarjetas</dd></>)}
            </dl>
            {q.note && <p className="bd-note">{q.note}</p>}
            <p className="bd-note">
              El anticipo ({q.depositPercent}%) da inicio al proyecto; el saldo se habilita en esta página cuando corresponda según el avance.
              {LEGAL_PAGES_PUBLISHED && <> Consulta los <Link href="/terminos" prefetch={false}>términos y condiciones de contratación</Link>.</>}
            </p>
          </div>
        )}

        {enabled && dueDeposit !== null && !pending && (
          <form method="post" action="/api/pagos/iniciar" className="bd-panel bd-pay">
            <div className="bd-panel-head">
              <h2>Pago seguro con Webpay Plus</h2>
              {sandbox && <span className="bd-status warn">Ambiente de pruebas</span>}
            </div>
            <p>Paga el anticipo de tu proyecto con tarjetas compatibles. Serás redirigido a Transbank para completar la operación.</p>
            {sandbox && <p className="bd-note">Ambiente de pruebas de Transbank: no se realizan cobros reales.</p>}
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="kind" value="anticipo" />
            <button type="submit" className="bd-btn bd-btn-primary">Pagar anticipo de {clp(dueDeposit)}</button>
            <p className="bd-note">Los datos de tu tarjeta los ingresas en el sitio de Webpay; nosotros no los vemos ni los guardamos.</p>
          </form>
        )}

        {enabled && dueBalance !== null && !pending && (
          <form method="post" action="/api/pagos/iniciar" className="bd-panel bd-pay">
            <div className="bd-panel-head">
              <h2>Pagar saldo</h2>
              {sandbox && <span className="bd-status warn">Ambiente de pruebas</span>}
            </div>
            <p>Saldo a pagar con Webpay Plus: <strong>{clp(dueBalance)}</strong>. Serás redirigido a Transbank para completar la operación.</p>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="kind" value="saldo" />
            <button type="submit" className="bd-btn bd-btn-primary">Pagar saldo de {clp(dueBalance)}</button>
          </form>
        )}

        {order.stage === "ANTICIPO_PAGADO" && (
          <p className="bd-note">El saldo se habilitará aquí cuando corresponda según el avance del proyecto.</p>
        )}
        {order.stage === "PAGADA" && <p className="bd-banner">Tu proyecto está pagado en su totalidad. ¡Gracias!</p>}

        <div className="bd-actions-row">
          {order.attempts.length > 0 && enabled && (
            <form method="post" action="/api/pagos/verificar">
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="bd-btn bd-btn-ghost">Verificar estado</button>
            </form>
          )}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-ghost">Consultar por WhatsApp</a>
          <Link href="/" prefetch={false} className="bd-btn bd-btn-ghost">Volver al inicio</Link>
        </div>
        <p className="bd-note">Consultas: {SITE.email}</p>
      </div>
    </section>
  )
}
