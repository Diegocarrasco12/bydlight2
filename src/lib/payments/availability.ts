import "server-only"
import { previewMode } from "@/lib/preview"
import { publicCheckoutReady, tbkMode } from "./config"

/**
 * POLITICA DE DISPONIBILIDAD DE WEBPAY. Capacidad de cobrar: paymentsEnabled(); acceso al checkout: checkoutMode() (config.ts);
 * anuncio publico: webpayAnnounced() (solo codigo publicado).
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
  // Anuncio PUBLICO (planes, portada, pie): depende solo del codigo publicado (ONLINE_CHECKOUT_UI y LEGAL_PAGES_PUBLISHED), no
  // de payments.json, que no existe al compilar la imagen. Con la prueba productiva (modo piloto) no se anuncia nada.
  return previewMode() || publicCheckoutReady()
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

export type BrandLogo = { src: string; srcSet?: string; alt: string; width: number; height: number }

/**
 * LOGOTIPOS OFICIALES (archivos de https://www.transbankdevelopers.cl/brand-assets copiados SIN modificar a public/img/pagos/).
 * Autorizacion: respuesta escrita de Transbank (Plataforma Tecnica de Incorporaciones, 2026-11): el comercio con productos
 * contratados puede usar los logotipos oficiales de Webpay Plus y Transbank. Version «negativo full color» porque todas las
 * superficies del sitio son oscuras (manual de uso TBK Developers). Solo se escalan, conservando proporcion.
 * - cards: lista VACIA a proposito. Transbank indico que las marcas de tarjeta efectivamente habilitadas deben confirmarse con
 *   el area comercial; hasta tener esa confirmacion por escrito no se anuncia ninguna marca (Visa, Mastercard, Amex, Redcompra...).
 *   Para agregarlas: guardar el archivo oficial en public/img/pagos/ y declararlo aqui (ver docs/WEBPAY-LOGOS-FUENTES.md).
 */
export const PAYMENT_LOGOS: { webpay: BrandLogo | null; transbank: BrandLogo | null; cards: BrandLogo[] } = {
  webpay: {
    src: "/img/pagos/webpay-plus-negativo-800.png",
    srcSet: "/img/pagos/webpay-plus-negativo-300.png 301w, /img/pagos/webpay-plus-negativo-800.png 800w",
    alt: "Webpay Plus de Transbank",
    width: 800,
    height: 198,
  },
  transbank: {
    src: "/img/pagos/transbank-negativo-800.png",
    srcSet: "/img/pagos/transbank-negativo-300.png 300w, /img/pagos/transbank-negativo-800.png 800w",
    alt: "Transbank",
    width: 800,
    height: 250,
  },
  cards: [],
}

/**
 * Version «positivo full color» (para superficies CLARAS) de los mismos logotipos oficiales, tambien sin modificar.
 * Solo la usa la propuesta C de la vista previa (placa blanca); el resto del sitio usa «negativo» sobre fondo oscuro.
 */
export const PAYMENT_LOGOS_LIGHT: { webpay: BrandLogo; transbank: BrandLogo } = {
  webpay: {
    src: "/img/pagos/webpay-plus-positivo-800.png",
    srcSet: "/img/pagos/webpay-plus-positivo-300.png 301w, /img/pagos/webpay-plus-positivo-800.png 800w",
    alt: "Webpay Plus de Transbank",
    width: 800,
    height: 198,
  },
  transbank: {
    src: "/img/pagos/transbank-positivo-800.png",
    srcSet: "/img/pagos/transbank-positivo-300.png 300w, /img/pagos/transbank-positivo-800.png 800w",
    alt: "Transbank",
    width: 800,
    height: 250,
  },
}

/** Textos de las propuestas visuales de «pagos seguros» (mismo contenido en las tres variantes). */
export const TRUST_TITLE = "Paga con confianza. Tu proyecto, más cerca."
export const TRUST_TEXT =
  "En Bydlight Solutions puedes pagar tus proyectos mediante Webpay Plus de Transbank, utilizando los medios de pago disponibles en la plataforma. Tus datos bancarios se ingresan directamente en el entorno seguro de Webpay."
export const TRUST_POINTS = [
  "Tus datos bancarios se ingresan solo en el entorno seguro de Webpay.",
  "Bydlight no ve ni guarda los datos de tu tarjeta.",
  "Pagas el anticipo de una cotización ya aprobada.",
]
export const TRUST_STEPS = [
  { t: "Solicitas tu cotización", d: "Cuéntanos el proyecto." },
  { t: "La revisamos y aprobamos", d: "Alcance, plazos y anticipo por escrito." },
  { t: "Pagas el anticipo en Webpay", d: "Desde el enlace de tu cotización." },
]
