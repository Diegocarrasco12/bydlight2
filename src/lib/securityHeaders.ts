/**
 * Cabeceras de seguridad HTTP (cierre 2026-11-10). Sin dependencias: las usa next.config.ts y las prueba tests/security-headers.test.mjs.
 *
 * - HSTS: vigencia corta (1 dia), sin includeSubDomains ni preload (reversible). Subirla a 6-12 meses solo tras vigilar
 *   unos dias con HTTPS forzado en Cloudflare (ver docs/auditorias/CIERRE_FINAL_BYDLIGHT2_2026-11-10.md). Los navegadores
 *   ignoran HSTS recibido por HTTP, asi que no afecta al desarrollo local.
 * - CSP: se publica en modo SOLO INFORME (Content-Security-Policy-Report-Only): el navegador registra en consola lo que
 *   bloquearia, pero NO bloquea nada. Pasar a modo de aplicacion es una decision posterior, tras revisar la consola en
 *   /, /contratar, /orden/<id> y el retorno de Webpay. Next.js emite scripts en linea (carga de la app y JSON-LD), por eso
 *   script-src lleva 'unsafe-inline'; la pagina de redireccion a Webpay (redirect-page.ts) tambien usa un script y un
 *   estilo en linea, y su formulario envia a Transbank: form-action debe permitir esos dos hosts.
 */

/** Hosts de Webpay Plus (produccion e integracion). Solo se usan como destino de formularios. */
export const WEBPAY_FORM_HOSTS = ["https://webpay3g.transbank.cl", "https://webpay3gint.transbank.cl"]

export const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'", ...WEBPAY_FORM_HOSTS],
  // static.cloudflareinsights.com: baliza de analitica que Cloudflare inyecta por el borde.
  "script-src": ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
  // EmailJS: formulario de contacto (el navegador llama a su API).
  "connect-src": ["'self'", "https://api.emailjs.com", "https://cloudflareinsights.com"],
}

export function buildCsp(directives: Record<string, string[]> = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ")
}

export const HSTS_VALUE = "max-age=86400"

export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: HSTS_VALUE },
  { key: "Content-Security-Policy-Report-Only", value: buildCsp() },
]
