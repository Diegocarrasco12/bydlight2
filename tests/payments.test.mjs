// Pruebas de los controles criticos de pagos. Usan SQLite real (archivo temporal) y un doble del SDK de Transbank:
// no tocan la red ni credenciales. Ejecutar con: npm test
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-pay-"))
process.env.PAYMENTS_DB = join(dir, "t.db")
process.env.PAYMENTS_CONFIG = join(dir, "none.json")
process.env.PAYMENTS_ENABLED = "true"
delete process.env.TBK_ENV
delete process.env.ADMIN_API_SECRET

const db = await import("../src/lib/payments/db.ts")
const store = await import("../src/lib/payments/store.ts")
const svc = await import("../src/lib/payments/service.ts")
const admin = await import("../src/lib/payments/adminOps.ts")
const auth = await import("../src/lib/payments/adminAuth.ts")
const cfg = await import("../src/lib/payments/config.ts")
const { MIGRATIONS } = await import("../src/lib/payments/migrations.mjs")

const calls = { create: 0, commit: 0, status: 0 }
let counter = 0
let tbk
function fakeTbk() {
  tbk = {
    create: async () => {
      calls.create++
      return { token: `tok${++counter}${"x".repeat(20)}`, url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction" }
    },
    commit: async () => {
      calls.commit++
      throw new Error("commit no configurado")
    },
    status: async () => {
      calls.status++
      return { status: "INITIALIZED" }
    },
  }
  globalThis.__tbk = tbk
}
beforeEach(() => {
  Object.assign(calls, { create: 0, commit: 0, status: 0 })
  process.env.PAYMENTS_ENABLED = "true"
  delete process.env.TBK_ENV
  cfg.resetConfigCache()
  fakeTbk()
})

const solicitud = {
  planId: "emprendedor",
  name: "Cliente Prueba",
  email: "cliente@example.com",
  message: "Necesito una landing page de prueba",
  accept: true,
}
async function newQuoted(amount = 149990) {
  const parsed = svc.parseSolicitud(solicitud)
  assert.ok(parsed.ok)
  const order = await svc.createOrder(parsed.data)
  const r = await admin.approveQuote(order.id, { amount })
  assert.ok(r.ok, r.error)
  return order.id
}
const authorized = (order, attempt, over = {}) => ({
  status: "AUTHORIZED",
  response_code: 0,
  buy_order: attempt.buyOrder,
  session_id: order.id,
  amount: attempt.amount,
  authorization_code: "1213",
  payment_type_code: "VN",
  installments_number: 0,
  card_detail: { card_number: "6623" },
  ...over,
})
const age = (id, minutes) => {
  const t = new Date(Date.now() - minutes * 60_000).toISOString()
  db.openDb().prepare("UPDATE attempts SET created_at = ? WHERE order_id = ?").run(t, id)
}
const BASE = "http://localhost:3000"

test("1. pago aprobado: confirma con Transbank, guarda autorizacion y solo ultimos 4 digitos", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  assert.ok(s.ok)
  let o = await store.readOrder(id)
  assert.equal(o.attempts[0].amount, 74995) // 50% de 149.990, calculado en el servidor
  tbk.commit = async () => {
    calls.commit++
    return authorized(o, o.attempts[0])
  }
  await svc.handleReturn(id, { tokenWs: s.token })
  o = await store.readOrder(id)
  assert.equal(o.stage, "ANTICIPO_PAGADO")
  assert.equal(o.attempts[0].status, "AUTORIZADO")
  assert.equal(o.attempts[0].authorizationCode, "1213")
  assert.equal(o.attempts[0].cardLast4, "6623")
  assert.equal(calls.commit, 1)
  assert.doesNotMatch(JSON.stringify(o), /4051885600446623/)
})

test("2. pago rechazado: no se marca pagado y se puede reintentar", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  tbk.commit = async () => {
    calls.commit++
    return { status: "FAILED", response_code: -1 }
  }
  await svc.handleReturn(id, { tokenWs: s.token })
  const o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "RECHAZADO")
  assert.equal(o.stage, "COTIZADA")
  assert.ok((await svc.startPayment(id, "anticipo", BASE)).ok)
})

test("3. pago cancelado por el cliente: no se confirma", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  await svc.handleReturn(id, { tbkToken: s.token, tbkOrden: "x", tbkSesion: id })
  const o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "CANCELADO")
  assert.equal(calls.commit, 0)
  assert.equal(o.stage, "COTIZADA")
})

