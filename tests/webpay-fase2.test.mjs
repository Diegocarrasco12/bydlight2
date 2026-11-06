// Fase 2 de Webpay Plus: estados inciertos, abandono, devoluciones administrativas y comprobante.
// Usan SQLite real (archivo temporal) y un DOBLE del SDK de Transbank: NO prueban contra el ambiente de integracion
// (eso se documenta aparte en docs/EVIDENCIAS-INTEGRACION-WEBPAY.md). Ejecutar con: npm test
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-pay2-"))
process.env.PAYMENTS_DB = join(dir, "t2.db")
process.env.PAYMENTS_CONFIG = join(dir, "none.json")
process.env.PAYMENTS_ENABLED = "true"
delete process.env.TBK_ENV
delete process.env.ADMIN_API_SECRET
delete process.env.ADMIN_REFUNDS

const db = await import("../src/lib/payments/db.ts")
const store = await import("../src/lib/payments/store.ts")
const svc = await import("../src/lib/payments/service.ts")
const admin = await import("../src/lib/payments/adminOps.ts")
const auth = await import("../src/lib/payments/adminAuth.ts")
const cfg = await import("../src/lib/payments/config.ts")
const refunds = await import("../src/lib/payments/refunds.ts")
const voucher = await import("../src/lib/payments/voucher.ts")
const route = await import("../src/app/api/admin/route.ts")
const { MIGRATIONS } = await import("../src/lib/payments/migrations.mjs")

const calls = { create: 0, commit: 0, status: 0, refund: 0 }
let counter = 0
let tbk
beforeEach(() => {
  Object.assign(calls, { create: 0, commit: 0, status: 0, refund: 0 })
  process.env.PAYMENTS_ENABLED = "true"
  delete process.env.TBK_ENV
  delete process.env.ADMIN_API_SECRET
  delete process.env.ADMIN_REFUNDS
  cfg.resetConfigCache()
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
    refund: async () => {
      calls.refund++
      throw new Error("refund no configurado")
    },
  }
  globalThis.__tbk = tbk
})

const BASE = "http://localhost:3000"
const solicitud = { planId: "emprendedor", name: "Cliente Prueba", email: "cliente@example.com", message: "Necesito una landing page de prueba", accept: true, acceptTerms: true, termsVersion: "borrador-2026-11-06-r2" }
async function newQuoted(amount = 100000) {
  const order = await svc.createOrder(svc.parseSolicitud(solicitud).data)
  const r = await admin.approveQuote(order.id, { amount, depositPercent: 50 })
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
  transaction_date: "2026-11-04T15:00:00.000Z",
  card_detail: { card_number: "6623" },
  ...over,
})
const age = (id, minutes) => {
  const t = new Date(Date.now() - minutes * 60_000).toISOString()
  db.openDb().prepare("UPDATE attempts SET created_at = ? WHERE order_id = ?").run(t, id)
}
/** Orden con el anticipo pagado (50.000 sobre 100.000). */
async function paidOrder(over = {}) {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  assert.ok(s.ok)
  let o = await store.readOrder(id)
  tbk.commit = async () => {
    calls.commit++
    return authorized(o, o.attempts[0], over)
  }
  await svc.handleReturn(id, { tokenWs: s.token })
  o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "AUTORIZADO")
  return id
}
const nullified = (amount, balance) => ({ type: "NULLIFIED", authorization_code: "123456", authorization_date: "2026-11-04T16:00:00.000Z", nullified_amount: amount, balance, response_code: 0 })
const key = () => randomBytes(12).toString("hex")

/* ---------- Caso A: confirmacion incierta ---------- */

