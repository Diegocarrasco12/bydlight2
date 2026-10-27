import { paymentsEnabled } from "@/lib/payments/config"
import { clientIp, json, rateLimited, sameOrigin } from "@/lib/payments/http"
import { createOrder, parseSolicitud } from "@/lib/payments/service"
import { storageWritable } from "@/lib/payments/store"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Origen no permitido." }, 403)
  if (!paymentsEnabled() || !(await storageWritable())) {
    return json({ error: "Las solicitudes en línea no están disponibles por ahora. Escríbenos por WhatsApp." }, 503)
  }
  if (rateLimited(`sol:${clientIp(req)}`, 5, 10 * 60_000)) {
    return json({ error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." }, 429)
  }
  if (Number(req.headers.get("content-length") ?? 0) > 10_000) return json({ error: "Solicitud demasiado grande." }, 413)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: "Solicitud inválida." }, 400)
  }
  if (typeof body.website === "string" && body.website !== "") {
    // Campo trampa para bots: se responde como exito sin crear nada.
    return json({ id: "XXXXXXXXXXXX" })
  }

  const parsed = parseSolicitud(body)
  if (!parsed.ok) return json({ error: parsed.errors.join(" ") }, 422)

  const order = await createOrder(parsed.data)
  return json({ id: order.id }, 201)
}
