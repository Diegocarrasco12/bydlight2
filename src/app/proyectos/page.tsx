import type { Metadata } from "next"
import Link from "next/link"
import { FinalCta } from "@/components/home/sections"
import { DesktopShowcase, PortfolioFeatured, PortfolioGrid } from "@/components/portfolio/Portfolio"

export const metadata: Metadata = {
  title: "Portafolio de proyectos web y software",
  description:
    "Proyectos reales de Byd Light Solutions: ecommerce Only Energy, plataforma de empleabilidad del CFT de Magallanes, sitios corporativos y software de escritorio para Windows.",
  alternates: { canonical: "/proyectos" },
  openGraph: { url: "/proyectos" },
}

export default function ProyectosPage() {
  return (
    <>
      <section className="bd-page-hero">
        <div className="bd-container">
          <nav className="bd-crumbs" aria-label="Migas de pan">
            <Link href="/" prefetch={false}>Inicio</Link> / Proyectos
          </nav>
          <h1>Portafolio de proyectos</h1>
          <p className="bd-lead">
            Tiendas online, plataformas y sitios en producción, además de nuestras capacidades en software de escritorio.
          </p>
        </div>
      </section>

      <section className="bd-section" aria-label="Proyecto destacado">
        <div className="bd-container">
          <PortfolioFeatured />
        </div>
      </section>

      <section className="bd-section bd-section-alt" aria-labelledby="more-title">
        <div className="bd-container">
          <div className="bd-head">
            <h2 id="more-title" className="bd-h2">Más proyectos</h2>
          </div>
          <PortfolioGrid />
        </div>
      </section>

      <DesktopShowcase />
      <FinalCta title="¿Quieres un proyecto como estos?" />
    </>
  )
}
