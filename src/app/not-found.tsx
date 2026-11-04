import type { Metadata } from "next"
import Link from "next/link"
import { SITE, whatsappLink } from "@/lib/site"

// Pagina 404 comun a todo el sitio. Tambien la ven las rutas reservadas (p. ej. /orden) mientras Webpay esta apagado:
// no revela si la ruta existe ni menciona pagos.
export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <section className="bd-section bd-state-page">
      <div className="bd-container">
        <p className="bd-eyebrow">Error 404</p>
        <h1>No encontramos esa página</h1>
        <p className="bd-lead">
          El enlace puede estar incompleto o la página ya no existe. Desde aquí puedes volver al inicio o contarnos qué estabas buscando.
        </p>
        <div className="bd-state-actions">
          <Link href="/" className="bd-btn bd-btn-primary">Volver al inicio</Link>
          <Link href="/servicios" className="bd-btn bd-btn-ghost">Ver servicios</Link>
          <a
            href={whatsappLink("Hola, no encontré una página del sitio de Byd Light Solutions.")}
            className="bd-btn bd-btn-ghost"
            target="_blank"
            rel="noopener noreferrer"
          >
            Escribir por WhatsApp
          </a>
        </div>
        <p className="bd-state-note">Escríbenos a {SITE.email}</p>
      </div>
    </section>
  )
}
