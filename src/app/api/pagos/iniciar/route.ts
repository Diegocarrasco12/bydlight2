import { paymentsEnabled, returnBaseUrl } from "@/lib/payments/config"
import { clientIp, rateLimited, redirectTo, sameOrigin } from "@/lib/payments/http"
import { startPayment } from "@/lib/payments/service"
import { isValidOrderId } from "@/lib/payments/store"
import type { PaymentKind } from "@/lib/payments/types"
import { SITE } from "@/lib/site"

export const dynamic = "force-dynamic"

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen no permitido.", { status: 403 })
  const form = await req.formData().catch(() => null)
  const orderId = String(form?.get("orderId") ?? "")
  const kind: PaymentKind = form?.get("kind") === "saldo" ? "saldo" : "anticipo" // el monto NO viene del cliente
  if (!isValidOrderId(orderId)) return redirectTo("/orden")
  if (!paymentsEnabled()) return redirectTo(`/orden/${orderId}?aviso=error`)
  if (rateLimited(`pay:${clientIp(req)}`, 10, 10 * 60_000)) return redirectTo(`/orden/${orderId}?aviso=error`)

  const result = await startPayment(orderId, kind, returnBaseUrl(new URL(req.url).origin, SITE.url))
  if (!result.ok) return redirectTo(`/orden/${orderId}?aviso=${result.code}`)

  // El navegador debe enviar token_ws por POST a Webpay (formulario auto-enviado).
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Redirigiendo a Webpay…</title></head>
<body style="background:#07090d;color:#f1f5f9;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">
<form id="f" method="post" action="${esc(result.url)}" style="display:grid;gap:14px;justify-items:center;padding:24px"><input type="hidden" name="token_ws" value="${esc(result.token)}">
<img src="${esc(SITE.logoSmall)}" alt="${esc(SITE.name)}" width="150" height="150" style="margin:-30px 0">
<p style="margin:0;font-size:1.15rem;font-weight:600">Te llevamos a Webpay para completar el pago</p>
<p style="margin:0;color:#9aa3b2;font-size:.92rem">Los datos de tu tarjeta se ingresan en el sitio de Transbank. No cierres esta ventana.</p>
<noscript><button type="submit" style="margin-top:8px;padding:12px 22px;border:0;border-radius:10px;background:#ff7a1a;color:#1a0d02;font-weight:700;cursor:pointer">Continuar a Webpay</button></noscript></form>
<script>document.getElementById("f").submit()</script></body></html>`
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}
