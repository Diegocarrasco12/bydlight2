import type { Metadata } from "next"
import LegalPage from "@/components/legal/LegalPage"
import { COMPANY } from "@/lib/company"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Política de privacidad y cookies",
  robots: { index: false, follow: false },
}

/**
 * Describe solo lo que el sitio hace hoy (verificado en el codigo el 2026-11-06): ver docs/BYDLIGHT-CIERRE-LEGAL-Y-DEPLOY.md.
 * Marco: Ley 19.628 vigente y Ley 21.719 (publicada el 13-12-2024; vigencia prevista el 01-12-2026 segun la BCN). No es una certificacion de
 * cumplimiento normativo; pendiente de revision por asesor legal. No se inventan plazos, proveedores ni transferencias.
 */
export default function PrivacidadPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/privacidad" title="Política de privacidad y cookies" lead="Qué datos recogemos, para qué, con quién se comparten, qué cookies usamos y cómo ejercer tus derechos.">
      <h2>1. Responsable</h2>
      <p>
        {COMPANY.legalName}, RUT {COMPANY.rut}, domicilio {COMPANY.address}. Contacto en materia de datos personales: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
      <h2>2. Datos que recogemos</h2>
      <ul>
        <li>Formulario de contacto: nombre, correo, teléfono (si lo informas), empresa (si la informas) y mensaje.</li>
        <li>Solicitud de contratación: los datos anteriores, el plan elegido, la cotización, el estado de la orden y un registro de eventos (por ejemplo, la aceptación de términos con su versión y fecha).</li>
        <li>Pagos con Webpay Plus: el número completo y el código de seguridad de la tarjeta se ingresan solo en el formulario de Transbank; Bydlight no los recibe ni los almacena. Bydlight conserva datos limitados de la transacción informados por Transbank: estado, monto, orden de compra, código de autorización, fecha, últimos 4 dígitos de la tarjeta, tipo de pago y cuotas.</li>
        <li>Comunicaciones: los correos y mensajes que intercambiamos contigo, incluidos los correos automáticos de confirmación que te enviamos (se registra si fueron enviados).</li>
        <li>Si nos escribes por WhatsApp, tu número y tus mensajes son tratados también por WhatsApp (Meta) según sus propias condiciones.</li>
        <li>Si contratas como empresa: razón social, RUT, y, si los informas, giro y dirección tributaria, que usamos solo para emitir el documento tributario correspondiente.</li>
        <li>Datos técnicos: la infraestructura del sitio registra datos de conexión (como la dirección IP y la fecha de acceso) con fines de seguridad y funcionamiento.</li>
      </ul>
      <h2>3. Para qué los usamos</h2>
      <p>Responder tu consulta; preparar, gestionar y ejecutar cotizaciones y proyectos; procesar pagos y emitir comprobantes y documentos tributarios; cumplir obligaciones legales (por ejemplo, tributarias); y resguardar la seguridad del sitio y prevenir fraudes. Los usamos para ejecutar lo que solicitas o contratas, para cumplir obligaciones legales y, cuando la ley lo exija, con tu consentimiento.</p>
      <h2>4. Con quién se comparten</h2>
      <ul>
        <li>Transbank S.A.: procesa los pagos con tarjeta mediante Webpay Plus.</li>
        <li>EmailJS: servicio que transporta los mensajes del formulario de contacto hacia nuestro correo.</li>
        <li>Brevo: servicio de envío de correos transaccionales desde el cual enviamos la confirmación de tu solicitud, la cotización y los comprobantes de pago.</li>
        <li>Zoho Mail: servicio de correo donde recibimos tus mensajes y tus respuestas a nuestros correos.</li>
        <li>WhatsApp (Meta): solo si decides escribirnos por ese medio, mediante el enlace publicado en el sitio.</li>
        <li>Cloudflare: opera la red de entrega y seguridad del sitio y, por ello, procesa datos técnicos de conexión.</li>
        <li>Autoridades, cuando una ley lo exija.</li>
      </ul>
      <p>No vendemos tus datos. <strong>Transferencias internacionales:</strong> los servicios de EmailJS, Brevo, Zoho Mail, Cloudflare y WhatsApp pueden tratar datos en servidores fuera de Chile; el país exacto depende de cada proveedor y de sus condiciones, y Bydlight no lo controla. Transbank opera en Chile. Solo enviamos a cada proveedor lo necesario para su función y tienes derecho a consultarnos qué datos se envían a cada uno.</p>
      <h2 id="cookies">5. Cookies y tecnologías de seguimiento</h2>
      <p>
        El sitio no usa cookies de analítica, publicidad ni seguimiento, ni almacena identificadores de navegación en tu dispositivo con esos fines. Las tipografías se sirven
        desde el propio sitio. Solo puede crearse una cookie técnica de acceso controlado y corta duración (para pruebas administrativas autorizadas) que no recoge datos de navegación.
        Si en el futuro se incorporan herramientas de analítica o publicidad, se informará aquí y se pedirá tu consentimiento antes de activarlas.
      </p>
      <h2>6. Conservación</h2>
      <p>
        Conservamos los datos solo mientras sean necesarios para las finalidades descritas y para cumplir obligaciones legales. Los antecedentes de órdenes, cotizaciones, pagos, devoluciones y documentos tributarios se conservan por el plazo que exige la normativa tributaria (en general, 6 años) para respaldar la operación. Las solicitudes de contratación sin cotización vigente, pago ni documento tributario se conservan hasta 24 meses desde la última comunicación; después se anonimizan (se reemplazan tus datos personales conservando solo registros sin identificarte). Las consultas recibidas por el formulario de contacto llegan a nuestra casilla de correo y se eliminan de ella en el mismo plazo. Estas depuraciones no son automáticas: las ejecuta el titular mediante un procedimiento controlado, que primero simula el resultado y deja un registro sin datos personales. Cuando lo solicites y la ley lo permita, anonimizamos antes tus datos; si hay pagos o documentos tributarios, esos datos se conservan solo para cumplir esa obligación. Los respaldos de la base no se reescriben: se eliminan al cumplir su plazo de caducidad (90 días como máximo), por lo que una supresión se refleja en ellos a más tardar en ese plazo.
      </p>
      <h2>7. Tus derechos</h2>
      <p>
        Puedes solicitar acceso, rectificación, cancelación o supresión, oposición y bloqueo de tus datos. La Ley N° 21.719, publicada el 13 de diciembre de 2024, establece su entrada en vigencia general el 1 de diciembre de 2026 y reconoce además otros derechos, como la portabilidad. Existe un proyecto de ley en tramitación que propone postergar esa fecha; mientras no esté promulgado y publicado, no se considera modificada la fecha de la ley publicada. Si la fecha cambia, lo informaremos aquí. Escríbenos a <a href={`mailto:${SITE.email}`}>{SITE.email}</a> indicando qué derecho
        ejerces, el código de tu orden si lo tienes y un medio para responderte; podremos pedirte datos para verificar tu identidad. El acceso se entrega como una exportación de tus datos en formato legible; la rectificación y la supresión se aplican sobre tu solicitud o orden (la supresión no procede sobre los datos que la ley nos obliga a conservar, y te lo informaremos por escrito). Responderemos por escrito dentro de los plazos que fije la ley. También podrás
        reclamar ante la autoridad de protección de datos que la ley establezca.
      </p>
      <h2>8. Cambios</h2>
      <p>Si cambia esta política, publicaremos la versión nueva en esta página con su fecha.</p>
    </LegalPage>
  )
}
