import type { Metadata } from "next"
import JsonLd from "@/components/seo/JsonLd"
import HeroStage from "@/components/hero/HeroStage"
import { ApiSection, Capabilities, HomeContact, InfraBand, Method, PlansTeaser, ProjectsShowcase, TechSection } from "@/components/home/blocks"
import { SITE, absoluteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: { absolute: "Desarrollo web y software a medida en Chile | Byd Light Solutions" },
  description:
    "Ingeniería de software y desarrollo web en Chile: plataformas, ecommerce, sistemas a medida, integraciones y automatización. Páginas web desde $149.990 + IVA.",
  alternates: { canonical: "/" },
}

export default function Home() {
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": absoluteUrl("/#service"),
    name: SITE.name,
    url: SITE.url,
    image: absoluteUrl(SITE.logo),
    areaServed: { "@type": "Country", name: "Chile" },
    description: SITE.description,
    provider: { "@id": absoluteUrl("/#organization") },
  }

  return (
    <>
      <JsonLd data={serviceLd} />
      <HeroStage />
      <Capabilities />
      <InfraBand />
      <ProjectsShowcase />
      <ApiSection />
      <Method />
      <TechSection />
      <PlansTeaser />
      <HomeContact />
    </>
  )
}
