import type { Metadata } from "next"
import Link from "next/link"
import PageHero from "@/components/layout/PageHero"
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
      <PageHero
        crumbs={[{ label: "Contacto" }]}
        eyebrow="Contacto"
        title={<>Hablemos de tu <span>proyecto</span></>}
        lead="Cuéntanos qué necesitas. Analizamos tu caso y te proponemos una solución clara, sin compromiso."
      />

      <section className="bd-section">
        <div className="bd-container bd-contact-grid">
          <div className="bd-contact-info">
            <h2 className="bd-h2">Elige cómo prefieres escribirnos</h2>
            <a
              className="way way-wa"
              href={whatsappLink("Hola, quiero cotizar un proyecto con Byd Light Solutions.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>WhatsApp</span>
              <strong>{SITE.whatsappDisplay}</strong>
            </a>
            <a className="way" href={`mailto:${SITE.email}`}>
              <span>Correo</span>
              <strong>{SITE.email}</strong>
            </a>
            <ul className="bd-checks">
              <li>Respuesta por correo o WhatsApp</li>
              <li>Cotización sin compromiso</li>
              <li>Alcance y plazos por escrito</li>
            </ul>
            <p className="bd-note left">
              ¿Ya sabes qué plan necesitas? <Link href="/planes" prefetch={false}>Mira los planes y precios</Link>.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
