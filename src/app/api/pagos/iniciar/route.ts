import { checkoutOpenFor } from "@/lib/payments/access"
import { paymentsEnabled, returnBaseUrl } from "@/lib/payments/config"
import { clientIp, rateLimited, redirectTo, sameOrigin } from "@/lib/payments/http"
import { amountDue, startPayment } from "@/lib/payments/service"
import { isValidOrderId } from "@/lib/payments/store"
import type { PaymentKind } from "@/lib/payments/types"
import { SITE } from "@/lib/site"
import { previewMode } from "@/lib/preview"
import { previewOrder } from "@/lib/payments/preview-data"
import { redirectPreviewHtml, redirectToWebpayHtml } from "@/lib/payments/redirect-page"
import { formatClp } from "@/lib/payments/voucher"
import { checkTerms } from "@/lib/terms"

export const dynamic = "force-dynamic"

const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen no permitido.", { status: 403 })
  const form = await req.formData().catch(() => null)
  const orderId = String(form?.get("orderId") ?? "")
  const kind: PaymentKind = form?.get("kind") === "saldo" ? "saldo" : "anticipo" // el monto NO viene del cliente
  if (!isValidOrderId(orderId)) return redirectTo("/orden")
  if (previewMode()) {
    // Vista previa: simulacion. No se toca la base ni se contacta a Transbank.
    const demo = previewOrder(orderId)
    const due = demo ? amountDue(demo, kind) : null
    return new Response(redirectPreviewHtml({ backHref: `/orden/${orderId}`, amountLabel: due ? formatClp(due) : undefined }), { headers: HTML_HEADERS })
  }
  if (!paymentsEnabled()) return redirectTo(`/orden/${orderId}?aviso=error`)
  // Modo piloto: solo con la cookie firmada del administrador se puede iniciar un cobro.
  if (!checkoutOpenFor(req.headers.get("cookie"))) return redirectTo(`/orden/${orderId}?aviso=error`)
  if (rateLimited(`pay:${clientIp(req)}`, 10, 10 * 60_000)) return redirectTo(`/orden/${orderId}?aviso=error`)

  // Aceptacion de terminos: validada aqui en el servidor (la casilla del navegador no basta) y registrada en la orden.
  if (checkTerms(form?.get("acceptTerms"), form?.get("termsVersion"))) return redirectTo(`/orden/${orderId}?aviso=terminos`)

  const result = await startPayment(orderId, kind, returnBaseUrl(new URL(req.url).origin, SITE.url), { accepted: true })
  if (!result.ok) return redirectTo(`/orden/${orderId}?aviso=${result.code}`)

  // El navegador debe enviar token_ws por POST a Webpay (formulario auto-enviado).
  return new Response(redirectToWebpayHtml({ url: result.url, token: result.token }), { headers: HTML_HEADERS })
}
