import type { Metadata } from "next"
import Link from "next/link"
import PageHero from "@/components/layout/PageHero"
import { LEGAL_DOCS, LEGAL_PAGES_PUBLISHED, requireLegalVisible } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Información legal",
  robots: { index: false, follow: false },
}

export default function LegalIndexPage() {
  requireLegalVisible()
  return (
    <>
      <PageHero
        crumbs={[{ label: "Información legal" }]}
        eyebrow="Información legal"
        title="Información legal y condiciones"
        lead="Términos, medios de pago, devoluciones, privacidad y soporte de Bydlight Solutions SpA."
      />
      <section className="bd-section">
        <div className="bd-container">
          {!LEGAL_PAGES_PUBLISHED && (
            <p className="bd-draft-banner" role="note">
              <strong>BORRADOR — pendiente de aprobación.</strong> Estas páginas no son públicas: solo se ven en la vista previa local.
            </p>
          )}
          <ul className="lg-cards">
            {LEGAL_DOCS.map((d) => (
              <li key={d.href}>
                <Link href={d.href} prefetch={false} className="lg-card">
                  <strong>{d.title}</strong>
                  <span>{d.short}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
