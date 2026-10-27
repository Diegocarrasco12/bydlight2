import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import OrderLookup from "@/components/checkout/OrderLookup"
import { paymentsEnabled } from "@/lib/payments/config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Consultar estado de una orden",
  robots: { index: false, follow: false },
  alternates: { canonical: "/orden" },
}

export default function OrdenLookupPage() {
  if (!paymentsEnabled()) notFound()
  return (
    <section className="bd-section" style={{ paddingTop: 140 }}>
      <div className="bd-container bd-checkout">
        <h1 className="bd-h2">Consultar estado de una orden</h1>
        <p className="bd-lead">Ingresa el código que recibiste al solicitar tu plan.</p>
        <OrderLookup />
        <p className="bd-note"><Link href="/planes" prefetch={false}>Ver planes</Link></p>
      </div>
    </section>
  )
}
