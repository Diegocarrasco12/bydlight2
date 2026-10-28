import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import JsonLd from "@/components/seo/JsonLd"
import PageHero from "@/components/layout/PageHero"
import { Faq, FinalCta } from "@/components/home/sections"
import { Photo } from "@/components/home/enterprise"
import { PLANS, planHref } from "@/lib/plans"
import { SERVICES, getService } from "@/lib/services"
import { SERVICE_EXTRAS, SERVICE_STEPS } from "@/lib/service-extras"
import { absoluteUrl } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const dynamicParams = false

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = getService(slug)
  if (!s) return {}
  return pageMetadata({ title: s.metaTitle, description: s.metaDescription, path: `/servicios/${s.slug}` })
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = getService(slug)
  if (!s) notFound()

  const plans = PLANS.filter((p) => s.planIds.includes(p.id))
  const priced = plans.filter((p) => p.priceFrom !== null)
  const url = absoluteUrl(`/servicios/${s.slug}`)
  const extra = SERVICE_EXTRAS[s.slug]
  const faqs = extra ? [...s.faq, ...extra.faqMore] : s.faq

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
    ],
  }

  return (
    <>
      <JsonLd data={ld} />
      <PageHero
        crumbs={[{ href: "/servicios", label: "Servicios" }, { label: s.name }]}
        eyebrow={s.line === "web" ? "Desarrollo web" : s.line === "empresa" ? "Soluciones empresariales" : "Ingeniería y software a medida"}
        title={s.name}
        lead={s.intro}
      />

      {s.photo && (
        <div className="bd-container sv-photo-wrap">
          <figure className="sv-photo">
            <Photo photo={s.photo} sizes="(max-width: 1240px) 100vw, 1192px" eager />
            <figcaption>Imagen ilustrativa · Pexels</figcaption>
          </figure>
        </div>
      )}

      {s.benefits && (
        <section className="bd-section sv-benefits" aria-label="Beneficios">
          <div className="bd-container">
            <ul className="sv-ben-grid">
              {s.benefits.map((b, i) => (
                <li key={b.t} className="sv-ben">
                  <span aria-hidden="true">0{i + 1}</span>
                  <h2>{b.t}</h2>
                  <p>{b.d}</p>
                </li>
              ))}
            </ul>
            {s.scopeNote && <p className="sv-scope"><b>Alcance:</b> {s.scopeNote}</p>}
          </div>
        </section>
      )}

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
            {extra && (
              <>
                <section>
                  <h2>Enfoque y tecnologías</h2>
                  <ul>{extra.approach.map((d) => <li key={d}>{d}</li>)}</ul>
                </section>
                <section>
                  <h2>Cómo trabajamos</h2>
                  <ol>{SERVICE_STEPS.map(([t, d]) => <li key={t}><b>{t}.</b> {d}</li>)}</ol>
                </section>
                <section>
                  <h2>Qué necesitamos para cotizar</h2>
                  <ul>{extra.quoteInfo.map((d) => <li key={d}>{d}</li>)}</ul>
                  <p>Si aún no tienes todo claro, no hay problema: <Link href="/contacto">cuéntanos tu caso</Link> y lo definimos juntos.</p>
                </section>
                <section>
                  <h2>Servicios relacionados</h2>
                  <ul>
                    {extra.related.map((slug) => {
                      const r = getService(slug)
                      return r ? <li key={slug}><Link href={`/servicios/${r.slug}`}>{r.name}</Link>: {r.short}</li> : null
                    })}
                  </ul>
                </section>
              </>
            )}
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

      <Faq items={faqs} title={`Preguntas sobre ${s.name.toLowerCase().replace(/erp/, "ERP").replace(/saas/, "SaaS")}`} />
      <FinalCta />
    </>
  )
}
