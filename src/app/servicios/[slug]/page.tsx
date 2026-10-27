import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import JsonLd from "@/components/seo/JsonLd"
import { Faq, FinalCta } from "@/components/home/sections"
import { PLANS, planHref } from "@/lib/plans"
import { SERVICES, getService } from "@/lib/services"
import { absoluteUrl } from "@/lib/site"

export const dynamicParams = false

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = getService(slug)
  if (!s) return {}
  return {
    title: s.metaTitle,
    description: s.metaDescription,
    alternates: { canonical: `/servicios/${s.slug}` },
    openGraph: {
      url: `/servicios/${s.slug}`,
      title: `${s.metaTitle} | Byd Light Solutions`,
      description: s.metaDescription,
    },
  }
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = getService(slug)
  if (!s) notFound()

  const plans = PLANS.filter((p) => s.planIds.includes(p.id))
  const priced = plans.filter((p) => p.priceFrom !== null)
  const url = absoluteUrl(`/servicios/${s.slug}`)

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: s.name,
        description: s.metaDescription,
        url,
        serviceType: s.name,
        areaServed: { "@type": "Country", name: "Chile" },
        provider: { "@id": absoluteUrl("/#organization") },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Servicios", item: absoluteUrl("/servicios") },
          { "@type": "ListItem", position: 3, name: s.name, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: s.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  }

  return (
    <>
      <JsonLd data={ld} />
      <section className="bd-page-hero">
        <div className="bd-container">
          <nav className="bd-crumbs" aria-label="Migas de pan">
            <Link href="/" prefetch={false}>Inicio</Link> /{" "}
            <Link href="/servicios" prefetch={false}>Servicios</Link> / {s.name}
          </nav>
          <span className="bd-eyebrow">{s.line === "web" ? "Desarrollo web" : "Ingeniería y software a medida"}</span>
          <h1>{s.name}</h1>
          <p className="bd-lead">{s.intro}</p>
        </div>
      </section>

      <section className="bd-section">
        <div className="bd-container bd-prose">
          <div>
            <section>
              <h2>Problemas que resolvemos</h2>
              <ul>{s.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </section>
            <section>
              <h2>Qué entregamos</h2>
              <ul>{s.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
            </section>
            <section>
              <h2>Ideal para</h2>
              <ul>{s.fitsFor.map((d) => <li key={d}>{d}</li>)}</ul>
            </section>
          </div>

          <aside className="bd-aside" aria-label="Cotizar este servicio">
            <h2>{priced.length ? `Desde ${priced[0].priceLabel} + IVA` : "Cotización personalizada"}</h2>
            <p>
              {priced.length
                ? "Valores referenciales en CLP. El alcance exacto se confirma en la cotización."
                : "El valor depende del alcance. Te respondemos con una propuesta clara."}
            </p>
            {priced.map((p) => (
              <Link
                key={p.id}
                href={planHref(p.id)}
                prefetch={false}
                className={`bd-btn ${p.recommended ? "bd-btn-primary" : "bd-btn-ghost"}`}
              >
                {p.name} · desde {p.priceLabel} + IVA
              </Link>
            ))}
            <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-ghost">Solicitar cotización</Link>
            <Link href="/planes" prefetch={false} className="bd-btn bd-btn-ghost">Ver todos los planes</Link>
          </aside>
        </div>
      </section>

      <Faq items={s.faq} title={`Preguntas sobre ${s.name.toLowerCase()}`} />
      <FinalCta />
    </>
  )
}
