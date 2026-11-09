// Release final: IVA incluido, persona/empresa, correos transaccionales (con transporte FALSO: nunca se envia un correo real),
// monitoreo de solo lectura y datos oficiales. SQLite real en archivo temporal. npm test
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-rel-"))
process.env.PAYMENTS_DB = join(dir, "t.db")
process.env.PAYMENTS_CONFIG = join(dir, "none.json")
process.env.MAIL_CONFIG = join(dir, "mail-none.json")
process.env.PAYMENTS_ENABLED = "true"
process.env.MAIL_ENABLED = "true"
delete process.env.TBK_ENV

const db = await import("../src/lib/payments/db.ts")
const store = await import("../src/lib/payments/store.ts")
const svc = await import("../src/lib/payments/service.ts")
const admin = await import("../src/lib/payments/adminOps.ts")
const cfg = await import("../src/lib/payments/config.ts")
const tax = await import("../src/lib/tax.ts")
const { normalizeRut } = await import("../src/lib/rut.ts")
const transport = await import("../src/lib/mail/transport.ts")
const outbox = await import("../src/lib/mail/outbox.ts")
const monitor = await import("../src/lib/payments/monitor.ts")
const T = await import("../src/lib/mail/templates.ts")
const { SITE } = await import("../src/lib/site.ts")
const { TERMS_VERSION } = await import("../src/lib/terms.ts")
const { MIGRATIONS } = await import("../src/lib/payments/migrations.mjs")

