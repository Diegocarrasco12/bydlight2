import type { Metadata } from "next"
import Link from "next/link"
import BgVideo from "@/components/media/BgVideo"
import { PortfolioPreview } from "@/components/home/sections"
import JsonLd from "@/components/seo/JsonLd"
import { SITE, absoluteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Byd Light Solutions: desarrollo web y software a medida con más de 13 años de experiencia en operaciones reales. Cómo trabajamos y qué podemos hacer por tu negocio.",
  alternates: { canonical: "/nosotros" },
}

const STEPS = [
  ["Analizamos", "Entendemos tu necesidad y detectamos el problema real antes de proponer nada."],
  ["Diseñamos", "Definimos una solución clara, eficiente y escalable, con alcance y plazos."],
  ["Desarrollamos", "Construimos el sitio, sistema o plataforma con revisiones durante el proceso."],
  ["Implementamos", "Publicamos, medimos y optimizamos en producción."],
] as const

export default function NosotrosPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: absoluteUrl("/nosotros"),
    name: "Nosotros | Byd Light Solutions",
    about: { "@id": absoluteUrl("/#organization") },
  }
  return (
    <>
      <JsonLd data={ld} />
      <section className="bd-pagehero">
        <BgVideo className="bd-pagehero-video bd-portrait" src="/videos/hero7.mp4" poster="/img/posters/hero7.webp" />
        <div className="bd-pagehero-shade" />
        <div className="bd-container bd-pagehero-body">
          <span className="bd-eyebrow">Nosotros</span>
          <h1>Construimos soluciones <span>reales</span></h1>
          <p>Tecnología aplicada a resultados: sitios web, plataformas y software a medida.</p>
        </div>
      </section>

      <section className="bd-section">
        <div className="bd-container bd-two">
          <div>
            <h2 className="bd-h2">Quiénes somos</h2>
            <p className="bd-lead">
              En {SITE.name} creamos soluciones digitales enfocadas en resolver problemas reales: desde sistemas
              empresariales hasta sitios y plataformas web, con un enfoque práctico, eficiente y orientado a resultados.
            </p>
          </div>
          <div>
            <h2 className="bd-h2">Experiencia</h2>
            <p className="bd-lead">
              Más de 13 años trabajando en operaciones reales: desarrollando soluciones para empresas, automatizando
              procesos y optimizando sistemas.
            </p>
            <ul className="bd-checks" style={{ marginTop: 16 }}>
              <li>Sistemas en producción</li>
              <li>Experiencia en terreno</li>
              <li>Soluciones reales</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bd-section bd-section-alt">
        <div className="bd-container">
          <div className="bd-head center">
            <h2 className="bd-h2">Cómo trabajamos</h2>
          </div>
          <ol className="bd-steps" style={{ marginTop: 40 }}>
            {STEPS.map(([t, d]) => (
              <li key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <PortfolioPreview />

      <section className="bd-section">
        <div className="bd-container">
          <div className="bd-cta bd-cta-video">
            <BgVideo className="bd-cta-bg" src="/videos/hero2.mp4" poster="/img/posters/hero2.webp" />
            <div className="bd-cta-inner">
              <h2>¿Tienes un proyecto en mente?</h2>
              <p>Hablemos y construyamos algo real.</p>
              <div className="bd-hero-actions">
                <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary">Solicitar asesoría</Link>
                <Link href="/planes" prefetch={false} className="bd-btn bd-btn-ghost">Ver planes y precios</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
