import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { paymentsEnabled } from "@/lib/payments/config"
import { amountDue } from "@/lib/payments/service"
import { isValidOrderId, readOrder } from "@/lib/payments/store"
import type { Attempt, Order } from "@/lib/payments/types"
import { SITE, whatsappLink } from "@/lib/site"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Estado de tu orden",
  robots: { index: false, follow: false },
}

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
const when = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })

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

function Result({ a }: { a: Attempt }) {
  const label = a.kind === "anticipo" ? "anticipo" : "saldo"
  switch (a.status) {
    case "AUTORIZADO":
      return (
        <div className="bd-result ok" role="status">
          <h2>Pago aprobado</h2>
          <p>Recibimos tu pago de {label} por {clp(a.amount)}.</p>
          <dl className="bd-dl">
            <dt>Comprobante</dt><dd>{a.buyOrder}</dd>
            <dt>Código de autorización</dt><dd>{a.authorizationCode ?? "—"}</dd>
            {a.cardLast4 && (<><dt>Tarjeta</dt><dd>•••• {a.cardLast4}</dd></>)}
            <dt>Fecha</dt><dd>{when(a.updatedAt)}</dd>
          </dl>
        </div>
      )
    case "RECHAZADO":
      return <div className="bd-result bad" role="status"><h2>Pago rechazado</h2><p>Tu banco o Webpay no autorizó el pago. No se realizó ningún cobro. Puedes reintentar con otro medio de pago.</p></div>
    case "CANCELADO":
      return <div className="bd-result warn" role="status"><h2>Pago cancelado</h2><p>Anulaste el pago en Webpay. No se realizó ningún cobro. Puedes reintentar cuando quieras.</p></div>
    case "EXPIRADO":
      return <div className="bd-result warn" role="status"><h2>Pago expirado</h2><p>El tiempo para completar el pago terminó. No se realizó ningún cobro. Puedes iniciar un nuevo pago.</p></div>
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
  if (!isValidOrderId(id)) notFound()
  const order = await readOrder(id)
  if (!order) notFound()

  const last = order.attempts[order.attempts.length - 1]
  const pending = order.attempts.some((a) => a.status === "INICIADO")
  const enabled = paymentsEnabled()
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

        {last && last.status !== "INICIADO" && <Result a={last} />}
        {pending && <Result a={order.attempts.find((a) => a.status === "INICIADO")!} />}

        {order.stage === "SOLICITADA" && (
          <div className="bd-panel">
            <h2>Solicitud recibida</h2>
            <p>Revisaremos tus requisitos y nuestra disponibilidad, y te enviaremos la cotización a <strong>{order.customer.email}</strong>. Cuando esté aprobada podrás pagar el anticipo desde esta página.</p>
            <p className="bd-note">Guarda este código: <strong>{order.id}</strong></p>
          </div>
        )}

        {q && (
          <div className="bd-panel">
            <h2>Resumen de la cotización</h2>
            <dl className="bd-dl">
              <dt>Plan</dt><dd>{order.planName}</dd>
              <dt>Total del proyecto</dt><dd>{clp(q.amount)}</dd>
              <dt>Anticipo ({q.depositPercent}%)</dt><dd>{clp(q.depositAmount)}</dd>
              <dt>Saldo</dt><dd>{clp(q.balanceAmount)}</dd>
              <dt>Cotización válida hasta</dt><dd>{when(q.validUntil)}</dd>
            </dl>
            {q.note && <p className="bd-note">{q.note}</p>}
          </div>
        )}

        {enabled && dueDeposit !== null && !pending && (
          <form method="post" action="/api/pagos/iniciar" className="bd-panel">
            <h2>Pagar anticipo</h2>
            <p>Pagarás <strong>{clp(dueDeposit)}</strong> con Webpay (tarjetas de crédito y débito). Los datos de tu tarjeta los ingresas en el sitio de Webpay; nosotros no los vemos ni los guardamos.</p>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="kind" value="anticipo" />
            <button type="submit" className="bd-btn bd-btn-primary">Pagar anticipo con Webpay</button>
          </form>
        )}

        {enabled && dueBalance !== null && !pending && (
          <form method="post" action="/api/pagos/iniciar" className="bd-panel">
            <h2>Pagar saldo</h2>
            <p>Saldo a pagar: <strong>{clp(dueBalance)}</strong>.</p>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="kind" value="saldo" />
            <button type="submit" className="bd-btn bd-btn-primary">Pagar saldo con Webpay</button>
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
