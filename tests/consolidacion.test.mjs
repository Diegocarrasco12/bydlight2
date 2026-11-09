// Consolidacion comercial: modalidades (directa / a medida), consistencia de precio, solicitudes duplicadas, aviso de pago pendiente y
// modelo de documentos tributarios (solo registro; nunca emite). SQLite real en archivo temporal. npm test
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-cons-"))
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
const tax = await import("../src/lib/payments/taxDocs.ts")
const plans = await import("../src/lib/plans.ts")
const notify = await import("../src/lib/mail/notify.ts")
const outbox = await import("../src/lib/mail/outbox.ts")
const transport = await import("../src/lib/mail/transport.ts")
const T = await import("../src/lib/mail/templates.ts")
const cfg = await import("../src/lib/payments/config.ts")
const { TERMS_VERSION } = await import("../src/lib/terms.ts")

const sent = []
beforeEach(() => {
  sent.length = 0
  process.env.PAYMENTS_ENABLED = "true"
  process.env.MAIL_ENABLED = "true"
  cfg.resetConfigCache()
  transport.setMailTransportForTests({ async send(m) { sent.push(m) } })
})

let n = 0
const body = (o = {}) => ({
  planId: "emprendedor", name: "Cliente Prueba", email: "cliente@example.com", message: `Necesito una landing page de prueba ${++n}`,
  accept: true, acceptTerms: true, termsVersion: TERMS_VERSION, customerType: "persona", ...o,
})
async function mk(o = {}) {
  const p = svc.parseSolicitud(body(o))
  assert.ok(p.ok, JSON.stringify(p.errors))
  return svc.createOrder(p.data)
}
const NOW = () => new Date().toISOString()
function addAttempt(orderId, { id, status = "AUTORIZADO", amount = 50, kind = "anticipo" }) {
  db.openDb()
    .prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, orderId, kind, `BD${id}`.slice(0, 26), amount, status, NOW(), NOW())
}

/* ---------------- Modalidades ---------------- */

test("E1. modalidades: cuatro planes de contratacion directa y software a medida fuera del checkout", () => {
  assert.deepEqual(plans.PLANS.filter((p) => p.modality === "directa").map((p) => p.id), ["emprendedor", "profesional", "empresa", "ecommerce"])
  assert.deepEqual(plans.PLANS.filter((p) => p.modality === "a-medida").map((p) => p.id), ["software"])
  assert.equal(plans.isDirectPlan("profesional"), true)
  assert.equal(plans.isDirectPlan("software"), false)
  assert.equal(plans.isDirectPlan("inexistente"), false)
  assert.equal(plans.planHref("profesional"), "/contratar?plan=profesional")
  assert.equal(plans.planHref("software"), "/contacto?plan=software") // a medida: siempre por contacto
  for (const p of plans.PLANS) assert.equal(p.modality === "directa", p.priceFrom !== null, p.id) // precio publicado <=> contratacion directa
})

test("E2. un proyecto a medida no se puede solicitar por el checkout (el servidor lo rechaza aunque el navegador lo envie)", () => {
  const r = svc.parseSolicitud(body({ planId: "software" }))
  assert.equal(r.ok, false)
  assert.match(r.errors.join(" "), /cotiza a medida/)
  assert.equal(svc.parseSolicitud(body({ planId: "ecommerce" })).ok, true)
})

/* ---------------- Consistencia de precio ---------------- */

test("E3. la cotizacion no puede quedar bajo el precio publicado del plan salvo orden expresa; el precio nunca viene del navegador", async () => {
  const o = await mk() // emprendedor: desde 149.990
  const low = await admin.approveQuote(o.id, { amount: 14999 }) // error de digitacion
  assert.equal(low.ok, false)
  assert.match(low.error, /menor al precio publicado/)
  assert.equal((await store.readOrder(o.id)).quote, undefined) // no se guardo nada
  assert.equal((await admin.approveQuote(o.id, { amount: 149990 })).ok, true) // en el piso: correcto
  assert.equal((await admin.approveQuote(o.id, { amount: 250000 })).ok, true) // sobre el piso: proyecto con mas alcance
  assert.equal((await admin.approveQuote(o.id, { amount: 100, allowBelowPlanPrice: true })).ok, true) // excepcion explicita (prueba/descuento)
  assert.equal((await store.readOrder(o.id)).quote.amount, 100)
})

/* ---------------- Duplicados ---------------- */

