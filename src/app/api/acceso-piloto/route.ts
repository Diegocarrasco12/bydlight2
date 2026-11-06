import { checkoutMode } from "@/lib/payments/config"
import { openDb } from "@/lib/payments/db"
import { clientIp, rateLimited } from "@/lib/payments/http"
import { PILOT_COOKIE, makePilotCookie, verifyPilotLink } from "@/lib/payments/pilot"

export const dynamic = "force-dynamic"

// Entrada al checkout en modo piloto (prueba productiva controlada). El enlace lo emite el administrador con su secreto
// (scripts/admin-remote.mjs pilot-link); es de un solo uso y vence en minutos. Todo fallo responde 404 igual: no revela nada.
const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } })

export async function GET(req: Request) {
  if (checkoutMode() !== "pilot") return NOT_FOUND()
  if (rateLimited(`pil:${clientIp(req)}`, 10, 10 * 60_000)) return NOT_FOUND()
  const v = verifyPilotLink(new URL(req.url).searchParams.get("t") ?? "")
  if (!v.ok) return NOT_FOUND()
  try {
    // Un solo uso: la huella del enlace queda registrada (misma tabla que los nonces administrativos).
    openDb().prepare("INSERT INTO admin_nonces (nonce, used_at) VALUES (?, ?)").run(v.nonce, Date.now())
  } catch {
    return NOT_FOUND() // reutilizado, o almacenamiento no disponible
  }
  const cookie = makePilotCookie(v.hours)
  if (!cookie) return NOT_FOUND()
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/contratar",
      "Set-Cookie": `${PILOT_COOKIE}=${cookie.value}; Path=/; Max-Age=${cookie.maxAge}; HttpOnly; SameSite=Lax${secure}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  })
}
