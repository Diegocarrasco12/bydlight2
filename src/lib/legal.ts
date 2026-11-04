import { notFound } from "next/navigation"

/**
 * Las paginas legales son BORRADORES pendientes de aprobacion del titular (ver docs/AUDITORIA-WEBPAY-2026-11-04.md).
 * Mientras esta bandera sea false responden 404 en produccion (siguen visibles en desarrollo para revision),
 * no estan en el sitemap ni en el menu. Cambiarla a true solo tras revision y aprobacion expresas.
 */
export const LEGAL_PAGES_PUBLISHED = false

export function requireLegalVisible() {
  if (!LEGAL_PAGES_PUBLISHED && process.env.NODE_ENV === "production") notFound()
}
