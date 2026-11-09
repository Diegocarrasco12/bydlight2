// Transporte de Brevo con `fetch` FALSO: nunca se contacta a Brevo ni se envia un correo real. Cubre el formato de la peticion,
// la clasificacion de errores, los reintentos controlados, el limite del plan gratuito y la proteccion contra duplicados. npm test
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-brevo-"))
const KEY = "xkeysib-" + "a1b2c3d4".repeat(6) + "-PRUEBA"
const mailFile = join(dir, "mail.json")
process.env.PAYMENTS_DB = join(dir, "t.db")
process.env.PAYMENTS_CONFIG = join(dir, "none.json")
process.env.MAIL_CONFIG = mailFile
process.env.PAYMENTS_ENABLED = "true"
delete process.env.MAIL_ENABLED
delete process.env.MAIL_BREVO_API_KEY

const db = await import("../src/lib/payments/db.ts")
const cfg = await import("../src/lib/payments/config.ts")
const mailCfg = await import("../src/lib/mail/config.ts")
const transport = await import("../src/lib/mail/transport.ts")
const outbox = await import("../src/lib/mail/outbox.ts")

const writeCfg = (o) => {
  writeFileSync(mailFile, JSON.stringify(o))
  mailCfg.resetMailConfigCache()
}
const iso = (ms) => new Date(ms).toISOString()
const realFetch = globalThis.fetch
const calls = []
let script = [] // respuestas en orden; la ultima se repite
const res = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

beforeEach(() => {
  calls.length = 0
  script = [res(201, { messageId: "<abc@smtp-relay.mailin.fr>" })]
  transport.setMailTransportForTests(null)
  cfg.resetConfigCache()
  writeCfg({ enabled: true, provider: "brevo", apiKey: KEY })
  db.openDb().exec("DELETE FROM mail_outbox")
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    const r = script.length > 1 ? script.shift() : script[0]
    if (r instanceof Error) throw r
    return r.clone()
  }
})
test.after(() => {
  globalThis.fetch = realFetch
})

const enq = (key, to = "cliente@example.com") =>
  outbox.enqueueMail({ dedupeKey: key, orderId: "ORD1", template: "t", to, subject: `Asunto ${key}`, html: "<p>Hola</p>", text: "Hola" })
const row = (key) => db.openDb().prepare("SELECT * FROM mail_outbox WHERE dedupe_key = ?").get(key)
const due = (key) => db.openDb().prepare("UPDATE mail_outbox SET next_attempt_at = ? WHERE dedupe_key = ?").run(iso(Date.now() - 1000), key)

test("B1. peticion: API v3, clave en cabecera api-key, remitente corporativo y Reply-To a contacto@", async () => {
  enq("k1")
  const r = await outbox.dispatchDue()
  assert.equal(r.sent, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://api.brevo.com/v3/smtp/email")
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.headers["api-key"], KEY)
  const b = JSON.parse(calls[0].init.body)
  assert.deepEqual(b.sender, { email: "notificaciones@bydlightsolutions.com", name: "Bydlight Solutions" })
  assert.deepEqual(b.replyTo, { email: "contacto@bydlightsolutions.com" })
  assert.deepEqual(b.to, [{ email: "cliente@example.com" }])
  assert.equal(b.subject, "Asunto k1")
  assert.equal(b.htmlContent, "<p>Hola</p>")
  assert.equal(b.textContent, "Hola")
  assert.ok(!JSON.stringify(b).includes(KEY)) // la clave solo va en la cabecera
  const m = row("k1")
  assert.equal(m.status, "ENVIADO")
  assert.equal(m.body_html, "") // el cuerpo se vacia tras el envio
})

test("B2. sin clave, apagado o en vista previa no hay transporte y nada llama a Brevo", async () => {
  writeCfg({ enabled: true, provider: "brevo" })
  assert.equal(transport.activeTransport(), null)
  writeCfg({ enabled: false, provider: "brevo", apiKey: KEY })
  assert.equal(transport.activeTransport(), null)
  writeCfg({ enabled: true, provider: "gmail-oauth2", clientId: "x", clientSecret: "y", refreshToken: "z" }) // configuracion antigua de Gmail
  assert.equal(transport.activeTransport(), null)
  enq("k2")
  assert.equal((await outbox.dispatchDue()).skipped, "correo-no-configurado")
  assert.equal(calls.length, 0)
})

