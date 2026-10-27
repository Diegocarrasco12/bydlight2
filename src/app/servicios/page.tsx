import type { Metadata } from "next"
import PageHero from "@/components/layout/PageHero"
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
      <PageHero
        crumbs={[{ label: "Servicios" }]}
        eyebrow="Servicios"
        title={<>Software y web, <span>de la idea a producción</span></>}
        lead="Desde un sitio con precio definido hasta sistemas empresariales con cotización a medida."
      />
      <ServicesGrid />
      <FinalCta />
    </>
  )
}