test("A1. commit y status fallan: PENDIENTE (no rechazado), sin segundo commit y sin nuevo cobro", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  tbk.status = async () => {
    calls.status++
    throw new Error("sin red")
  }
  await svc.handleReturn(id, { tokenWs: s.token })
  let o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "PENDIENTE")
  assert.equal(o.stage, "COTIZADA")
  assert.equal(calls.commit, 1)
  // retorno repetido: no se vuelve a confirmar
  await svc.handleReturn(id, { tokenWs: s.token })
  assert.equal(calls.commit, 1)
  // no se crea otra transaccion mientras exista una de resultado desconocido
  const again = await svc.startPayment(id, "anticipo", BASE)
  assert.equal(again.ok, false)
  assert.equal(again.code, "en-curso")
  assert.equal(calls.create, 1)
  // el estado real llega despues: queda AUTORIZADO
  o = await store.readOrder(id)
  tbk.status = async () => authorized(o, o.attempts[0])
  await svc.verifyOrder(id)
  o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "AUTORIZADO")
  assert.equal(o.stage, "ANTICIPO_PAGADO")
})

test("A2. commit falla pero status informa FAILED -> RECHAZADO; informa AUTHORIZED -> AUTORIZADO", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  tbk.status = async () => ({ status: "FAILED", response_code: -1 })
  await svc.handleReturn(id, { tokenWs: s.token })
  assert.equal((await store.readOrder(id)).attempts[0].status, "RECHAZADO")

  const id2 = await newQuoted()
  const s2 = await svc.startPayment(id2, "anticipo", BASE)
  const o2 = await store.readOrder(id2)
  tbk.status = async () => authorized(o2, o2.attempts[0])
  await svc.handleReturn(id2, { tokenWs: s2.token })
  assert.equal((await store.readOrder(id2)).attempts[0].status, "AUTORIZADO")
})

test("A3. respuesta no concluyente del commit (INITIALIZED o vacia) = PENDIENTE, nunca rechazo", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  tbk.commit = async () => ({ status: "INITIALIZED" })
  tbk.status = async () => ({ status: "INITIALIZED" })
  await svc.handleReturn(id, { tokenWs: s.token })
  const a = (await store.readOrder(id)).attempts[0]
  assert.equal(a.status, "PENDIENTE")
  assert.equal(a.responseCode, undefined)
})

test("A4. un PENDIENTE sin respuesta de Transbank se cierra a ERROR (revision manual) solo tras 7 dias, nunca a RECHAZADO", async () => {
  const id = await newQuoted()
  const s = await svc.startPayment(id, "anticipo", BASE)
  tbk.status = async () => {
    throw new Error("sin red")
  }
  await svc.handleReturn(id, { tokenWs: s.token })
  age(id, 60 * 24 * 3) // 3 dias
  await svc.verifyOrder(id)
  assert.equal((await store.readOrder(id)).attempts[0].status, "PENDIENTE")
  age(id, 60 * 24 * 8) // 8 dias
  await svc.verifyOrder(id)
  const a = (await store.readOrder(id)).attempts[0]
  assert.equal(a.status, "ERROR")
  assert.match(a.note, /revisión manual/)
})

test("A5. estados anulados informados por Transbank para un pago no registrado exigen revision manual (no se marca pagado)", async () => {
  const id = await newQuoted()
  await svc.startPayment(id, "anticipo", BASE)
  age(id, 30)
  tbk.status = async () => ({ status: "NULLIFIED" })
  await svc.verifyOrder(id)
  const o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "ERROR")
  assert.equal(o.stage, "COTIZADA")
})

/* ---------- Caso B: abandono ---------- */

test("B1. el abandono respeta la vigencia: dentro de la ventana bloquea; vencida se consulta a Transbank antes de reintentar", async () => {
  const id = await newQuoted()
  assert.ok((await svc.startPayment(id, "anticipo", BASE)).ok)
  assert.equal((await svc.startPayment(id, "anticipo", BASE)).code, "en-curso") // reciente
  age(id, 8) // integracion: ventana de 11 min
  assert.equal((await svc.startPayment(id, "anticipo", BASE)).code, "en-curso")
  age(id, 12)
  tbk.status = async () => ({ status: "INITIALIZED" })
  const again = await svc.startPayment(id, "anticipo", BASE)
  assert.ok(again.ok)
  const o = await store.readOrder(id)
  assert.equal(o.attempts[0].status, "EXPIRADO")
  assert.equal(o.attempts.length, 2)
})

