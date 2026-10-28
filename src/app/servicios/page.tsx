import type { Metadata } from "next"
import PageHero from "@/components/layout/PageHero"
import { FinalCta } from "@/components/home/sections"
import { ServicesByCategory } from "@/components/home/enterprise"

export const metadata: Metadata = {
  title: "Servicios: ERP, SaaS, software a medida y desarrollo web",
  description:
    "Soluciones ERP y SaaS, software a medida, arquitectura, integraciones, automatización, páginas web y ecommerce para empresas en Chile.",
  alternates: { canonical: "/servicios" },
  openGraph: { url: "/servicios" },
}

export default function ServiciosPage() {
  return (
    <>
      <PageHero
        crumbs={[{ label: "Servicios" }]}
        eyebrow="Servicios"
        title={<>Software y web, <span>de la idea a producción</span></>}
        lead="Desde un sitio con precio definido hasta ERP, plataformas SaaS y sistemas empresariales con cotización a medida."
      />
      <ServicesByCategory />
      <FinalCta />
    </>
  )
}
