import type { Metadata } from "next"
import Link from "next/link"
import Contact from "@/components/contact/Contact"
import JsonLd from "@/components/seo/JsonLd"
import {
  Faq,
  HomeHero,
  PlansGrid,
  ProcessSteps,
  PortfolioPreview,
  ServicesGrid,
  TwoLines,
} from "@/components/home/sections"
import { PLANS_FAQ } from "@/lib/plans"
import { SITE, absoluteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: { absolute: "Desarrollo web y software a medida en Chile | Byd Light Solutions" },
  description:
    "Páginas web desde $149.990 + IVA, ecommerce y software a medida para emprendedores, pymes y empresas en Chile. Planes con alcance, revisiones y plazos definidos.",
  alternates: { canonical: "/" },
}

export default function Home() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PLANS_FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
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
      <JsonLd data={faqLd} />
      <HomeHero />
      <PlansGrid />
      <div className="bd-container" style={{ textAlign: "center", paddingBottom: 56 }}>
        <Link href="/planes#comparativa" prefetch={false} className="bd-btn bd-btn-ghost">
          Ver comparativa completa de planes
        </Link>
      </div>
      <TwoLines />
      <ServicesGrid />
      <PortfolioPreview />
      <ProcessSteps />
      <Faq items={PLANS_FAQ} />
      <Contact />
    </>
  )
}
