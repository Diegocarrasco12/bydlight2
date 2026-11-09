import { notFound } from "next/navigation"

/**
 * Paginas legales PUBLICADAS (Etapa B, aprobadas por el titular). Con la bandera en false responden 404 en produccion
 * (siguen visibles en desarrollo para revision), sin menu ni enlaces en correos. Es una de las DOS llaves del checkout
 * publico (la otra es ONLINE_CHECKOUT_UI); ademas hace falta access=public en payments.json.
 *
 * Garantia tecnica: con la bandera en true, un marcador de dato pendiente en el texto hace fallar `next build`
 * (ver LegalPage y tests/preview-legal.test.mjs L2). Volver a false oculta las seis paginas de inmediato tras recompilar.
 */
export const LEGAL_PAGES_PUBLISHED = true

/** true si las paginas legales se muestran (publicadas, o desarrollo local para revision). */
export function legalVisible(): boolean {
  return LEGAL_PAGES_PUBLISHED || process.env.NODE_ENV !== "production"
}

export function requireLegalVisible() {
  if (!legalVisible()) notFound()
}

/**
 * Nota tributaria unica para comprobantes de la orden y correos. No afirma que el comprobante sea boleta ni factura, no promete
 * facturacion automatica y no fija fechas ni plazos. El detalle esta en /informacion-comercial#documentos-tributarios.
 */
export const TAX_NOTE =
  "Este comprobante es informativo: no es una boleta ni una factura de Bydlight. El comprobante electrónico del medio de pago puede tener validez tributaria según la normativa del SII; si necesitas factura, indícalo antes de contratar (la factura no se emite de forma automática)."

/** Documentos legales: fuente unica para el menu lateral, el indice y el pie de pagina. */
export const LEGAL_DOCS = [
  { href: "/terminos", title: "Términos de contratación", short: "Cómo se contrata, se paga y se entrega un proyecto." },
  { href: "/informacion-comercial", title: "Información comercial y medios de pago", short: "Quién vende, qué se vende, cómo se paga, estados de un pago y documentos tributarios." },
  { href: "/devoluciones", title: "Cancelación y devoluciones", short: "Qué ocurre si cancelas o si un pago debe devolverse." },
  { href: "/servicios-digitales", title: "Servicios digitales", short: "Cómo se entregan y reciben los servicios de software." },
  { href: "/privacidad", title: "Política de privacidad y cookies", short: "Qué datos recogemos, para qué, con quién se comparten y qué cookies se usan." },
  { href: "/soporte", title: "Contacto y soporte", short: "Canales, horarios y ayuda con un pago." },
] as const
