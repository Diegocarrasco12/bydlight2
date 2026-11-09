/**
 * Aceptacion de terminos de contratacion (2026-11-06). Modulo puro (sin dependencias de Next) para poder probarlo.
 *
 * La version identifica el texto legal que la persona vio al marcar la casilla. Se guarda en la orden como evento
 * TERMINOS_ACEPTADOS (solo-agregar) al crear la solicitud y al iniciar cada pago. Mientras las paginas legales sean
 * borrador la version lleva el prefijo «borrador»: al publicarlas hay que cambiarla a la fecha de publicacion
 * (ver docs/LEGAL-DATOS-PENDIENTES.md), asi cada aceptacion queda ligada al texto exacto que se mostro.
 */
export const TERMS_VERSION = "2026-11-09-r1"

export function termsChecked(v: unknown): boolean {
  return v === true || v === "on" || v === "true"
}

/** null = valido; si no, el mensaje para la persona. La version enviada debe ser exactamente la vigente. */
export function checkTerms(acceptTerms: unknown, termsVersion: unknown): string | null {
  if (!termsChecked(acceptTerms)) return "Debes aceptar los términos de contratación y la política de privacidad para continuar."
  if (termsVersion !== TERMS_VERSION) return "Los términos fueron actualizados. Recarga la página y vuelve a aceptarlos."
  return null
}

export function termsEventDetail(context: string): string {
  return `version=${TERMS_VERSION};ctx=${context}`
}