test("B2. abandono vencido pero Transbank dice AUTHORIZED: se registra el pago y NO se crea otro cobro", async () => {
  const id = await newQuoted()
  await svc.startPayment(id, "anticipo", BASE)
  const o = await store.readOrder(id)
  age(id, 20)
  tbk.status = async () => authorized(o, o.attempts[0])
  const r = await svc.startPayment(id, "anticipo", BASE)
  assert.equal(r.ok, false)
  assert.equal(calls.create, 1)
  assert.equal((await store.readOrder(id)).attempts[0].status, "AUTORIZADO")
})

test("B3. abandono vencido y la consulta falla: sigue bloqueando (no hay reintento a ciegas)", async () => {
  const id = await newQuoted()
  await svc.startPayment(id, "anticipo", BASE)
  age(id, 30)
  tbk.status = async () => {
    throw new Error("sin red")
  }
  const r = await svc.startPayment(id, "anticipo", BASE)
  assert.equal(r.ok, false)
  assert.equal(r.code, "en-curso")
  assert.equal(calls.create, 1)
  assert.equal((await store.readOrder(id)).attempts[0].status, "INICIADO")
})

test("B4. en produccion la ventana es de 6 minutos", async () => {
  const id = await newQuoted()
  process.env.TBK_ENV = "production"
  process.env.TBK_COMMERCE_CODE = "123"
  process.env.TBK_API_KEY = "k".repeat(40)
  assert.equal(svc.abandonMinutes(), 6)
  assert.ok((await svc.startPayment(id, "anticipo", "https://bydlightsolutions.com")).ok)
  age(id, 7)
  tbk.status = async () => ({ status: "INITIALIZED" })
  assert.ok((await svc.startPayment(id, "anticipo", "https://bydlightsolutions.com")).ok)
  delete process.env.TBK_ENV
  delete process.env.TBK_COMMERCE_CODE
  delete process.env.TBK_API_KEY
})

/* ---------- Comprobante ---------- */

test("C1. comprobante del pago aprobado: campos de Transbank, sin tokens ni tarjeta completa", async () => {
  const id = await paidOrder({ payment_type_code: "VC", installments_number: 3, installments_amount: 16667 })
  const o = await store.readOrder(id)
  const v = voucher.buildVoucher(o, o.attempts[0])
  const map = Object.fromEntries(v.rows.map((r) => [r.label, r.value]))
  assert.equal(map["Comercio"], "Bydlight Solutions SpA")
  assert.equal(map["Orden de compra"], o.attempts[0].buyOrder)
  assert.match(map["Monto pagado"], /50\.000/)
  assert.match(map["Monto pagado"], /CLP/)
  assert.equal(map["Estado"], "Aprobada")
  assert.equal(map["Código de autorización"], "1213")
  assert.equal(map["Tipo de pago"], "Crédito, cuotas normales")
  assert.equal(map["Cuotas"], "3")
  assert.match(map["Monto de cada cuota"], /16\.667/)
  assert.equal(map["Tarjeta"], "•••• 6623")
  assert.match(map["Fecha y hora"], /2026/)
  const dump = JSON.stringify(v)
  assert.ok(!dump.includes(o.attempts[0].token))
})

test("C2. el comprobante omite lo que Transbank no entrego y no existe para pagos no aprobados", async () => {
  const id = await paidOrder({ authorization_code: undefined, card_detail: undefined, payment_type_code: undefined, installments_number: undefined, transaction_date: undefined })
  const o = await store.readOrder(id)
  const labels = voucher.buildVoucher(o, o.attempts[0]).rows.map((r) => r.label)
  for (const l of ["Código de autorización", "Tarjeta", "Tipo de pago", "Cuotas"]) assert.ok(!labels.includes(l), l)
  for (const st of ["RECHAZADO", "CANCELADO", "EXPIRADO", "ERROR", "PENDIENTE", "INICIADO"]) {
    assert.equal(voucher.buildVoucher(o, { ...o.attempts[0], status: st }), null)
  }
  assert.equal(voucher.paymentTypeLabel("XX"), undefined)
  assert.equal(voucher.paymentTypeLabel("VD"), "Débito (Redcompra)")
})

/* ---------- Devoluciones ---------- */

