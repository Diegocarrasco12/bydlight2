import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CARD_DIR, WEBPAY_PENDING_FILE } from "@/lib/payments/brand-assets"
import { previewMode } from "@/lib/preview"

// Sirve, solo en vista previa local, los logotipos oficiales descargados que aun no tienen autorizacion de uso publico.
export const dynamic = "force-dynamic"

const NOT_FOUND = () => new Response("Not found", { status: 404 })

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  if (!previewMode()) return NOT_FOUND()
  const { file } = await ctx.params
  let path: string | null = null
  if (file === "webpay-plus.png") path = WEBPAY_PENDING_FILE
  else if (/^(visa|mastercard|amex|redcompra)\.(svg|png)$/.test(file)) path = join(CARD_DIR, file)
  if (!path) return NOT_FOUND()
  try {
    const body = readFileSync(path)
    return new Response(body, { headers: { "Content-Type": file.endsWith(".svg") ? "image/svg+xml" : "image/png", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } })
  } catch {
    return NOT_FOUND()
  }
}
