import type { Metadata } from "next"
import LegalPage, { Pend } from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Información comercial y medios de pago (borrador)",
  robots: { index: false, follow: false },
}

export default function InformacionComercialPage() {
  requireLegalVisible()
  return (
    <LegalPage title="Información comercial y medios de pago" lead="Quién vende, cómo se paga y cómo se presta el servicio.">
      <h2>Proveedor</h2>
      <p>
        Byd Light Solutions SpA. RUT: <Pend>RUT de la sociedad</Pend>. Domicilio: <Pend>dirección legal</Pend>. Correo: {SITE.email}. WhatsApp: {SITE.whatsappDisplay}.
      </p>
      <h2>Qué se vende</h2>
      <p>Servicios de desarrollo web, software a medida e integraciones, según plan o cotización. No son bienes físicos: no hay despacho.</p>
      <h2>Medios de pago</h2>
      <p>
        Tarjetas de crédito, débito y prepago mediante Webpay Plus de Transbank, en pesos chilenos. Los datos de la tarjeta los ingresas en el sitio de
        Transbank. <Pend>habilitar este texto solo cuando Transbank confirme la activación</Pend>.
      </p>
      <h2>Prestación del servicio</h2>
      <p>Forma y plazo de entrega según la cotización aceptada. <Pend>forma de entrega y aceptación (ver servicios digitales)</Pend>.</p>
      <h2>Precios e impuestos</h2>
      <p>Precios en CLP. Tratamiento de IVA: <Pend>confirmar régimen tributario</Pend>.</p>
      <h2>Más información</h2>
      <p>
        <a href="/terminos">Términos</a> · <a href="/devoluciones">Cancelación y devoluciones</a> · <a href="/privacidad">Privacidad</a> · <a href="/soporte">Soporte</a>
      </p>
    </LegalPage>
  )
}
