import "server-only"
import fs from "node:fs"
import path from "node:path"
import { previewMode } from "@/lib/preview"

// Configuracion del correo transaccional. Mismas reglas que payments.json: los secretos viven SOLO en el servidor
// (variables de entorno o /data/config/mail.json con permisos 0600); nunca en el repositorio ni en la imagen.
//
// Proveedor implementado: API de Gmail con OAuth2 (scope gmail.send) para enviar desde bydlightsolutions@gmail.com SIN usar la
// contrasena de la cuenta. Requiere (pendiente de configurar por el titular): proyecto en Google Cloud con la API de Gmail,
// cliente OAuth (id y secreto) y un refresh token obtenido una vez. Ver docs/CORREOS-TRANSACCIONALES.md.

export type MailFileConfig = {
  enabled?: boolean
  provider?: "gmail-oauth2"
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  /** Remitente (debe ser la cuenta autorizada). Por defecto el correo oficial. */
  from?: string
  /** Destino de las notificaciones internas (nuevas solicitudes, alertas). Por defecto, el correo oficial. */
  notifyTo?: string
}

export const OFFICIAL_EMAIL = "bydlightsolutions@gmail.com"

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

export type MailCredentials = { clientId: string; clientSecret: string; refreshToken: string; from: string; notifyTo: string }

/** Credenciales completas, o null si el correo no esta configurado (en ese caso NO se encola ni se envia nada). */
export function mailCredentials(): MailCredentials | null {
  const f = mailFileConfig()
  const clientId = process.env.MAIL_CLIENT_ID ?? f.clientId
  const clientSecret = process.env.MAIL_CLIENT_SECRET ?? f.clientSecret
  const refreshToken = process.env.MAIL_REFRESH_TOKEN ?? f.refreshToken
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken, from: f.from ?? OFFICIAL_EMAIL, notifyTo: f.notifyTo ?? OFFICIAL_EMAIL }
}

export function mailEnabledFlag(): boolean {
  if (previewMode()) return false // la vista previa nunca envia correos
  if (process.env.MAIL_ENABLED === "false") return false
  return process.env.MAIL_ENABLED === "true" || mailFileConfig().enabled === true
}
