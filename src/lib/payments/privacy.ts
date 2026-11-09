import "server-only"
import { randomBytes } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { dbPath, openDb } from "./db"
import { isValidOrderId } from "./store"

/**
 * Retencion y anonimizacion de datos personales (politica de privacidad, §6).
 *
 * Principios:
 *  - SIMULACION por defecto: nada se modifica sin `execute: true`.
 *  - Solo se anonimizan solicitudes SIN contratacion ni pago: etapa SOLICITADA/COTIZADA, cotizacion ausente o vencida, sin ningun pago
 *    autorizado/pendiente/en curso, sin devoluciones y sin documentos tributarios. Las ordenes con pago o antecedentes tributarios
 *    JAMAS se tocan (conservacion legal).
 *  - Se ANONIMIZA, no se borra: la fila de la orden, sus fechas, el plan, los intentos y los eventos permanecen (integridad referencial,
 *    conciliacion e historial). Solo se reemplazan los datos personales.
 *  - Lotes acotados (limite por ejecucion), una transaccion por orden, sin purgas globales.
 *  - Cada ejecucion deja una linea en `privacy-audit.log` (junto a la base, modo 600) y un evento en la orden, SIN datos personales.
 * No hay ninguna ejecucion automatica: solo la dispara el titular con la API administrativa firmada.
 */

export const RETENTION_MONTHS = 24
export const ANON_NAME = "[anonimizado]"
const ANON_MESSAGE = "[eliminado por politica de privacidad]"
const MAX_LIMIT = 200
const anonEmail = (id: string) => `anonimizado-${id.toLowerCase()}@invalid.local`

export type Reason = "retencion" | "solicitud-titular"
export type Candidate = { orderId: string; stage: string; lastActivity: string }
export type SkipReason = "con-pago-o-documentos" | "cotizacion-vigente" | "correo-pendiente" | "ya-anonimizada" | "inexistente" | "no-vencida" | "etapa-contratada"
export type ScanResult = {
  mode: "simulacion" | "ejecucion"
  months: number
  cutoff: string
  eligible: Candidate[]
  retainedLegal: number // ordenes con pago/devolucion/documento: nunca elegibles
  retainedYoung: number // sin pago pero con actividad dentro del plazo
  alreadyAnonymized: number
  anonymized: string[]
  runId?: string
}

type Row = Record<string, unknown>
const iso = (ms: number) => new Date(ms).toISOString()
const subMonths = (ms: number, m: number) => {
  const d = new Date(ms)
  d.setUTCMonth(d.getUTCMonth() - m)
  return d.getTime()
}

const LEGAL_HOLD = `(
  EXISTS (SELECT 1 FROM attempts a WHERE a.order_id = o.id AND a.status IN ('AUTORIZADO','PENDIENTE','INICIADO'))
  OR EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = o.id)
  OR EXISTS (SELECT 1 FROM tax_documents t WHERE t.order_id = o.id)
  OR o.stage NOT IN ('SOLICITADA','COTIZADA')
)`

function lastActivity(db: ReturnType<typeof openDb>, id: string, updatedAt: string): string {
  const e = db.prepare("SELECT MAX(at) AS at FROM events WHERE order_id = ?").get(id) as Row | undefined
  const at = e?.at ? String(e.at) : ""
  return at > updatedAt ? at : updatedAt
}

function pendingMail(db: ReturnType<typeof openDb>, id: string): boolean {
  return ((db.prepare("SELECT COUNT(*) AS n FROM mail_outbox WHERE order_id = ? AND status IN ('PENDIENTE','ENVIANDO')").get(id) as Row).n as number) > 0
}

function quoteValid(db: ReturnType<typeof openDb>, id: string, nowIso: string): boolean {
  const q = db.prepare("SELECT valid_until FROM quotes WHERE order_id = ?").get(id) as Row | undefined
  return !!q && String(q.valid_until) >= nowIso
}

function auditLog(entry: Record<string, unknown>) {
  const file = path.join(path.dirname(dbPath()), "privacy-audit.log")
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", { mode: 0o600 })
}

