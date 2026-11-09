// Migracion 4 sobre una base REAL de la version anterior (esquema v3 con ordenes, cotizacion, pago autorizado y eventos):
// la actualizacion no pierde ni altera nada, las ordenes anteriores quedan como «persona», la base sigue protegida contra
// doble pago y el codigo anterior (que ignora la migracion 4) seguiria funcionando. npm test
import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

const dir = mkdtempSync(join(tmpdir(), "bd-mig4-"))
const file = join(dir, "v3.db")
const { MIGRATIONS } = await import("../src/lib/payments/migrations.mjs")
const db = await import("../src/lib/payments/db.ts")

const sum = (s) => createHash("sha256").update(s).digest("hex")
const NOW = "2026-11-06T15:00:00.000Z"

// --- Construye una base exactamente como la dejo la version desplegada (migraciones 1 a 3) y le carga datos ---
function buildV3() {
  const c = new DatabaseSync(file)
  c.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON")
  c.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)")
  for (const m of MIGRATIONS.filter((x) => x.version <= 3)) {
    c.exec(m.sql)
    c.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)").run(m.version, m.name, sum(m.sql), NOW)
  }
  const o = c.prepare("INSERT INTO orders (id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  o.run("3SJR79AE5RX8", NOW, NOW, "ANTICIPO_PAGADO", "emprendedor", "Emprendedor", "Cliente Historico", "historico@example.com", null, "Empresa Vieja", "Compra de prueba")
  o.run("ABCDEFGHJKMN", NOW, NOW, "SOLICITADA", "profesional", "Profesional", "Otro Cliente", "otro@example.com", "+56911111111", null, "Solicitud sin cotizar")
  c.prepare("INSERT INTO quotes VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("3SJR79AE5RX8", 100, 50, 50, 50, NOW, "2026-11-07T15:00:00.000Z", "PRUEBA PRODUCTIVA")
  c.prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, token, status, created_at, updated_at, authorization_code, card_last4, payment_type, installments, response_code, tbk_status, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("att-1", "3SJR79AE5RX8", "anticipo", "BD3SJR79AE5RX8A1", 50, "tok-historico", "AUTORIZADO", NOW, NOW, "123456", "6623", "VD", 0, 0, "AUTHORIZED", null)
  const e = c.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, ?, ?)")
  for (const t of ["SOLICITUD_CREADA", "COTIZACION_APROBADA", "PAGO_INICIADO", "PAGO_AUTORIZADO"]) e.run("3SJR79AE5RX8", NOW, t, null)
  c.close()
}
const snapshot = (conn) => ({
  orders: conn.prepare("SELECT id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message FROM orders ORDER BY id").all(),
  quotes: conn.prepare("SELECT * FROM quotes ORDER BY order_id").all(),
  attempts: conn.prepare("SELECT * FROM attempts ORDER BY id").all(),
  events: conn.prepare("SELECT seq, order_id, at, type, detail FROM events ORDER BY seq").all(),
})

buildV3()
const before = (() => {
  const c = new DatabaseSync(file, { readOnly: true })
  const s = snapshot(c)
  c.close()
  return s
})()

test("M1. la base v3 de partida es valida y tiene datos", () => {
  assert.equal(before.orders.length, 2)
  assert.equal(before.attempts.length, 1)
  assert.equal(before.events.length, 4)
})

test("M2. migrar de v3 a la version actual (4 y 5) conserva TODOS los datos sin alterarlos y deja a las ordenes anteriores como persona", () => {
  const conn = db.openDb(file) // la ruta real: abre, aplica pragmas y migra
  const after = snapshot(conn)
  assert.deepEqual(after, before) // ninguna fila ni valor cambio
  assert.equal(conn.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v, MIGRATIONS.length)
  assert.equal(conn.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n, MIGRATIONS.length)
  const rows = conn.prepare("SELECT id, cust_type, cust_tax_id, cust_giro, cust_address FROM orders ORDER BY id").all()
  assert.deepEqual(rows.map((r) => [r.cust_type, r.cust_tax_id, r.cust_giro, r.cust_address]), [["persona", null, null, null], ["persona", null, null, null]])
  assert.equal(conn.prepare("PRAGMA integrity_check").get().integrity_check, "ok")
  assert.equal(conn.prepare("PRAGMA foreign_key_check").all().length, 0)
  const mo = conn.prepare("SELECT COUNT(*) AS n FROM mail_outbox").get().n
  assert.equal(mo, 0) // las ordenes historicas no generan correos retroactivos
})

test("M3. las migraciones 1-3 ya aplicadas conservan su checksum y volver a abrir la base no cambia nada (idempotente)", () => {
  db.closeDb()
  const conn = db.openDb(file)
  const reg = conn.prepare("SELECT version, checksum FROM schema_migrations ORDER BY version").all()
  for (const m of MIGRATIONS) assert.equal(reg.find((r) => r.version === m.version).checksum, sum(m.sql))
  assert.deepEqual(snapshot(conn), before)
})

test("M4. la proteccion contra doble pago sigue vigente tras migrar", () => {
  const conn = db.openDb(file)
  assert.throws(
    () => conn.prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)").run("att-2", "3SJR79AE5RX8", "anticipo", "BD3SJR79AE5RX8A2", 50, "AUTORIZADO", NOW, NOW),
    /UNIQUE/i,
  )
})

test("M5. compatibilidad hacia atras: el INSERT del codigo anterior (sin las columnas nuevas) sigue funcionando y queda como persona", () => {
  const conn = db.openDb(file)
  conn.prepare("INSERT INTO orders (id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("ZZZZZZZZZZZ2", NOW, NOW, "SOLICITADA", "emprendedor", "Emprendedor", "Cliente Codigo Viejo", "viejo@example.com", null, null, "insert sin columnas nuevas")
  assert.equal(conn.prepare("SELECT cust_type FROM orders WHERE id = ?").get("ZZZZZZZZZZZ2").cust_type, "persona")
})

test("M6. el CHECK de cust_type impide valores invalidos", () => {
  const conn = db.openDb(file)
  assert.throws(() => conn.prepare("UPDATE orders SET cust_type = ? WHERE id = ?").run("otro", "ABCDEFGHJKMN"), /CHECK/i)
})
