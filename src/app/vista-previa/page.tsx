import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { LEGAL_DOCS } from "@/lib/legal"
import { PREVIEW_ORDERS } from "@/lib/payments/preview-data"
import { previewMode } from "@/lib/preview"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Índice de la vista previa", robots: { index: false, follow: false } }

const SITE_ROUTES = [
  { href: "/", label: "Portada (franja de pagos bajo «Planes»)" },
  { href: "/planes", label: "Planes y precios" },
  { href: "/servicios", label: "Servicios" },
  { href: "/servicios/desarrollo-web", label: "Servicio: desarrollo web" },
  { href: "/servicios/ecommerce", label: "Servicio: ecommerce" },
]

export default function VistaPreviaPage() {
  if (!previewMode()) notFound() // en produccion esta ruta no existe
  const groups = [...new Set(PREVIEW_ORDERS.map((o) => o.group))]
  return (
    <section className="bd-section" style={{ paddingTop: 140 }}>
      <div className="bd-container">
        <p className="bd-eyebrow">Vista previa local</p>
        <h1 className="bd-h2">Índice de la experiencia de pago</h1>
        <p className="bd-lead">
          Datos ficticios: no se contacta a Transbank, no se guardan solicitudes y no se usan credenciales. El formulario de pago real lo aloja Transbank y no forma parte de este diseño.
        </p>

        <div className="pv-grid">
          <div>
            <h2>Sitio</h2>
            <ul>{SITE_ROUTES.map((r) => <li key={r.href}><Link href={r.href} prefetch={false}>{r.label}</Link> <code>{r.href}</code></li>)}</ul>
            <h2>Solicitud y cotización</h2>
            <ul>
              <li><Link href="/contratar?plan=profesional" prefetch={false}>Formulario de solicitud</Link> <code>/contratar?plan=profesional</code></li>
              <li><Link href="/orden" prefetch={false}>Consultar una orden</Link> <code>/orden</code></li>
            </ul>
          </div>
          <div>
            {groups.map((g) => (
              <div key={g}>
                <h2>{g}</h2>
                <ul>
                  {PREVIEW_ORDERS.filter((o) => o.group === g).map((o) => (
                    <li key={o.id}><Link href={`/orden/${o.id}`} prefetch={false}>{o.label}</Link> <code>/orden/{o.id}</code></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div>
            <h2>Páginas legales (borrador)</h2>
            <ul>
              <li><Link href="/legal" prefetch={false}>Índice legal</Link> <code>/legal</code></li>
              {LEGAL_DOCS.map((d) => <li key={d.href}><Link href={d.href} prefetch={false}>{d.title}</Link> <code>{d.href}</code></li>)}
            </ul>
            <h2>Pantalla de redirección</h2>
            <p className="bd-note left">En «Resumen previo al pago» (<code>/orden/DEMOCOTIZADA</code>) pulsa el botón de pago: se abre la simulación de la redirección a Webpay.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
