import type { Metadata } from "next"
import PageHero from "@/components/layout/PageHero"
import { FinalCta } from "@/components/home/sections"
import { ServicesByCategory } from "@/components/home/enterprise"
import JsonLd from "@/components/seo/JsonLd"
import { breadcrumbLd, pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Servicios de software y desarrollo web",
  description:
    "Soluciones ERP y SaaS, software a medida, arquitectura, integraciones, automatización, páginas web y ecommerce para empresas en Chile.",
  path: "/servicios",
})

export default function ServiciosPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [breadcrumbLd([{ name: "Servicios", path: "/servicios" }])] }} />
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