test("B3. la configuracion por defecto usa los remitentes corporativos; la clave tambien puede venir del entorno", () => {
  writeCfg({ enabled: true })
  assert.equal(mailCfg.mailCredentials(), null)
  process.env.MAIL_BREVO_API_KEY = KEY
  const c = mailCfg.mailCredentials()
  delete process.env.MAIL_BREVO_API_KEY
  assert.equal(c.from, "notificaciones@bydlightsolutions.com")
  assert.equal(c.replyTo, "contacto@bydlightsolutions.com")
  assert.equal(c.notifyTo, "contacto@bydlightsolutions.com")
})

test("B4. 400 (mensaje invalido): error permanente, queda FALLIDO sin reintentar y sin guardar la respuesta completa", async () => {
  script = [res(400, { code: "invalid_parameter", message: "detalle con datos del cliente cliente@example.com" })]
  enq("k4")
  const r = await outbox.dispatchDue()
  assert.equal(r.failed, 1)
  const m = row("k4")
  assert.equal(m.status, "FALLIDO")
  assert.equal(m.last_error, "brevo 400 invalid_parameter")
  assert.equal(calls.length, 1)
})

test("B5. destinatario con formato invalido: permanente y sin llamar a Brevo", async () => {
  enq("k5", "no-es-un-correo")
  enq("k5b", "a@b.cl\r\nBcc: x@y.cl")
  const r = await outbox.dispatchDue()
  assert.equal(r.failed, 2)
  assert.equal(calls.length, 0)
  assert.equal(row("k5").last_error, "destinatario invalido")
})

test("B6. 5xx y caidas de red: reintento con espera progresiva y consumo de intentos; luego se envia sin duplicar", async () => {
  script = [res(503, { code: "service_unavailable" }), new TypeError("fetch failed"), res(201, { messageId: "<x>" })]
  enq("k6")
  let r = await outbox.dispatchDue()
  assert.equal(r.retry, 1)
  let m = row("k6")
  assert.equal(m.status, "PENDIENTE")
  assert.equal(m.attempts, 1)
  assert.equal(m.last_error, "brevo 503 service_unavailable")
  assert.ok(Date.parse(m.next_attempt_at) > Date.now() + 30_000) // espera, no reintenta en bucle
  assert.equal((await outbox.dispatchDue()).sent, 0) // aun no vence
  due("k6")
  r = await outbox.dispatchDue()
  assert.equal(r.retry, 1)
  assert.match(row("k6").last_error, /sin respuesta/)
  due("k6")
  r = await outbox.dispatchDue()
  assert.equal(r.sent, 1)
  m = row("k6")
  assert.equal(m.status, "ENVIADO")
  assert.equal(m.attempts, 3)
  assert.equal(calls.length, 3)
})

test("B7. tras los intentos maximos un 5xx persistente queda FALLIDO", async () => {
  script = [res(500)]
  enq("k7")
  for (let i = 0; i < outbox.MAX_ATTEMPTS; i++) {
    await outbox.dispatchDue()
    due("k7")
  }
  assert.equal(row("k7").status, "FALLIDO")
  assert.equal(calls.length, outbox.MAX_ATTEMPTS)
})

test("B8. plan gratuito: al agotarse la cuota (429) la tanda se detiene, no se gastan intentos y nada se pierde", async () => {
  // Brevo gratuito: 300/dia. Simulamos que el tercer envio topa el limite.
  script = [res(201), res(201), res(429, { code: "too_many_requests", message: "limite" }, { "retry-after": "7200" })]
  for (const k of ["q1", "q2", "q3", "q4", "q5"]) enq(k)
  const r = await outbox.dispatchDue()
  assert.equal(r.sent, 2)
  assert.equal(r.retry, 1)
  assert.equal(calls.length, 3) // q4 y q5 ni se intentaron: el resto fallaria igual
  const q3 = row("q3")
  assert.equal(q3.status, "PENDIENTE")
  assert.equal(q3.attempts, 0) // no consume intentos
  assert.match(q3.last_error, /^brevo 429 too_many_requests: cuota/)
  const wait = Date.parse(q3.next_attempt_at) - Date.now()
  assert.ok(wait > 110 * 60_000 && wait <= 121 * 60_000, `Retry-After 7200 s ~ 120 min, fue ${Math.round(wait / 60000)}`)
  assert.equal(row("q4").status, "PENDIENTE")
  assert.equal(row("q4").attempts, 0)
  // Al reponerse la cuota, se envian todos los pendientes.
  script = [res(201)]
  for (const k of ["q3", "q4", "q5"]) due(k)
  assert.equal((await outbox.dispatchDue()).sent, 3)
})

