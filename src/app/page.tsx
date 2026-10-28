import type { Metadata } from "next"
import JsonLd from "@/components/seo/JsonLd"
import HeroNetwork from "@/components/hero/HeroNetwork"
import { ApiSection, Capabilities, HomeContact, InfraBand, Method, PlansTeaser, ProjectsShowcase, TechSection } from "@/components/home/blocks"
import { EnterpriseBand } from "@/components/home/enterprise"
import { SITE, absoluteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: { absolute: "Desarrollo web y software a medida en Chile | Byd Light Solutions" },
  description:
    "Ingeniería de software en Chile: soluciones ERP y SaaS, integraciones y APIs, sistemas a medida, ecommerce y automatización. Páginas web desde $149.990 + IVA.",
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
      <HeroNetwork />
      <EnterpriseBand />
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
