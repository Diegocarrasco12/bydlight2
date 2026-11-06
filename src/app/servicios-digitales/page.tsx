import type { Metadata } from "next"
import LegalPage from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Condiciones de prestación de servicios digitales",
  robots: { index: false, follow: false },
}

export default function ServiciosDigitalesPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/servicios-digitales" title="Condiciones de prestación de servicios digitales" lead="Cómo se entregan y reciben los servicios de software.">
      <h2>1. Entrega</h2>
      <p>Los servicios son digitales: la entrega se realiza en línea (acceso al sitio o sistema, repositorio o archivos). No hay despacho físico. La forma de entrega y aceptación de cada proyecto se indica en su cotización.</p>
      <h2>2. Responsabilidades del cliente</h2>
      <ul>
        <li>Entregar contenidos, accesos y aprobaciones en los plazos acordados.</li>
        <li>Contar con las licencias y derechos sobre los materiales que aporte.</li>
        <li>Servicios de terceros (hosting, dominios, pasarelas de pago): la cotización indica quién los contrata y paga.</li>
      </ul>
      <h2>3. Revisiones y aceptación</h2>
      <p>Las rondas de revisión y el plazo para observar los entregables constan en la cotización del plan o proyecto (los planes publicados en el sitio indican sus revisiones incluidas).</p>
      <h2>4. Disponibilidad y mantenimiento</h2>
      <p>Bydlight no garantiza la disponibilidad de servicios de terceros. Los compromisos de disponibilidad, mantenimiento o soporte, si los hay, constan en la cotización o contrato.</p>
      <h2>5. Confidencialidad y datos</h2>
      <p>La información que el cliente entrega se usa solo para ejecutar el proyecto. El tratamiento de datos personales se rige por la <a href="/privacidad">Política de privacidad</a>; si el proyecto trata datos de los usuarios del cliente, las responsabilidades de cada parte se acuerdan por escrito en el contrato.</p>
    </LegalPage>
  )
}