test("R1. devolucion total: llama a Transbank una vez, registra y es idempotente", async () => {
  const id = await paidOrder()
  tbk.refund = async (token, amount) => {
    calls.refund++
    assert.equal(amount, 50000)
    return nullified(50000, 0)
  }
  const k = key()
  const r = await refunds.refundPayment({ orderId: id, amount: 50000, reason: "prueba", idempotencyKey: k, requestedBy: "test" })
  assert.ok(r.ok, r.error)
  assert.equal(r.data.status, "COMPLETADA")
  assert.equal(r.data.authorizationCode, "123456")
  assert.equal(r.data.balance, 0)
  // misma clave: mismo resultado, sin nueva llamada
  const again = await refunds.refundPayment({ orderId: id, amount: 50000, reason: "prueba", idempotencyKey: k, requestedBy: "test" })
  assert.ok(again.ok)
  assert.equal(again.replayed, true)
  assert.equal(calls.refund, 1)
  // misma clave con otro monto: rechazada
  assert.equal((await refunds.refundPayment({ orderId: id, amount: 10, idempotencyKey: k, requestedBy: "test" })).ok, false)
  // clave nueva: ya devuelto en su totalidad
  const dup = await refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "test" })
  assert.equal(dup.ok, false)
  assert.match(dup.error, /totalidad/)
  assert.equal(calls.refund, 1)
  // auditoria
  const o = await store.readOrder(id)
  const types = o.events.map((e) => e.type)
  assert.ok(types.includes("DEVOLUCION_SOLICITADA") && types.includes("DEVOLUCION_COMPLETADA"))
  assert.doesNotMatch(JSON.stringify(o.events), new RegExp(o.attempts[0].token))
  assert.equal(voucher.refundedAmount(o, o.attempts[0]), 50000)
})

test("R2. devolucion parcial: suma de parciales acotada al monto; en cuotas solo total", async () => {
  const id = await paidOrder()
  let balance = 50000
  tbk.refund = async (token, amount) => {
    calls.refund++
    balance -= amount
    return nullified(amount, balance)
  }
  assert.ok((await refunds.refundPayment({ orderId: id, amount: 20000, idempotencyKey: key(), requestedBy: "t" })).ok)
  const over = await refunds.refundPayment({ orderId: id, amount: 40000, idempotencyKey: key(), requestedBy: "t" })
  assert.equal(over.ok, false)
  assert.match(over.error, /excede/)
  assert.ok((await refunds.refundPayment({ orderId: id, amount: 30000, idempotencyKey: key(), requestedBy: "t" })).ok)
  assert.equal((await refunds.refundPayment({ orderId: id, amount: 1, idempotencyKey: key(), requestedBy: "t" })).ok, false)
  assert.equal(calls.refund, 2)

  // pago en cuotas: no admite parcial (Transbank codigo 53)
  const id2 = await paidOrder({ payment_type_code: "VC", installments_number: 3 })
  const part = await refunds.refundPayment({ orderId: id2, amount: 1000, idempotencyKey: key(), requestedBy: "t" })
  assert.equal(part.ok, false)
  assert.match(part.error, /cuotas/)
  assert.equal(calls.refund, 2)
})

test("R3. validaciones: monto, orden, pago no autorizado, clave", async () => {
  const id = await paidOrder()
  const base = { orderId: id, idempotencyKey: key(), requestedBy: "t" }
  for (const amount of [0, -5, 1.5, NaN, 50001]) assert.equal((await refunds.refundPayment({ ...base, amount })).ok, false, String(amount))
  assert.equal((await refunds.refundPayment({ ...base, amount: 10, idempotencyKey: "corta" })).ok, false)
  assert.equal((await refunds.refundPayment({ ...base, orderId: "no-valida", amount: 10 })).ok, false)
  assert.equal((await refunds.refundPayment({ ...base, orderId: "AAAAAAAAAAAA", amount: 10 })).ok, false)
  const unpaid = await newQuoted()
  const none = await refunds.refundPayment({ ...base, orderId: unpaid, amount: 10 })
  assert.equal(none.ok, false)
  assert.match(none.error, /autorizado/)
  assert.equal(calls.refund, 0)
})

