import type { Metadata } from "next"
import LegalPage from "@/components/legal/LegalPage"
import { COMPANY } from "@/lib/company"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Información comercial y medios de pago",
  robots: { index: false, follow: false },
}

export default function InformacionComercialPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/informacion-comercial" title="Información comercial y medios de pago" lead="Quién vende, cómo se paga y cómo se presta el servicio.">
      <h2>Proveedor</h2>
      <p>
        {COMPANY.legalName}, {COMPANY.type}. RUT {COMPANY.rut}. Giro: {COMPANY.activity}. Domicilio: {COMPANY.address}. Correo: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. WhatsApp: {SITE.whatsappDisplay}. Sitio: {SITE.url.replace("https://", "")}.
      </p>
      <h2>Qué se vende</h2>
      <p>Servicios de desarrollo web, software a medida e integraciones, según plan o cotización. No son bienes físicos: no hay despacho.</p>
      <h2>Medios de pago</h2>
      <p>
        Pago en línea mediante Webpay Plus de Transbank, en pesos chilenos, con los medios de pago habilitados en esa plataforma. El número completo y el código de
        seguridad de la tarjeta los ingresas solo en el sitio de Transbank.
      </p>
      <h2>Prestación del servicio</h2>
      <p>Forma y plazo de entrega según la cotización aceptada (ver <a href="/servicios-digitales">servicios digitales</a>).</p>
      <h2>Precios, IVA y documentos tributarios</h2>
      <p>
        Precios en CLP. Los precios de los planes publicados se expresan más IVA; Bydlight es contribuyente afecto a IVA. Cada cotización indica el monto total, el anticipo y el saldo.
        El comprobante de pago del sitio no reemplaza el documento tributario que corresponda emitir por separado, conforme a la normativa del Servicio de Impuestos Internos.
      </p>
      <h2>Más información</h2>
      <p>
        <a href="/terminos">Términos</a> · <a href="/devoluciones">Cancelación, retracto y devoluciones</a> · <a href="/privacidad">Privacidad</a> · <a href="/soporte">Soporte</a>
      </p>
    </LegalPage>
  )
}
