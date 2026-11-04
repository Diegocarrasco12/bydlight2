import type { Metadata } from "next"
import LegalPage, { Pend } from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Contacto y soporte (borrador)",
  robots: { index: false, follow: false },
}

export default function SoportePage() {
  requireLegalVisible()
  return (
    <LegalPage title="Contacto y soporte" lead="Cómo comunicarte con Byd Light Solutions SpA.">
      <h2>Canales</h2>
      <ul>
        <li>Correo: {SITE.email}</li>
        <li>WhatsApp: {SITE.whatsappDisplay}</li>
        <li>Formulario: <a href="/contacto">/contacto</a></li>
      </ul>
      <h2>Horario y tiempos de respuesta</h2>
      <p>Horario de atención: <Pend>definir</Pend>. Tiempo de respuesta: <Pend>definir</Pend>.</p>
      <h2>Soporte posterior a la entrega</h2>
      <p>Alcance, duración y costo del soporte o mantenimiento: <Pend>definir</Pend>.</p>
      <h2>Problemas con un pago</h2>
      <p>Escribe con el código de tu orden (12 caracteres). Revisamos el estado del pago con Transbank y te respondemos por el mismo medio.</p>
    </LegalPage>
  )
}
