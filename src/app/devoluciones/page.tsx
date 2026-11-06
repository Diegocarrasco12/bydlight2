import type { Metadata } from "next"
import LegalPage, { Pend } from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Política de cancelación y devoluciones (borrador)",
  robots: { index: false, follow: false },
}

export default function DevolucionesPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/devoluciones" title="Política de cancelación y devoluciones" lead="Qué ocurre si cancelas o si un pago debe devolverse.">
      <h2>1. Cancelación antes de iniciar el trabajo</h2>
      <p>Plazo y porcentaje de devolución del anticipo si se cancela antes de comenzar: <Pend>definir</Pend>.</p>
      <h2>2. Cancelación con trabajo en curso</h2>
      <p>Cómo se calcula el trabajo ya realizado y qué parte del anticipo se retiene: <Pend>definir</Pend>.</p>
      <h2>3. Derecho de retracto y servicios personalizados</h2>
      <p>Aplicación del derecho de retracto a servicios de desarrollo a medida: <Pend>validar con asesor legal; no se presenta aquí como regla definitiva</Pend>.</p>
      <h2>4. Pagos duplicados o erróneos</h2>
      <p>
        Si se detecta un cobro duplicado o erróneo, Bydlight lo revisa y, de corresponder, solicita la anulación a Transbank por el medio
        original de pago. Plazo estimado de reflejo en la cuenta del cliente: <Pend>confirmar con Transbank y el banco emisor</Pend>.
      </p>
      <h2>5. Cómo solicitar una devolución</h2>
      <p>Escribe a {SITE.email} indicando el código de tu orden. Respondemos en <Pend>plazo de respuesta</Pend>.</p>
    </LegalPage>
  )
}
