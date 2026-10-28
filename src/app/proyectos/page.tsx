import type { Metadata } from "next"
import PageHero from "@/components/layout/PageHero"
import { FinalCta } from "@/components/home/sections"
import { DesktopShowcase, ProjectFeature, ProjectGrid } from "@/components/portfolio/Portfolio"
import JsonLd from "@/components/seo/JsonLd"
import { breadcrumbLd, pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Portafolio de proyectos web y software",
  description:
    "Proyectos reales de Byd Light Solutions: ecommerce Only Energy, plataforma de empleabilidad del CFT de Magallanes, sitios corporativos y software para Windows.",
  path: "/proyectos",
})

export default function ProyectosPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [breadcrumbLd([{ name: "Proyectos", path: "/proyectos" }])] }} />
      <PageHero
        crumbs={[{ label: "Proyectos" }]}
        eyebrow="Portafolio"
        title={<>Proyectos que <span>ya están en producción</span></>}
        lead="Tiendas, plataformas y sitios que puedes visitar, más nuestras capacidades en software de escritorio."
      />
      <section className="bd-section showcase bd-light" aria-labelledby="feat-title">
        <div className="bd-container">
          <h2 id="feat-title" className="sr-only">Proyecto destacado</h2>
          <ProjectFeature />
        </div>
      </section>
      <section className="bd-section" aria-labelledby="more-title">
        <div className="bd-container">
          <div className="bd-head">
            <h2 id="more-title" className="bd-h2">Más proyectos</h2>
          </div>
          <ProjectGrid />
        </div>
      </section>
      <DesktopShowcase />
      <FinalCta title="¿Quieres un proyecto como estos?" />
    </>
  )
}
