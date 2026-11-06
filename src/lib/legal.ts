import { notFound } from "next/navigation"

/**
 * Las paginas legales son BORRADORES pendientes de aprobacion del titular (ver docs/AUDITORIA-WEBPAY-2026-11-04.md).
 * Mientras esta bandera sea false responden 404 en produccion (siguen visibles en desarrollo para revision),
 * no estan en el sitemap ni en el menu. Cambiarla a true solo tras revision y aprobacion expresas.
 *
 * Garantia tecnica: con la bandera en true, el componente <Pend> (marcador [PENDIENTE]) lanza un error. Si queda
 * un solo dato pendiente, `next build` falla y no se puede publicar texto con marcadores. Ver tests/legal.test.mjs.
 */
export const LEGAL_PAGES_PUBLISHED = false

/** true si las paginas legales se muestran (publicadas, o desarrollo local para revision). */
export function legalVisible(): boolean {
  return LEGAL_PAGES_PUBLISHED || process.env.NODE_ENV !== "production"
}

export function requireLegalVisible() {
  if (!legalVisible()) notFound()
}

/** Documentos legales: fuente unica para el menu lateral, el indice y el pie de pagina. */
export const LEGAL_DOCS = [
  { href: "/terminos", title: "Términos de contratación", short: "Cómo se contrata, se paga y se entrega un proyecto." },
  { href: "/informacion-comercial", title: "Información comercial y medios de pago", short: "Quién vende, qué se vende y cómo se paga." },
  { href: "/devoluciones", title: "Cancelación y devoluciones", short: "Qué ocurre si cancelas o si un pago debe devolverse." },
  { href: "/servicios-digitales", title: "Servicios digitales", short: "Cómo se entregan y reciben los servicios de software." },
  { href: "/privacidad", title: "Política de privacidad", short: "Qué datos recogemos, para qué y con quién se comparten." },
  { href: "/soporte", title: "Contacto y soporte", short: "Canales, horarios y ayuda con un pago." },
] as const