/** Anonimiza UNA orden ya validada (dentro de una transaccion propia). */
function anonymizeOne(db: ReturnType<typeof openDb>, id: string, reason: Reason, runId: string, at: string) {
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(
      `UPDATE orders SET cust_name = ?, cust_email = ?, cust_phone = NULL, cust_company = NULL, message = ?,
         cust_tax_id = NULL, cust_giro = NULL, cust_address = NULL WHERE id = ?`,
    ).run(ANON_NAME, anonEmail(id), ANON_MESSAGE, id)
    db.prepare("UPDATE quotes SET note = NULL WHERE order_id = ?").run(id)
    db.prepare("UPDATE mail_outbox SET to_addr = ?, subject = ?, body_html = '', body_text = '', last_error = NULL WHERE order_id = ? AND status IN ('ENVIADO','FALLIDO')").run(
      anonEmail(id),
      "[anonimizado]",
      id,
    )
    db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, 'PRIVACIDAD_ANONIMIZADA', ?)").run(id, at, `${reason} run:${runId}`)
    db.exec("COMMIT")
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  }
}

/**
 * Busca (y con `execute` anonimiza) solicitudes sin contratacion ni pago con mas de `months` meses de inactividad.
 * `limit` acota cuantas se procesan por ejecucion (maximo 200).
 */
export function retentionRun(opts: { execute?: boolean; months?: number; limit?: number; now?: number } = {}): ScanResult {
  const db = openDb()
  const now = opts.now ?? Date.now()
  const months = Math.min(Math.max(Math.floor(opts.months ?? RETENTION_MONTHS), RETENTION_MONTHS), 120) // nunca menos que la politica
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 50), 1), MAX_LIMIT)
  const cutoff = iso(subMonths(now, months))
  const nowIso = iso(now)
  const runId = randomBytes(6).toString("hex")

  const rows = db.prepare(`SELECT o.id AS id, o.stage AS stage, o.updated_at AS updated_at, o.cust_name AS cust_name, ${LEGAL_HOLD} AS hold FROM orders o ORDER BY o.created_at`).all() as Row[]
  const res: ScanResult = { mode: opts.execute ? "ejecucion" : "simulacion", months, cutoff, eligible: [], retainedLegal: 0, retainedYoung: 0, alreadyAnonymized: 0, anonymized: [], runId }
  for (const r of rows) {
    const id = String(r.id)
    if (r.cust_name === ANON_NAME) { res.alreadyAnonymized++; continue }
    if (Number(r.hold) === 1) { res.retainedLegal++; continue }
    const last = lastActivity(db, id, String(r.updated_at))
    if (last >= cutoff || quoteValid(db, id, nowIso) || pendingMail(db, id)) { res.retainedYoung++; continue }
    res.eligible.push({ orderId: id, stage: String(r.stage), lastActivity: last })
  }
  if (opts.execute) {
    for (const c of res.eligible.slice(0, limit)) {
      anonymizeOne(db, c.orderId, "retencion", runId, nowIso)
      res.anonymized.push(c.orderId)
    }
  }
  auditLog({ runId, at: nowIso, mode: res.mode, reason: "retencion", months, cutoff, eligible: res.eligible.length, retainedLegal: res.retainedLegal, retainedYoung: res.retainedYoung, anonymized: res.anonymized })
  return res
}

export type EraseResult = { ok: true; mode: "simulacion" | "ejecucion"; orderId: string; erased: boolean } | { ok: false; error: string; reason: SkipReason }

/**
 * Supresion a solicitud del titular de UNA orden. Solo si no esta sujeta a conservacion legal (sin pago, devolucion ni documento
 * tributario); si lo esta, se rechaza y se debe informar al titular que sus datos se conservan solo para esa finalidad.
 */
