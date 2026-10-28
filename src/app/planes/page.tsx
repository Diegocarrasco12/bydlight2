import type { Metadata } from "next"
import JsonLd from "@/components/seo/JsonLd"
import PageHero from "@/components/layout/PageHero"
import { Faq, FinalCta, MaintenanceBlock, PlanComparison, PlansGrid } from "@/components/home/sections"
import { PLANS, PLANS_FAQ } from "@/lib/plans"
import { absoluteUrl } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Planes y precios de páginas web",
  description:
    "Planes de desarrollo web en Chile: Emprendedor desde $149.990, Profesional $299.990, Empresa $499.990 y Ecommerce $699.990, más IVA. Software a medida a cotizar.",
  path: "/planes",
})

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
