import type { ReactNode } from "react"
import PageHero from "@/components/layout/PageHero"

/** Marca un dato que el titular debe decidir. Nunca se presenta como definitivo. */
export function Pend({ children }: { children: ReactNode }) {
  return <span className="bd-pending">[PENDIENTE: {children}]</span>
}

export default function LegalPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <>
      <PageHero crumbs={[{ label: title }]} eyebrow="Información legal" title={title} lead={lead} />
      <section className="bd-section">
        <div className="bd-container bd-legal">
          <p className="bd-draft-banner" role="note">
            <strong>BORRADOR — pendiente de aprobación.</strong> Este texto aún no es vigente ni ha sido revisado por el titular o un
            asesor legal. Los datos marcados como <Pend>decisión</Pend> deben completarse antes de publicar.
          </p>
          {children}
        </div>
      </section>
    </>
  )
}
