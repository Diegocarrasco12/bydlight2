import "server-only"
import { SITE } from "@/lib/site"

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  )
}

// Limitador en memoria (una sola instancia). Frena abuso basico; Cloudflare agrega proteccion perimetral.
const hits = new Map<string, { n: number; reset: number }>()

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cur = hits.get(key)
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs })
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    return false
  }
  cur.n += 1
  return cur.n > max
}

/** Acepta solo peticiones originadas en nuestro propio sitio (defensa contra CSRF). */
export function sameOrigin(req: Request): boolean {
  const allowed = new Set([SITE.url, new URL(req.url).origin])
  if (process.env.PUBLIC_BASE_URL) allowed.add(process.env.PUBLIC_BASE_URL.replace(/\/$/, ""))
  const origin = req.headers.get("origin")
  if (origin) return allowed.has(origin)
  const site = req.headers.get("sec-fetch-site")
  return site === "same-origin" || site === "none"
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

export function redirectTo(url: string) {
  return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } })
}
