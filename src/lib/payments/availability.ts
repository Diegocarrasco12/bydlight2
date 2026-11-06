import "server-only"
import { paymentsEnabled, tbkMode } from "./config"

/**
 * POLITICA DE DISPONIBILIDAD DE WEBPAY (fuente unica: paymentsEnabled()).
 *
 * Los mensajes comerciales sobre Webpay (planes, pie de pagina) y el modulo de pago de la cotizacion solo existen
 * cuando el checkout esta habilitado. Asi nunca se anuncia un medio de pago que no puede usarse:
 *  - Desarrollo local: habilitado por defecto (sandbox y datos ficticios).
 *  - Produccion: APAGADO e invisible hasta la activacion autorizada (PAYMENTS_ENABLED=true o enabled=true en
 *    payments.json, ver docs/ACTIVACION-WEBPAY.md). Las paginas estaticas se generan al compilar: tras activar hay que
 *    volver a compilar y publicar para que aparezcan los mensajes (fallo seguro: sin activar, no se anuncia nada).
 *  - El ambiente de pruebas (tbkMode() === "integration") se rotula siempre en la pagina de la orden.
 */
export function webpayAnnounced(): boolean {
  return paymentsEnabled()
}

/** true cuando las transacciones van al ambiente de integracion de Transbank (sin cobros reales). */
export function webpaySandbox(): boolean {
  return tbkMode() !== "production"
}

export const WEBPAY_PLANS_NOTE =
  "Pago con tarjetas de crédito, débito y prepago mediante Webpay Plus, sujeto a disponibilidad y condiciones del medio de pago."
export const WEBPAY_FOOTER_NOTE = "Pagos procesados mediante Webpay Plus de Transbank."

/** Textos comerciales de la muestra de pagos (PaymentBrandShowcase). */
export const PAY_HEADLINE = "Paga con tus tarjetas favoritas"
export const PAY_SUBTITLE = "Crédito, débito y prepago a través de Webpay Plus"
export const PAY_TRUST = "Los datos de tu tarjeta se ingresan en el sitio seguro de Webpay; Bydlight no los ve ni los guarda."

export type BrandLogo = { src: string; alt: string; width: number; height: number }

/**
 * LOGOTIPOS OFICIALES. null / lista vacia = NO se muestra ningun logotipo: no se dibuja ni se imita una marca ajena.
 * - webpay: pack oficial "logo-webpay-plus.zip" en https://www.transbankdevelopers.cl/brand-assets . Los terminos de
 *   Transbank exigen autorizacion previa, expresa y por escrito para usar la marca fuera de la integracion.
 * - cards: Transbank no entrega logos de tarjetas; Visa/Mastercard/etc. tienen sus propias normas. Solo se agregan marcas
 *   CONFIRMADAS como habilitadas en el contrato del comercio (confirmacion de Transbank por escrito).
 * Para activar: guardar el archivo en public/img/pagos/ y completar aqui (ver docs/WEBPAY-LOGOS-FUENTES.md).
 */
export const PAYMENT_LOGOS: { webpay: BrandLogo | null; cards: BrandLogo[] } = { webpay: null, cards: [] }