const sent = []
let failNext = 0
const fake = {
  async send(m) {
    if (failNext > 0) {
      failNext--
      throw new transport.MailError("falla simulada")
    }
    sent.push(m)
  },
}
let tbk
let counter = 0
beforeEach(() => {
  sent.length = 0
  failNext = 0
  process.env.PAYMENTS_ENABLED = "true"
  process.env.MAIL_ENABLED = "true"
  cfg.resetConfigCache()
  transport.setMailTransportForTests(fake)
  tbk = {
    create: async () => ({ token: `tok${++counter}${"x".repeat(20)}`, url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction" }),
    commit: async () => {
      throw new Error("no configurado")
    },
    status: async () => ({ status: "INITIALIZED" }),
  }
  globalThis.__tbk = tbk
})

const base = { planId: "emprendedor", name: "Cliente Prueba", email: "cliente@example.com", message: "Necesito una landing page de prueba", accept: true, acceptTerms: true, termsVersion: TERMS_VERSION }
const BASE = "http://localhost:3000"
const mk = async (extra = {}) => {
  const p = svc.parseSolicitud({ ...base, ...extra })
  assert.ok(p.ok, JSON.stringify(p.errors))
  return svc.createOrder(p.data)
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await outbox.dispatchDue(50)
}
const authorizedRes = (o, a) => ({ status: "AUTHORIZED", response_code: 0, buy_order: a.buyOrder, session_id: o.id, amount: a.amount, authorization_code: "1213", payment_type_code: "VN", installments_number: 0, card_detail: { card_number: "6623" } })
async function pay(id, kind = "anticipo", result = "ok") {
  const s = await svc.startPayment(id, kind, BASE)
  assert.ok(s.ok, JSON.stringify(s))
  const o = await store.readOrder(id)
  const a = o.attempts[o.attempts.length - 1]
  tbk.commit = async () => (result === "ok" ? authorizedRes(o, a) : { status: "FAILED", response_code: -1, buy_order: a.buyOrder, session_id: o.id, amount: a.amount })
  await svc.handleReturn(id, { tokenWs: s.token })
  return s
}

/* ---------------- IVA ---------------- */

test("R1. IVA: el desglose parte del total final y suma exacto (neto + IVA = total) para cualquier monto", () => {
  assert.deepEqual(tax.ivaBreakdown(149990), { total: 149990, net: 126042, iva: 23948, percent: 19 })
  assert.deepEqual(tax.ivaBreakdown(119), { total: 119, net: 100, iva: 19, percent: 19 })
  assert.deepEqual(tax.ivaBreakdown(100), { total: 100, net: 84, iva: 16, percent: 19 })
  for (let t = 0; t <= 5000; t++) {
    const b = tax.ivaBreakdown(t)
    assert.equal(b.net + b.iva, t)
    assert.ok(Math.abs(b.iva - (t * 19) / 119) <= 0.5 + 1e-9)
  }
  assert.throws(() => tax.ivaBreakdown(10.5))
})

test("R2. anticipo y saldo: redondeo consistente y la suma siempre es el total (sin IVA adicional)", () => {
  for (const [total, pct, dep] of [[149990, 50, 74995], [100001, 50, 50001], [99999, 33, 33000], [299990, 30, 89997], [699990, 40, 279996], [100, 50, 50]]) {
    const s = tax.splitDeposit(total, pct)
    assert.equal(s.deposit, dep, `${total} ${pct}`)
    assert.equal(s.deposit + s.balance, total)
  }
})

test("R3. el monto enviado a Transbank es exactamente el anticipo aprobado del total con IVA (valores con diferencia de redondeo)", async () => {
  for (const [amount, pct] of [[100001, 50], [149990, 50], [99999, 33], [333333, 45]]) {
    const o = await mk()
    const r = await admin.approveQuote(o.id, { amount, depositPercent: pct })
    assert.ok(r.ok)
    const exp = tax.splitDeposit(amount, pct)
    assert.deepEqual([r.data.deposit, r.data.balance], [exp.deposit, exp.balance])
    let sent_ = null
    tbk.create = async (_b, _s, amt) => {
      sent_ = amt
      return { token: `tok${++counter}${"y".repeat(20)}`, url: "https://x" }
    }
    assert.ok((await svc.startPayment(o.id, "anticipo", BASE)).ok)
    assert.equal(sent_, exp.deposit)
    const q = (await store.readOrder(o.id)).quote
    assert.equal(q.amount, amount) // el total cotizado se conserva tal cual: nunca se le suma IVA
    assert.equal(q.depositAmount + q.balanceAmount, amount)
  }
})

test("R4. ningun texto publico habla de precios '+ IVA' y las cotizaciones muestran IVA incluido", () => {
  const walk = (d, out = []) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(tsx?|mjs)$/.test(n)) out.push(p)
    }
    return out
  }
  for (const f of walk(join(process.cwd(), "src"))) {
    const t = readFileSync(f, "utf8")
    assert.ok(!/\+ IVA|más IVA/.test(t.replace(/neto \+ IVA/g, "")), `${f}: precio "+ IVA"`)
  }
  assert.match(readFileSync(join(process.cwd(), "src/lib/plans.ts"), "utf8"), /IVA_LABEL = "IVA incluido"/)
  assert.match(readFileSync(join(process.cwd(), "src/lib/payments/voucher.ts"), "utf8"), /IVA incluido/)
})

test("R5. la auditoria detecta anticipos que no siguen el calculo estandar y no toca ordenes historicas", async () => {
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 100001, depositPercent: 50 })
  db.openDb().prepare("UPDATE quotes SET deposit_amount = 50000, balance_amount = 50001 WHERE order_id = ?").run(o.id)
  const { findings } = await admin.auditPayments()
  assert.ok(findings.some((f) => f.orderId === o.id && f.type === "COTIZACION_REDONDEO"))
})

/* ---------------- Personas y empresas ---------------- */

test("R6. RUT: valida modulo 11 y normaliza el formato", () => {
  assert.equal(normalizeRut("78161844-6"), "78.161.844-6")
  assert.equal(normalizeRut("78.161.844-6"), "78.161.844-6")
  assert.equal(normalizeRut("76.086.428-5"), "76.086.428-5")
  assert.equal(normalizeRut("78.161.844-5"), null)
  assert.equal(normalizeRut("abc"), null)
  assert.equal(normalizeRut(""), null)
})

