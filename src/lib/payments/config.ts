import "server-only"
import fs from "node:fs"
import path from "node:path"
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk"

// Solo el servidor importa este modulo ("server-only"): las credenciales nunca llegan al navegador.
//
// Fuentes de configuracion (la primera que define el valor gana):
//   1. Variables de entorno (desarrollo, CI, o un env_file si el ejecutor lo permite).
//   2. Archivo JSON `payments.json` en el volumen de datos (PAYMENTS_CONFIG o /data/config/payments.json).
//      Es la via que no requiere `environment` en Compose: se crea una vez, con permisos 0600, en el servidor.
//      Nunca se versiona ni entra a la imagen. Se relee como maximo cada 5 s, asi que apagar los pagos
//      (enabled=false) tiene efecto casi inmediato, sin redeploy.

export type FileConfig = {
  enabled?: boolean
  env?: "integration" | "production"
  commerceCode?: string
  apiKey?: string
  publicBaseUrl?: string
  adminSecret?: string
}

function configPath(): string {
  if (process.env.PAYMENTS_CONFIG) return process.env.PAYMENTS_CONFIG
  return process.env.NODE_ENV === "production" ? "/data/config/payments.json" : path.join(process.cwd(), ".data", "payments.json")
}

let cache: { at: number; file: string; value: FileConfig } | null = null

export function fileConfig(): FileConfig {
  const file = configPath()
  const now = Date.now()
  if (cache && cache.file === file && now - cache.at < 5000) return cache.value
  let value: FileConfig = {}
  try {
    value = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ file, "utf8")) as FileConfig
  } catch {
    value = {} // sin archivo o ilegible: configuracion vacia (fail closed)
  }
  cache = { at: now, file, value }
  return value
}

/** Solo para pruebas. */
export function resetConfigCache() {
  cache = null
}

/**
 * Las solicitudes y pagos en linea solo se habilitan donde hay almacenamiento y configuracion.
 * En produccion (NODE_ENV=production) quedan APAGADOS salvo habilitacion explicita
 * (PAYMENTS_ENABLED=true o enabled=true en el archivo de configuracion). Un "false" en cualquiera de las
 * dos fuentes apaga todo.
 */
export function paymentsEnabled(): boolean {
  const flag = process.env.PAYMENTS_ENABLED
  if (flag === "false") return false
  const fileFlag = fileConfig().enabled
  if (fileFlag === false) return false
  if (flag === "true" || fileFlag === true) return true
  return process.env.NODE_ENV !== "production"
}

export type TbkMode = "integration" | "production"

export function tbkMode(): TbkMode {
  const v = process.env.TBK_ENV ?? fileConfig().env
  return v === "production" ? "production" : "integration"
}

function tbkCredentials() {
  return {
    code: process.env.TBK_COMMERCE_CODE ?? fileConfig().commerceCode,
    key: process.env.TBK_API_KEY ?? fileConfig().apiKey,
  }
}

export function createTransaction() {
  if (tbkMode() === "production") {
    const { code, key } = tbkCredentials()
    if (!code || !key) {
      throw new Error("Produccion de Webpay sin credenciales configuradas")
    }
    return new WebpayPlus.Transaction(new Options(code, key, Environment.Production, 15000))
  }
  // Ambiente de integracion: credenciales publicas de pruebas que trae el SDK oficial. No mueven dinero.
  return new WebpayPlus.Transaction(
    new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration, 15000),
  )
}

/** URL base a la que Webpay devuelve al cliente. En produccion siempre es la del sitio. */
export function returnBaseUrl(requestOrigin: string, siteUrl: string): string {
  const configured = process.env.PUBLIC_BASE_URL ?? fileConfig().publicBaseUrl
  if (configured) return configured.replace(/\/$/, "")
  return process.env.NODE_ENV === "production" ? siteUrl : requestOrigin
}

/** Secreto de la API administrativa (>= 32 caracteres). Sin secreto, la API administrativa no existe. */
export function adminSecret(): string | null {
  const s = process.env.ADMIN_API_SECRET ?? fileConfig().adminSecret
  return s && s.length >= 32 ? s : null
}
