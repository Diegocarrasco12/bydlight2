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
      <p>Servicios digitales, sin despacho de bienes físicos, en dos modalidades:</p>
      <ul>
        <li><strong>Servicios con precio publicado (contratación directa):</strong> los planes de <a href="/planes">Planes y precios</a>, con alcance, entregables, revisiones y plazo referencial publicados. Se solicitan en el sitio; la cotización confirma el monto total final con IVA, el anticipo y el saldo antes de que pagues.</li>
        <li><strong>Proyectos a medida:</strong> software, integraciones y desarrollos personalizados. Se cotizan y contratan de forma independiente por los canales de contacto, con condiciones y forma de pago propias; no se pagan por el pago en línea del sitio.</li>
      </ul>
      <h2 id="pagos">Pagos: cómo funcionan y qué significa cada estado</h2>
      <p>Los pagos en línea los procesa Transbank con Webpay Plus. Bydlight solo registra el resultado que Transbank informa y lo confirma directamente con Transbank antes de dar un pago por recibido.</p>
      <ul>
        <li><strong>Autorizado:</strong> Transbank confirmó el pago. Recibes el comprobante en la página de tu orden y por correo; al pagar el anticipo, además, la confirmación escrita de la contratación.</li>
        <li><strong>Pendiente de confirmación:</strong> aún no hay resultado final. No es una confirmación de pago ni un rechazo. Bydlight consulta el resultado a Transbank y te avisa; mientras tanto no necesitas volver a pagar. Si tu banco muestra un cargo y no recibes noticias, escríbenos con el código de tu orden.</li>
        <li><strong>Rechazado:</strong> el medio de pago no autorizó la operación. No se registra un pago y puedes reintentar con la misma u otra tarjeta desde la página de tu orden.</li>
        <li><strong>Cancelado o expirado:</strong> si cancelas el pago en el sitio de Transbank o se agota el tiempo para completarlo, no se registra un pago y puedes volver a intentarlo mientras la cotización esté vigente.</li>
        <li><strong>Devuelto:</strong> si corresponde devolver un pago, se gestiona con Transbank por el mismo medio de pago. El plazo en que se refleja depende de Transbank y de tu banco. Ver <a href="/devoluciones">Cancelación, retracto y devoluciones</a>.</li>
      </ul>
      <h2>Medios de pago</h2>
      <p>
        Pago en línea mediante Webpay Plus de Transbank, en pesos chilenos, con los medios de pago habilitados en esa plataforma. El número completo y el código de
        seguridad de la tarjeta los ingresas solo en el sitio de Transbank.
      </p>
      <h2>Prestación del servicio</h2>
      <p>Forma y plazo de entrega según la cotización aceptada (ver <a href="/servicios-digitales">servicios digitales</a>).</p>
      <h2>Precios e IVA</h2>
      <p>
        Precios en CLP. Todos los precios publicados y cotizados son finales e incluyen IVA; Bydlight es contribuyente afecto a IVA. Cada cotización indica el monto total con IVA, el anticipo y el saldo.
      </p>
      <h2 id="documentos-tributarios">Documentos tributarios</h2>
      <ul>
        <li>Los comprobantes que muestra este sitio y los correos de confirmación son informativos: <strong>no son una boleta ni una factura</strong> de Bydlight.</li>
        <li>El comprobante electrónico del medio de pago (voucher de Webpay) puede tener validez tributaria cuando así lo reconoce la normativa del Servicio de Impuestos Internos (SII) y según el modelo de emisión que Bydlight tenga efectivamente vigente ante el SII. Solo cuando ese modelo lo permite no se emite una boleta adicional; en caso contrario se emite la boleta electrónica correspondiente.</li>
        <li>Cuando la normativa exija otro documento, este se emite como boleta electrónica o factura electrónica, según corresponda.</li>
        <li>La factura no se emite de forma automática ni por el solo hecho de pagar. Si necesitas factura, indícalo antes de contratar y entrega los datos de tu empresa (razón social y RUT). Se emite cuando corresponda según la normativa y la habilitación vigente de Bydlight ante el SII; si tienes dudas sobre su disponibilidad, consúltalo por los canales de contacto antes de pagar.</li>
        <li>Si un documento ya emitido debe corregirse o anularse (por ejemplo, por una devolución), se hace con la nota de crédito que corresponda.</li>
      </ul>
      <h2>Más información</h2>
      <p>
        <a href="/terminos">Términos</a> · <a href="/devoluciones">Cancelación, retracto y devoluciones</a> · <a href="/privacidad">Privacidad</a> · <a href="/soporte">Soporte</a>
      </p>
    </LegalPage>
  )
}
