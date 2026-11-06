import Link from "next/link"
import {
  PAYMENT_LOGOS,
  PAYMENT_LOGOS_LIGHT,
  TRUST_POINTS,
  TRUST_STEPS,
  TRUST_TEXT,
  TRUST_TITLE,
  type BrandLogo,
} from "@/lib/payments/availability"

/**
 * PROPUESTAS VISUALES de «pagos seguros» (solo vista previa local; ver PaymentBrandShowcase y docs/WEBPAY-PROPUESTAS-VISUALES.md).
 * Mismo contenido y mismos medios autorizados en las tres variantes:
 *   A · Premium minimalista · B · Confianza tecnológica · C · Bydlight Signature Payments.
 * Medios: SOLO los logotipos oficiales de Webpay Plus y Transbank (autorizados por escrito). Marcas de tarjeta: ninguna (sin confirmar).
 * Los logotipos no se recolorean ni se les aplican efectos: «negativo» sobre fondo oscuro, «positivo» sobre placa blanca.
 */

export type TrustPlace = "home" | "plans" | "checkout" | "footer"
type V = "a" | "b" | "c"

function Logo({ l, h, cls }: { l: BrandLogo; h: number; cls?: string }) {
  return (
    <img className={cls} src={l.src} srcSet={l.srcSet} sizes={`${Math.round(h * (l.width / l.height))}px`} alt={l.alt} width={l.width} height={l.height} style={{ height: h, width: "auto" }} loading="lazy" decoding="async" />
  )
}

function Shield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  )
}
function Lock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}
function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  )
}

const WP = PAYMENT_LOGOS.webpay!
const TB = PAYMENT_LOGOS.transbank!

function Points({ n = 3 }: { n?: number }) {
  return (
    <ul className="pt-points">
      {TRUST_POINTS.slice(0, n).map((p) => <li key={p}><Tick />{p}</li>)}
    </ul>
  )
}
function Steps() {
  return (
    <ol className="pt-steps" aria-label="Cómo se paga">
      {TRUST_STEPS.map((s, i) => (
        <li key={s.t}><span className="pt-n">{i + 1}</span><span><strong>{s.t}</strong><small>{s.d}</small></span></li>
      ))}
    </ol>
  )
}
const Cta = () => <Link href="/contratar" prefetch={false} className="bd-btn bd-btn-primary pt-cta">Solicitar cotización</Link>

