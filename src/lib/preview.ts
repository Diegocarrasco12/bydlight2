/**
 * MODO VISTA PREVIA (solo desarrollo local).
 *
 * Se activa unicamente si NODE_ENV !== "production" Y BD_PREVIEW=1 (ver scripts/dev-preview.mjs). En produccion
 * (build de `next build`/`next start`, imagen Docker) es SIEMPRE false, aunque la variable exista.
 *
 * Con la vista previa activa:
 *  - los pagos se muestran habilitados y con la interfaz de contratacion visible;
 *  - las ordenes salen de datos de demostracion (src/lib/payments/preview-data.ts), sin base de datos;
 *  - NO se llama a Transbank (ni integracion ni produccion) y se ignoran las credenciales: el boton de pago
 *    abre una pantalla de simulacion; las solicitudes no se guardan.
 *
 * Este archivo no importa nada del servidor a proposito: puede usarse desde cualquier modulo.
 */
export function previewMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.BD_PREVIEW === "1"
}
