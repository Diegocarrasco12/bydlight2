import type { Metadata } from "next"
import LegalPage from "@/components/legal/LegalPage"
import { COMPANY } from "@/lib/company"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Contacto y soporte",
  robots: { index: false, follow: false },
}

export default function SoportePage() {
  requireLegalVisible()
  return (
    <LegalPage path="/soporte" title="Contacto y soporte" lead={`Cómo comunicarte con ${COMPANY.legalName}.`}>
      <h2>Canales</h2>
      <ul>
        <li>Correo: <a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
        <li>WhatsApp: {SITE.whatsappDisplay}</li>
        <li>Formulario: <a href="/contacto">/contacto</a></li>
        <li>Domicilio: {COMPANY.address}</li>
      </ul>
      <h2>Cómo te respondemos</h2>
      <p>Respondemos los mensajes por correo o WhatsApp, y dejamos por escrito lo acordado sobre alcance, plazos y valores de cada proyecto.</p>
      <h2>Soporte posterior a la entrega</h2>
      <p>El alcance, duración y costo del soporte o mantenimiento de cada proyecto, si los hay, constan en su cotización o contrato.</p>
      <h2>Problemas con un pago</h2>
      <p>Escribe con el código de tu orden (12 caracteres). Revisamos el estado del pago con Transbank y te respondemos por el mismo medio.</p>
      <h2>Reclamos</h2>
      <p>Puedes presentar un reclamo por los canales anteriores indicando el código de tu orden. Si eres consumidor, también puedes acudir al Servicio Nacional del Consumidor.</p>
    </LegalPage>
  )
}