test("E4. solicitud repetida (doble clic o reintento): misma orden y un solo juego de correos", async () => {
  const input = svc.parseSolicitud(body({ email: "Doble@Example.com" })).data
  assert.equal(await svc.findDuplicateRequest(input), null)
  const o = await svc.createOrder(input)
  const again = await svc.findDuplicateRequest({ ...input, email: "doble@example.com" }) // el correo no distingue mayusculas
  assert.equal(again.id, o.id)
  assert.equal(await svc.findDuplicateRequest({ ...input, message: input.message + " distinto" }), null) // otra solicitud
  assert.equal(await svc.findDuplicateRequest({ ...input, planId: "profesional" }), null)
  // Ya cotizada deja de contar como duplicado (el cliente podria querer otra orden igual).
  await admin.approveQuote(o.id, { amount: 149990 })
  assert.equal(await svc.findDuplicateRequest(input), null)
})

test("E5. la ventana de duplicados es de 30 minutos", async () => {
  const input = svc.parseSolicitud(body()).data
  const o = await svc.createOrder(input)
  assert.ok(await svc.findDuplicateRequest(input))
  db.openDb().prepare("UPDATE orders SET created_at = ? WHERE id = ?").run(new Date(Date.now() - 31 * 60_000).toISOString(), o.id)
  assert.equal(await svc.findDuplicateRequest(input), null)
})

/* ---------------- Aviso de pago pendiente ---------------- */

test("E6. pago pendiente: un solo aviso, sin afirmar pago ni rechazo; al autorizarse llega el comprobante", async () => {
  const o = await mk()
  await admin.approveQuote(o.id, { amount: 149990 })
  await outbox.dispatchDue(50)
  sent.length = 0
  const base = await store.readOrder(o.id)
  const att = { id: "att-pend-1", kind: "anticipo", buyOrder: "BDPEND1", amount: base.quote.depositAmount, token: null, status: "INICIADO", createdAt: NOW(), updatedAt: NOW() }
  addAttempt(o.id, { id: att.id, status: "PENDIENTE", amount: att.amount })
  const before = { stage: "COTIZADA", quoteApprovedAt: base.quote.approvedAt, attempts: { [att.id]: "INICIADO" } }
  const pending = { ...base, attempts: [{ ...att, status: "PENDIENTE" }] }
  await notify.notifyChanges(before, pending)
  await notify.notifyChanges(before, pending) // callback repetido
  await outbox.dispatchDue(50)
  const m = sent.filter((x) => /verificando tu pago/.test(x.subject))
  assert.equal(m.length, 1)
  assert.equal(m[0].to, "cliente@example.com")
  assert.doesNotMatch(m[0].subject + m[0].text, /Comprobante de pago|pago autorizado|Recibimos tu pago/i)
  assert.match(m[0].text, /no es una confirmación de pago/)
  assert.doesNotMatch(m[0].text, /no se realizó ningún cargo/i) // no se promete algo que se desconoce
  assert.equal(sent.some((x) => /Comprobante|no autorizado/.test(x.subject)), false)
  // PENDIENTE -> AUTORIZADO: llega el comprobante (y no un segundo aviso de pendiente).
  sent.length = 0
  await notify.notifyChanges({ ...before, attempts: { [att.id]: "PENDIENTE" } }, { ...base, attempts: [{ ...att, status: "AUTORIZADO", cardLast4: "6623", paymentType: "VD", authorizationCode: "123456", transactionDate: NOW() }] })
  await outbox.dispatchDue(50)
  assert.ok(sent.some((x) => /Comprobante de pago/.test(x.subject)))
  assert.equal(sent.some((x) => /verificando tu pago/.test(x.subject)), false)
})

test("E7. la plantilla de pendiente escapa el texto del cliente", async () => {
  const o = await store.readOrder((await mk({ name: "<b>Ana</b>" })).id)
  const r = T.pagoPendiente(o, { id: "a", kind: "anticipo", buyOrder: "x", amount: 100, token: null, status: "PENDIENTE", createdAt: NOW(), updatedAt: NOW() })
  assert.doesNotMatch(r.html, /<b>Ana/)
  assert.match(r.html, /Estamos verificando tu pago/)
})

/* ---------------- Documentos tributarios ---------------- */

