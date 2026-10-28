import type { Metadata } from "next"
import Link from "next/link"
import PageHero from "@/components/layout/PageHero"
import JsonLd from "@/components/seo/JsonLd"
import { Method, ProjectsShowcase } from "@/components/home/blocks"
import { FinalCta } from "@/components/home/sections"
import { Photo } from "@/components/home/enterprise"
import { PHOTOS } from "@/lib/services"
import { SITE, absoluteUrl } from "@/lib/site"
import { breadcrumbLd, pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Nosotros: ingeniería de software en Chile",
  description:
    "Ingeniería de software y desarrollo web con más de 13 años de experiencia en operaciones reales. Cómo trabajamos y qué podemos hacer por tu negocio.",
  path: "/nosotros",
})

export default function NosotrosPage() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        url: absoluteUrl("/nosotros"),
        name: "Nosotros | Byd Light Solutions",
        inLanguage: "es-CL",
        about: { "@id": absoluteUrl("/#organization") },
      },
      breadcrumbLd([{ name: "Nosotros", path: "/nosotros" }]),
    ],
  }
  return (
    <>
      <JsonLd data={ld} />
      <PageHero
        crumbs={[{ label: "Nosotros" }]}
        eyebrow="Nosotros"
        title={<>Ingenieros que <span>construyen producto</span></>}
        lead={`${SITE.name} convierte problemas de negocio en software que funciona: sitios, plataformas y sistemas a medida.`}
      />

      <section className="bd-section" aria-labelledby="exp-title">
        <div className="bd-container about">
          <div className="about-fig rv" aria-hidden="true">
            <b>13+</b>
            <span>años en operaciones reales</span>
          </div>
          <div className="about-copy rv">
            <h2 id="exp-title" className="bd-h2">Experiencia que viene del terreno</h2>
            <p className="bd-lead">
              Trabajamos desde hace más de 13 años en operaciones reales: desarrollando soluciones para empresas,
              automatizando procesos y optimizando sistemas. Esa experiencia es la que aplicamos a cada proyecto.
            </p>
            <ul className="bd-checks">
              <li>Sistemas en producción</li>
              <li>Experiencia en terreno</li>
              <li>Soluciones reales, no plantillas</li>
            </ul>
            <p className="bd-note left">
              <Link href="/proyectos" prefetch={false}>Mira los proyectos publicados</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="bd-section nos-photo" aria-label="Cómo trabajamos">
        <div className="bd-container">
          <figure className="sv-photo rv">
            <Photo photo={PHOTOS.equipo} sizes="(max-width: 1240px) 100vw, 1192px" />
            <figcaption>Imagen ilustrativa · Pexels. No corresponde a personas ni oficinas de Byd Light Solutions.</figcaption>
          </figure>
        </div>
      </section>

      <Method />
      <ProjectsShowcase />
      <FinalCta title="Construyamos algo real" />
    </>
  )
}
