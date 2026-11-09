// Habilitacion de Webpay Plus: auditoria de consistencia, busqueda administrativa, doble clic, comprobante ampliado y
// separacion entre publicidad y cobros. SQLite real temporal + DOBLE del SDK de Transbank (sin red, sin credenciales). npm test
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { createHash, createHmac, randomBytes } from "node:crypto"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-hab-"))
process.env.PAYMENTS_DB = join(dir, "h.db")
process.env.PAYMENTS_CONFIG = join(dir, "none.json")
process.env.PAYMENTS_ENABLED = "true"
delete process.env.TBK_ENV
delete process.env.ADMIN_API_SECRET

const db = await import("../src/lib/payments/db.ts")
const store = await import("../src/lib/payments/store.ts")
const svc = await import("../src/lib/payments/service.ts")
const admin = await import("../src/lib/payments/adminOps.ts")
const cfg = await import("../src/lib/payments/config.ts")
const voucher = await import("../src/lib/payments/voucher.ts")
const route = await import("../src/app/api/admin/route.ts")

const calls = { create: 0, commit: 0, status: 0 }
let counter = 0
let tbk
beforeEach(() => {
  Object.assign(calls, { create: 0, commit: 0, status: 0 })
  process.env.PAYMENTS_ENABLED = "true"
  delete process.env.TBK_ENV
  delete process.env.ADMIN_API_SECRET
  cfg.resetConfigCache()
  tbk = {
    create: async () => {
      calls.create++
      await new Promise((r) => setTimeout(r, 15)) // da ventana a un segundo clic simultaneo
      return { token: `tk${++counter}${"y".repeat(20)}`, url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction" }
    },
    commit: async () => { calls.commit++; throw new Error("sin configurar") },
    status: async () => { calls.status++; return { status: "INITIALIZED" } },
    refund: async () => { throw new Error("no configurado") },
  }
  globalThis.__tbk = tbk
})

const { TERMS_VERSION } = await import("../src/lib/terms.ts")
const BASE = "http://localhost:3000"
const sol = { planId: "emprendedor", name: "Cliente Habilitacion", email: "hab@example.com", message: "Necesito una landing page de prueba", accept: true, acceptTerms: true, termsVersion: TERMS_VERSION }
async function quoted(amount = 100000) {
  const o = await svc.createOrder(svc.parseSolicitud(sol).data)
  assert.ok((await admin.approveQuote(o.id, { amount, depositPercent: 50 })).ok)
  return o.id
}
const ok = (o, a, over = {}) => ({ status: "AUTHORIZED", response_code: 0, buy_order: a.buyOrder, session_id: o.id, amount: a.amount, authorization_code: "777", payment_type_code: "VN", installments_number: 0, transaction_date: "2026-11-06T15:00:00.000Z", card_detail: { card_number: "1234" }, ...over })
async function paid() {
  const id = await quoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  let o = await store.readOrder(id)
  tbk.commit = async () => ok(o, o.attempts[0])
  await svc.handleReturn(id, { tokenWs: s.token })
  return id
}
const findings = async () => (await admin.auditPayments()).findings
const types = (f, id) => f.filter((x) => x.orderId === id).map((x) => x.type)

test("H1. doble clic: dos inicios simultaneos crean UNA sola transaccion en Transbank", async () => {
  const id = await quoted()
  const [a, b] = await Promise.all([svc.startPayment(id, "anticipo", BASE), svc.startPayment(id, "anticipo", BASE)])
  assert.equal([a, b].filter((r) => r.ok).length, 1)
  assert.equal([a, b].find((r) => !r.ok).code, "en-curso")
  assert.equal(calls.create, 1)
  assert.equal((await store.readOrder(id)).attempts.length, 1)
})

test("H2. reutilizar un token ya confirmado no vuelve a confirmar ni cambia nada", async () => {
  const id = await paid()
  const o = await store.readOrder(id)
  const tok = o.attempts[0].token
  const before = calls.commit
  await svc.handleReturn(id, { tokenWs: tok })
  await svc.handleReturn(id, { tokenWs: tok })
  assert.equal(calls.commit, before)
  // un token de otra orden no se acepta en esta
  const other = await quoted()
  const s2 = await svc.startPayment(other, "anticipo", BASE)
  await svc.handleReturn(id, { tokenWs: s2.token })
  assert.equal((await store.readOrder(other)).attempts[0].status, "INICIADO")
})

test("H3. auditoria: una orden sana no produce hallazgos graves", async () => {
  const id = await paid()
  const f = await findings()
  assert.deepEqual(types(f, id).filter((t) => t !== "SIN_CODIGO_AUTORIZACION"), [])
})

test("H4. auditoria: pago autorizado no reflejado en la orden y monto distinto del esperado", async () => {
  const id = await paid()
  const d = db.openDb()
  d.prepare("UPDATE orders SET stage = 'COTIZADA' WHERE id = ?").run(id) // simula fallo de persistencia posterior a la confirmacion
  d.prepare("UPDATE attempts SET amount = 49000 WHERE order_id = ?").run(id)
  const t = types(await findings(), id)
  assert.ok(t.includes("AUTORIZADO_NO_REFLEJADO"), t.join())
  assert.ok(t.includes("MONTO_DISTINTO"), t.join())
})

test("H5. auditoria: pago duplicado, retorno interrumpido y revision manual", async () => {
  // duplicado: dos intentos autorizados del anticipo (la base lo impide por indice unico, asi que se inserta saltando la restriccion de la copia)
  const id = await paid()
  const d = db.openDb()
  const idx = d.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='attempts' AND sql LIKE '%AUTORIZADO%'").all()
  assert.ok(idx.length >= 1, "debe existir el indice unico que impide el doble pago")
  assert.throws(() => d.prepare("INSERT INTO attempts SELECT id || 'b', order_id, kind, 'BLX' || substr(buy_order, 3), amount, 'tokdup' || substr(token, 7), status, created_at, updated_at, authorization_code, card_last4, payment_type, installments, response_code, tbk_status, note, transaction_date, installments_amount FROM attempts WHERE order_id = ?").run(id))
  // pendiente largo
  const p = await quoted()
  await svc.startPayment(p, "anticipo", BASE)
  d.prepare("UPDATE attempts SET created_at = ? WHERE order_id = ?").run(new Date(Date.now() - 90 * 60_000).toISOString(), p)
  let t = types(await findings(), p)
  assert.ok(t.includes("PENDIENTE_LARGO"))
  // revision manual: Transbank autoriza otro monto
  const m = await quoted()
  const s = await svc.startPayment(m, "anticipo", BASE)
  const o = await store.readOrder(m)
  tbk.commit = async () => ok(o, o.attempts[0], { amount: 1 })
  await svc.handleReturn(m, { tokenWs: s.token })
  t = types(await findings(), m)
  assert.ok(t.includes("REVISION_MANUAL"))
  assert.notEqual((await store.readOrder(m)).stage, "ANTICIPO_PAGADO")
})

test("H6. la auditoria es de solo lectura y no llama a Transbank", async () => {
  const before = JSON.stringify(db.openDb().prepare("SELECT * FROM attempts ORDER BY id").all())
  const c = { ...calls }
  await admin.auditPayments()
  assert.equal(JSON.stringify(db.openDb().prepare("SELECT * FROM attempts ORDER BY id").all()), before)
  assert.deepEqual(calls, c)
})

test("H7. busqueda administrativa por orden, orden de compra y correo; incluye anticipo, saldo y cobrado", async () => {
  const id = await paid()
  const o = await store.readOrder(id)
  for (const q of [id, o.attempts[0].buyOrder, "hab@example.com", "Habilitacion"]) {
    const r = admin.listOrders(50, q).find((x) => x.id === id)
    assert.ok(r, `no encontro por ${q}`)
    assert.equal(r.depositAmount, 50000)
    assert.equal(r.balanceAmount, 50000)
    assert.equal(r.paid, 50000)
  }
  assert.equal(admin.listOrders(50, "no-existe-xyz").length, 0)
  assert.ok(admin.listOrders(50, "%").length === 0, "los comodines se escapan")
  assert.ok(admin.listOrders(50, "'; DROP TABLE orders; --").length === 0)
  assert.ok(admin.listOrders(50).length >= 1)
})

test("H8. API administrativa: auditoria sin firma = 404/401; con firma valida responde", async () => {
  const secret = randomBytes(24).toString("hex")
  process.env.ADMIN_API_SECRET = secret
  const mk = (body, sign = true) => {
    const raw = JSON.stringify(body), ts = Date.now(), nonce = randomBytes(8).toString("hex")
    const sig = createHmac("sha256", secret).update(`${ts}.${nonce}.POST./api/admin.${createHash("sha256").update(raw).digest("hex")}`).digest("hex")
    return new Request("http://localhost:3000/api/admin", { method: "POST", body: raw, headers: { "content-type": "application/json", ...(sign ? { "x-admin-timestamp": String(ts), "x-admin-nonce": nonce, "x-admin-signature": sig } : {}) } })
  }
  assert.equal((await route.POST(mk({ action: "audit" }, false))).status, 401)
  const r = await route.POST(mk({ action: "audit" }))
  assert.equal(r.status, 200)
  const j = await r.json()
  assert.ok(Array.isArray(j.findings) && typeof j.checkedOrders === "number")
  delete process.env.ADMIN_API_SECRET
  assert.equal((await route.POST(mk({ action: "audit" }, false))).status, 404)
})

test("H9. comprobante: orden Bydlight, total de la cotizacion y saldo pendiente; sin datos sensibles", async () => {
  const id = await paid()
  const o = await store.readOrder(id)
  const v = voucher.buildVoucher(o, o.attempts[0])
  const m = Object.fromEntries(v.rows.map((r) => [r.label, r.value]))
  assert.equal(m["Orden Bydlight"], id)
  assert.match(m["Total de la cotización"], /100\.000/)
  assert.match(m["Total de la cotización"], /50 %/)
  assert.match(m["Saldo pendiente"], /50\.000/)
  const dump = JSON.stringify(v)
  assert.ok(!dump.includes(o.attempts[0].token) && !/\d{13,}/.test(dump))
})

test("H10. recuperacion: confirmacion que se perdio (INICIADO con pago AUTHORIZED en Transbank) se registra sin crear otro cobro", async () => {
  const id = await quoted()
  await svc.startPayment(id, "anticipo", BASE)
  let o = await store.readOrder(id)
  tbk.status = async () => ok(o, o.attempts[0])
  const created = calls.create
  await admin.reconcilePending()
  o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "AUTORIZADO")
  assert.equal(o.stage, "ANTICIPO_PAGADO")
  assert.equal(calls.create, created)
  assert.ok(!types(await findings(), id).includes("AUTORIZADO_NO_REFLEJADO"))
})