test("R4. error de comunicacion: queda INCIERTA, bloquea nuevas devoluciones y se concilia por status", async () => {
  const id = await paidOrder()
  tbk.refund = async () => {
    calls.refund++
    throw new Error("timeout de red")
  }
  const r = await refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "t" })
  assert.ok(r.ok)
  assert.equal(r.data.status, "INCIERTA")
  assert.match(r.data.error, /timeout/)
  const blocked = await refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "t" })
  assert.equal(blocked.ok, false)
  assert.match(blocked.error, /incierto|curso/)
  assert.equal(calls.refund, 1)
  // el pago sigue AUTHORIZED: la devolucion no se aplico
  let o = await store.readOrder(id)
  tbk.status = async () => authorized(o, o.attempts[0])
  const rec = await refunds.reconcileRefund(id, r.data.id)
  assert.equal(rec.data.status, "FALLIDA")
  // ahora se puede reintentar con otra clave
  tbk.refund = async () => {
    calls.refund++
    return nullified(50000, 0)
  }
  assert.equal((await refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "t" })).data.status, "COMPLETADA")
})

test("R5. conciliacion: Transbank informa NULLIFIED -> COMPLETADA; status inaccesible no cambia nada; respuesta inesperada = INCIERTA", async () => {
  const id = await paidOrder()
  tbk.refund = async () => ({ type: "NULLIFIED", response_code: 16 }) // codigo de error en una respuesta 200: no se asume exito
  const r = await refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "t" })
  assert.equal(r.data.status, "INCIERTA")
  tbk.status = async () => {
    throw new Error("sin red")
  }
  assert.equal((await refunds.reconcileRefund(id, r.data.id)).ok, false)
  tbk.status = async () => ({ status: "NULLIFIED" })
  assert.equal((await refunds.reconcileRefund(id, r.data.id)).data.status, "COMPLETADA")
})

test("R6. concurrencia: dos devoluciones simultaneas del mismo pago llaman a Transbank una sola vez", async () => {
  const id = await paidOrder()
  tbk.refund = async () => {
    calls.refund++
    await new Promise((res) => setTimeout(res, 40))
    return nullified(50000, 0)
  }
  const [a, b] = await Promise.all([
    refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "t" }),
    refunds.refundPayment({ orderId: id, amount: 50000, idempotencyKey: key(), requestedBy: "t" }),
  ])
  assert.equal([a, b].filter((x) => x.ok).length, 1)
  assert.equal(calls.refund, 1)
  // la base lo impide aunque fallara el bloqueo: una sola devolucion abierta por pago
  const raw = db.openDb()
  const aid = (await store.readOrder(id)).attempts[0].id
  const ins = (st, k) =>
    raw
      .prepare("INSERT INTO refunds (id, order_id, attempt_id, amount, status, idempotency_key, requested_by, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, 't', 'x', 'x')")
      .run(`RF${k}`, id, aid, st, `${k}`.padEnd(16, "0"))
  ins("SOLICITADA", "a")
  assert.throws(() => ins("INCIERTA", "b"))
})

test("R7. persistencia: las devoluciones y su auditoria sobreviven al reinicio de la base", async () => {
  const id = await paidOrder()
  tbk.refund = async () => nullified(50000, 0)
  const r = await refunds.refundPayment({ orderId: id, amount: 50000, reason: "motivo", idempotencyKey: key(), requestedBy: "t" })
  db.closeDb()
  const o = await store.readOrder(id)
  assert.equal(o.refunds.length, 1)
  assert.equal(o.refunds[0].id, r.data.id)
  assert.equal(o.refunds[0].reason, "motivo")
  assert.equal(o.refunds[0].requestedBy, "t")
  assert.equal(refunds.listRefunds(id).length, 1)
})

/* ---------- API administrativa ---------- */

