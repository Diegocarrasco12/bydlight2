import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import ContractForm from "@/components/checkout/ContractForm"
import { paymentsEnabled } from "@/lib/payments/config"
import { storageWritable } from "@/lib/payments/store"
import { PLANS, PRICE_NOTE } from "@/lib/plans"
import { whatsappLink } from "@/lib/site"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Solicitar un plan",
  description: "Solicita la contratación de un plan web o una cotización de software a medida.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/contratar" },
}

export default async function ContratarPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams
  // Sin pagos habilitados el checkout no existe: se redirige a contacto (nada de solicitudes ni ordenes).
  if (!paymentsEnabled()) redirect(`/contacto${plan && PLANS.some((p) => p.id === plan) ? `?plan=${plan}` : ""}`)
  const initial = PLANS.some((p) => p.id === plan) ? (plan as string) : "profesional"
  const available = paymentsEnabled() && (await storageWritable())
  const options = PLANS.map((p) => ({ id: p.id, name: p.name, priceLabel: p.priceLabel, fixed: p.priceFrom !== null }))

  return (
    <>
      <section className="bd-page-hero">
        <div className="bd-container">
          <nav className="bd-crumbs" aria-label="Migas de pan">
            <Link href="/" prefetch={false}>Inicio</Link> / <Link href="/planes" prefetch={false}>Planes</Link> / Solicitar
          </nav>
          <h1>Solicitar un plan</h1>
          <p className="bd-lead">Elegir plan → Solicitar → Confirmar cotización → Pagar anticipo → Recibir confirmación.</p>
        </div>
      </section>

      <section className="bd-section">
        <div className="bd-container bd-checkout">
          <ol className="bd-flow" aria-label="Pasos de la contratación">
            <li className="on">Solicitud</li>
            <li>Cotización</li>
            <li>Anticipo</li>
            <li>Confirmación</li>
          </ol>

          {available ? (
            <ContractForm plans={options} initialPlan={initial} />
          ) : (
            <div className="bd-panel">
              <h2>Solicitudes en línea no disponibles por ahora</h2>
              <p>Estamos habilitando este canal. Mientras tanto, cuéntanos tu proyecto por WhatsApp y te respondemos con una cotización.</p>
              <a href={whatsappLink("Hola, quisiera contratar un plan con Byd Light Solutions.")} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-primary">
                Escribir por WhatsApp
              </a>
            </div>
          )}
          <p className="bd-note">{PRICE_NOTE}</p>
        </div>
      </section>
    </>
  )
}
