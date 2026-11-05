import type { Metadata } from "next"
import LegalPage, { Pend } from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Política de privacidad (borrador)",
  robots: { index: false, follow: false },
}

/**
 * BORRADOR. Describe solo lo que el sitio hace hoy (verificable en el codigo). Las bases legales, plazos de
 * conservacion, derechos y su ejercicio deben ser redactados y validados por un asesor legal (Ley 19.628 y
 * modificaciones vigentes): no se afirma cumplimiento normativo.
 */
export default function PrivacidadPage() {
  requireLegalVisible()
  return (
    <LegalPage title="Política de privacidad" lead="Qué datos recogemos, para qué y con quién se comparten.">
      <h2>1. Responsable</h2>
      <p>
        Byd Light Solutions SpA. RUT: <Pend>RUT de la sociedad</Pend>. Domicilio: <Pend>dirección legal</Pend>. Contacto: {SITE.email}.
      </p>
      <h2>2. Datos que recogemos</h2>
      <ul>
        <li>Formulario de contacto: nombre, correo, teléfono (si lo informas), empresa (si la informas) y mensaje.</li>
        <li>Solicitud de contratación (si está habilitada): los datos anteriores, el plan elegido y el estado de la orden y de los pagos.</li>
        <li>Pagos con Webpay Plus: los datos de la tarjeta se ingresan en el formulario de Transbank; Bydlight no los recibe ni los almacena. Se guarda el resultado de la operación (estado, monto, código de autorización, últimos 4 dígitos y tipo de pago informados por Transbank).</li>
      </ul>
      <h2>3. Para qué los usamos</h2>
      <p>Responder tu consulta, preparar y gestionar cotizaciones y proyectos, procesar pagos y emitir comprobantes. <Pend>base legal y finalidades adicionales: validar con asesor legal</Pend>.</p>
      <h2>4. Con quién se comparten</h2>
      <ul>
        <li>EmailJS: transporta los mensajes del formulario de contacto hacia nuestro correo.</li>
        <li>Transbank S.A.: procesa los pagos con tarjeta.</li>
        <li>Cloudflare: red y seguridad del sitio.</li>
        <li><Pend>otros proveedores (hosting, correo, analítica): confirmar si existen</Pend></li>
      </ul>
      <h2>5. Cookies y analítica</h2>
      <p>El sitio no utiliza cookies de seguimiento ni analítica de terceros al momento de este borrador. <Pend>reconfirmar antes de publicar y actualizar si se agrega analítica</Pend>.</p>
      <h2>6. Conservación y derechos</h2>
      <p>Plazos de conservación: <Pend>definir</Pend>. Acceso, rectificación, cancelación y oposición: escribe a {SITE.email}. <Pend>procedimiento y plazos de respuesta: validar con asesor legal</Pend>.</p>
    </LegalPage>
  )
}
