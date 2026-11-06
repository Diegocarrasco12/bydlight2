import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import PrintButton from "@/components/checkout/PrintButton"
import { TERMS_VERSION } from "@/lib/terms"
import PaymentBrandShowcase from "@/components/payments/PaymentBrandShowcase"
import { checkoutMode, paymentsEnabled } from "@/lib/payments/config"
import { webpaySandbox } from "@/lib/payments/availability"
import { legalVisible } from "@/lib/legal"
import { previewMode } from "@/lib/preview"
import { previewOrder } from "@/lib/payments/preview-data"
import { clientIp, rateLimited } from "@/lib/payments/http"
import { amountDue, verifyOrder } from "@/lib/payments/service"
import { isValidOrderId, readOrder } from "@/lib/payments/store"
import type { Attempt, Order } from "@/lib/payments/types"
import { IVA_PERCENT, ivaBreakdown } from "@/lib/tax"
import { buildVoucher, formatClp, formatWhen } from "@/lib/payments/voucher"
import { COMPANY } from "@/lib/company"
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
function quoteExpired(o: Order) {
  return !!o.quote && new Date(o.quote.validUntil).getTime() < Date.now()
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
  terminos: "Para pagar debes aceptar los términos de contratación y la política de privacidad.",
}

const STEPS = ["Solicitud", "Cotización", "Pago", "Confirmación"]
function stepIndex(o: Order, pending: boolean) {
  if (o.stage === "SOLICITADA") return 0
  if (o.stage === "COTIZADA") return pending ? 2 : 1
  if (o.stage === "ANTICIPO_PAGADO" || o.stage === "SALDO_HABILITADO") return 3
  return 4 // PAGADA / CERRADA: todo completado
}

// Estado visible de la cotizacion, derivado SOLO de los datos validados por el servidor (etapa y vigencia de la orden).
function quoteStatus(o: Order): { label: string; tone: "ok" | "warn" | "off" } {
  if (o.stage === "PAGADA") return { label: "Pagada", tone: "ok" }
  if (o.stage === "ANTICIPO_PAGADO") return { label: "Anticipo pagado", tone: "ok" }
  if (o.stage === "SALDO_HABILITADO") return { label: "Saldo disponible", tone: "warn" }
  if (o.quote && new Date(o.quote.validUntil).getTime() < Date.now()) return { label: "Cotización vencida", tone: "off" }
  return { label: "Cotización aprobada", tone: "ok" }
}

