import { paymentsEnabled } from "@/lib/payments/config"
import { clientIp, rateLimited, redirectTo, sameOrigin } from "@/lib/payments/http"
import { verifyOrder } from "@/lib/payments/service"
import { isValidOrderId } from "@/lib/payments/store"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen no permitido.", { status: 403 })
  const form = await req.formData().catch(() => null)
  const orderId = String(form?.get("orderId") ?? "")
  if (!isValidOrderId(orderId)) return redirectTo("/orden")
  if (paymentsEnabled() && !rateLimited(`ver:${clientIp(req)}`, 20, 10 * 60_000)) await verifyOrder(orderId)
  return redirectTo(`/orden/${orderId}`)
}
