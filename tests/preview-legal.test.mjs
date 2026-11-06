// Vista previa local de pagos y publicacion de paginas legales (2026-11-06).
// - La vista previa jamas se activa en produccion ni toca Transbank.
// - Las paginas legales no pueden publicarse con marcadores [PENDIENTE].
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")

function withEnv(env, fn) {
  const prev = {}
  for (const k of Object.keys(env)) prev[k] = process.env[k]
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return fn()
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

const preview = await import("../src/lib/preview.ts")
const cfg = await import("../src/lib/payments/config.ts")
const demo = await import("../src/lib/payments/preview-data.ts")
const store = await import("../src/lib/payments/store.ts")

test("V1. la vista previa NO se activa en produccion aunque exista BD_PREVIEW", () => {
  withEnv({ NODE_ENV: "production", BD_PREVIEW: "1" }, () => assert.equal(preview.previewMode(), false))
  withEnv({ NODE_ENV: "development", BD_PREVIEW: undefined }, () => assert.equal(preview.previewMode(), false))
  withEnv({ NODE_ENV: "development", BD_PREVIEW: "1" }, () => assert.equal(preview.previewMode(), true))
})

test("V2. en vista previa los pagos se muestran, siempre en integracion, y no se puede crear ninguna transaccion", () => {
  withEnv({ NODE_ENV: "development", BD_PREVIEW: "1", PAYMENTS_ENABLED: "false", TBK_ENV: "production", TBK_COMMERCE_CODE: "x", TBK_API_KEY: "y" }, () => {
    assert.equal(cfg.paymentsEnabled(), true)
    assert.equal(cfg.tbkMode(), "integration")
    assert.throws(() => cfg.createTransaction(), /Vista previa/)
  })
})

test("V3. sin vista previa, produccion sigue apagada por defecto (sin cambios de comportamiento)", () => {
  cfg.resetConfigCache()
  withEnv({ NODE_ENV: "production", BD_PREVIEW: "1", PAYMENTS_ENABLED: undefined, PAYMENTS_CONFIG: join(root, "no-existe.json") }, () => {
    assert.equal(cfg.paymentsEnabled(), false)
  })
})

test("V4. las ordenes de demostracion solo existen en vista previa y tienen identificadores validos", () => {
  withEnv({ NODE_ENV: "production", BD_PREVIEW: "1" }, () => assert.equal(demo.previewOrder("DEMOCOTIZADA"), null))
  withEnv({ NODE_ENV: "development", BD_PREVIEW: "1" }, () => {
    for (const o of demo.PREVIEW_ORDERS) {
      assert.equal(store.isValidOrderId(o.id), true, o.id)
      const order = demo.previewOrder(o.id)
      assert.ok(order, o.id)
      assert.equal(order.customer.email, "demo@example.com")
    }
    assert.equal(demo.previewOrder("NOEXISTE2222"), null)
  })
})

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

test("L1. el componente <Pend> lanza error cuando las paginas legales estan publicadas", () => {
  const src = readFileSync(join(root, "src/components/legal/LegalPage.tsx"), "utf8")
  assert.match(src, /if \(LEGAL_PAGES_PUBLISHED\) \{\s*throw new Error/)
})

test("L2. con LEGAL_PAGES_PUBLISHED = true no puede quedar ningun marcador [PENDIENTE] en src/", () => {
  const legal = readFileSync(join(root, "src/lib/legal.ts"), "utf8")
  const published = /export const LEGAL_PAGES_PUBLISHED = true/.test(legal)
  if (!published) return // borrador: los marcadores son esperados y las paginas dan 404 en produccion
  const offenders = walk(join(root, "src")).filter((f) => /<Pend[ >]|\[PENDIENTE/.test(readFileSync(f, "utf8")) && !f.endsWith("LegalPage.tsx"))
  assert.deepEqual(offenders, [])
})

test("L3. las paginas legales siguen cerradas en produccion mientras no se publiquen", () => {
  const legal = readFileSync(join(root, "src/lib/legal.ts"), "utf8")
  assert.match(legal, /export const LEGAL_PAGES_PUBLISHED = false/)
  assert.match(legal, /LEGAL_PAGES_PUBLISHED \|\| process\.env\.NODE_ENV !== "production"/)
})
