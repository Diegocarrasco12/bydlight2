import "server-only"
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk"

// Solo el servidor importa este modulo ("server-only"): las credenciales nunca llegan al navegador.

/**
 * Las solicitudes y pagos en linea solo se habilitan donde hay almacenamiento y configuracion.
 * En produccion (NODE_ENV=production) quedan APAGADOS salvo PAYMENTS_ENABLED=true explicito.
 */
export function paymentsEnabled(): boolean {
  const flag = process.env.PAYMENTS_ENABLED
  if (flag === "true") return true
  if (flag === "false") return false
  return process.env.NODE_ENV !== "production"
}

export type TbkMode = "integration" | "production"

export function tbkMode(): TbkMode {
  return process.env.TBK_ENV === "production" ? "production" : "integration"
}

export function createTransaction() {
  if (tbkMode() === "production") {
    const code = process.env.TBK_COMMERCE_CODE
    const key = process.env.TBK_API_KEY
    if (!code || !key) {
      throw new Error("Produccion de Webpay sin credenciales configuradas")
    }
    return new WebpayPlus.Transaction(new Options(code, key, Environment.Production))
  }
  // Ambiente de integracion: credenciales publicas de pruebas que trae el SDK oficial. No mueven dinero.
  return new WebpayPlus.Transaction(
    new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration, 15000),
  )
}

/** URL base a la que Webpay devuelve al cliente. En produccion siempre es la del sitio. */
export function returnBaseUrl(requestOrigin: string, siteUrl: string): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "")
  return process.env.NODE_ENV === "production" ? siteUrl : requestOrigin
}
