import type { Metadata } from "next"
import LegalPage from "@/components/legal/LegalPage"
import { COMPANY } from "@/lib/company"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Términos y condiciones de contratación",
  robots: { index: false, follow: false },
}

/**
 * Texto preparado con datos oficiales de la sociedad y SOLO con reglas implementadas o remitidas a la cotizacion: no fija porcentajes,
 * plazos, penalizaciones ni garantias que el titular no haya aprobado. Pendiente de revision legal (docs/BYDLIGHT-CIERRE-LEGAL-Y-DEPLOY.md).
 */
export default function TerminosPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/terminos" title="Términos y condiciones de contratación" lead={`Cómo se contratan los servicios de ${COMPANY.legalName}.`}>
      <h2>1. Quiénes somos</h2>
      <p>
        {COMPANY.legalName} (en adelante, «Bydlight»), {COMPANY.type}, RUT {COMPANY.rut}, giro: {COMPANY.activity.toLowerCase()}.
        Domicilio: {COMPANY.address}. Contacto: <a href={`mailto:${SITE.email}`}>{SITE.email}</a> · WhatsApp {SITE.whatsappDisplay}.
        Bydlight es contribuyente afecto a IVA.
      </p>
      <h2>2. Servicios y modalidades de contratación</h2>
      <p>Bydlight ofrece servicios de desarrollo de sitios web, ecommerce, software, integraciones y consultoría tecnológica, en dos modalidades:</p>
      <ul>
        <li><strong>Servicios con precio publicado (contratación directa).</strong> Los planes de <a href="/planes">Planes y precios</a> tienen alcance, entregables, revisiones y plazo referencial publicados, y un precio «desde» con IVA incluido. Se solicitan desde el sitio: Bydlight te envía la cotización con el monto total final con IVA, el anticipo y el saldo, y la contratación solo se perfecciona cuando aceptas estos términos y pagas el anticipo. No se cobra nada antes de eso.</li>
        <li><strong>Proyectos a medida</strong> (software, integraciones y desarrollos personalizados). Se cotizan y contratan de forma independiente por los canales de contacto: alcance, precio, plazos, condiciones de pago y aceptación constan en una cotización o contrato específico. No se contratan ni se pagan por el pago en línea del sitio.</li>
      </ul>
      <p>El alcance, los entregables y los plazos de cada proyecto se detallan por escrito en su cotización; lo que un plan no incluye se indica en su ficha de la página de planes.</p>
      <h2>3. Quién contrata y qué ley protege</h2>
      <p>
        Estos términos se aplican a toda contratación realizada en este sitio. Cuando quien contrata es un consumidor, conforme a la Ley N° 19.496 sobre
        Protección de los Derechos de los Consumidores, rigen además sus derechos legales, que ninguna cláusula de estos términos limita ni renuncia
        (por ejemplo, la información veraz y oportuna, la confirmación escrita del contrato y el derecho de retracto descrito en la
        <a href="/devoluciones"> Política de cancelación y devoluciones</a>). Cuando quien contrata es una empresa para su actividad, se aplican estos
        términos y las condiciones de su cotización.
      </p>
      <h2>4. Cotización y contratación</h2>
      <ul>
        <li>Todo proyecto parte con una solicitud y una cotización emitida por Bydlight. La cotización tiene una vigencia habitual de 7 días, que se indica en ella; una cotización vencida no puede pagarse en línea.</li>
        <li>Antes de pagar se muestra el servicio, el monto total, el anticipo y el saldo pendiente, el medio de pago y la vigencia.</li>
        <li>La contratación se perfecciona cuando el cliente acepta expresamente estos términos y paga el anticipo. Bydlight registra la versión de los términos aceptados y la fecha y hora de aceptación.</li>
        <li>Alcance y entregables: lo que incluye cada proyecto, sus entregables y las rondas de revisión constan en la cotización o en el plan elegido.</li>
        <li>Aprobaciones: las aprobaciones de diseños y entregables se solicitan por escrito (correo o la página de la orden) y se dan cuando el cliente las confirma expresamente. El silencio del cliente no equivale a aprobación: si vence el plazo de revisión sin respuesta, Bydlight le enviará un recordatorio por escrito y el calendario del proyecto se ajustará en consecuencia.</li>
        <li>Cambios solicitados: los ajustes dentro del alcance y de las revisiones incluidas no tienen costo adicional; los cambios de alcance se cotizan por separado y requieren aceptación escrita.</li>
      </ul>
      <h2>5. Precios, IVA, anticipo y saldo</h2>
      <ul>
        <li>Los precios se informan en pesos chilenos (CLP). Todos los precios publicados en el sitio y cotizados son finales e incluyen IVA (no se suma impuesto adicional). Cada cotización indica el monto total con IVA en CLP, el anticipo y el saldo.</li>
        <li>El anticipo habitual es del 50 % del monto total (el porcentaje exacto consta en la cotización) y da inicio al proyecto; el saldo restante, habitualmente 50 %, se paga según las condiciones de entrega indicadas en la cotización y se habilita desde la página de la orden.</li>
        <li>Los pagos en línea se procesan mediante Webpay Plus de Transbank. El número completo y el código de seguridad de la tarjeta se ingresan solo en el sitio de Transbank; Bydlight no los recibe ni los almacena. Bydlight conserva únicamente el resultado de la operación (estado, monto, código de autorización, últimos 4 dígitos y tipo de pago).</li>
        <li>Estado de los pagos: un pago puede quedar autorizado, pendiente de confirmación, rechazado o devuelto; qué significa cada uno y qué ocurre en cada caso se explica en <a href="/informacion-comercial#pagos">Información comercial y medios de pago</a>.</li>
        <li>Documentos tributarios: los comprobantes de este sitio y los correos de confirmación son informativos y no son una boleta ni una factura. El comprobante electrónico del medio de pago puede tener validez tributaria según la normativa del Servicio de Impuestos Internos; cuando corresponda otro documento (boleta o factura electrónica), se emite conforme a esa normativa y a la habilitación vigente de Bydlight. La factura no se emite de forma automática: si la necesitas, indícalo antes de contratar. Detalle en <a href="/informacion-comercial#documentos-tributarios">Información comercial y medios de pago</a>.</li>
      </ul>
      <h2>6. Plazos de ejecución</h2>
      <p>Cada plan publica un plazo referencial; el plazo del proyecto se acuerda en la cotización y depende de la entrega oportuna de contenidos, accesos y aprobaciones por parte del cliente. Si hay retrasos de cualquiera de las partes, se informará por escrito y se acordará un nuevo calendario.</p>
      <h2>7. Obligaciones del cliente</h2>
      <p>Entregar información veraz, contenidos y accesos oportunamente; contar con los derechos y licencias sobre los materiales que aporte; y revisar los entregables dentro de los plazos acordados. Más detalle en las <a href="/servicios-digitales">Condiciones de prestación de servicios digitales</a>.</p>
      <h2>8. Propiedad intelectual y licencias</h2>
      <p>
        Los derechos sobre cada entregable específico se definen expresamente en la cotización o contrato (cesión o licencia de uso), y se activan una vez pagado el precio
        acordado. Los componentes preexistentes y reutilizables de Bydlight (herramientas, bibliotecas, plantillas y código propio anterior al proyecto) son de propiedad de
        Bydlight, que otorga al cliente las licencias de uso necesarias para operar su entregable. El cliente conserva la titularidad de los contenidos y materiales que aporta. Los materiales de terceros y los componentes de código abierto conservan sus propias licencias. Bydlight
        solo menciona un proyecto como referencia con autorización del cliente.
      </p>
      <h2>9. Servicios de terceros, hosting y dominios</h2>
      <p>Cuando un proyecto requiera servicios de terceros (hosting, dominios, correo, pasarelas de pago u otros), la cotización indica quién los contrata y paga. Preferentemente, los dominios y cuentas del proyecto se registran a nombre del cliente, y sus accesos se le entregan al finalizar; si por algún motivo quedan a nombre de Bydlight, la cotización lo indica y se acuerda su traspaso. Bydlight no controla ni garantiza la disponibilidad de servicios de terceros.</p>
      <h2>10. Garantías, soporte y mantenimiento</h2>
      <p>Rigen las garantías legales que correspondan, que estos términos no limitan. Los defectos de funcionamiento respecto de lo cotizado se corrigen conforme a la garantía indicada en la cotización. El soporte posterior a la entrega y el mantenimiento no están incluidos salvo que la cotización o el plan los incluyan; el mantenimiento mensual es un servicio aparte, con su alcance y duración. Ver <a href="/soporte">Contacto y soporte</a>.</p>
      <h2>11. Cancelación, retracto y devoluciones</h2>
      <p>Ver la <a href="/devoluciones">Política de cancelación y devoluciones</a>.</p>
      <h2>12. Datos personales</h2>
      <p>Los datos entregados se usan para gestionar la solicitud, el proyecto y los pagos. Ver la <a href="/privacidad">Política de privacidad</a>.</p>
      <h2>13. Ley aplicable y reclamos</h2>
      <p>
        Estos términos se rigen por la ley chilena. Puedes escribirnos a <a href={`mailto:${SITE.email}`}>{SITE.email}</a> con el código de tu orden para cualquier reclamo; lo
        revisaremos y responderemos por escrito. Si eres consumidor, conservas el derecho de recurrir al Servicio Nacional del Consumidor y a los tribunales competentes
        conforme a la ley.
      </p>
    </LegalPage>
  )
}