test("B9. 429 sin Retry-After y creditos agotados (400 not_enough_credits) se aplazan, no son permanentes", async () => {
  script = [res(429)]
  enq("k9")
  await outbox.dispatchDue()
  let m = row("k9")
  assert.equal(m.status, "PENDIENTE")
  assert.equal(m.attempts, 0)
  assert.ok(Date.parse(m.next_attempt_at) - Date.now() > 55 * 60_000)
  script = [res(400, { code: "not_enough_credits", message: "x" })]
  due("k9")
  await outbox.dispatchDue()
  m = row("k9")
  assert.equal(m.status, "PENDIENTE")
  assert.equal(m.attempts, 0)
})

test("B10. 401/403 (clave invalida o IP no autorizada en Brevo): se aplaza 30 min con aviso claro, sin perder el correo ni la clave en el error", async () => {
  script = [res(401, { code: "unauthorized", message: `Key ${KEY} not found` })]
  enq("k10")
  const r = await outbox.dispatchDue()
  assert.equal(r.retry, 1)
  const m = row("k10")
  assert.equal(m.status, "PENDIENTE")
  assert.equal(m.attempts, 0)
  assert.match(m.last_error, /revisar clave API e IPs autorizadas/)
  assert.ok(!m.last_error.includes(KEY))
  const wait = Date.parse(m.next_attempt_at) - Date.now()
  assert.ok(wait > 25 * 60_000 && wait <= 31 * 60_000)
  script = [res(403)]
  due("k10")
  await outbox.dispatchDue()
  assert.equal(row("k10").status, "PENDIENTE")
})

test("B11. un correo aplazado por mas de 72 horas queda FALLIDO y visible (no se reintenta eternamente)", async () => {
  script = [res(401)]
  enq("k11")
  db.openDb().prepare("UPDATE mail_outbox SET created_at = ? WHERE dedupe_key = ?").run(iso(Date.now() - 73 * 3_600_000), "k11")
  const r = await outbox.dispatchDue()
  assert.equal(r.failed, 1)
  assert.equal(row("k11").status, "FALLIDO")
})

test("B12. proteccion contra duplicados: la misma dedupe_key se encola y se envia una sola vez", async () => {
  assert.equal(enq("pago:att-1"), true)
  assert.equal(enq("pago:att-1"), false)
  assert.equal(enq("pago:att-1"), false)
  await outbox.dispatchDue()
  await outbox.dispatchDue()
  assert.equal(calls.length, 1)
  assert.equal(db.openDb().prepare("SELECT COUNT(*) AS n FROM mail_outbox").get().n, 1)
  // Ya enviado, un hecho repetido tampoco lo vuelve a encolar.
  assert.equal(enq("pago:att-1"), false)
  await outbox.dispatchDue()
  assert.equal(calls.length, 1)
})

test("B13. la clave nunca aparece en el registro de la cola ni en los mensajes de error, con ninguna respuesta", async () => {
  for (const [i, r] of [res(400, { code: "x", message: KEY }), res(401, { message: KEY }), res(429, { message: KEY }), res(502, { message: KEY }), new Error(`fallo ${KEY}`)].entries()) {
    script = [r]
    enq(`z${i}`)
    await outbox.dispatchDue()
    due(`z${i}`)
  }
  const all = JSON.stringify(db.openDb().prepare("SELECT * FROM mail_outbox").all())
  assert.ok(!all.includes(KEY))
})

test("B14. un envio interrumpido (ENVIANDO) se recupera tras 10 minutos y se reenvia una vez (entrega al menos una vez)", async () => {
  enq("k14")
  db.openDb().prepare("UPDATE mail_outbox SET status = 'ENVIANDO', attempts = 1, next_attempt_at = ? WHERE dedupe_key = ?").run(iso(Date.now() - 1000), "k14")
  assert.equal((await outbox.dispatchDue()).sent, 1)
  assert.equal(row("k14").attempts, 2)
  assert.equal(calls.length, 1)
})
