// Retencion y anonimizacion de datos personales: simulacion por defecto, solo solicitudes sin contratacion ni pago, nunca ordenes con pago,
// integridad referencial, registro auditable sin datos personales. Datos FICTICIOS en una base temporal. npm test
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-priv-"))
process.env.PAYMENTS_DB = join(dir, "t.db")
process.env.PAYMENTS_CONFIG = join(dir, "none.json")
process.env.MAIL_CONFIG = join(dir, "mail-none.json")
process.env.PAYMENTS_ENABLED = "true"
process.env.MAIL_ENABLED = "false"
delete process.env.TBK_ENV

const db = await import("../src/lib/payments/db.ts")
const svc = await import("../src/lib/payments/service.ts")
const admin = await import("../src/lib/payments/adminOps.ts")
const priv = await import("../src/lib/payments/privacy.ts")
const { TERMS_VERSION } = await import("../src/lib/terms.ts")

let n = 0
async function mk(email, o = {}) {
  const p = svc.parseSolicitud({
    planId: "emprendedor", name: "Persona Ficticia", email, message: `Consulta ficticia numero ${++n} para pruebas`,
    accept: true, acceptTerms: true, termsVersion: TERMS_VERSION, customerType: "persona", phone: "+56911112222", ...o,
  })
  assert.ok(p.ok, JSON.stringify(p.errors))
  return (await svc.createOrder(p.data)).id
}
const d = () => db.openDb()
const OLD = "2023-01-15T10:00:00.000Z"
function age(id, at = OLD) {
  d().prepare("UPDATE orders SET created_at = ?, updated_at = ? WHERE id = ?").run(at, at, id)
  d().prepare("UPDATE events SET at = ? WHERE order_id = ?").run(at, id)
}
const row = (id) => d().prepare("SELECT * FROM orders WHERE id = ?").get(id)
const counts = () => ({
  orders: d().prepare("SELECT COUNT(*) n FROM orders").get().n,
  attempts: d().prepare("SELECT COUNT(*) n FROM attempts").get().n,
  quotes: d().prepare("SELECT COUNT(*) n FROM quotes").get().n,
})
const auditFile = join(dir, "privacy-audit.log")

