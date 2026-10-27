import type { Metadata } from "next"
import Link from "next/link"
import { FinalCta, ServicesGrid } from "@/components/home/sections"

export const metadata: Metadata = {
  title: "Servicios de desarrollo web, software a medida y arquitectura",
  description:
    "Desarrollo de páginas web y ecommerce, software a medida, arquitectura de software, integraciones y automatización para empresas en Chile.",
  alternates: { canonical: "/servicios" },
  openGraph: { url: "/servicios" },
}

export default function ServiciosPage() {
  return (
    <>
      <section className="bd-page-hero">
        <div className="bd-container">
          <nav className="bd-crumbs" aria-label="Migas de pan">
            <Link href="/" prefetch={false}>Inicio</Link> / Servicios
          </nav>
          <h1>Servicios de desarrollo de software y web</h1>
          <p className="bd-lead">
            Desde un sitio web con precio definido hasta sistemas empresariales con cotización personalizada.
          </p>
        </div>
      </section>
      <ServicesGrid />
      <FinalCta />
    </>
  )
}