test("E8. boleta: queda pendiente, el importe sale del pago, un folio la emite y no se duplica por pago", async () => {
  const o = await mk()
  addAttempt(o.id, { id: "att-t1", amount: 74995 })
  const r1 = await tax.registerTaxDocument(o.id, { attemptId: "att-t1", kind: "boleta" })
  assert.ok(r1.ok, r1.error)
  assert.equal(r1.data.status, "PENDIENTE")
  assert.equal(r1.data.totalAmount, 74995) // importe del pago, no del operador
  assert.equal(r1.data.netAmount + r1.data.vatAmount, 74995)
  assert.equal(r1.data.folio, undefined)
  // Un segundo documento vigente para el mismo pago se rechaza (emision duplicada), sea del tipo que sea.
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t1", kind: "boleta" })).ok, false)
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t1", kind: "factura_exportacion", receiverTaxId: "ES-B12345678", receiverName: "Cliente SL" })).ok, false)
  const issued = await tax.markTaxDocumentIssued(o.id, r1.data.id, { folio: "1001", issuedAt: "2026-11-09" })
  assert.ok(issued.ok, issued.error)
  assert.equal(issued.data.status, "EMITIDO")
  assert.equal((await tax.markTaxDocumentIssued(o.id, r1.data.id, { folio: "1002", issuedAt: "2026-11-09" })).ok, false) // ya emitido
  assert.deepEqual(tax.listTaxDocuments(o.id).map((d) => [d.kind, d.status, d.folio]), [["boleta", "EMITIDO", "1001"]])
  const ev = (await store.readOrder(o.id)).events.map((e) => e.type)
  assert.ok(ev.includes("DOCUMENTO_TRIBUTARIO_REGISTRADO"))
})

test("E9. el folio no se repite dentro del mismo tipo; folio y fecha van juntos; solo se documentan pagos autorizados", async () => {
  const o = await mk()
  addAttempt(o.id, { id: "att-t2" })
  addAttempt(o.id, { id: "att-t3", kind: "saldo" })
  addAttempt(o.id, { id: "att-t4", status: "RECHAZADO" })
  assert.ok((await tax.registerTaxDocument(o.id, { attemptId: "att-t2", kind: "boleta", folio: "2001", issuedAt: "2026-11-09" })).ok)
  const dup = await tax.registerTaxDocument(o.id, { attemptId: "att-t3", kind: "boleta", folio: "2001", issuedAt: "2026-11-09" })
  assert.equal(dup.ok, false)
  assert.match(dup.error, /folio/)
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t3", kind: "boleta", folio: "2002" })).ok, false) // falta fecha
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t3", kind: "boleta", folio: "2002", issuedAt: "2999-01-01" })).ok, false) // futura
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t3", kind: "boleta", folio: "20 02", issuedAt: "2026-11-09" })).ok, false)
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t4", kind: "boleta" })).ok, false) // rechazado
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "no-existe", kind: "boleta" })).ok, false)
  assert.equal((await tax.registerTaxDocument(o.id, { kind: "boleta" })).ok, false) // sin pago
  assert.equal((await tax.registerTaxDocument(o.id, { attemptId: "att-t3", kind: "vale" })).ok, false)
  // Mismo folio en otro TIPO de documento si es distinto numerador (las series son independientes).
  assert.ok((await tax.registerTaxDocument(o.id, { attemptId: "att-t3", kind: "boleta", folio: "2003", issuedAt: "2026-11-09" })).ok)
})

test("E10. factura nacional exige cliente empresa con razon social y RUT; factura de exportacion exige receptor extranjero", async () => {
  const persona = await mk()
  addAttempt(persona.id, { id: "att-t5" })
  assert.match((await tax.registerTaxDocument(persona.id, { attemptId: "att-t5", kind: "factura" })).error, /empresa/)
  const emp = await mk({ customerType: "empresa", company: "Empresa SpA", taxId: "78161844-6" })
  const empRut = (await store.readOrder(emp.id)).customer.taxId
  assert.ok(empRut, "el RUT de prueba debe ser valido")
  addAttempt(emp.id, { id: "att-t6", amount: 119000 })
  const f = await tax.registerTaxDocument(emp.id, { attemptId: "att-t6", kind: "factura" })
  assert.ok(f.ok, f.error)
  assert.equal(f.data.receiverTaxId, empRut)
  assert.equal(f.data.netAmount, 100000)
  assert.equal(f.data.vatAmount, 19000)
  // Exportacion: sin IVA calculado por el sistema, receptor extranjero obligatorio y un RUT chileno no corresponde.
  addAttempt(persona.id, { id: "att-t7", kind: "saldo", amount: 200000 })
  assert.equal((await tax.registerTaxDocument(persona.id, { attemptId: "att-t7", kind: "factura_exportacion" })).ok, false)
  assert.equal((await tax.registerTaxDocument(persona.id, { attemptId: "att-t7", kind: "factura_exportacion", receiverTaxId: "78161844-6", receiverName: "X Chile" })).ok, false)
  const x = await tax.registerTaxDocument(persona.id, { attemptId: "att-t7", kind: "factura_exportacion", receiverTaxId: "ES-B12345678", receiverName: "Cliente Espana SL" })
  assert.ok(x.ok, x.error)
  assert.equal(x.data.vatAmount, 0)
  assert.equal(x.data.netAmount, 200000)
})

