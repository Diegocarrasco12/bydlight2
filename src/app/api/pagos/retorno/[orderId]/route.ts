import { paymentsEnabled } from "@/lib/payments/config"
import { redirectTo } from "@/lib/payments/http"
import { handleReturn, type ReturnParams } from "@/lib/payments/service"
import { isValidOrderId } from "@/lib/payments/store"

export const dynamic = "force-dynamic"

// Webpay vuelve por GET (produccion) o POST (integracion en pago abortado). Se aceptan ambos.
// El resultado NUNCA se deduce de este retorno: se confirma con Transbank desde el servidor.
const clean = (v: unknown) => (typeof v === "string" && /^[\w-]{1,100}$/.test(v) ? v : undefined)

async function handle(req: Request, orderId: string, params: URLSearchParams | FormData) {
  if (!isValidOrderId(orderId)) return redirectTo("/orden")
  if (paymentsEnabled()) {
    const p: ReturnParams = {
      tokenWs: clean(params.get("token_ws")),
      tbkToken: clean(params.get("TBK_TOKEN")),
      tbkOrden: clean(params.get("TBK_ORDEN_COMPRA")),
      tbkSesion: clean(params.get("TBK_ID_SESION")),
    }
    await handleReturn(orderId, p)
  }
  return redirectTo(`/orden/${orderId}`)
}

export async function GET(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params
  return handle(req, orderId, new URL(req.url).searchParams)
}

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params
  const form = await req.formData().catch(() => new FormData())
  return handle(req, orderId, form)
}
