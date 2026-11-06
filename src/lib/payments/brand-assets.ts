import "server-only"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { PAYMENT_LOGOS, type BrandLogo } from "./availability"
import { previewMode } from "@/lib/preview"

/**
 * Marcas de pago para PaymentBrandShowcase.
 *
 *  - PUBLICAS (produccion): solo las de PAYMENT_LOGOS (archivos en public/img/pagos/, con autorizacion verificada).
 *  - VISTA PREVIA LOCAL: ademas, los logos de tarjetas descargados cuya marca aun NO esta confirmada, desde
 *    assets-pendientes/pagos/ (carpeta fuera de public/, ignorada por git y por Docker). Se sirven solo en vista previa por
 *    /vista-previa/logos/<id>.<ext>. En produccion esta ruta no existe, asi que una marca no verificada no puede publicarse.
 */

export type BrandId = "webpay" | "visa" | "mastercard" | "amex" | "redcompra"

/** Estado de cada marca (ver docs/WEBPAY-LOGOS-FUENTES.md). Webpay Plus y Transbank: autorizados por escrito. Tarjetas: pendientes de confirmar con el area comercial. */
export const BRAND_STATUS: Record<BrandId, { name: string; file: string; pending: string }> = {
  webpay: { name: "Webpay Plus", file: "webpay-plus.png", pending: "Autorizado por escrito por Transbank (comercio con productos contratados); ya publicado." },
  visa: { name: "Visa", file: "visa", pending: "Confirmar que Visa está habilitada en el contrato del comercio y descargar el logo desde brand.visa.com." },
  mastercard: { name: "Mastercard", file: "mastercard", pending: "Confirmar que Mastercard está habilitada y aceptar el Artwork Download Agreement en mastercard.com/brandcenter." },
  amex: { name: "American Express", file: "amex", pending: "No confirmada para el comercio: requiere habilitación y material oficial de American Express." },
  redcompra: { name: "Redcompra", file: "redcompra", pending: "Redcompra es marca de Transbank: pedir el logo y la autorización por escrito." },
}

const ROOT = join(process.cwd(), "assets-pendientes", "pagos")
export const CARD_DIR = join(ROOT, "cards")
export const CARD_IDS = ["visa", "mastercard", "amex", "redcompra"] as const

function pngSize(file: string): { width: number; height: number } | null {
  try { const b = readFileSync(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } } catch { return null }
}
function svgSize(file: string): { width: number; height: number } | null {
  try {
    const s = readFileSync(file, "utf8").slice(0, 2000)
    const vb = s.match(/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/)
    if (vb) return { width: Number(vb[1]), height: Number(vb[2]) }
    const w = s.match(/\bwidth="([\d.]+)/), h = s.match(/\bheight="([\d.]+)/)
    return w && h ? { width: Number(w[1]), height: Number(h[1]) } : null
  } catch { return null }
}

/** Logotipo de Transbank (procesador de pagos), autorizado por escrito. */
export function transbankLogo(): BrandLogo | null { return PAYMENT_LOGOS.transbank }

export type ResolvedBrand = { id: BrandId; name: string; logo: BrandLogo | null; pending: boolean }

/** Marcas que se muestran: publicas verificadas, o (solo vista previa) archivos oficiales pendientes y recuadros rotulados. */
export function resolveBrands(): { webpay: ResolvedBrand; cards: ResolvedBrand[] } {
  const preview = previewMode()
  const webpay: ResolvedBrand = { id: "webpay", name: BRAND_STATUS.webpay.name, logo: PAYMENT_LOGOS.webpay, pending: false }
  const cards: ResolvedBrand[] = []
  if (PAYMENT_LOGOS.cards.length) {
    PAYMENT_LOGOS.cards.forEach((l) => cards.push({ id: "visa", name: l.alt, logo: l, pending: false }))
  } else if (preview) {
    for (const id of CARD_IDS) {
      let logo: BrandLogo | null = null
      for (const ext of ["svg", "png"] as const) {
        const f = join(CARD_DIR, `${id}.${ext}`)
        if (existsSync(f)) {
          const d = ext === "png" ? pngSize(f) : svgSize(f)
          if (d) { logo = { src: `/vista-previa/logos/${id}.${ext}`, alt: BRAND_STATUS[id].name, ...d }; break }
        }
      }
      cards.push({ id, name: BRAND_STATUS[id].name, logo, pending: true })
    }
  }
  return { webpay, cards }
}