// Escenario ficticio
const oldFree = await mk("vieja.sin.pago@example.com") // elegible
const oldFree2 = await mk("vieja2.sin.pago@example.com") // elegible
const young = await mk("reciente@example.com") // dentro del plazo
const oldPaid = await mk("pagada@example.com") // con pago autorizado: jamas
const oldQuoteValid = await mk("cotizacion.vigente@example.com") // cotizacion vigente
for (const id of [oldFree, oldFree2, oldPaid, oldQuoteValid]) age(id)
d().prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)").run("pay1", oldPaid, "anticipo", "BDPRIV0001", 50, "AUTORIZADO", OLD, OLD)
await admin.approveQuote(oldQuoteValid, { amount: 200000, allowBelowPlanPrice: true, validDays: 7 })
age(oldQuoteValid) // actividad antigua, pero la cotizacion sigue vigente (valid_until = ahora + 7 dias)
d().prepare("INSERT INTO mail_outbox (dedupe_key, order_id, template, to_addr, subject, body_html, body_text, status, next_attempt_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run("k-old-free", oldFree, "solicitudRecibida", "vieja.sin.pago@example.com", "Recibimos tu solicitud Persona Ficticia", "<p>x</p>", "x", "FALLIDO", OLD, OLD)

test("PV1. la simulacion es el modo por defecto y no modifica nada", () => {
  const before = JSON.stringify([d().prepare("SELECT * FROM orders ORDER BY id").all(), d().prepare("SELECT * FROM mail_outbox").all(), d().prepare("SELECT COUNT(*) n FROM events").get()])
  const r = priv.retentionRun()
  assert.equal(r.mode, "simulacion")
  assert.deepEqual(r.eligible.map((c) => c.orderId).sort(), [oldFree, oldFree2].sort())
  assert.equal(r.anonymized.length, 0)
  const after = JSON.stringify([d().prepare("SELECT * FROM orders ORDER BY id").all(), d().prepare("SELECT * FROM mail_outbox").all(), d().prepare("SELECT COUNT(*) n FROM events").get()])
  assert.equal(after, before)
})

test("PV2. se retienen la orden con pago, la reciente y la de cotizacion vigente (nunca elegibles)", () => {
  const r = priv.retentionRun()
  const ids = r.eligible.map((c) => c.orderId)
  for (const keep of [oldPaid, young, oldQuoteValid]) assert.ok(!ids.includes(keep), keep)
  assert.ok(r.retainedLegal >= 1)
  assert.ok(r.retainedYoung >= 2)
})

test("PV3. la ejecucion anonimiza solo lo elegible, conserva filas, pagos y eventos, y deja registro sin datos personales", () => {
  const c0 = counts()
  const r = priv.retentionRun({ execute: true })
  assert.equal(r.mode, "ejecucion")
  assert.deepEqual(r.anonymized.sort(), [oldFree, oldFree2].sort())
  assert.deepEqual(counts(), c0) // integridad: ninguna fila eliminada
  const o = row(oldFree)
  assert.equal(o.cust_name, priv.ANON_NAME)
  assert.match(o.cust_email, /^anonimizado-.*@invalid\.local$/)
  assert.equal(o.cust_phone, null)
  assert.ok(!o.message.includes("Consulta ficticia"))
  assert.equal(o.plan_id, "emprendedor") // el plan y las fechas permanecen
  const mail = d().prepare("SELECT to_addr, subject, body_html FROM mail_outbox WHERE order_id = ?").get(oldFree)
  assert.match(mail.to_addr, /invalid\.local$/)
  assert.equal(mail.body_html, "")
  assert.ok(d().prepare("SELECT COUNT(*) n FROM events WHERE order_id = ? AND type = 'PRIVACIDAD_ANONIMIZADA'").get(oldFree).n === 1)
  // lo retenido sigue intacto
  assert.equal(row(oldPaid).cust_email, "pagada@example.com")
  assert.equal(row(young).cust_email, "reciente@example.com")
  assert.equal(row(oldQuoteValid).cust_name, "Persona Ficticia")
  assert.equal(d().prepare("SELECT status FROM attempts WHERE id = 'pay1'").get().status, "AUTORIZADO")
  // registro auditable: existe y NO contiene datos personales
  assert.ok(existsSync(auditFile))
  const log = readFileSync(auditFile, "utf8")
  assert.match(log, /"mode":"ejecucion"/)
  assert.ok(!/example\.com|Persona Ficticia|\+569/.test(log))
})

test("PV4. repetir la ejecucion es idempotente y no hay purgas globales (limite por ejecucion)", async () => {
  const again = priv.retentionRun({ execute: true })
  assert.equal(again.anonymized.length, 0)
  assert.ok(again.alreadyAnonymized >= 2)
  const a = await mk("lote1@example.com"), b = await mk("lote2@example.com"), c = await mk("lote3@example.com")
  for (const id of [a, b, c]) age(id)
  const r = priv.retentionRun({ execute: true, limit: 2 })
  assert.equal(r.anonymized.length, 2)
  assert.equal(r.eligible.length, 3)
  assert.equal(priv.retentionRun({ execute: true, limit: 999 }).anonymized.length, 1) // el limite maximo se acota y procesa el resto
})

test("PV5. el plazo nunca puede ser menor que la politica (24 meses)", async () => {
  const id = await mk("reciente2@example.com")
  age(id, new Date(Date.now() - 30 * 86400000).toISOString()) // 30 dias
  const r = priv.retentionRun({ months: 1, execute: true })
  assert.equal(r.months, priv.RETENTION_MONTHS)
  assert.ok(!r.anonymized.includes(id))
})

test("PV6. supresion a solicitud: simulacion, rechazo si hay pago o cotizacion vigente, y ejecucion si corresponde", async () => {
  const r0 = priv.eraseOrder(oldPaid, { execute: true })
  assert.equal(r0.ok, false)
  assert.equal(r0.reason, "con-pago-o-documentos")
  assert.equal(row(oldPaid).cust_email, "pagada@example.com")
  const r1 = priv.eraseOrder(oldQuoteValid, { execute: true })
  assert.equal(r1.reason, "cotizacion-vigente")
  const fresh = await mk("pide.suprimir@example.com")
  const sim = priv.eraseOrder(fresh)
  assert.equal(sim.ok && sim.erased, false)
  assert.equal(row(fresh).cust_email, "pide.suprimir@example.com")
  const done = priv.eraseOrder(fresh, { execute: true })
  assert.equal(done.ok && done.erased, true)
  assert.equal(row(fresh).cust_name, priv.ANON_NAME)
  assert.equal(priv.eraseOrder(fresh, { execute: true }).reason, "ya-anonimizada")
  assert.equal(priv.eraseOrder("NOEXISTE1234", { execute: true }).ok, false)
})

test("PV7. rectificacion de datos con evento; no aplica a ordenes anonimizadas", async () => {
  const id = await mk("rectificar@example.com")
  const r = priv.rectifyCustomer(id, { name: "Nombre Corregido", phone: "+56922223333" })
  assert.equal(r.ok, true)
  assert.equal(row(id).cust_name, "Nombre Corregido")
  assert.equal(priv.rectifyCustomer(id, { email: "malo" }).ok, false)
  assert.equal(priv.rectifyCustomer(id, {}).ok, false)
  assert.ok(d().prepare("SELECT COUNT(*) n FROM events WHERE order_id = ? AND type = 'PRIVACIDAD_RECTIFICADA'").get(id).n === 1)
  assert.equal(priv.rectifyCustomer(oldFree, { name: "Otro Nombre" }).ok, false)
})

test("PV8. el acceso (exportacion) ya no encuentra datos anonimizados y los pagos conciliados permanecen", async () => {
  assert.equal((await admin.exportCustomerData("vieja.sin.pago@example.com")).orders.length, 0)
  assert.equal((await admin.exportCustomerData("pagada@example.com")).orders.length, 1)
})

test("PV9. la API y el CLI exponen la privacidad con simulacion por defecto (solo execute === true modifica)", () => {
  const route = readFileSync(new URL("../src/app/api/admin/route.ts", import.meta.url), "utf8")
  assert.match(route, /case "privacy-scan"[\s\S]*execute: b\.execute === true/)
  assert.match(route, /case "privacy-erase"[\s\S]*execute: b\.execute === true/)
  const cli = readFileSync(new URL("../scripts/admin-remote.mjs", import.meta.url), "utf8")
  assert.match(cli, /includes\("--execute"\)\) body\.execute = true/)
  const src = readFileSync(new URL("../src/lib/payments/privacy.ts", import.meta.url), "utf8")
  assert.ok(!/DELETE FROM/i.test(src), "no se borran filas: solo se anonimiza")
})
