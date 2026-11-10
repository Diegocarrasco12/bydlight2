// Cierre 2026-11-10: formularios que no filtran datos por URL, cabeceras HTTP (HSTS y CSP compatible con Webpay/Next/EmailJS/Cloudflare),
// sitemap coherente con noindex y lint sin codigo ajeno. Sin red, sin credenciales. npm test
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { CSP_DIRECTIVES, HSTS_VALUE, buildCsp, securityHeaders, WEBPAY_FORM_HOSTS } from "@/lib/securityHeaders"
import sitemap from "@/app/sitemap"

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const formTag = (code) => code.match(/<form\b[^>]*>/)?.[0] ?? ""

test("CS1. formularios de contratacion y contacto: nunca GET (datos personales fuera de la URL si falla el JavaScript)", () => {
  for (const f of ["src/components/checkout/ContractForm.tsx", "src/components/contact/ContactForm.tsx"]) {
    const tag = formTag(src(f))
    assert.match(tag, /method="post"/, `${f}: debe declarar method="post"`)
    assert.doesNotMatch(tag, /method="get"/i)
  }
  // El envio con JavaScript sigue siendo POST JSON a la API, con la proteccion de doble clic.
  const c = src("src/components/checkout/ContractForm.tsx")
  assert.match(c, /fetch\("\/api\/solicitudes", \{\s*method: "POST"/)
  assert.match(c, /disabled=\{busy\}/)
  assert.match(c, /e\.preventDefault\(\)/)
})

test("CS2. sin JavaScript el POST no crea nada: la API solo acepta JSON y el sitio no tiene formularios GET con datos", () => {
  const api = src("src/app/api/solicitudes/route.ts")
  assert.match(api, /await req\.json\(\)[\s\S]{0,80}Solicitud inv/)
  for (const f of ["src/components/checkout/ContractForm.tsx", "src/components/contact/ContactForm.tsx", "src/app/orden/[id]/page.tsx"]) {
    assert.doesNotMatch(src(f), /<form[^>]*method="get"/i)
  }
})

test("CS3. cabeceras: HSTS corto y reversible (sin preload ni includeSubDomains); el resto se conserva", () => {
  const h = Object.fromEntries(securityHeaders.map((x) => [x.key, x.value]))
  assert.equal(h["Strict-Transport-Security"], HSTS_VALUE)
  assert.match(HSTS_VALUE, /^max-age=\d+$/)
  assert.ok(Number(HSTS_VALUE.split("=")[1]) <= 86400 * 7, "vigencia inicial corta")
  assert.doesNotMatch(HSTS_VALUE, /preload|includeSubDomains/i)
  assert.equal(h["X-Content-Type-Options"], "nosniff")
  assert.equal(h["X-Frame-Options"], "DENY")
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin")
  assert.match(h["Permissions-Policy"], /camera=\(\)/)
})

test("CS4. CSP en modo solo informe (no bloquea) y compatible con Webpay, Next.js, EmailJS y Cloudflare", () => {
  const keys = securityHeaders.map((x) => x.key)
  assert.ok(keys.includes("Content-Security-Policy-Report-Only"))
  assert.ok(!keys.includes("Content-Security-Policy"), "aun no se aplica: se activa tras revisar la consola")
  const csp = buildCsp()
  // El formulario de redireccion a Transbank (y su retorno por POST) debe poder enviar a Webpay.
  for (const host of WEBPAY_FORM_HOSTS) assert.ok(CSP_DIRECTIVES["form-action"].includes(host))
  assert.ok(CSP_DIRECTIVES["form-action"].includes("'self'"))
  // Next.js y la redireccion a Webpay usan scripts y estilos en linea.
  assert.ok(CSP_DIRECTIVES["script-src"].includes("'unsafe-inline'"))
  assert.ok(CSP_DIRECTIVES["style-src"].includes("'unsafe-inline'"))
  assert.ok(!CSP_DIRECTIVES["script-src"].includes("'unsafe-eval'"), "sin unsafe-eval")
  assert.ok(CSP_DIRECTIVES["connect-src"].includes("https://api.emailjs.com"))
  assert.ok(CSP_DIRECTIVES["script-src"].includes("https://static.cloudflareinsights.com"))
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /base-uri 'self'/)
  assert.doesNotMatch(csp, /\*(?!\.)/, "sin comodines")
})

test("CS5. la pagina de redireccion a Webpay solo envia a hosts permitidos por form-action", async () => {
  const { redirectToWebpayHtml } = await import("@/lib/payments/redirect-page")
  const html = redirectToWebpayHtml({ url: "https://webpay3g.transbank.cl/webpayserver/initTransaction", token: "tok" })
  const action = html.match(/<form[^>]*action="([^"]+)"/)[1]
  assert.ok(CSP_DIRECTIVES["form-action"].includes(new URL(action).origin))
})

test("CS6. sitemap: solo paginas indexables (las legales y el checkout son noindex y no se listan)", () => {
  const urls = sitemap().map((e) => new URL(e.url).pathname)
  for (const p of ["/", "/planes", "/servicios", "/proyectos", "/nosotros", "/contacto"]) assert.ok(urls.includes(p) || p === "/" , p)
  for (const p of ["/contratar", "/orden", "/terminos", "/privacidad", "/devoluciones"]) assert.ok(!urls.includes(p), `${p} es noindex`)
  assert.equal(new Set(urls).size, urls.length, "sin duplicados")
  for (const f of ["src/app/terminos/page.tsx", "src/app/privacidad/page.tsx", "src/app/devoluciones/page.tsx", "src/app/contratar/page.tsx"]) {
    assert.match(src(f), /index: false/, `${f} debe ser noindex`)
  }
})

test("CS7. next.config usa las cabeceras versionadas y mantiene no-store para ordenes y API", () => {
  const cfg = src("next.config.ts")
  assert.match(cfg, /from "\.\/src\/lib\/securityHeaders"/)
  assert.match(cfg, /source: "\/orden\/:path\*"[\s\S]*private_/)
  assert.match(cfg, /source: "\/api\/:path\*"[\s\S]*private_/)
  assert.match(cfg, /value: "no-store"/)
  assert.match(cfg, /max-age=0, must-revalidate/)
})

test("CS8. lint: el codigo ajeno minificado (bydlightredes) esta fuera del alcance de eslint", () => {
  const cfg = src("eslint.config.mjs")
  assert.match(cfg, /"bydlightredes\/\*\*"/)
})
