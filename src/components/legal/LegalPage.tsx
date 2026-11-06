import Link from "next/link"
import type { ReactNode } from "react"
import PageHero from "@/components/layout/PageHero"
import { LEGAL_DOCS, LEGAL_PAGES_PUBLISHED } from "@/lib/legal"

/**
 * Marca un dato que el titular debe decidir. Nunca se presenta como definitivo.
 * Con las paginas publicadas (LEGAL_PAGES_PUBLISHED = true) lanza un error: no se pueden publicar marcadores.
 */
export function Pend({ children }: { children: ReactNode }) {
  if (LEGAL_PAGES_PUBLISHED) {
    throw new Error("Dato legal [PENDIENTE] en una pagina publicada: completar el texto antes de publicar.")
  }
  return <span className="bd-pending">[PENDIENTE: {children}]</span>
}

export default function LegalPage({
  title,
  lead,
  path,
  children,
}: {
  title: string
  lead: string
  /** Ruta de esta pagina (para marcar el menu lateral). */
  path?: string
  children: ReactNode
}) {
  return (
    <>
      <PageHero crumbs={[{ href: "/legal", label: "Información legal" }, { label: title }]} eyebrow="Información legal" title={title} lead={lead} />
      <section className="bd-section">
        <div className="bd-container lg-wrap">
          <nav className="lg-nav" aria-label="Documentos legales">
            <p className="lg-nav-title">Documentos</p>
            <ul>
              {LEGAL_DOCS.map((d) => (
                <li key={d.href}>
                  <Link href={d.href} prefetch={false} aria-current={d.href === path ? "page" : undefined}>{d.title}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <article className="bd-legal">
            {!LEGAL_PAGES_PUBLISHED && (
              <p className="bd-draft-banner" role="note">
                <strong>BORRADOR — pendiente de revisión legal y aprobación del titular.</strong> Este texto aún no es vigente. No constituye asesoría jurídica ni certificación de cumplimiento normativo.
              </p>
            )}
            {children}
          </article>
        </div>
      </section>
    </>
  )
}
