// Cierre legal: identificacion de la sociedad, ausencia de marcadores y de datos que no deben publicarse. Lectura de archivos (sin red). npm test
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|mjs|css)$/.test(n)) out.push(p)
  }
  return out
}
const src = walk(join(root, "src"))
const read = (f) => readFileSync(join(root, f), "utf8")
const LEGAL = ["terminos", "privacidad", "devoluciones", "soporte", "servicios-digitales", "informacion-comercial"]

test("G1. ninguna pagina legal usa marcadores [PENDIENTE] (se podria publicar sin que el build falle)", () => {
  for (const p of LEGAL) assert.ok(!/<Pend[ >]/.test(read(`src/app/${p}/page.tsx`)), p)
})

test("G2. la identificacion usa el RUT de la sociedad y nunca el RUT personal del solicitante", () => {
  const c = read("src/lib/company.ts")
  assert.match(c, /78\.161\.844-6/)
  assert.match(c, /Bydlight Solutions SpA/)
  for (const f of src) assert.ok(!readFileSync(f, "utf8").includes(["18.087", "534-4"].join(".")), f)
  assert.match(read("src/app/terminos/page.tsx"), /COMPANY\.rut/)
  assert.match(read("src/app/privacidad/page.tsx"), /COMPANY\.rut/)
  assert.match(read("src/app/informacion-comercial/page.tsx"), /COMPANY\.rut/)
})

test("G3. no se publica el codigo de comercio ni credenciales; el nombre de la sociedad es el oficial", () => {
  for (const f of src) {
    const t = readFileSync(f, "utf8")
    assert.ok(!t.includes(["5970", "5310", "9914"].join("")), f)
    if (!f.endsWith("legal.ts")) assert.ok(!/Byd Light Solutions SpA/.test(t), `nombre antiguo en ${f}`)
  }
})

test("G4. la politica de privacidad no afirma que no se guarda ningun dato de la tarjeta", () => {
  const t = read("src/app/privacidad/page.tsx") + read("src/app/terminos/page.tsx")
  assert.match(t, /últimos 4 dígitos/)
  assert.ok(!/no almacena los datos de (la|tu) tarjeta/i.test(t))
})

test("G5. el retracto no se excluye en forma general ni se declaran irreembolsables todos los anticipos", () => {
  const t = read("src/app/devoluciones/page.tsx")
  assert.match(t, /no excluye en forma general/)
  assert.match(t, /no considera irreembolsables todos los anticipos/)
  assert.ok(!/anticipo[^.]*no (es|son) reembolsable/i.test(t))
})

test("G6. aceptacion de terminos: casilla sin premarcar y version nueva del texto", () => {
  const form = read("src/components/checkout/ContractForm.tsx")
  assert.ok(!/name="acceptTerms"[^>]*(defaultChecked|checked)/.test(form))
  assert.ok(!/name="acceptTerms"[^>]*(defaultChecked|checked)/.test(read("src/app/orden/[id]/page.tsx")))
  assert.match(read("src/lib/terms.ts"), /borrador-2026-11-06-r3/)
})

test("G7. el cierre legal no activo nada: banderas y pagos siguen cerrados", () => {
  assert.match(read("src/lib/plans.ts"), /ONLINE_CHECKOUT_UI\s*=\s*false/)
  assert.match(read("src/lib/legal.ts"), /LEGAL_PAGES_PUBLISHED\s*=\s*false/)
})

test("G8. cookies: el codigo no usa analitica, publicidad ni almacenamiento local (afirmacion de la politica)", () => {
  for (const f of src) {
    const t = readFileSync(f, "utf8")
    if (f.includes("PayVariantSwitch")) continue // selector de la vista previa local (no existe en produccion)
    assert.ok(!/localStorage|sessionStorage|document\.cookie|googletagmanager|gtag\(|fbq\(/.test(t), f)
  }
})