test("4. retorno duplicado: se confirma una sola vez y el estado no cambia", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  let o = await store.readOrder(id)
  tbk.commit = async () => {
    calls.commit++
    return authorized(o, o.attempts[0])
  }
  await Promise.all([svc.handleReturn(id, { tokenWs: s.token }), svc.handleReturn(id, { tokenWs: s.token })])
  await svc.handleReturn(id, { tokenWs: s.token })
  o = await store.readOrder(id)
  assert.equal(calls.commit, 1)
  assert.equal(o.events.filter((e) => e.type === "PAGO_AUTORIZADO").length, 1)
  assert.equal(o.attempts.length, 1)
})

test("5. monto manipulado: Transbank autoriza otro monto/orden -> no se marca pagado; la base impide doble pago", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  let o = await store.readOrder(id)
  tbk.commit = async () => authorized(o, o.attempts[0], { amount: 1000 })
  await svc.handleReturn(id, { tokenWs: s.token })
  o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "ERROR")
  assert.notEqual(o.stage, "ANTICIPO_PAGADO")
  assert.ok(o.events.some((e) => e.type === "REVISION_MANUAL"))

  const id2 = await newQuoted()
  const s2 = await svc.startPayment(id2, "anticipo", BASE)
  const o2 = await store.readOrder(id2)
  tbk.commit = async () => authorized(o2, o2.attempts[0], { session_id: "OTRAORDEN123" })
  await svc.handleReturn(id2, { tokenWs: s2.token })
  assert.equal((await store.readOrder(id2)).attempts[0].status, "ERROR")

  const d = db.openDb()
  const now = new Date().toISOString()
  const ins = (aid, bo, st) =>
    d
      .prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, status, created_at, updated_at) VALUES (?, ?, 'anticipo', ?, 74995, ?, ?, ?)")
      .run(aid, id, bo, st, now, now)
  ins("z1", "BLZ1", "AUTORIZADO")
  assert.throws(() => ins("z2", "BLZ2", "AUTORIZADO"), /UNIQUE/)
  assert.throws(() => d.prepare("UPDATE quotes SET deposit_amount = 1 WHERE order_id = ?").run(id), /CHECK/)
})

test("6. el monto nunca viene del cliente: sin cotizacion, en otra etapa o vencida no hay pago", async () => {
  const order = await svc.createOrder(svc.parseSolicitud(solicitud).data) // SOLICITADA, sin cotizacion
  assert.equal((await svc.startPayment(order.id, "anticipo", BASE)).code, "sin-pago")
  assert.equal((await svc.startPayment(order.id, "saldo", BASE)).code, "sin-pago")
  const id = await newQuoted()
  assert.equal((await svc.startPayment(id, "saldo", BASE)).code, "sin-pago") // saldo no habilitado
  db.openDb().prepare("UPDATE quotes SET valid_until = ? WHERE order_id = ?").run(new Date(Date.now() - 1000).toISOString(), id)
  assert.equal((await svc.startPayment(id, "anticipo", BASE)).code, "vencida")
  assert.equal(calls.create, 0) // Transbank no se llamo en ningun caso
})

test("7. orden inexistente o codigo invalido", async () => {
  assert.equal((await svc.startPayment("AAAAAAAAAAAA", "anticipo", BASE)).code, "no-existe")
  assert.equal((await svc.startPayment("../../etc/passwd", "anticipo", BASE)).code, "no-existe")
  await svc.handleReturn("AAAAAAAAAAAA", { tokenWs: "t" }) // no lanza
  await svc.verifyOrder("nope")
  assert.equal(await store.readOrder("AAAAAAAAAAAA"), null)
  assert.equal(await store.readOrder("0123456789AB"), null) // alfabeto invalido
  assert.equal((await admin.approveQuote("AAAAAAAAAAAA", { amount: 100000 })).ok, false)
})

test("8. identificadores: 12 caracteres aleatorios, sin colisiones", () => {
  const ids = new Set()
  for (let i = 0; i < 20000; i++) ids.add(store.newOrderId())
  assert.equal(ids.size, 20000)
  for (const id of ids) assert.ok(store.isValidOrderId(id))
  assert.ok(31 ** 12 > 7e17) // ~59 bits: adivinar una orden activa es inviable (y hay limite por IP)
})

