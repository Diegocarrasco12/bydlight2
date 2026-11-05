import type { Metadata } from "next"
import LegalPage, { Pend } from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Términos y condiciones de contratación (borrador)",
  robots: { index: false, follow: false },
}

export default function TerminosPage() {
  requireLegalVisible()
  return (
    <LegalPage title="Términos y condiciones de contratación" lead="Cómo se contratan los servicios de Byd Light Solutions SpA.">
      <h2>1. Quiénes somos</h2>
      <p>
        Byd Light Solutions SpA (en adelante, «Bydlight»), empresa chilena de ingeniería y desarrollo de software. RUT: <Pend>RUT de la sociedad</Pend>.
        Domicilio: <Pend>dirección legal</Pend>. Contacto: {SITE.email}.
      </p>
      <h2>2. Servicios</h2>
      <p>
        Desarrollo de sitios web, ecommerce, software a medida, integraciones y consultoría tecnológica, según el plan o la cotización aceptada.
        El alcance, los entregables y los plazos se detallan por escrito en cada cotización.
      </p>
      <h2>3. Cotización y contratación</h2>
      <ul>
        <li>Todo proyecto parte con una solicitud y una cotización emitida por Bydlight, con su vigencia indicada.</li>
        <li>El precio se informa en pesos chilenos (CLP). Tratamiento de IVA: <Pend>confirmar régimen tributario</Pend>.</li>
        <li>Los cambios de alcance se cotizan por separado y requieren aceptación escrita.</li>
      </ul>
      <h2>4. Precio y forma de pago</h2>
      <ul>
        <li>Se paga un anticipo (porcentaje indicado en la cotización) y un saldo, en las condiciones de la cotización.</li>
        <li>Los pagos en línea se procesan mediante Webpay Plus (tarjetas de crédito y débito). Bydlight no recibe ni almacena los datos de la tarjeta.</li>
        <li>Plazo para pagar el saldo y consecuencias del atraso: <Pend>definir</Pend>.</li>
      </ul>
      <h2>5. Plazos de entrega</h2>
      <p>Los plazos se acuerdan en la cotización y dependen de la entrega oportuna de contenidos y aprobaciones por parte del cliente. <Pend>definir tratamiento de retrasos</Pend>.</p>
      <h2>6. Propiedad intelectual</h2>
      <p>Titularidad y licencia del código, diseños y contenidos entregados: <Pend>definir (cesión, licencia, momento de transferencia)</Pend>.</p>
      <h2>7. Garantía y soporte posterior</h2>
      <p>Período y alcance de garantía por errores: <Pend>definir</Pend>. Mantenimiento y soporte: ver <a href="/soporte">Soporte</a>.</p>
      <h2>8. Cancelación y devoluciones</h2>
      <p>Ver la <a href="/devoluciones">Política de cancelación y devoluciones</a>.</p>
      <h2>9. Datos personales</h2>
      <p>Los datos entregados se usan para gestionar la solicitud y el proyecto. Ver la <a href="/privacidad">Política de privacidad</a> (borrador, <Pend>pendiente de revisión legal</Pend>).</p>
      <h2>10. Ley aplicable y reclamos</h2>
      <p>Ley chilena. Tribunales competentes y procedimiento de reclamos: <Pend>validar con asesor legal</Pend>.</p>
    </LegalPage>
  )
}
