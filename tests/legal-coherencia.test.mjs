// Coherencia de los documentos legales entre si y con el sitio: acceso, modalidades, estados de pago, tratamiento tributario sin
// afirmaciones incorrectas, sin fechas de aprobacion inventadas ni contradicciones. Lectura de archivos (sin red). npm test
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const read = (f) => readFileSync(join(root, f), "utf8")
const DOCS = ["terminos", "privacidad", "devoluciones", "soporte", "servicios-digitales", "informacion-comercial"]
const page = (d) => read(`src/app/${d}/page.tsx`)
const text = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")
const legal = await import("../src/lib/legal.ts")

test("LG1. los seis documentos estan en el indice, el menu lateral y el pie de pagina", () => {
  assert.deepEqual(legal.LEGAL_DOCS.map((d) => d.href).sort(), DOCS.map((d) => `/${d}`).sort())
  assert.match(read("src/components/footer/Footer.tsx"), /LEGAL_DOCS/)
  assert.match(read("src/components/legal/LegalPage.tsx"), /LEGAL_DOCS/)
  assert.match(read("src/app/legal/page.tsx"), /LEGAL_DOCS/)
})

test("LG2. la contratacion enlaza terminos, devoluciones y privacidad antes de aceptar (solicitud y pago)", () => {
  const form = read("src/components/checkout/ContractForm.tsx")
  for (const href of ["/terminos", "/devoluciones", "/privacidad"]) assert.ok(form.includes(`href="${href}"`), `formulario ${href}`)
  const orden = read("src/app/orden/[id]/page.tsx")
  for (const href of ["/terminos", "/devoluciones", "/privacidad"]) assert.ok(orden.includes(`"${href}"`), `orden ${href}`)
})

test("LG3. se explican las dos modalidades: precio publicado (directa) y proyectos a medida fuera del pago en linea", () => {
  for (const d of ["terminos", "informacion-comercial"]) {
    const t = text(page(d))
    assert.match(t, /precio publicado/i, d)
    assert.match(t, /a medida/i, d)
    assert.match(t, /no se (contratan ni se )?pagan por el pago en l[ií]nea/i, d)
  }
  assert.match(text(page("terminos")), /No se cobra nada antes/)
})

test("LG4. estados de pago explicados: autorizado, pendiente (ni confirmacion ni rechazo), rechazado, cancelado/expirado y devuelto", () => {
  const t = text(page("informacion-comercial"))
  for (const k of ["Autorizado:", "Pendiente de confirmación:", "Rechazado:", "Cancelado o expirado:", "Devuelto:"]) assert.ok(t.includes(k), k)
  assert.match(t, /No es una confirmación de pago ni un rechazo/)
  assert.match(page("informacion-comercial"), /id="pagos"/)
  assert.match(page("terminos"), /informacion-comercial#pagos/)
})

test("LG5. tratamiento tributario: el comprobante interno no es boleta, el voucher puede tener validez, la factura no es automatica", () => {
  assert.match(legal.TAX_NOTE, /no es una boleta ni una factura/)
  assert.match(legal.TAX_NOTE, /medio de pago puede tener validez tributaria/)
  assert.match(legal.TAX_NOTE, /no se emite de forma automática/)
  const all = DOCS.map((d) => text(page(d))).join(" ") + " " + text(read("src/lib/mail/templates.ts")) + " " + text(read("src/app/orden/[id]/page.tsx"))
  assert.doesNotMatch(all, /este comprobante (es|constituye|equivale a) (una )?(boleta|factura)/i)
  assert.doesNotMatch(all, /(emitimos|emite|enviaremos)[^.]{0,40}(factura|boleta)[^.]{0,30}autom[aá]tic/i)
  assert.doesNotMatch(all, /facturaci[oó]n autom[aá]tica/i)
  const info = text(page("informacion-comercial"))
  assert.match(info, /no son una boleta ni una factura/)
  assert.match(info, /La factura no se emite de forma automática/)
  assert.match(info, /habilitación vigente de Bydlight ante el SII/)
  assert.match(info, /nota de crédito/)
  assert.match(text(page("terminos")), /no son una boleta ni una factura/)
  assert.match(read("src/lib/mail/templates.ts"), /NO_TAX_DOC = TAX_NOTE/)
  assert.match(read("src/app/orden/[id]/page.tsx"), /\{TAX_NOTE\}/)
})

test("LG6. un solo correo de contacto en todo el sitio; ningun documento usa fechas de aprobacion ni afirma aprobacion legal", () => {
  assert.equal(/email: "([^"]+)"/.exec(read("src/lib/site.ts"))[1], "contacto@bydlightsolutions.com")
  for (const d of DOCS) {
    const raw = page(d)
    assert.ok(!/@gmail\.com/.test(raw), d)
    const t = text(raw)
    assert.doesNotMatch(t, /aprobad[oa]s? (por|el)|revisad[oa] por (un )?abogad|certificad[oa]|cumple (con )?(totalmente|plenamente)/i, d)
    assert.doesNotMatch(t, /vigente desde|actualizad[oa] el|[úu]ltima actualizaci[oó]n/i, d)
  }
})

test("LG7. cookies: la politica describe el uso real (sin analitica ni publicidad) y el codigo no incorpora herramientas de seguimiento", () => {
  assert.match(text(page("privacidad")), /no usa cookies de analítica, publicidad ni seguimiento/)
  assert.match(page("privacidad"), /id="cookies"/)
  assert.doesNotMatch(read("src/app/layout.tsx"), /googletagmanager|google-analytics|gtag\(|fbq\(|hotjar|clarity\.ms/i)
})

test("LG8. privacidad nombra a todos los proveedores que usa el codigo: Transbank, EmailJS, Brevo, Zoho y Cloudflare", () => {
  const t = text(page("privacidad"))
  for (const p of ["Transbank", "EmailJS", "Brevo", "Zoho Mail", "Cloudflare"]) assert.ok(t.includes(p), p)
  assert.match(read("src/lib/mail/transport.ts"), /api\.brevo\.com/)
})

test("LG9. la version de los terminos es una etiqueta de edicion (no una fecha de aprobacion) y no es borrador", async () => {
  const { TERMS_VERSION } = await import("../src/lib/terms.ts")
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}-r\d+$/)
  assert.ok(!/borrador/i.test(TERMS_VERSION))
})

test("LG10. los derechos del consumidor no se restringen: retracto sin exclusion general y sin anticipos irreembolsables", () => {
  const t = text(page("devoluciones"))
  assert.match(t, /no excluye en forma general este derecho/)
  assert.match(t, /no considera irreembolsables todos los anticipos/)
  assert.match(t, /10 días/)
  assert.match(t, /90 días/)
  assert.match(text(page("terminos")), /ninguna cláusula de estos términos limita ni renuncia/)
})

test("LG11. clausulas comerciales propuestas: sin aprobacion por silencio, anticipo 50 %, vigencia 7 dias, licencias y dominios", () => {
  const t = text(page("terminos"))
  assert.match(t, /El silencio del cliente no equivale a aprobación/)
  assert.doesNotMatch(t, /se entienden dadas cuando el cliente las confirma o vence/)
  assert.match(t, /anticipo habitual es del 50 %/)
  assert.match(t, /vigencia habitual de 7 días/)
  assert.match(t, /componentes preexistentes y reutilizables de Bydlight[^.]*son de propiedad de Bydlight/)
  assert.match(t, /definen expresamente en la cotización o contrato/)
  assert.match(t, /Preferentemente, los dominios y cuentas del proyecto se registran a nombre del cliente/)
})