function StatusIcon({ tone }: { tone: "ok" | "bad" | "warn" | "wait" }) {
  const p = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }
  return (
    <span className={`bd-ico ${tone}`}>
      {tone === "ok" && <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
      {tone === "bad" && <svg {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>}
      {tone === "warn" && <svg {...p}><path d="M12 8v5M12 16.5v.01" /><path d="M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" /></svg>}
      {tone === "wait" && <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>}
    </span>
  )
}

function ResultHead({ tone, title }: { tone: "ok" | "bad" | "warn" | "wait"; title: string }) {
  return (
    <div className="bd-result-head">
      <StatusIcon tone={tone} />
      <h2>{title}</h2>
    </div>
  )
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
              <strong>{COMPANY.legalName}</strong>
              <span>RUT {COMPANY.rut} · {COMPANY.addressShort}</span>
              <span>{SITE.url.replace("https://", "")} · {SITE.email}</span>
              <span>Comprobante de pago · Orden {order.id}</span>
            </div>
          </div>
          <ResultHead tone="ok" title="Pago aprobado" />
          <p>Recibimos tu pago de {label} por {clp(a.amount)}. Guarda este comprobante.</p>
          <h3 className="bd-voucher-title">{v.title}</h3>
          <dl className="bd-dl">
            {v.rows.map((row) => (
              <div key={row.label} className="bd-dl-row"><dt>{row.label}</dt><dd>{row.value}</dd></div>
            ))}
          </dl>
          <p className="bd-note left">Este comprobante acredita el pago en línea con Webpay Plus. No reemplaza el documento tributario que corresponda emitir por separado.</p>
          {refunded.length > 0 && <p className="bd-note">Se registró una devolución sobre este pago. Si tienes dudas, escríbenos con el código de la orden.</p>}
          <div className="bd-voucher-brand">
            <span>Pago procesado por Webpay Plus de Transbank</span>
            {/* Logotipos oficiales sin modificar: version negativa en pantalla (fondo oscuro), positiva al imprimir (fondo blanco). */}
            <img className="scr" src="/img/pagos/webpay-plus-negativo-300.png" alt="Webpay Plus de Transbank" width={301} height={76} loading="lazy" />
            <img className="prn" src="/img/pagos/webpay-plus-positivo-300.png" alt="Webpay Plus de Transbank" width={301} height={76} loading="lazy" />
          </div>
          <div className="bd-voucher-actions"><PrintButton /></div>
        </div>
      )
    }
    case "RECHAZADO":
      return <div className="bd-result bad" role="status"><ResultHead tone="bad" title="Pago rechazado" /><p>Tu banco o Webpay no autorizó el pago. No se realizó ningún cobro. Puedes reintentar con otra tarjeta.</p></div>
    case "CANCELADO":
      return <div className="bd-result warn" role="status"><ResultHead tone="warn" title="Pago cancelado" /><p>Anulaste el pago en Webpay. No se realizó ningún cobro. Puedes reintentar cuando quieras.</p></div>
    case "EXPIRADO":
      return <div className="bd-result warn" role="status"><ResultHead tone="warn" title="Pago expirado" /><p>El tiempo para completar el pago terminó. No se realizó ningún cobro. Puedes iniciar un nuevo pago.</p></div>
    case "PENDIENTE":
      return <div className="bd-result warn" role="status"><ResultHead tone="wait" title="Estamos confirmando tu pago" /><p>Aún no tenemos la confirmación final de Webpay. <strong>No vuelvas a pagar:</strong> consultaremos el estado automáticamente. Puedes usar «Verificar estado» en unos minutos. Si el cargo aparece en tu tarjeta, escríbenos con el código de esta orden.</p></div>
    case "ERROR":
      return <div className="bd-result bad" role="status"><ResultHead tone="bad" title="No pudimos confirmar el pago" /><p>{a.note ?? "Ocurrió un problema al confirmar."} Si viste un cargo, escríbenos con el código de esta orden y lo revisamos.</p></div>
    default:
      return <div className="bd-result warn" role="status"><ResultHead tone="wait" title="Pago en curso" /><p>Estamos esperando la confirmación de Webpay. Si ya terminaste el pago, usa «Verificar estado».</p></div>
  }
}