test("9. API administrativa: solo con firma valida; sin secreto no existe", () => {
  const secret = randomBytes(24).toString("hex")
  const body = JSON.stringify({ action: "list" })
  const mk = (over = {}) => {
    const ts = over.ts ?? Date.now()
    const nonce = over.nonce ?? randomBytes(16).toString("hex")
    const sig = over.sig ?? auth.signAdminRequest(secret, ts, nonce, "POST", "/api/admin", over.signedBody ?? body)
    return new Request("http://localhost/api/admin", {
      method: "POST",
      headers: { "x-admin-timestamp": String(ts), "x-admin-nonce": nonce, "x-admin-signature": sig, "cf-connecting-ip": "203.0.113.9" },
      body,
    })
  }
  assert.deepEqual(auth.verifyAdminRequest(mk(), body), { ok: false, status: 404 }) // sin secreto configurado
  process.env.ADMIN_API_SECRET = secret
  assert.deepEqual(auth.verifyAdminRequest(mk(), body), { ok: true })
  assert.equal(auth.verifyAdminRequest(mk({ nonce: "a".repeat(32) }), body).ok, true)
  assert.equal(auth.verifyAdminRequest(mk({ nonce: "a".repeat(32) }), body).ok, false) // repeticion del nonce
  assert.equal(auth.verifyAdminRequest(mk({ ts: Date.now() - 120_000 }), body).ok, false) // vencida
  assert.equal(auth.verifyAdminRequest(mk({ sig: "0".repeat(64) }), body).ok, false) // firma falsa
  assert.equal(auth.verifyAdminRequest(mk({ signedBody: '{"action":"close"}' }), body).ok, false) // cuerpo alterado
  const other = auth.signAdminRequest("otro-secreto-otro-secreto-otro-secreto", Date.now(), "b".repeat(32), "POST", "/api/admin", body)
  assert.equal(auth.verifyAdminRequest(mk({ nonce: "b".repeat(32), sig: other }), body).ok, false) // secreto equivocado
  process.env.ADMIN_API_SECRET = "corto"
  assert.equal(auth.verifyAdminRequest(mk(), body).status, 404) // secreto corto = API deshabilitada
  delete process.env.ADMIN_API_SECRET
})

test("10. la cotizacion no se puede cambiar con pago en curso o ya pagado; validaciones de monto", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  assert.equal((await admin.approveQuote(id, { amount: 1000 })).ok, false) // pago en curso
  const o = await store.readOrder(id)
  tbk.commit = async () => authorized(o, o.attempts[0])
  await svc.handleReturn(id, { tokenWs: s.token })
  assert.equal((await admin.approveQuote(id, { amount: 1000 })).ok, false) // ya pagado
  assert.equal((await svc.startPayment(id, "anticipo", BASE)).ok, false)
  assert.equal((await admin.releaseBalance(id)).ok, true)
  assert.ok((await svc.startPayment(id, "saldo", BASE)).ok)
  assert.equal((await store.readOrder(id)).attempts[1].amount, 74995)

  const id3 = await newQuoted()
  const bads = [{ amount: 0 }, { amount: -5 }, { amount: 1.5 }, { amount: 1e9 }, { amount: 5000, depositPercent: 0 }, { amount: 5000, depositPercent: 101 }, { amount: 5000, validDays: 999 }]
  for (const bad of bads) assert.equal((await admin.approveQuote(id3, bad)).ok, false, JSON.stringify(bad))
})

test("11. reinicio: ordenes y pagos sobreviven al cierre y reapertura de SQLite; migraciones protegidas", async () => {
  const id = await newQuoted()
  await svc.startPayment(id, "anticipo", BASE)
  const before = await store.readOrder(id)
  db.closeDb()
  const after = await store.readOrder(id)
  assert.equal(after.attempts[0].token, before.attempts[0].token)
  assert.deepEqual(after.quote, before.quote)
  assert.equal(after.attempts[0].status, "INICIADO")
  assert.equal(db.openDb().prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n, MIGRATIONS.length)

  db.openDb().prepare("UPDATE schema_migrations SET checksum = 'alterado' WHERE version = 1").run()
  db.closeDb()
  assert.throws(() => db.openDb(), /modificada/)
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite")
  const raw = new DatabaseSync(process.env.PAYMENTS_DB)
  raw.prepare("UPDATE schema_migrations SET checksum = ? WHERE version = 1").run(createHash("sha256").update(MIGRATIONS[0].sql).digest("hex"))
  raw.close()
  assert.ok(db.openDb())
})

test("12. pago interrumpido: se recupera consultando a Transbank (autorizado) o expira", async () => {
  const id = await newQuoted()
  await svc.startPayment(id, "anticipo", BASE)
  let o = await store.readOrder(id)
  tbk.status = async () => {
    calls.status++
    return authorized(o, o.attempts[0])
  }
  await svc.verifyOrder(id) // el cliente pago pero nunca volvio
  o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "AUTORIZADO")
  assert.equal(o.stage, "ANTICIPO_PAGADO")

  const id2 = await newQuoted()
  await svc.startPayment(id2, "anticipo", BASE)
  tbk.status = async () => ({ status: "INITIALIZED" })
  assert.ok((await admin.reconcilePending()).checked >= 1)
  assert.equal((await store.readOrder(id2)).attempts[0].status, "INICIADO") // reciente: sigue esperando
  age(id2, 30)
  await admin.reconcilePending()
  assert.equal((await store.readOrder(id2)).attempts[0].status, "EXPIRADO")
})

