import "server-only"
import { mailCredentials, mailEnabledFlag, type MailCredentials } from "./config"

export type MailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string; messageKey: string }

export class MailError extends Error {
  permanent: boolean
  /** Minutos a aplazar sin consumir intentos (cuota, limite de velocidad, clave o IP): la cola se detiene y reanuda despues. */
  deferMin?: number
  constructor(message: string, permanent = false, deferMin?: number) {
    super(message)
    this.permanent = permanent
    this.deferMin = deferMin
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

const BREVO_URL = "https://api.brevo.com/v3/smtp/email"
const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/

/** Cuerpo JSON de la API de Brevo (exportado para las pruebas). Sin cabeceras libres: nada del cliente llega a una cabecera. */
export function buildBrevoPayload(c: Pick<MailCredentials, "from" | "fromName" | "replyTo">, m: MailMessage) {
  return {
    sender: { email: c.from, name: c.fromName },
    to: [{ email: m.to.trim() }],
    replyTo: { email: (m.replyTo ?? c.replyTo).trim() },
    subject: m.subject.replace(/[\r\n]+/g, " ").trim(),
    htmlContent: m.html,
    textContent: m.text,
    tags: ["transaccional"],
  }
}

/** Codigo corto del error de Brevo (campo `code`); nunca se guarda el cuerpo completo de la respuesta. */
async function brevoCode(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { code?: unknown }
    return typeof j.code === "string" ? j.code.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) : ""
  } catch {
    return ""
  }
}

function retryAfterMin(res: Response, fallback: number): number {
  const v = Number(res.headers.get("retry-after"))
  return Number.isFinite(v) && v > 0 ? Math.min(720, Math.max(1, Math.ceil(v / 60))) : fallback
}

function brevoTransport(c: MailCredentials): MailTransport {
  return {
    async send(m) {
      if (!EMAIL_RE.test(m.to.trim())) throw new MailError("destinatario invalido", true)
      let res: Response
      try {
        res = await fetch(BREVO_URL, {
          method: "POST",
          headers: { "api-key": c.apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(buildBrevoPayload(c, m)),
          signal: AbortSignal.timeout(20_000),
        })
      } catch {
        throw new MailError("brevo sin respuesta (red o tiempo agotado)") // reintento con espera progresiva
      }
      if (res.ok) return // 201 {messageId}
      const code = await brevoCode(res)
      const tag = `brevo ${res.status}${code ? ` ${code}` : ""}`
      // Cuota agotada (plan gratuito: 300 correos/dia) o limite de velocidad: se aplaza SIN gastar intentos.
      if (res.status === 429 || res.status === 402 || code === "not_enough_credits") throw new MailError(`${tag}: cuota o limite de envios`, false, retryAfterMin(res, 60))
      // Clave invalida/revocada o IP del servidor no autorizada en Brevo: problema de configuracion, no del correo; se aplaza y no se pierde.
      if (res.status === 401 || res.status === 403) throw new MailError(`${tag}: revisar clave API e IPs autorizadas en Brevo`, false, 30)
      if (res.status >= 500 || res.status === 408) throw new MailError(tag) // transitorio: reintento normal
      throw new MailError(tag, true) // 400 y demas 4xx: mensaje o destinatario invalido; reintentar no lo arregla
    },
  }
}

/** Transporte activo, o null si el correo no esta habilitado y configurado (nada se encola ni se envia). */
export function activeTransport(): MailTransport | null {
  if (override) return mailEnabledFlag() ? override : null
  if (!mailEnabledFlag()) return null
  const c = mailCredentials()
  return c ? brevoTransport(c) : null
}