function PayPanel({
  kind,
  orderId,
  title,
  concept,
  amount,
  sandbox,
  preview,
  showLegal,
}: {
  kind: "anticipo" | "saldo"
  orderId: string
  title: string
  concept: string
  amount: number
  sandbox: boolean
  preview: boolean
  showLegal: boolean
}) {
  return (
    <form method="post" action="/api/pagos/iniciar" className="bd-panel bd-pay">
      <div className="bd-panel-head">
        <h2>{title}</h2>
        {preview ? <span className="bd-status warn">Vista previa · sin cobros</span> : sandbox && <span className="bd-status warn">Ambiente de pruebas</span>}
      </div>
      <dl className="bd-sum">
        <div><dt>Concepto</dt><dd>{concept}</dd></div>
        <div><dt>Proveedor</dt><dd>{COMPANY.legalName} · RUT {COMPANY.rut}</dd></div>
        <div><dt>Medio de pago</dt><dd>Webpay Plus</dd></div>
        <div className="total"><dt>Total a pagar</dt><dd>{clp(amount)}</dd></div>
      </dl>
      <PaymentBrandShowcase variant="checkout" />
      <p className="bd-note left">Al pagar serás redirigido al sitio de Transbank para completar la operación. Luego volverás a esta página, donde verás el resultado y tu comprobante.</p>
      {sandbox && !preview && <p className="bd-note left">Ambiente de pruebas de Transbank: no se realizan cobros reales.</p>}
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="termsVersion" value={TERMS_VERSION} />
      <label className="bd-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          {showLegal ? (
            <>Acepto los <Link href="/terminos" prefetch={false} target="_blank">términos de contratación</Link>, la{" "}
            <Link href="/devoluciones" prefetch={false} target="_blank">política de cancelación y devoluciones</Link> y la{" "}
            <Link href="/privacidad" prefetch={false} target="_blank">política de privacidad</Link>.</>
          ) : (
            <>Acepto los términos de contratación, la política de cancelación y devoluciones y la política de privacidad.</>
          )}
        </span>
      </label>
      <button type="submit" className="bd-btn bd-btn-primary bd-btn-block">Pagar {kind === "anticipo" ? "anticipo" : "saldo"} de {clp(amount)}</button>
    </form>
  )
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
  const preview = previewMode()
  const demo = preview ? previewOrder(id) : null
  if (preview && !demo) notFound() // en vista previa solo existen las ordenes de demostracion
  // Frena la busqueda de codigos al azar: cada IP puede consultar 40 ordenes por 10 min.
  if (!preview && rateLimited(`ord:${clientIp({ headers: await headers() })}`, 40, 10 * 60_000)) notFound()
  let order = demo ?? (await readOrder(id))
  if (!order) notFound()

  // Recuperacion: si quedo un pago "en curso" (cliente cerro la ventana, retorno perdido), se consulta a Transbank.
  if (!preview && hasStalePending(order) && paymentsEnabled()) {
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
  const step = stepIndex(order, pending)
  const expired = quoteExpired(order)
  const showLegal = legalVisible()
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

        {!preview && checkoutMode() === "pilot" && !sandbox && <p className="bd-banner" role="status"><strong>Prueba productiva controlada.</strong> Esta orden usa Webpay en producción: el cobro es real.</p>}
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
              {order.customer.type === "empresa" && (<><dt>Cliente</dt><dd>{order.customer.company} · RUT {order.customer.taxId}</dd></>)}
              <dt>Total del proyecto (IVA incluido)</dt><dd>{clp(q.amount)}</dd>
              <dt>IVA incluido ({IVA_PERCENT} %)</dt><dd>{clp(ivaBreakdown(q.amount).iva)}</dd>
              <dt>Anticipo ({q.depositPercent}%)</dt><dd>{clp(q.depositAmount)}</dd>
              <dt>Saldo</dt><dd>{clp(q.balanceAmount)}</dd>
              <dt>Cotización válida hasta</dt><dd>{when(q.validUntil)}</dd>
              {enabled && (<><dt>Método de pago</dt><dd>Webpay Plus · crédito, débito y prepago</dd></>)}
            </dl>
            {q.note && <p className="bd-note left">{q.note}</p>}
            <p className="bd-note left">
              Montos en pesos chilenos (CLP), con IVA incluido; el IVA se desglosa solo a modo informativo. El anticipo ({q.depositPercent}%) da inicio al proyecto; el saldo se habilita en esta página cuando corresponda según el avance.
            </p>
          </div>
        )}

        {expired && order.stage === "COTIZADA" && (
          <div className="bd-panel">
            <h2>Esta cotización venció</h2>
            <p>Para volver a pagar necesitamos actualizarla. Escríbenos con el código de tu orden y te enviamos una nueva.</p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-primary">Pedir cotización actualizada</a>
          </div>
        )}

        {enabled && dueDeposit !== null && !pending && !expired && (
          <PayPanel
            kind="anticipo"
            orderId={order.id}
            title="Resumen previo al pago"
            concept={`${order.planName} · anticipo (${q?.depositPercent}%)`}
            amount={dueDeposit}
            sandbox={sandbox}
            preview={preview}
            showLegal={showLegal}
          />
        )}

        {enabled && dueBalance !== null && !pending && (
          <PayPanel
            kind="saldo"
            orderId={order.id}
            title="Resumen previo al pago del saldo"
            concept={`${order.planName} · saldo`}
            amount={dueBalance}
            sandbox={sandbox}
            preview={preview}
            showLegal={showLegal}
          />
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