test("E11. anular libera el pago para documentarlo de nuevo; la nota de credito exige un documento emitido y no supera su monto", async () => {
  const o = await mk()
  addAttempt(o.id, { id: "att-t8", amount: 100000 })
  const d = (await tax.registerTaxDocument(o.id, { attemptId: "att-t8", kind: "boleta" })).data
  assert.equal((await tax.registerTaxDocument(o.id, { kind: "nota_credito", refDocId: d.id })).ok, false) // aun no emitido
  assert.ok((await tax.voidTaxDocument(o.id, d.id, "error de digitacion")).ok)
  assert.equal((await tax.voidTaxDocument(o.id, d.id)).ok, false) // ya anulado
  const d2 = (await tax.registerTaxDocument(o.id, { attemptId: "att-t8", kind: "boleta", folio: "3001", issuedAt: "2026-11-09" })).data
  assert.equal((await tax.registerTaxDocument(o.id, { kind: "nota_credito", refDocId: d2.id, totalAmount: 100001 })).ok, false)
  const nc = await tax.registerTaxDocument(o.id, { kind: "nota_credito", refDocId: d2.id, totalAmount: 40000, folio: "N1", issuedAt: "2026-11-09" })
  assert.ok(nc.ok, nc.error)
  assert.equal(nc.data.refDocId, d2.id)
  assert.equal(tax.listTaxDocuments(o.id).length, 3)
  // Un documento de otra orden no se puede referenciar.
  const other = await mk()
  assert.equal((await tax.registerTaxDocument(other.id, { kind: "nota_credito", refDocId: d2.id })).ok, false)
})

test("E12. pagos sin documento vigente: la lista de pendientes baja a medida que se documentan; solo lectura", async () => {
  const o = await mk()
  addAttempt(o.id, { id: "att-t9", amount: 70000 })
  addAttempt(o.id, { id: "att-t10", status: "PENDIENTE", amount: 70000 })
  const has = (id) => tax.pendingTaxDocuments(500).some((p) => p.attemptId === id)
  assert.equal(has("att-t9"), true)
  assert.equal(has("att-t10"), false) // solo pagos autorizados
  const before = db.openDb().prepare("SELECT COUNT(*) AS c FROM tax_documents").get().c
  tax.pendingTaxDocuments()
  assert.equal(db.openDb().prepare("SELECT COUNT(*) AS c FROM tax_documents").get().c, before)
  await tax.registerTaxDocument(o.id, { attemptId: "att-t9", kind: "boleta" })
  assert.equal(has("att-t9"), false)
})

test("E13. la base impide por si sola documentos duplicados o incoherentes (aunque se evite el codigo)", async () => {
  const o = await mk()
  addAttempt(o.id, { id: "att-t11" })
  const c = db.openDb()
  const ins = (kind, status, folio, issued, attempt = "att-t11", ref = null) =>
    c.prepare("INSERT INTO tax_documents (order_id, attempt_id, kind, status, folio, issued_at, total_amount, ref_doc_id, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(o.id, attempt, kind, status, folio, issued, 50, ref, "t", NOW(), NOW())
  assert.throws(() => ins("boleta", "EMITIDO", null, null), /CHECK/i) // emitido sin folio
  assert.throws(() => ins("tipo-raro", "PENDIENTE", null, null), /CHECK/i)
  ins("boleta", "PENDIENTE", null, null)
  assert.throws(() => ins("factura", "PENDIENTE", null, null), /UNIQUE/i) // segundo documento vigente del mismo pago
  assert.throws(() => ins("nota_credito", "PENDIENTE", null, null), /CHECK/i) // nota sin referencia
})
