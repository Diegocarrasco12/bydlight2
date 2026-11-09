import "server-only"
import fs from "node:fs"
import path from "node:path"
import { previewMode } from "@/lib/preview"

// Configuracion del correo transaccional. Mismas reglas que payments.json: los secretos viven SOLO en el servidor
// (variables de entorno o /data/config/mail.json con permisos 0600); nunca en el repositorio ni en la imagen.
//
// Proveedor: Brevo (API transaccional HTTPS, POST /v3/smtp/email). Remitente con dominio propio autenticado (DKIM/DMARC) en
// notificaciones@bydlightsolutions.com; las respuestas de los clientes van a contacto@ (recepcion en Zoho Mail). Unico secreto: la
// clave API de Brevo (`apiKey`), que se instala en el servidor con scripts/mail-config-set.mjs --init (entrada oculta).
// Ver docs/CORREOS-TRANSACCIONALES.md.

export type MailFileConfig = {
  enabled?: boolean
  provider?: "brevo"
  /** Clave API de Brevo (xkeysib-...). Solo en el servidor. */
  apiKey?: string
  /** Remitente (debe ser un remitente autenticado en Brevo). */
  from?: string
  fromName?: string
  /** Direccion a la que responde el cliente. */
  replyTo?: string
  /** Destino de las notificaciones internas (nuevas solicitudes, alertas): un buzon que reciba Zoho. */
  notifyTo?: string
}

export const MAIL_SENDER = "notificaciones@bydlightsolutions.com"
export const MAIL_SENDER_NAME = "Bydlight Solutions"
export const MAIL_REPLY_TO = "contacto@bydlightsolutions.com"

function configPath(): string {
  if (process.env.MAIL_CONFIG) return process.env.MAIL_CONFIG
  return process.env.NODE_ENV === "production" ? "/data/config/mail.json" : path.join(process.cwd(), ".data", "mail.json")
}

let cache: { at: number; file: string; value: MailFileConfig } | null = null

export function mailFileConfig(): MailFileConfig {
  const file = configPath()
  const now = Date.now()
  if (cache && cache.file === file && now - cache.at < 5000) return cache.value
  let value: MailFileConfig = {}
  try {
    value = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ file, "utf8")) as MailFileConfig
  } catch {
    value = {}
  }
  cache = { at: now, file, value }
  return value
}

export function resetMailConfigCache() {
  cache = null
}

export type MailCredentials = { apiKey: string; from: string; fromName: string; replyTo: string; notifyTo: string }

/** Credenciales completas, o null si el correo no esta configurado (en ese caso NO se encola ni se envia nada). */
export function mailCredentials(): MailCredentials | null {
  const f = mailFileConfig()
  const apiKey = (process.env.MAIL_BREVO_API_KEY ?? f.apiKey ?? "").trim()
  if (!apiKey) return null
  return {
    apiKey,
    from: f.from ?? MAIL_SENDER,
    fromName: f.fromName ?? MAIL_SENDER_NAME,
    replyTo: f.replyTo ?? MAIL_REPLY_TO,
    notifyTo: f.notifyTo ?? MAIL_REPLY_TO,
  }
}

export function mailEnabledFlag(): boolean {
  if (previewMode()) return false // la vista previa nunca envia correos
  if (process.env.MAIL_ENABLED === "false") return false
  return process.env.MAIL_ENABLED === "true" || mailFileConfig().enabled === true
}