test("R7. persona natural: no se piden ni se guardan datos de empresa; empresa exige razon social y RUT valido", async () => {
  const persona = svc.parseSolicitud({ ...base, company: "Algo SpA", taxId: "78161844-6" })
  assert.ok(persona.ok)
  assert.equal(persona.data.customerType, "persona")
  assert.equal(persona.data.company, undefined)
  assert.equal(persona.data.taxId, undefined)
  assert.equal(svc.parseSolicitud({ ...base, customerType: "empresa" }).ok, false)
  assert.equal(svc.parseSolicitud({ ...base, customerType: "empresa", company: "Mi Empresa SpA", taxId: "11.111.111-2" }).ok, false)
  const emp = svc.parseSolicitud({ ...base, customerType: "empresa", company: "Mi Empresa SpA", taxId: "78161844-6" })
  assert.ok(emp.ok)
  assert.equal(emp.data.taxId, "78.161.844-6")
  assert.equal(emp.data.giro, undefined) // giro y direccion son opcionales
  const o = await svc.createOrder({ ...emp.data, giro: "Servicios", address: "Calle 1" })
  const r = await store.readOrder(o.id)
  assert.deepEqual([r.customer.type, r.customer.company, r.customer.taxId, r.customer.giro, r.customer.address], ["empresa", "Mi Empresa SpA", "78.161.844-6", "Servicios", "Calle 1"])
})

test("R8. migracion 4: ordenes anteriores quedan como persona y la tabla de correos existe (version 4 aplicada)", () => {
  const conn = db.openDb()
  assert.equal(MIGRATIONS[MIGRATIONS.length - 1].version, 4)
  assert.equal(conn.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n, MIGRATIONS.length)
  assert.ok(conn.prepare("SELECT name FROM sqlite_master WHERE name = 'mail_outbox'").get())
})

/* ---------------- Correos ---------------- */

test("R9. solicitud: un correo al cliente y uno interno al buzon de contacto, sin duplicar", async () => {
  await flush() // vacia lo que dejaron las pruebas anteriores
  sent.length = 0
  const o = await mk()
  await flush()
  assert.deepEqual(sent.map((m) => m.to).sort(), ["cliente@example.com", "contacto@bydlightsolutions.com"])
  const c = sent.find((m) => m.to === "cliente@example.com")
  assert.match(c.subject, /Recibimos tu solicitud/)
  assert.match(c.html, new RegExp(o.id))
  assert.match(c.html, /78\.161\.844-6/)
  await flush()
  assert.equal(sent.length, 2)
})

test("R10. flujo completo: cotizacion, contratacion, comprobante y saldo; el correo de pago sale solo tras la autorizacion real", async () => {
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 149990 })
  await flush()
  const quote = sent.find((m) => /Tu cotización/.test(m.subject))
  assert.match(quote.html, /IVA incluido/)
  assert.match(quote.text, /149\.990/)
  sent.length = 0
  const s = await svc.startPayment(o.id, "anticipo", BASE) // iniciar el pago NO envia nada
  await flush()
  assert.equal(sent.length, 0)
  const cur = await store.readOrder(o.id)
  tbk.commit = async () => authorizedRes(cur, cur.attempts[0])
  await svc.handleReturn(o.id, { tokenWs: s.token })
  await flush()
  assert.deepEqual(sent.map((m) => m.subject.split(" · ")[0]).sort(), ["Comprobante de pago", "Contratación confirmada"])
  const voucher = sent.find((m) => /Comprobante/.test(m.subject))
  assert.match(voucher.html, /1213/)
  assert.match(voucher.html, /6623/)
  assert.doesNotMatch(voucher.html + voucher.text, /tok\d+x{5}/) // jamas el token
  const contract = sent.find((m) => /Contratación/.test(m.subject))
  assert.match(contract.text, /retracto/)
  // El retorno repetido no duplica nada.
  sent.length = 0
  await svc.handleReturn(o.id, { tokenWs: s.token })
  await flush()
  assert.equal(sent.length, 0)
  await admin.releaseBalance(o.id)
  await flush()
  assert.deepEqual(sent.map((m) => m.subject.split(" · ")[0]), ["Saldo habilitado"])
})

