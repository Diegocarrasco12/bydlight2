import type { Metadata } from "next"
import { pageMetadata } from "@/lib/seo"
import { notFound } from "next/navigation"
import Link from "next/link"
import PageHero from "@/components/layout/PageHero"
import JsonLd from "@/components/seo/JsonLd"
import { FinalCta } from "@/components/home/sections"
import { AppFrame, BrowserFrame } from "@/components/portfolio/Frames"
import { Tech } from "@/components/portfolio/Portfolio"
import { PROJECTS } from "@/lib/portfolio"
import { absoluteUrl } from "@/lib/site"

export const dynamicParams = false

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }))
}

const find = (slug: string) => PROJECTS.find((p) => p.slug === slug)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = find(slug)
  if (!p) return {}
  return pageMetadata({ title: `${p.name}: ${p.kind.toLowerCase()}`, description: p.summary, path: `/proyectos/${p.slug}` })
}

function hostOf(url?: string) {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : ""
  } catch {
    return ""
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = find(slug)
  if (!p) notFound()
  const url = absoluteUrl(`/proyectos/${p.slug}`)
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Proyectos", item: absoluteUrl("/proyectos") },
          { "@type": "ListItem", position: 3, name: p.name, item: url },
        ],
      },
    ],
  }

  return (
    <>
      <JsonLd data={ld} />
      <PageHero
        crumbs={[{ href: "/proyectos", label: "Proyectos" }, { label: p.name }]}
        eyebrow={p.demo ? "Demostración de capacidades" : p.kind}
        title={p.name}
        lead={p.summary}
      >
        <div className="ph-actions">
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-primary">Visitar sitio</a>
          )}
          <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-ghost">Quiero algo así</Link>
        </div>
      </PageHero>

      <section className="bd-section showcase">
        <div className="bd-container">
          {p.demo && (
            <p className="bd-note left">Aplicación de demostración creada por Byd Light con datos ficticios; no es un proyecto de un cliente.</p>
          )}
          <div className="gallery">
            {p.images.map((i, k) => (
              <div key={i.src} className={`gallery-item${k === 0 ? " first" : ""}`}>
                {p.demo ? <AppFrame image={i} title={p.name} /> : <BrowserFrame image={i} url={hostOf(p.url)} priority={k === 0} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bd-section" aria-labelledby="det-title">
        <div className="bd-container two-col">
          <div>
            <h2 id="det-title" className="bd-h2">Qué incluye</h2>
            <ul className="bd-checks">
              {p.verified.map((v) => <li key={v}>{v}</li>)}
            </ul>
          </div>
          {p.tech.length > 0 && (
            <div>
              <h2 className="bd-h2">Tecnologías</h2>
              <Tech tech={p.tech} />
            </div>
          )}
        </div>
      </section>

      <FinalCta title="¿Tienes un proyecto en mente?" />
    </>
  )
}
