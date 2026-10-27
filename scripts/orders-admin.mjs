#!/usr/bin/env node
// Administracion de ordenes y de la base SQLite (solo desde la maquina del administrador; no es un endpoint web).
// Uso:
//   node scripts/orders-admin.mjs list
//   node scripts/orders-admin.mjs show <ID>
//   node scripts/orders-admin.mjs approve <ID> --amount <CLP> [--deposit-percent 50] [--valid-days 7] [--note "texto"]
//   node scripts/orders-admin.mjs release-balance <ID>
//   node scripts/orders-admin.mjs close <ID>
//   node scripts/orders-admin.mjs check                      integridad + migraciones
//   node scripts/orders-admin.mjs backup <archivo.db>        copia consistente (VACUUM INTO), no sobrescribe
//   node scripts/orders-admin.mjs restore <archivo.db> --yes reemplaza la base (detener la app antes)
// Base de datos: PAYMENTS_DB o ./.data/bydlight.db

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { MIGRATIONS } from "../src/lib/payments/migrations.mjs"

const file = process.env.PAYMENTS_DB ?? path.join(process.cwd(), ".data", "bydlight.db")
const ID_RE = /^[A-Z2-9]{12}$/

const [cmd, arg, ...rest] = process.argv.slice(2)
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : def
}
const die = (m) => {
  console.error(m)
  process.exit(1)
}
const clp = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
const sum = (s) => createHash("sha256").update(s).digest("hex")

function open(f = file) {
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(f)
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000")
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)")
  const applied = new Map(db.prepare("SELECT version, checksum FROM schema_migrations").all().map((r) => [r.version, r.checksum]))
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) {
      if (applied.get(m.version) !== sum(m.sql)) die(`La migracion ${m.version} fue modificada despues de aplicarse.`)
      continue
    }
    db.exec("BEGIN IMMEDIATE")
    db.exec(m.sql)
    db.prepare("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)").run(m.version, m.name, sum(m.sql), new Date().toISOString())
    db.exec("COMMIT")
  }
  return db
}

const mustOrder = (db, id) => {
  if (!ID_RE.test(id ?? "")) die("ID de orden invalido.")
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id)
  if (!o) die("Orden no encontrada.")
  return o
}
const event = (db, id, type, detail) =>
  db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, ?, ?)").run(id, new Date().toISOString(), type, detail ?? null)
const touch = (db, id, stage) =>
  db.prepare("UPDATE orders SET stage = ?, updated_at = ? WHERE id = ?").run(stage, new Date().toISOString(), id)

