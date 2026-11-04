"use client"

import Link from "next/link"
import { SITE } from "@/lib/site"

// Error inesperado de una pagina: mensaje en espanol, sin detalles tecnicos ni datos del error.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="bd-section bd-state-page" role="alert">
      <div className="bd-container">
        <p className="bd-eyebrow">Algo salió mal</p>
        <h1>No pudimos cargar esta página</h1>
        <p className="bd-lead">Fue un problema nuestro, no tuyo. Puedes intentarlo de nuevo o volver al inicio.</p>
        <div className="bd-state-actions">
          <button type="button" className="bd-btn bd-btn-primary" onClick={() => reset()}>Reintentar</button>
          <Link href="/" className="bd-btn bd-btn-ghost">Volver al inicio</Link>
        </div>
        <p className="bd-state-note">Si el problema continúa, escríbenos a {SITE.email}</p>
      </div>
    </section>
  )
}