test("13. expiracion: tiempo excedido en Webpay y bloqueo de pagos simultaneos", async () => {
  const id = await newQuoted()
  assert.ok((await svc.startPayment(id, "anticipo", BASE)).ok)
  assert.equal((await svc.startPayment(id, "anticipo", BASE)).code, "en-curso")
  const o = await store.readOrder(id)
  await svc.handleReturn(id, { tbkOrden: o.attempts[0].buyOrder, tbkSesion: id })
  assert.equal((await store.readOrder(id)).attempts[0].status, "EXPIRADO")
  assert.equal(calls.commit, 0)
  assert.ok((await svc.startPayment(id, "anticipo", BASE)).ok) // puede reintentar
})

test("14. retorno invalido (token_ws + TBK_TOKEN): no se confirma", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  await svc.handleReturn(id, { tokenWs: s.token, tbkToken: s.token })
  assert.equal(calls.commit, 0)
  assert.equal((await store.readOrder(id)).attempts[0].status, "ERROR")
})

test("15. configuracion: produccion apagada por defecto, interruptor por archivo, credenciales obligatorias", async () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  delete process.env.PAYMENTS_ENABLED
  cfg.resetConfigCache()
  assert.equal(cfg.paymentsEnabled(), false)
  assert.equal(await store.storageWritable(), false)
  assert.equal(await store.readOrder("AAAAAAAAAAAA"), null)
  assert.equal(cfg.adminSecret(), null)

  const file = join(dir, "payments.json")
  process.env.PAYMENTS_CONFIG = file
  writeFileSync(file, JSON.stringify({ enabled: true, env: "production", commerceCode: "123", apiKey: "k".repeat(40), publicBaseUrl: "https://bydlightsolutions.com/" }))
  cfg.resetConfigCache()
  assert.equal(cfg.paymentsEnabled(), true)
  assert.equal(cfg.tbkMode(), "production")
  assert.equal(cfg.returnBaseUrl("http://otro", "https://x"), "https://bydlightsolutions.com")
  cfg.createTransaction()
  assert.equal(globalThis.__tbkOptions.environment, "production")
  assert.equal(globalThis.__tbkOptions.commerceCode, "123")

  writeFileSync(file, JSON.stringify({ enabled: false })) // interruptor de emergencia
  cfg.resetConfigCache()
  assert.equal(cfg.paymentsEnabled(), false)

  writeFileSync(file, JSON.stringify({ enabled: true, env: "production" })) // sin credenciales: nunca cae a integracion
  cfg.resetConfigCache()
  assert.throws(() => cfg.createTransaction(), /sin credenciales/)

  writeFileSync(file, "{no es json") // archivo ilegible = configuracion vacia
  cfg.resetConfigCache()
  assert.equal(cfg.paymentsEnabled(), false)

  process.env.NODE_ENV = prev
  process.env.PAYMENTS_CONFIG = join(dir, "none.json")
  process.env.PAYMENTS_ENABLED = "true"
  cfg.resetConfigCache()
})

test("16. en produccion el retorno de Webpay debe ser https", async () => {
  const id = await newQuoted()
  process.env.TBK_ENV = "production"
  process.env.TBK_COMMERCE_CODE = "123"
  process.env.TBK_API_KEY = "k".repeat(40)
  assert.equal((await svc.startPayment(id, "anticipo", "http://bydlightsolutions.com")).ok, false)
  assert.equal(calls.create, 0)
  assert.ok((await svc.startPayment(id, "anticipo", "https://bydlightsolutions.com")).ok)
  delete process.env.TBK_ENV
  delete process.env.TBK_COMMERCE_CODE
  delete process.env.TBK_API_KEY
})

test("17. solicitudes: validacion y campos de precio del cliente ignorados", () => {
  assert.equal(svc.parseSolicitud({ ...solicitud, planId: "inexistente" }).ok, false)
  assert.equal(svc.parseSolicitud({ ...solicitud, email: "no-es-correo" }).ok, false)
  assert.equal(svc.parseSolicitud({ ...solicitud, accept: false }).ok, false)
  assert.equal(svc.parseSolicitud({ ...solicitud, message: "corto" }).ok, false)
  const p = svc.parseSolicitud({ ...solicitud, amount: 1, quote: { amount: 1 }, stage: "COTIZADA" })
  assert.ok(p.ok)
  assert.deepEqual(Object.keys(p.data).sort(), ["company", "email", "message", "name", "phone", "planId"])
})
