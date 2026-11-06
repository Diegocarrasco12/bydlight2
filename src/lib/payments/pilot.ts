import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { adminSecret } from "./config"

/**
 * Acceso piloto al checkout (prueba productiva controlada). Sin base de datos ni secretos nuevos: todo se deriva con HMAC
 * del secreto administrativo que ya existe solo en el servidor.
 *
 *  - Enlace de un solo uso (lo emite scripts/admin-remote.mjs pilot-link): `v1.<exp>.<horas>.<hmac>`; vale como maximo
 *    10 minutos; al usarse se registra su huella en admin_nonces (no se puede reutilizar).
 *  - Cookie de sesion (la fija /api/acceso-piloto): `v1.<exp>.<hmac>`, HttpOnly, SameSite=Lax, 1 a 8 horas.
 * Rotar el secreto administrativo invalida de inmediato todos los enlaces y cookies.
 */

export const PILOT_COOKIE = "bd_piloto"
export const PILOT_LINK_MAX_S = 600
export const PILOT_HOURS_MAX = 8

const mac = (secret: string, label: string) => createHmac("sha256", secret).update(label).digest("hex")
const eq = (a: string, b: string) => {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex")
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

/** Para pruebas y para el cliente administrativo (mismo algoritmo en scripts/admin-remote.mjs). */
export function signPilotLink(secret: string, nowMs: number, minutes: number, hours: number): string {
  const exp = Math.floor(nowMs / 1000) + Math.round(minutes * 60)
  return `v1.${exp}.${hours}.${mac(secret, `pilot-link.v1.${exp}.${hours}`)}`
}

export function verifyPilotLink(token: string, nowMs = Date.now(), secret = adminSecret()): { ok: true; nonce: string; hours: number } | { ok: false } {
  if (!secret || typeof token !== "string" || token.length > 200) return { ok: false }
  const m = /^v1\.(\d{9,11})\.(\d{1,2})\.([0-9a-f]{64})$/.exec(token)
  if (!m) return { ok: false }
  const exp = Number(m[1]), hours = Number(m[2]), now = Math.floor(nowMs / 1000)
  if (!(hours >= 1 && hours <= PILOT_HOURS_MAX)) return { ok: false }
  if (exp <= now || exp - now > PILOT_LINK_MAX_S) return { ok: false }
  if (!eq(m[3], mac(secret, `pilot-link.v1.${exp}.${hours}`))) return { ok: false }
  return { ok: true, nonce: m[3], hours }
}

export function makePilotCookie(hours: number, nowMs = Date.now(), secret = adminSecret()): { value: string; maxAge: number } | null {
  if (!secret) return null
  const exp = Math.floor(nowMs / 1000) + hours * 3600
  return { value: `v1.${exp}.${mac(secret, `pilot-cookie.v1.${exp}`)}`, maxAge: hours * 3600 }
}

export function pilotCookieValid(value: string | undefined | null, nowMs = Date.now(), secret = adminSecret()): boolean {
  if (!secret || !value || value.length > 200) return false
  const m = /^v1\.(\d{9,11})\.([0-9a-f]{64})$/.exec(value)
  if (!m) return false
  const exp = Number(m[1]), now = Math.floor(nowMs / 1000)
  if (exp <= now || exp - now > PILOT_HOURS_MAX * 3600) return false
  return eq(m[2], mac(secret, `pilot-cookie.v1.${exp}`))
}

/** Valor de una cookie dentro de la cabecera Cookie. */
export function cookieValue(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}