test("H11. orden inexistente: el inicio de pago no llama a Transbank (la caida de la base se cubre en payments 15/D y verify:prod: 503 sin almacenamiento)", async () => {
  const s = await import("../src/app/api/solicitudes/route.ts")
  assert.equal(typeof s.POST, "function")
  const before = calls.create
  const r = await svc.startPayment("ZZZZZZZZZZZZ", "anticipo", BASE)
  assert.equal(r.ok, false)
  assert.equal(calls.create, before)
})

test("H12. publicidad separada de los cobros: produccion apagada por defecto y checkout publico exige DOS indicadores de codigo + access=public", () => {
  const plans = readFileSync(new URL("../src/lib/plans.ts", import.meta.url), "utf8")
  const legal = readFileSync(new URL("../src/lib/legal.ts", import.meta.url), "utf8")
  const online = /ONLINE_CHECKOUT_UI\s*=\s*(true|false)/.exec(plans)?.[1]
  const pages = /LEGAL_PAGES_PUBLISHED\s*=\s*(true|false)/.exec(legal)?.[1]
  assert.ok(online && pages)
  assert.equal(cfg.publicCheckoutReady(), online === "true" && pages === "true")
  // Etapa B: el codigo versionado abre las dos llaves; el acceso publico real sigue dependiendo de access=public en payments.json
  assert.equal(online, "true")
  assert.equal(pages, "true")
})
