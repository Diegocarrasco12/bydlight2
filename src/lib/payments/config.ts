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
import { previewMode } from "@/lib/preview"
import { ONLINE_CHECKOUT_UI } from "@/lib/plans"
import { LEGAL_PAGES_PUBLISHED } from "@/lib/legal"

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
  /** Permiso explicito para devoluciones desde la API administrativa. Ausente o false = deshabilitadas. */
  adminRefunds?: boolean
  /**
   * Quien puede usar el checkout cuando enabled=true. Ausente = "pilot" en produccion (acceso controlado por enlace firmado).
   * "public" solo surte efecto si el codigo publicado tiene ONLINE_CHECKOUT_UI=true Y LEGAL_PAGES_PUBLISHED=true.
   */
  access?: "pilot" | "public"
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
  if (previewMode()) return true // vista previa local con datos de demostracion (nunca en produccion)
  const flag = process.env.PAYMENTS_ENABLED
  if (flag === "false") return false
  const fileFlag = fileConfig().enabled
  if (fileFlag === false) return false
  if (flag === "true" || fileFlag === true) return true
  return process.env.NODE_ENV !== "production"
}

/**
 * Modo de acceso al checkout (solicitudes, /contratar, inicio de pago). Explicito y reversible:
 *  - closed: pagos apagados (enabled=false o sin configuracion). Nada se abre.
 *  - pilot:  pagos habilitados pero SOLO quien entre con el enlace firmado del administrador (cookie HMAC de corta vida).
 *            Es el modo de la prueba productiva: terceros no pueden crear ordenes ni iniciar cobros.
 *  - public: abierto a todos. Exige access="public" en payments.json Y, en el codigo desplegado, ONLINE_CHECKOUT_UI=true y
 *            LEGAL_PAGES_PUBLISHED=true (si falta alguno, se degrada a pilot).
 * Los retornos de Webpay, la verificacion de estado y la API administrativa dependen de paymentsEnabled(), no de este modo.
 * En desarrollo (NODE_ENV != production) y en la vista previa el valor por defecto es public (sandbox, sin cobros reales).
 */
export type CheckoutMode = "closed" | "pilot" | "public"

export function publicCheckoutReady(): boolean {
  return ONLINE_CHECKOUT_UI && LEGAL_PAGES_PUBLISHED
}

export function checkoutMode(): CheckoutMode {
  if (previewMode()) return "public"
  if (!paymentsEnabled()) return "closed"
  const explicit = process.env.PAYMENTS_ACCESS ?? fileConfig().access
  if (explicit === "public") return publicCheckoutReady() ? "public" : "pilot"
  if (explicit === "pilot") return "pilot"
  return process.env.NODE_ENV === "production" ? "pilot" : "public"
}

export type TbkMode = "integration" | "production"

export function tbkMode(): TbkMode {
  if (previewMode()) return "integration" // la vista previa nunca usa produccion
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
  // Defensa en profundidad: en vista previa no existe ninguna transaccion posible, ni de integracion.
  if (previewMode()) throw new Error("Vista previa: los pagos estan simulados y no se comunican con Transbank")
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

/** Las devoluciones por la API administrativa exigen, ademas de la firma, este permiso explicito (apagado por defecto). */
export function adminRefundsEnabled(): boolean {
  const flag = process.env.ADMIN_REFUNDS
  if (flag === "false") return false
  return flag === "true" || fileConfig().adminRefunds === true
}

/** Secreto de la API administrativa (>= 32 caracteres). Sin secreto, la API administrativa no existe. */
export function adminSecret(): string | null {
  const s = process.env.ADMIN_API_SECRET ?? fileConfig().adminSecret
  return s && s.length >= 32 ? s : null
}