test("R11. pago rechazado: aviso sin cargo; cancelado por el cliente: sin correo; resultado incierto: sin correo", async () => {
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 149990 })
  await flush()
  sent.length = 0
  await pay(o.id, "anticipo", "fail")
  await flush()
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /Pago no autorizado/)
  assert.match(sent[0].text, /ningún cargo/)
  sent.length = 0
  const s = await svc.startPayment(o.id, "anticipo", BASE)
  await svc.handleReturn(o.id, { tbkToken: s.token })
  await flush()
  assert.equal(sent.length, 0)
})

test("R12. si el correo falla, el pago queda autorizado una sola vez y el correo se reintenta sin duplicarse", async () => {
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 149990 })
  await flush()
  sent.length = 0
  failNext = 100 // el proveedor esta caido
  await pay(o.id)
  let cur = await store.readOrder(o.id)
  assert.equal(cur.stage, "ANTICIPO_PAGADO")
  assert.equal(cur.attempts.filter((a) => a.status === "AUTORIZADO").length, 1)
  const r1 = await outbox.dispatchDue(50)
  assert.equal(r1.sent, 0)
  assert.ok(r1.retry >= 1)
  // Aun no vence la espera: no reintenta.
  assert.equal((await outbox.dispatchDue(50)).retry, 0)
  // Se vence la espera y el proveedor se recupera.
  failNext = 0
  db.openDb().prepare("UPDATE mail_outbox SET next_attempt_at = ? WHERE status = 'PENDIENTE'").run(new Date(Date.now() - 1000).toISOString())
  await flush()
  assert.equal(sent.length, 2)
  assert.equal(outbox.outboxStats().counts.PENDIENTE ?? 0, 0)
  const row = db.openDb().prepare("SELECT body_html, body_text, status FROM mail_outbox WHERE template = 'pago_autorizado'").get()
  assert.equal(row.status, "ENVIADO")
  assert.equal(row.body_html + row.body_text, "") // enviado: no se conservan datos personales en la cola
  cur = await store.readOrder(o.id)
  assert.equal(cur.attempts.filter((a) => a.status === "AUTORIZADO").length, 1)
})

test("R13. tras los reintentos maximos el correo queda FALLIDO y la conciliacion lo alerta", async () => {
  const o = await mk()
  await flush()
  failNext = 1000
  await admin.approveQuote(o.id, { amount: 149990 })
  for (let i = 0; i < outbox.MAX_ATTEMPTS + 1; i++) {
    db.openDb().prepare("UPDATE mail_outbox SET next_attempt_at = ? WHERE status = 'PENDIENTE'").run(new Date(Date.now() - 1000).toISOString())
    await outbox.dispatchDue(50)
  }
  assert.ok((outbox.outboxStats().counts.FALLIDO ?? 0) >= 1)
  const { findings } = await admin.auditPayments()
  assert.ok(findings.some((f) => f.type === "CORREOS_FALLIDOS"))
})

test("R14. sin correo configurado o apagado no se encola nada y los pagos funcionan igual; ordenes historicas no generan correos", async () => {
  process.env.MAIL_ENABLED = "false"
  const before = db.openDb().prepare("SELECT COUNT(*) AS n FROM mail_outbox").get().n
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 149990 })
  await pay(o.id)
  assert.equal(db.openDb().prepare("SELECT COUNT(*) AS n FROM mail_outbox").get().n, before)
  assert.equal((await store.readOrder(o.id)).stage, "ANTICIPO_PAGADO")
  // Se enciende el correo: la orden ya pagada no genera correos retroactivos al consultarla.
  process.env.MAIL_ENABLED = "true"
  await svc.verifyOrder(o.id)
  await svc.handleReturn(o.id, { tokenWs: "token-que-no-existe" })
  assert.equal(db.openDb().prepare("SELECT COUNT(*) AS n FROM mail_outbox").get().n, before)
  // Sin credenciales reales y sin transporte de prueba, el correo no esta activo.
  transport.setMailTransportForTests(null)
  assert.equal(transport.activeTransport(), null)
})

