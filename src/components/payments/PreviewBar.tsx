import Link from "next/link"
import { previewMode } from "@/lib/preview"
import PayVariantSwitch from "./PayVariantSwitch"

/** Franja fija de la VISTA PREVIA local. En produccion previewMode() es siempre false y no renderiza nada. */
export default function PreviewBar() {
  if (!previewMode()) return null
  return (
    <div className="pv-bar" role="note">
      <strong>Vista previa</strong>
      <span>Datos de demostración · sin cobros ni credenciales · no es el sitio publicado</span>
      <PayVariantSwitch />
      <Link href="/vista-previa" prefetch={false}>Índice de la vista previa</Link>
    </div>
  )
}
