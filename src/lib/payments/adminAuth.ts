import "server-only"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { adminSecret } from "./config"
import { openDb } from "./db"
import { clientIp, rateLimited } from "./http"

// Autenticacion de la API administrativa: peticion firmada con HMAC-SHA256.
//   firma = HMAC(secreto, `${timestamp}.${nonce}.${METODO}.${ruta}.${sha256(cuerpo)}`)
// Cabeceras: X-Admin-Timestamp (ms), X-Admin-Nonce (hex 16-64), X-Admin-Signature (hex).
// El secreto nunca viaja: no se puede reutilizar una peticion capturada (ventana de 60 s + nonce de un solo uso),
// ni modificar su cuerpo sin invalidar la firma. Sin secreto configurado, la API no existe (404).

export const ADMIN_WINDOW_MS = 60_000

export function signAdminRequest(secret: string, ts: number, nonce: string, method: string, pathname: string, body: string) {
  const bodyHash = createHash("sha256").update(body).digest("hex")
  return createHmac("sha256", secret).update(`${ts}.${nonce}.${method.toUpperCase()}.${pathname}.${bodyHash}`).digest("hex")
}

export type AdminAuth = { ok: true } | { ok: false; status: 401 | 404 | 429 }

export function verifyAdminRequest(req: Request, body: string, now = Date.now()): AdminAuth {
  const secret = adminSecret()
  if (!secret) return { ok: false, status: 404 }
  // Tope de peticiones por IP (el uso legitimo es de unas pocas por dia), antes de calcular nada.
  if (rateLimited(`adm:${clientIp(req)}`, 30, 10 * 60_000)) return { ok: false, status: 429 }
  const fail = (): AdminAuth => ({ ok: false, status: 401 })

  const ts = Number(req.headers.get("x-admin-timestamp"))
  const nonce = req.headers.get("x-admin-nonce") ?? ""
  const sig = req.headers.get("x-admin-signature") ?? ""
  if (!Number.isFinite(ts) || Math.abs(now - ts) > ADMIN_WINDOW_MS) return fail()
  if (!/^[0-9a-f]{16,64}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) return fail()

  const url = new URL(req.url)
  const expected = signAdminRequest(secret, ts, nonce, req.method, url.pathname, body)
  const a = Buffer.from(sig, "hex")
  const b = Buffer.from(expected, "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail()

  // Un solo uso por nonce (la base sobrevive a reinicios). Se purgan los vencidos.
  const db = openDb()
  db.prepare("DELETE FROM admin_nonces WHERE used_at < ?").run(now - 10 * ADMIN_WINDOW_MS)
  try {
    db.prepare("INSERT INTO admin_nonces (nonce, used_at) VALUES (?, ?)").run(nonce, now)
  } catch {
    return fail() // repeticion
  }
  return { ok: true }
}
