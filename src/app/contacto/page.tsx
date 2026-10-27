import type { Metadata } from "next"
import Link from "next/link"
import BgVideo from "@/components/media/BgVideo"
import ContactForm from "@/components/contact/ContactForm"
import JsonLd from "@/components/seo/JsonLd"
import { SITE, absoluteUrl, whatsappLink } from "@/lib/site"

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Cuéntanos tu proyecto web o de software a medida. Respondemos por correo o WhatsApp con una propuesta clara y sin compromiso.",
  alternates: { canonical: "/contacto" },
}

export default function ContactoPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: absoluteUrl("/contacto"),
    name: "Contacto Byd Light Solutions",
    about: { "@id": absoluteUrl("/#organization") },
  }
  return (
    <>
      <JsonLd data={ld} />
      <section className="bd-pagehero">
        <BgVideo className="bd-pagehero-video" src="/videos/hero4.mp4" poster="/img/posters/hero4.webp" />
        <div className="bd-pagehero-shade" />
        <div className="bd-container bd-pagehero-body">
          <span className="bd-eyebrow">Contacto</span>
          <h1>Hablemos de tu <span>proyecto</span></h1>
          <p>Cuéntanos qué necesitas. Analizamos tu caso y te proponemos una solución clara, sin compromiso.</p>
        </div>
      </section>

      <section className="bd-section">
        <div className="bd-container bd-contact-grid">
          <div className="bd-contact-info">
            <h2 className="bd-h2">Cuéntanos lo que necesitas</h2>
            <ul className="bd-checks">
              <li>Respuesta por correo o WhatsApp</li>
              <li>Cotización sin compromiso</li>
              <li>Planes con alcance y plazos definidos</li>
            </ul>
            <div className="bd-contact-ways">
              <a className="bd-btn bd-btn-primary" href={whatsappLink("Hola, quiero cotizar un proyecto con Byd Light Solutions.")} target="_blank" rel="noopener noreferrer">
                Escribir por WhatsApp
              </a>
              <a className="bd-btn bd-btn-ghost" href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </div>
            <p className="bd-note" style={{ textAlign: "left" }}>
              ¿Ya sabes qué plan necesitas? <Link href="/planes" prefetch={false}>Mira los planes y precios</Link>.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
