import Link from "next/link"
import { PAYMENT_LOGOS_LIGHT, webpayAnnounced } from "@/lib/payments/availability"
import CtaTrust from "./CtaTrust"

/**
 * Seccion comercial «pago seguro» de la portada (bajo los planes). Solo logotipos oficiales de Webpay Plus y Transbank
 * (autorizados por escrito), version «positivo» sobre placa blanca neutra para conservar sus colores. Sin marcas de tarjeta.
 * Solo se renderiza cuando Webpay se anuncia (webpayAnnounced); no cambia el acceso piloto ni crea accesos nuevos.
 *
 * Veracidad del mensaje: el numero completo y el codigo de seguridad se ingresan en Webpay (Transbank); Bydlight solo recibe
 * del resultado los ultimos 4 digitos para el comprobante (service.ts / store.ts: card_last4). Por eso se afirma «no solicita ni
 * almacena el numero completo ni el codigo de seguridad», y no «ningun dato de tu tarjeta».
 */
const WP = PAYMENT_LOGOS_LIGHT.webpay
const TB = PAYMENT_LOGOS_LIGHT.transbank

const STEPS = ["Solicitas tu cotización", "La revisamos y aprobamos", "Pagas el anticipo en Webpay"]

export default function SecurePaySection() {
  if (!webpayAnnounced()) return null
  return (
    <section className="sp rv" id="pagos-seguros" aria-labelledby="sp-title">
      <div className="sp-copy">
        <span className="sp-eyebrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l7 3v5.5c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" />
          </svg>
          Pagos seguros
        </span>
        <h2 id="sp-title" className="sp-title">Tu proyecto merece <em>un pago seguro.</em></h2>
        <p className="sp-lead">
          En Bydlight Solutions puedes pagar el anticipo de tu proyecto mediante Webpay Plus de Transbank, una vez aprobada tu cotización.
        </p>
        <ol className="sp-steps" aria-label="Cómo se paga">
          {STEPS.map((t, i) => <li key={t}><span>{i + 1}</span>{t}</li>)}
        </ol>
        <Link href="/contratar" prefetch={false} className="bd-btn bd-btn-primary sp-cta">Solicitar cotización</Link>
        <CtaTrust className="sp-cta-trust" />
      </div>
      <div className="sp-plate">
        <div className="sp-card">
          <img src={WP.src} srcSet={WP.srcSet} sizes="(max-width: 640px) 240px, 300px" alt={WP.alt} width={WP.width} height={WP.height} loading="lazy" decoding="async" />
          <hr />
          <span className="sp-by">Procesado por</span>
          <img className="sp-tb" src={TB.src} srcSet={TB.srcSet} sizes="150px" alt={TB.alt} width={TB.width} height={TB.height} loading="lazy" decoding="async" />
        </div>
        <p className="sp-note">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          <span>El pago se completa en el entorno seguro de Transbank. Bydlight no solicita ni almacena el número completo ni el código de seguridad de tu tarjeta.</span>
        </p>
      </div>
    </section>
  )
}