const SECRET = "a".repeat(64)
async function signed(body, over = {}) {
  const raw = JSON.stringify(body)
  const ts = Date.now()
  const nonce = randomBytes(16).toString("hex")
  const sig = auth.signAdminRequest(SECRET, ts, nonce, "POST", "/api/admin", raw)
  return new Request("http://localhost:3000/api/admin", {
    method: "POST",
    body: raw,
    headers: { "x-admin-timestamp": String(ts), "x-admin-nonce": nonce, "x-admin-signature": sig, "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...over },
  })
}

test("D1. acceso no autorizado a la devolucion: sin secreto 404, sin firma 401, firma valida sin permiso 403", async () => {
  const id = await paidOrder()
  const body = { action: "refund", orderId: id, amount: 50000, idempotencyKey: key() }
  // sin secreto configurado la API no existe
  assert.equal((await route.POST(new Request("http://localhost:3000/api/admin", { method: "POST", body: JSON.stringify(body) }))).status, 404)
  process.env.ADMIN_API_SECRET = SECRET
  // sin firma
  assert.equal((await route.POST(new Request("http://localhost:3000/api/admin", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "10.9.9.9" } }))).status, 401)
  // firma valida pero sin el permiso explicito de devoluciones
  assert.equal((await route.POST(await signed(body))).status, 403)
  // cuerpo alterado tras firmar
  const req = await signed(body)
  const tampered = new Request(req.url, { method: "POST", body: JSON.stringify({ ...body, amount: 1 }), headers: req.headers })
  assert.equal((await route.POST(tampered)).status, 401)
  assert.equal(calls.refund, 0)
})

test("D2. con firma y permiso explicito la devolucion funciona; repetir la clave no duplica", async () => {
  const id = await paidOrder()
  process.env.ADMIN_API_SECRET = SECRET
  process.env.ADMIN_REFUNDS = "true"
  tbk.refund = async () => {
    calls.refund++
    return nullified(50000, 0)
  }
  const body = { action: "refund", orderId: id, amount: 50000, idempotencyKey: key() }
  const r1 = await route.POST(await signed(body))
  assert.equal(r1.status, 200)
  const j1 = await r1.json()
  assert.equal(j1.refund.status, "COMPLETADA")
  assert.ok(!JSON.stringify(j1).includes("tok"))
  const r2 = await route.POST(await signed(body))
  assert.equal((await r2.json()).replayed, true)
  assert.equal(calls.refund, 1)
  assert.equal((await route.POST(await signed({ ...body, amount: "50000" }))).status, 422)
  assert.equal((await route.POST(await signed({ action: "reconcile-refund", orderId: id, refundId: "no-existe" }))).status, 422)
  assert.equal(cfg.adminRefundsEnabled(), true)
  process.env.ADMIN_REFUNDS = "false"
  assert.equal(cfg.adminRefundsEnabled(), false)
})

test("D3. las devoluciones estan apagadas por defecto", () => {
  assert.equal(cfg.adminRefundsEnabled(), false)
})

/* ---------- Esquema ---------- */

test("S1. la migracion 3 conserva los pagos existentes y crea devoluciones", () => {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite")
  const raw = new DatabaseSync(":memory:")
  raw.exec("PRAGMA foreign_keys = ON")
  raw.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)")
  for (const m of MIGRATIONS.slice(0, 2)) {
    raw.exec(m.sql)
    raw.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?, 'x')").run(m.version, m.name, createHash("sha256").update(m.sql).digest("hex"))
  }
  raw.exec("INSERT INTO orders VALUES ('ABCDEFGHJKMN','t','t','COTIZADA','p','P','n','e@x.cl',NULL,NULL,'m')")
  raw.exec("INSERT INTO attempts (id, order_id, kind, buy_order, amount, token, status, created_at, updated_at, authorization_code, card_last4) VALUES ('a1','ABCDEFGHJKMN','anticipo','BL1',500,'tk','AUTORIZADO','t','t','999','1234')")
  db.migrate(raw)
  const a = raw.prepare("SELECT status, authorization_code, card_last4, transaction_date FROM attempts WHERE id = 'a1'").get()
  assert.equal(a.status, "AUTORIZADO")
  assert.equal(a.authorization_code, "999")
  assert.equal(a.transaction_date, null)
  raw.exec("UPDATE attempts SET status = 'PENDIENTE' WHERE id = 'a1'") // estado nuevo admitido
  assert.throws(() => raw.exec("UPDATE attempts SET status = 'INVENTADO' WHERE id = 'a1'"))
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM refunds").get().n, 0)
  raw.close()
})
