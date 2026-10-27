import "server-only"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { MIGRATIONS } from "./migrations.mjs"

// Tipos minimos de node:sqlite (los @types/node del proyecto son anteriores al modulo).
export type SqlValue = string | number | null
export interface Statement {
  run(...p: SqlValue[]): unknown
  get(...p: SqlValue[]): unknown
  all(...p: SqlValue[]): unknown[]
}
export interface DatabaseSync {
  exec(sql: string): void
  prepare(sql: string): Statement
  close(): void
}

// SQLite con el modulo integrado de Node (node:sqlite, Node >= 22.13): sin dependencias nativas ni
// binarios extra en la imagen. Se obtiene con process.getBuiltinModule para que el bundler no lo toque.
// Politica: una sola instancia de la app escribe; WAL + busy_timeout cubren lecturas y escrituras concurrentes.

export function dbPath(): string {
  if (process.env.PAYMENTS_DB) return process.env.PAYMENTS_DB
  // Ruta fija en produccion: un volumen montado en /data no requiere variables de entorno.
  return process.env.NODE_ENV === "production" ? "/data/bydlight.db" : path.join(process.cwd(), ".data", "bydlight.db")
}

let db: DatabaseSync | null = null
let openedPath = ""

export function openDb(file = dbPath()): DatabaseSync {
  if (db && openedPath === file) return db
  db?.close()
  db = null

  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const { DatabaseSync: Db } = process.getBuiltinModule("node:sqlite") as { DatabaseSync: new (file: string) => DatabaseSync }
  const conn = new Db(file)
  try {
    try { fs.chmodSync(file, 0o600) } catch { /* en Windows no aplica */ }
    conn.exec("PRAGMA journal_mode = WAL")
    conn.exec("PRAGMA synchronous = FULL") // durabilidad ante cortes: es dinero, no un cache
    conn.exec("PRAGMA foreign_keys = ON")
    conn.exec("PRAGMA busy_timeout = 5000")
    migrate(conn)
  } catch (e) {
    conn.close()
    throw e
  }
  db = conn
  openedPath = file
  return conn
}

export function closeDb() {
  db?.close()
  db = null
  openedPath = ""
}

const checksum = (sql: string) => createHash("sha256").update(sql).digest("hex")

/** Aplica las migraciones pendientes en orden, cada una en su transaccion. Aborta si una ya aplicada fue alterada. */
export function migrate(conn: DatabaseSync) {
  conn.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
  )
  const applied = new Map(
    (conn.prepare("SELECT version, checksum FROM schema_migrations").all() as { version: number; checksum: string }[]).map(
      (r) => [r.version, r.checksum],
    ),
  )
  for (const m of MIGRATIONS) {
    const sum = checksum(m.sql)
    const prev = applied.get(m.version)
    if (prev) {
      if (prev !== sum) throw new Error(`La migracion ${m.version} (${m.name}) fue modificada despues de aplicarse`)
      continue
    }
    conn.exec("BEGIN IMMEDIATE")
    try {
      conn.exec(m.sql)
      conn
        .prepare("INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)")
        .run(m.version, m.name, sum, new Date().toISOString())
      conn.exec("COMMIT")
    } catch (e) {
      conn.exec("ROLLBACK")
      throw e
    }
  }
}
