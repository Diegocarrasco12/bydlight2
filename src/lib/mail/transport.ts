import "server-only"
import { createHash } from "node:crypto"
import { mailCredentials, mailEnabledFlag, OFFICIAL_EMAIL, type MailCredentials } from "./config"

export type MailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string; messageKey: string }

export class MailError extends Error {
  permanent: boolean
  constructor(message: string, permanent = false) {
    super(message)
    this.permanent = permanent
  }
}

export interface MailTransport {
  send(m: MailMessage): Promise<void>
}

// Doble de prueba: las pruebas fijan un transporte falso y NUNCA se envia un correo real.
let override: MailTransport | null = null
export function setMailTransportForTests(t: MailTransport | null) {
  override = t
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64")
const wrap = (s: string) => s.replace(/(.{76})/g, "$1\r\n")
const headerWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`)

/** Mensaje RFC 822 multipart/alternative (texto + HTML), UTF-8, sin cabeceras controladas por el usuario. */
export function buildRfc822(from: string, m: MailMessage): string {
  const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim() // impide inyeccion de cabeceras
  const boundary = `bd_${createHash("sha256").update(m.messageKey).digest("hex").slice(0, 24)}`
  const lines = [
    `From: Bydlight Solutions <${clean(from)}>`,
    `To: ${clean(m.to)}`,
    ...(m.replyTo ? [`Reply-To: ${clean(m.replyTo)}`] : []),
    `Subject: ${headerWord(clean(m.subject))}`,
    "MIME-Version: 1.0",
    "Auto-Submitted: auto-generated",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(m.text)),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(m.html)),
    `--${boundary}--`,
    "",
  ]
  return lines.join("\r\n")
}

let tokenCache: { value: string; exp: number } | null = null

async function accessToken(c: MailCredentials): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.value
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new MailError(`oauth ${res.status}`, res.status === 400 || res.status === 401) // credenciales revocadas: no reintentar a ciegas
  const j = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new MailError("oauth sin access_token", true)
  tokenCache = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3000) * 1000 }
  return j.access_token
}

function gmailTransport(c: MailCredentials): MailTransport {
  return {
    async send(m) {
      const token = await accessToken(c)
      const raw = Buffer.from(buildRfc822(c.from, m), "utf8").toString("base64url")
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 401) tokenCache = null
      if (!res.ok) throw new MailError(`gmail ${res.status}`, res.status === 400) // 400 = mensaje o destinatario invalido
    },
  }
}

/** Transporte activo, o null si el correo no esta habilitado y configurado (nada se encola ni se envia). */
export function activeTransport(): MailTransport | null {
  if (override) return mailEnabledFlag() ? override : null
  if (!mailEnabledFlag()) return null
  const c = mailCredentials()
  return c ? gmailTransport(c) : null
}

export { OFFICIAL_EMAIL }