test("R15. plantillas: escapan el texto del cliente, sin cabeceras inyectables y con datos oficiales", async () => {
  const o = await store.readOrder((await mk({ name: '<script>alert(1)</script> "Ana"', message: "<img src=x onerror=1> hola mundo" })).id)
  const r = T.nuevaSolicitudInterna(o)
  assert.doesNotMatch(r.html, /<script>|<img src=x/)
  assert.match(r.html, /&lt;script&gt;/)
  const body = transport.buildBrevoPayload({ from: "notificaciones@bydlightsolutions.com", fromName: "Bydlight Solutions", replyTo: "contacto@bydlightsolutions.com" }, { to: "a@b.cl", subject: "Hola\r\nBcc: x@y.cl", html: "<p>x</p>", text: "x", messageKey: "k" })
  assert.doesNotMatch(body.subject, /[\r\n]/) // el asunto no puede inyectar cabeceras
  assert.equal(body.headers, undefined) // no se envian cabeceras libres
  assert.deepEqual(body.sender, { email: "notificaciones@bydlightsolutions.com", name: "Bydlight Solutions" })
  assert.deepEqual(body.replyTo, { email: "contacto@bydlightsolutions.com" })
  assert.match(T.solicitudRecibida(o).html, /RUT 78\.161\.844-6/)
  assert.match(T.solicitudRecibida(o).html, /meta name="viewport"/)
})

test("R16. correo publico del sitio sin cambios; el codigo no contiene claves ni restos de Gmail OAuth", () => {
  assert.equal(SITE.email, "bydlightsolutions@gmail.com")
  const walk = (d, out = []) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(tsx?|mjs)$/.test(n)) out.push(p)
    }
    return out
  }
  for (const f of walk(join(process.cwd(), "src"))) {
    const t = readFileSync(f, "utf8")
    assert.ok(!/xkeysib-[A-Za-z0-9]{20,}/.test(t), `clave de Brevo en ${f}`)
    assert.ok(!/gmail\.googleapis|oauth2\.googleapis|refresh_token/.test(t), `resto de Gmail OAuth en ${f}`)
  }
})

/* ---------------- Monitoreo ---------------- */

test("R17. monitor: solo lectura (no cambia ordenes), alerta una sola vez por dia y por conjunto de hallazgos", async () => {
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 100001, depositPercent: 50 })
  await pay(o.id)
  await flush()
  // Se simula un pago autorizado que no quedo reflejado en la etapa.
  db.openDb().prepare("UPDATE orders SET stage = 'COTIZADA' WHERE id = ?").run(o.id)
  const snapshot = JSON.stringify(await store.readOrder(o.id))
  sent.length = 0
  const r1 = await monitor.monitorAndAlert()
  assert.ok(r1.findings.some((f) => f.orderId === o.id && f.type === "AUTORIZADO_NO_REFLEJADO"))
  assert.equal(r1.alerted, true)
  await flush()
  assert.equal(sent.filter((m) => /conciliación/.test(m.subject)).length, 1)
  assert.equal(sent.find((m) => /conciliación/.test(m.subject)).to, "contacto@bydlightsolutions.com")
  assert.equal((await monitor.monitorAndAlert()).alerted, false) // mismo conjunto, mismo dia
  assert.equal(JSON.stringify(await store.readOrder(o.id)), snapshot) // no modifico nada
})

test("R18. exportacion de datos del titular (solo lectura, sin tokens)", async () => {
  const o = await mk({ email: "titular@example.com" })
  const out = await admin.exportCustomerData("Titular@Example.com")
  assert.equal(out.orders.length, 1)
  assert.equal(out.orders[0].id, o.id)
  assert.doesNotMatch(JSON.stringify(out), /"token":"/)
  assert.deepEqual((await admin.exportCustomerData("nadie@example.com")).orders, [])
})