export function eraseOrder(orderId: string, opts: { execute?: boolean; now?: number } = {}): EraseResult {
  if (!isValidOrderId(orderId)) return { ok: false, error: "ID de orden invalido.", reason: "inexistente" }
  const db = openDb()
  const now = opts.now ?? Date.now()
  const nowIso = iso(now)
  const r = db.prepare(`SELECT o.id AS id, o.cust_name AS cust_name, ${LEGAL_HOLD} AS hold FROM orders o WHERE o.id = ?`).get(orderId) as Row | undefined
  const runId = randomBytes(6).toString("hex")
  const refuse = (error: string, reason: SkipReason): EraseResult => {
    auditLog({ runId, at: nowIso, mode: opts.execute ? "ejecucion" : "simulacion", reason: "solicitud-titular", orderId, anonymized: [], refused: reason })
    return { ok: false, error, reason }
  }
  if (!r) return refuse("Orden no encontrada.", "inexistente")
  if (r.cust_name === ANON_NAME) return refuse("La orden ya esta anonimizada.", "ya-anonimizada")
  if (Number(r.hold) === 1) return refuse("La orden tiene pagos, devoluciones o documentos tributarios, o una etapa contratada: sus datos se conservan por obligacion legal y solo para esa finalidad.", "con-pago-o-documentos")
  if (quoteValid(db, orderId, nowIso)) return refuse("Tiene una cotizacion vigente: espere su vencimiento o cierre la orden antes de suprimir.", "cotizacion-vigente")
  if (pendingMail(db, orderId)) return refuse("Hay correos pendientes de envio: ejecute mail-dispatch y reintente.", "correo-pendiente")
  if (opts.execute) anonymizeOne(db, orderId, "solicitud-titular", runId, nowIso)
  auditLog({ runId, at: nowIso, mode: opts.execute ? "ejecucion" : "simulacion", reason: "solicitud-titular", orderId, anonymized: opts.execute ? [orderId] : [] })
  return { ok: true, mode: opts.execute ? "ejecucion" : "simulacion", orderId, erased: !!opts.execute }
}

/** Rectificacion de nombre, telefono, empresa o correo de una orden (derecho de rectificacion). No toca datos de documentos ya emitidos. */
export function rectifyCustomer(orderId: string, f: { name?: string; phone?: string; company?: string; email?: string }, now = Date.now()): { ok: true; fields: string[] } | { ok: false; error: string } {
  if (!isValidOrderId(orderId)) return { ok: false, error: "ID de orden invalido." }
  const db = openDb()
  const o = db.prepare("SELECT cust_name FROM orders WHERE id = ?").get(orderId) as Row | undefined
  if (!o) return { ok: false, error: "Orden no encontrada." }
  if (o.cust_name === ANON_NAME) return { ok: false, error: "La orden esta anonimizada." }
  const sets: string[] = []
  const vals: (string | null)[] = []
  const fields: string[] = []
  const clean = (s: string, n: number) => s.replace(/[\r\n\t]+/g, " ").trim().slice(0, n)
  if (f.name !== undefined) { const v = clean(f.name, 80); if (v.length < 2) return { ok: false, error: "Nombre invalido." }; sets.push("cust_name = ?"); vals.push(v); fields.push("nombre") }
  if (f.email !== undefined) {
    const v = clean(f.email, 120).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: "Correo invalido." }
    sets.push("cust_email = ?"); vals.push(v); fields.push("correo")
  }
  if (f.phone !== undefined) { const v = clean(f.phone, 30); sets.push("cust_phone = ?"); vals.push(v || null); fields.push("telefono") }
  if (f.company !== undefined) { const v = clean(f.company, 120); sets.push("cust_company = ?"); vals.push(v || null); fields.push("empresa") }
  if (!sets.length) return { ok: false, error: "Indique al menos un dato a rectificar." }
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).run(...vals, orderId)
    db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, 'PRIVACIDAD_RECTIFICADA', ?)").run(orderId, iso(now), fields.join(","))
    db.exec("COMMIT")
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  }
  auditLog({ runId: randomBytes(6).toString("hex"), at: iso(now), mode: "ejecucion", reason: "rectificacion", orderId, fields })
  return { ok: true, fields }
}
