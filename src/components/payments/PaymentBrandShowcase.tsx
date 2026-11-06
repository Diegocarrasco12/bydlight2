import { PAY_HEADLINE, PAY_SUBTITLE, PAY_TRUST, webpayAnnounced } from "@/lib/payments/availability"
import { resolveBrands, transbankLogo, type ResolvedBrand } from "@/lib/payments/brand-assets"
import { paymentsEnabled } from "@/lib/payments/config"
import { previewMode } from "@/lib/preview"
import PaymentTrust, { FooterC, type TrustPlace } from "./PaymentTrust"

/**
 * Banda de medios de pago (Webpay Plus). Las variantes publicas (hero, compact) solo se renderizan con el anuncio publico
 * habilitado (webpayAnnounced); la variante checkout tambien en modo piloto (paymentsEnabled), porque ahi ya se va a pagar.
 *
 * Variantes del mismo componente (sin duplicar estilos):
 *  - hero: portada y planes. Primero las marcas, despues el texto.
 *  - compact: una fila junto a precios, servicios y pie de pagina.
 *  - checkout: /contratar y resumen de pago (marcas + senal de confianza junto al importe y al boton).
 *
 * Marcas: solo se muestran logotipos oficiales sin modificar (resolveBrands). Sin autorizacion verificada, en produccion
 * no aparece ninguna; en la vista previa local aparecen los archivos oficiales pendientes o un recuadro rotulado.
 */

export type ShowcaseVariant = "hero" | "compact" | "checkout"

function Icon({ name }: { name: "credit" | "debit" | "prepaid" | "shield" }) {
  const c = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }
  switch (name) {
    case "shield":
      return <svg {...c}><path d="M12 3l7 3v5.5c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>
    case "credit":
      return <svg {...c}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>
    case "debit":
      return <svg {...c}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><rect x="6.5" y="9" width="4" height="3.2" rx="0.8" /><path d="M14 15h4" /></svg>
    default:
      return <svg {...c}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M7 14.5c1.2-2.4 2.4-2.4 3.6 0s2.4 2.4 3.6 0 1.8-1.8 2.8-1" /></svg>
  }
}

/** Categorias de tarjeta: informacion secundaria (no es el protagonista). */
function Methods() {
  return (
    <ul className="pb-methods" aria-label="Tipos de tarjeta aceptados">
      <li><Icon name="credit" />Crédito</li>
      <li><Icon name="debit" />Débito</li>
      <li><Icon name="prepaid" />Prepago</li>
    </ul>
  )
}

function Tile({ b, size }: { b: ResolvedBrand; size: "lg" | "md" }) {
  if (b.logo) {
    return (
      <li className={`pb-tile ${size}`} data-brand={b.id} title={b.pending ? "Logotipo oficial · uso pendiente de autorización (solo vista previa)" : b.name}>
        {/* Logotipo oficial sin modificar: solo se escala manteniendo su proporcion (height fija, width automatico). */}
        <img src={b.logo.src} srcSet={b.logo.srcSet} sizes={b.logo.srcSet ? "(max-width: 640px) 220px, 300px" : undefined} alt={b.logo.alt} width={b.logo.width} height={b.logo.height} loading="lazy" decoding="async" />
      </li>
    )
  }
  if (previewMode()) {
    return <li className={`pb-tile pb-empty ${size}`} data-brand={b.id}><b>{b.name}</b><small>logo pendiente</small></li>
  }
  return b.id === "webpay" ? <li className={`pb-tile pb-word ${size}`}><b>Webpay Plus</b></li> : null
}

/** Procesador de pagos: logotipo oficial de Transbank (autorizado por escrito), sin modificar. */
function Processor() {
  const l = transbankLogo()
  if (!l) return null
  return (
    <p className="pb-processor">
      <span>Pagos procesados por</span>
      <img src={l.src} srcSet={l.srcSet} sizes="120px" alt={l.alt} width={l.width} height={l.height} loading="lazy" decoding="async" />
    </p>
  )
}

function Brands({ size }: { size: "lg" | "md" }) {
  const { webpay, cards } = resolveBrands()
  return (
    <ul className="pb-brands" aria-label="Medios de pago">
      <Tile b={webpay} size="lg" />
      {cards.map((c) => <Tile key={c.id + c.name} b={c} size={size} />)}
    </ul>
  )
}

export default function PaymentBrandShowcase({ variant = "hero", id, place }: { variant?: ShowcaseVariant; id?: string; place?: TrustPlace }) {
  if (variant === "checkout" ? !paymentsEnabled() && !webpayAnnounced() : !webpayAnnounced()) return null

  // Pie de pagina: diseno C definitivo (aprobado), en vista previa y en el sitio publicado una vez anunciado Webpay.
  if (place === "footer") return <FooterC />

  // VISTA PREVIA local: tres propuestas visuales (A/B/C) con selector. En produccion previewMode() es false y se usa el diseno vigente.
  if (previewMode()) return <PaymentTrust place={place ?? (variant === "checkout" ? "checkout" : variant === "compact" ? "plans" : "home")} />

  if (variant === "compact") {
    return (
      <aside className="pb pb-compact" id={id} aria-label="Pagos con tarjeta">
        <span className="pb-lead">Paga con tarjeta</span>
        <Brands size="md" />
        <Methods />
        <Processor />
      </aside>
    )
  }

  if (variant === "checkout") {
    return (
      <aside className="pb pb-checkout" id={id} aria-label="Pagos con tarjeta">
        <Brands size="md" />
        <Methods />
        <p className="pb-trust"><Icon name="shield" /><span><strong>Pago seguro.</strong> {PAY_TRUST}</span></p>
        <Processor />
      </aside>
    )
  }

  return (
    <aside className="pb pb-hero" id={id} aria-label="Pagos con tarjeta">
      <Brands size="md" />
      <div className="pb-copy">
        <span className="pb-eyebrow">Paga con tarjeta · fácil, seguro y profesional</span>
        <h2 className="pb-title">{PAY_HEADLINE}</h2>
        <p className="pb-sub">{PAY_SUBTITLE}</p>
        <Methods />
      </div>
    </aside>
  )
}