if (cmd === "list") {
  const db = open()
  const rows = db.prepare("SELECT id, stage, plan_name, cust_name, cust_email FROM orders ORDER BY created_at").all()
  for (const o of rows) console.log(`${o.id}  ${o.stage.padEnd(16)} ${o.plan_name.padEnd(18)} ${o.cust_name} <${o.cust_email}>`)
  if (!rows.length) console.log("(sin ordenes)")
} else if (cmd === "show") {
  const db = open()
  const o = mustOrder(db, arg)
  const quote = db.prepare("SELECT * FROM quotes WHERE order_id = ?").get(arg) ?? null
  const attempts = db
    .prepare("SELECT id, kind, buy_order, amount, status, authorization_code, card_last4, response_code, tbk_status, created_at FROM attempts WHERE order_id = ? ORDER BY created_at")
    .all(arg) // sin tokens
  const events = db.prepare("SELECT at, type, detail FROM events WHERE order_id = ? ORDER BY seq").all(arg)
  console.log(JSON.stringify({ order: o, quote, attempts, events }, null, 2))
} else if (cmd === "approve") {
  const db = open()
  const o = mustOrder(db, arg)
  if (o.stage !== "SOLICITADA" && o.stage !== "COTIZADA") die(`No se puede cotizar una orden en estado ${o.stage}.`)
  if (db.prepare("SELECT 1 FROM attempts WHERE order_id = ? AND status = 'AUTORIZADO'").get(arg)) die("La orden ya tiene un pago autorizado.")
  const amount = Number(opt("amount"))
  const pct = Number(opt("deposit-percent", "50"))
  const days = Number(opt("valid-days", "7"))
  if (!Number.isInteger(amount) || amount < 100) die("--amount debe ser un entero en CLP (minimo 100).")
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) die("--deposit-percent debe estar entre 1 y 100.")
  if (!Number.isInteger(days) || days < 1 || days > 60) die("--valid-days debe estar entre 1 y 60.")
  const deposit = Math.round((amount * pct) / 100)
  const now = new Date()
  db.exec("BEGIN IMMEDIATE")
  db.prepare(
    `INSERT INTO quotes (order_id, amount, deposit_percent, deposit_amount, balance_amount, approved_at, valid_until, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET amount = excluded.amount, deposit_percent = excluded.deposit_percent,
       deposit_amount = excluded.deposit_amount, balance_amount = excluded.balance_amount,
       approved_at = excluded.approved_at, valid_until = excluded.valid_until, note = excluded.note`,
  ).run(arg, amount, pct, deposit, amount - deposit, now.toISOString(), new Date(now.getTime() + days * 86_400_000).toISOString(), opt("note") ?? null)
  touch(db, arg, "COTIZADA")
  event(db, arg, "COTIZACION_APROBADA", `${amount} / anticipo ${deposit}`)
  db.exec("COMMIT")
  console.log(`Cotizacion aprobada: total ${clp(amount)}, anticipo ${clp(deposit)} (${pct}%), saldo ${clp(amount - deposit)}.`)
} else if (cmd === "release-balance") {
  const db = open()
  const o = mustOrder(db, arg)
  if (o.stage !== "ANTICIPO_PAGADO") die(`Solo se habilita el saldo tras el anticipo (estado actual: ${o.stage}).`)
  db.exec("BEGIN IMMEDIATE")
  touch(db, arg, "SALDO_HABILITADO")
  event(db, arg, "SALDO_HABILITADO")
  db.exec("COMMIT")
  console.log("Saldo habilitado.")
} else if (cmd === "close") {
  const db = open()
  mustOrder(db, arg)
  db.exec("BEGIN IMMEDIATE")
  touch(db, arg, "CERRADA")
  event(db, arg, "ORDEN_CERRADA")
  db.exec("COMMIT")
  console.log("Orden cerrada.")
} else if (cmd === "check") {
  const db = open()
  const ic = db.prepare("PRAGMA integrity_check").all().map((r) => r.integrity_check)
  const fk = db.prepare("PRAGMA foreign_key_check").all()
  const v = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v
  console.log(`integridad: ${ic.join(", ")} | claves foraneas: ${fk.length ? "ERRORES" : "ok"} | migracion: v${v}`)
  if (ic[0] !== "ok" || fk.length) process.exit(2)
} else if (cmd === "backup") {
  if (!arg) die("Indica el archivo de destino.")
  if (fs.existsSync(arg)) die("El destino ya existe; no se sobrescribe.")
  const db = open()
  fs.mkdirSync(path.dirname(path.resolve(arg)), { recursive: true, mode: 0o700 })
  db.prepare("VACUUM INTO ?").run(path.resolve(arg))
  try { fs.chmodSync(arg, 0o600) } catch { /* Windows */ }
  const t = new DatabaseSync(arg, { readOnly: true })
  const ok = t.prepare("PRAGMA integrity_check").get().integrity_check
  t.close()
  if (ok !== "ok") die(`Respaldo creado pero la verificacion fallo: ${ok}`)
  console.log(`Respaldo verificado: ${arg}`)
} else if (cmd === "restore") {
  if (!arg || !fs.existsSync(arg)) die("Indica un respaldo existente.")
  if (!rest.includes("--yes")) die("Restaurar reemplaza la base actual. Detiene la app y repite con --yes.")
  const t = new DatabaseSync(path.resolve(arg), { readOnly: true })
  const ok = t.prepare("PRAGMA integrity_check").get().integrity_check
  const has = t.prepare("SELECT name FROM sqlite_master WHERE name = 'orders'").get()
  t.close()
  if (ok !== "ok" || !has) die("El respaldo no es una base valida de ordenes.")
  if (fs.existsSync(file)) {
    const safety = `${file}.antes-de-restaurar-${Date.now()}`
    const cur = open()
    cur.prepare("VACUUM INTO ?").run(safety)
    cur.close()
    console.log(`Copia de seguridad previa: ${safety}`)
  }
  try {
    for (const ext of ["-wal", "-shm"]) fs.rmSync(file + ext, { force: true })
  } catch {
    die("La base esta en uso. Detiene la aplicacion y repite (la base actual no se modifico).")
  }
  fs.copyFileSync(arg, file)
  try { fs.chmodSync(file, 0o600) } catch { /* Windows */ }
  open().close() // aplica migraciones pendientes si el respaldo es mas antiguo
  console.log("Base restaurada y migrada.")
} else {
  die("Comandos: list | show <ID> | approve <ID> --amount N | release-balance <ID> | close <ID> | check | backup <archivo> | restore <archivo> --yes")
}
