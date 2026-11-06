import type { Metadata } from "next"
import LegalPage, { Pend } from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Condiciones de prestación de servicios digitales (borrador)",
  robots: { index: false, follow: false },
}

export default function ServiciosDigitalesPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/servicios-digitales" title="Condiciones de prestación de servicios digitales" lead="Cómo se entregan y reciben los servicios de software.">
      <h2>1. Entrega</h2>
      <p>Los servicios son digitales: la entrega se realiza en línea (acceso al sitio o sistema, repositorio o archivos). No hay despacho físico. Forma de entrega y aceptación: <Pend>definir</Pend>.</p>
      <h2>2. Responsabilidades del cliente</h2>
      <ul>
        <li>Entregar contenidos, accesos y aprobaciones en los plazos acordados.</li>
        <li>Contar con las licencias y derechos sobre los materiales que aporte.</li>
        <li>Terceros (hosting, dominios, pasarelas de pago): <Pend>definir quién contrata y paga</Pend>.</li>
      </ul>
      <h2>3. Revisiones y aceptación</h2>
      <p>Número de rondas de revisión y plazo para observar entregables: <Pend>definir</Pend>.</p>
      <h2>4. Disponibilidad y mantenimiento</h2>
      <p>Bydlight no garantiza la disponibilidad de servicios de terceros. Compromisos de disponibilidad, si los hubiera: <Pend>definir</Pend>.</p>
      <h2>5. Confidencialidad y datos</h2>
      <p>Tratamiento de información del cliente y de sus usuarios: <Pend>definir y alinear con la política de privacidad</Pend>.</p>
    </LegalPage>
  )
}
