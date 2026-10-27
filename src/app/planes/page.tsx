import type { Metadata } from "next"
import JsonLd from "@/components/seo/JsonLd"
import PageHero from "@/components/layout/PageHero"
import { Faq, FinalCta, MaintenanceBlock, PlanComparison, PlansGrid } from "@/components/home/sections"
import { PLANS, PLANS_FAQ } from "@/lib/plans"
import { absoluteUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "Planes y precios de páginas web, ecommerce y software",
  description:
    "Planes de desarrollo web en Chile: Emprendedor desde $149.990, Web Profesional desde $299.990, Web Empresa desde $499.990 y Ecommerce desde $699.990, más IVA. Software a medida con cotización.",
  alternates: { canonical: "/planes" },
  openGraph: { url: "/planes", title: "Planes y precios | Byd Light Solutions" },
}

export default function PlanesPage() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OfferCatalog",
        name: "Planes de desarrollo web y software",
        url: absoluteUrl("/planes"),
        itemListElement: PLANS.filter((p) => p.priceFrom !== null).map((p) => ({
          "@type": "Offer",
          name: p.name,
          description: p.tagline,
          priceSpecification: {
            "@type": "PriceSpecification",
            minPrice: p.priceFrom,
            priceCurrency: "CLP",
            valueAddedTaxIncluded: false,
          },
          seller: { "@id": absoluteUrl("/#organization") },
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: PLANS_FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Planes y precios", item: absoluteUrl("/planes") },
        ],
      },
    ],
  }

  return (
    <>
      <JsonLd data={ld} />
      <PageHero
        crumbs={[{ label: "Planes y precios" }]}
        eyebrow="Planes y precios"
        title={<>Sitios con alcance <span>y precio definidos</span></>}
        lead="Cada plan indica páginas, revisiones y plazos por escrito. Para proyectos más complejos, cotización a medida."
      />
      <PlansGrid showHead={false} />
      <PlanComparison />
      <MaintenanceBlock />
      <Faq items={PLANS_FAQ} />
      <FinalCta />
    </>
  )
}