/* ------------------------------------------------------------------ HOME ------------------------------------------------------------------ */
function Home({ v }: { v: V }) {
  if (v === "a") {
    return (
      <section className="pt pt-a pt-home" aria-label="Pagos seguros">
        <div className="pt-a-copy">
          <h2 className="pt-title">{TRUST_TITLE}</h2>
          <p className="pt-text">{TRUST_TEXT}</p>
          <Cta />
        </div>
        <div className="pt-a-logos">
          <Logo l={WP} h={44} />
          <span className="pt-sep" aria-hidden="true" />
          <Logo l={TB} h={26} />
        </div>
      </section>
    )
  }
  if (v === "b") {
    return (
      <section className="pt pt-b pt-home" aria-label="Pagos seguros">
        <div className="pt-b-top">
          <span className="pt-eyebrow"><Lock />Pago seguro · Webpay Plus</span>
          <h2 className="pt-title">{TRUST_TITLE}</h2>
          <p className="pt-text">{TRUST_TEXT}</p>
        </div>
        <div className="pt-b-grid">
          <div className="pt-b-card pt-b-logos">
            <span className="pt-cap">Plataforma de pago</span>
            <Logo l={WP} h={58} />
            <span className="pt-cap">Procesado por</span>
            <Logo l={TB} h={32} />
          </div>
          <div className="pt-b-card">
            <span className="pt-cap">Cómo se protege tu pago</span>
            <Points />
            <Cta />
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="pt pt-c pt-home" aria-label="Pagos seguros">
      <div className="pt-c-main">
        <span className="pt-eyebrow">Pagos · Bydlight Signature</span>
        <h2 className="pt-title">Paga con confianza.<br /><em>Tu proyecto, más cerca.</em></h2>
        <p className="pt-text">{TRUST_TEXT}</p>
        <Steps />
        <Cta />
      </div>
      <div className="pt-c-plate">
        <div className="pt-c-card">
          <Logo l={PAYMENT_LOGOS_LIGHT.webpay} h={60} />
          <hr />
          <span className="pt-by">Procesado por</span>
          <Logo l={PAYMENT_LOGOS_LIGHT.transbank} h={30} />
        </div>
        <p className="pt-c-note"><Shield />Los datos de tu tarjeta se ingresan solo en el sitio seguro de Webpay.</p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ PLANES (discreto) ------------------------------------------------------------------ */
function Plans({ v }: { v: V }) {
  const line = "El anticipo de una cotización aprobada se paga con tarjeta mediante Webpay Plus de Transbank."
  if (v === "a") {
    return (
      <aside className="pt pt-a pt-plans" aria-label="Pagos con tarjeta">
        <p>{line}</p>
        <div className="pt-a-logos"><Logo l={WP} h={30} /><span className="pt-sep" aria-hidden="true" /><Logo l={TB} h={18} /></div>
      </aside>
    )
  }
  if (v === "b") {
    return (
      <aside className="pt pt-b pt-plans" aria-label="Pagos con tarjeta">
        <span className="pt-eyebrow"><Lock />Pago seguro</span>
        <p>{line} Tus datos bancarios se ingresan solo en Webpay.</p>
        <div className="pt-b-chips"><Logo l={WP} h={32} /><Logo l={TB} h={20} /></div>
      </aside>
    )
  }
  return (
    <aside className="pt pt-c pt-plans" aria-label="Pagos con tarjeta">
      <div className="pt-c-chip"><Logo l={PAYMENT_LOGOS_LIGHT.webpay} h={30} /></div>
      <div className="pt-c-plans-copy">
        <strong>Pagas el anticipo cuando tu cotización está aprobada.</strong>
        <span>Con tarjeta, en el entorno seguro de Webpay Plus de Transbank.</span>
      </div>
      <ol className="pt-mini-steps"><li>Solicitud</li><li>Aprobación</li><li>Anticipo</li></ol>
    </aside>
  )
}

/* ------------------------------------------------------------------ CHECKOUT ------------------------------------------------------------------ */
function Checkout({ v }: { v: V }) {
  if (v === "a") {
    return (
      <aside className="pt pt-a pt-checkout" aria-label="Pagos con tarjeta">
        <div className="pt-a-logos"><Logo l={WP} h={36} /><span className="pt-sep" aria-hidden="true" /><Logo l={TB} h={22} /></div>
        <p className="pt-fine">Pagas en el sitio seguro de Webpay. Bydlight no ve ni guarda los datos de tu tarjeta.</p>
      </aside>
    )
  }
  if (v === "b") {
    return (
      <aside className="pt pt-b pt-checkout" aria-label="Pagos con tarjeta">
        <span className="pt-eyebrow"><Lock />Pago seguro</span>
        <div className="pt-b-chips"><Logo l={WP} h={38} /><Logo l={TB} h={22} /></div>
        <Points n={2} />
      </aside>
    )
  }
  return (
    <aside className="pt pt-c pt-checkout" aria-label="Pagos con tarjeta">
      <div className="pt-c-card pt-c-card-row"><Logo l={PAYMENT_LOGOS_LIGHT.webpay} h={38} /><span className="pt-by">Procesado por</span><Logo l={PAYMENT_LOGOS_LIGHT.transbank} h={22} /></div>
      <p className="pt-c-note"><Shield />Tus datos bancarios se ingresan solo en el sitio seguro de Webpay; Bydlight no los ve ni los guarda.</p>
    </aside>
  )
}

/* ------------------------------------------------------------------ FOOTER ------------------------------------------------------------------ */
export function Footer({ v }: { v: V }) {
  if (v === "c") {
    return (
      <aside className="pt pt-c pt-footer" aria-label="Pagos con tarjeta">
        <div className="pt-c-chip"><Logo l={PAYMENT_LOGOS_LIGHT.webpay} h={26} /></div>
        <span className="pt-fine">Pagos seguros · procesados por Transbank</span>
      </aside>
    )
  }
  return (
    <aside className={`pt pt-${v} pt-footer`} aria-label="Pagos con tarjeta">
      <span className="pt-fine">{v === "b" ? <><Lock />Pagos seguros</> : "Pagos con tarjeta"}</span>
      <Logo l={WP} h={26} />
      <span className="pt-sep" aria-hidden="true" />
      <Logo l={TB} h={16} />
    </aside>
  )
}

/** Pie de pagina DEFINITIVO (propuesta C aprobada): no depende del selector. */
export function FooterC() {
  return <div className="pt-fixed-footer"><Footer v="c" /></div>
}

const BY_PLACE = { home: Home, plans: Plans, checkout: Checkout, footer: Footer } as const

/** Renderiza las tres variantes; el selector de la vista previa (PreviewBar) muestra una sola con CSS (html[data-pay]). */
export default function PaymentTrust({ place }: { place: TrustPlace }) {
  const P = BY_PLACE[place]
  return (
    <>
      {(["a", "b", "c"] as const).map((v) => (
        <div key={v} className="pt-var" data-v={v} data-place={place}><P v={v} /></div>
      ))}
    </>
  )
}
