import "server-only"
import { randomInt } from "node:crypto"
import { paymentsEnabled } from "./config"
import { openDb } from "./db"
import type { Attempt, Order } from "./types"

// Persistencia en SQLite (ver db.ts y migrations.ts). La interfaz publica es la misma que tenia el
// almacen de archivos: readOrder / writeOrder / storageWritable / withOrderLock.

const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const ID_RE = /^[A-Z2-9]{12}$/

export function isValidOrderId(id: string): boolean {
  return ID_RE.test(id)
}

export function newOrderId(): string {
  let id = ""
  for (let i = 0; i < 12; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)]
  return id
}

type Row = Record<string, unknown>

const str = (v: unknown) => (v == null ? undefined : String(v))
const num = (v: unknown) => (v == null ? undefined : Number(v))

export async function readOrder(id: string): Promise<Order | null> {
  // Con los pagos apagados no se abre ni se crea la base (en produccion el disco es de solo lectura).
  if (!paymentsEnabled() || !isValidOrderId(id)) return null
  const db = openDb()
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Row | undefined
  if (!o) return null
  const q = db.prepare("SELECT * FROM quotes WHERE order_id = ?").get(id) as Row | undefined
  const attempts = db.prepare("SELECT * FROM attempts WHERE order_id = ? ORDER BY created_at, id").all(id) as Row[]
  const events = db.prepare("SELECT at, type, detail FROM events WHERE order_id = ? ORDER BY seq").all(id) as Row[]
  const order: Order = {
    id: String(o.id),
    createdAt: String(o.created_at),
    updatedAt: String(o.updated_at),
    stage: o.stage as Order["stage"],
    planId: String(o.plan_id),
    planName: String(o.plan_name),
    customer: {
      name: String(o.cust_name),
      email: String(o.cust_email),
      ...(o.cust_phone != null && { phone: String(o.cust_phone) }),
      ...(o.cust_company != null && { company: String(o.cust_company) }),
    },
    message: String(o.message),
    attempts: attempts.map((a) => ({
      id: String(a.id),
      kind: a.kind as Attempt["kind"],
      buyOrder: String(a.buy_order),
      amount: Number(a.amount),
      token: str(a.token) ?? null,
      status: a.status as Attempt["status"],
      createdAt: String(a.created_at),
      updatedAt: String(a.updated_at),
      authorizationCode: str(a.authorization_code),
      cardLast4: str(a.card_last4),
      paymentType: str(a.payment_type),
      installments: num(a.installments),
      responseCode: num(a.response_code),
      tbkStatus: str(a.tbk_status),
      note: str(a.note),
    })),
    events: events.map((e) => ({ at: String(e.at), type: String(e.type), ...(e.detail != null && { detail: String(e.detail) }) })),
  }
  if (q) {
    order.quote = {
      amount: Number(q.amount),
      depositPercent: Number(q.deposit_percent),
      depositAmount: Number(q.deposit_amount),
      balanceAmount: Number(q.balance_amount),
      approvedAt: String(q.approved_at),
      validUntil: String(q.valid_until),
      note: str(q.note),
    }
  }
  return order
}

/** Guarda la orden completa en una sola transaccion (todo o nada). Los eventos son solo-agregar. */
export async function writeOrder(order: Order): Promise<void> {
  if (!paymentsEnabled()) throw new Error("pagos deshabilitados")
  if (!isValidOrderId(order.id)) throw new Error("id de orden invalido")
  const db = openDb()
  order.updatedAt = new Date().toISOString()
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare(
      `INSERT INTO orders (id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, stage = excluded.stage`,
    ).run(
      order.id, order.createdAt, order.updatedAt, order.stage, order.planId, order.planName,
      order.customer.name, order.customer.email, order.customer.phone ?? null, order.customer.company ?? null, order.message,
    )
    if (order.quote) {
      const q = order.quote
      db.prepare(
        `INSERT INTO quotes (order_id, amount, deposit_percent, deposit_amount, balance_amount, approved_at, valid_until, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(order_id) DO UPDATE SET amount = excluded.amount, deposit_percent = excluded.deposit_percent,
           deposit_amount = excluded.deposit_amount, balance_amount = excluded.balance_amount,
           approved_at = excluded.approved_at, valid_until = excluded.valid_until, note = excluded.note`,
      ).run(order.id, q.amount, q.depositPercent, q.depositAmount, q.balanceAmount, q.approvedAt, q.validUntil, q.note ?? null)
    }
    const upAttempt = db.prepare(
      `INSERT INTO attempts (id, order_id, kind, buy_order, amount, token, status, created_at, updated_at,
         authorization_code, card_last4, payment_type, installments, response_code, tbk_status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET token = excluded.token, status = excluded.status, updated_at = excluded.updated_at,
         authorization_code = excluded.authorization_code, card_last4 = excluded.card_last4, payment_type = excluded.payment_type,
         installments = excluded.installments, response_code = excluded.response_code, tbk_status = excluded.tbk_status, note = excluded.note`,
    )
    for (const a of order.attempts) {
      upAttempt.run(
        a.id, order.id, a.kind, a.buyOrder, a.amount, a.token, a.status, a.createdAt, a.updatedAt,
        a.authorizationCode ?? null, a.cardLast4 ?? null, a.paymentType ?? null, a.installments ?? null,
        a.responseCode ?? null, a.tbkStatus ?? null, a.note ?? null,
      )
    }
    const have = (db.prepare("SELECT COUNT(*) AS n FROM events WHERE order_id = ?").get(order.id) as { n: number }).n
    const addEvent = db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, ?, ?)")
    for (const e of order.events.slice(have)) addEvent.run(order.id, e.at, e.type, e.detail ?? null)
    db.exec("COMMIT")
  } catch (e) {
    db.exec("ROLLBACK")
    throw e
  }
}

/** Verifica que la base abre y se puede escribir antes de aceptar solicitudes (fail closed). */
export async function storageWritable(): Promise<boolean> {
  if (!paymentsEnabled()) return false
  try {
    const db = openDb()
    db.exec("BEGIN IMMEDIATE")
    db.exec("ROLLBACK")
    return true
  } catch {
    return false
  }
}

// Exclusion mutua por orden dentro del proceso (el contenedor corre una sola instancia).
const locks = new Map<string, Promise<unknown>>()

export async function withOrderLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const chain = prev.then(() => gate)
  locks.set(id, chain)
  try {
    await prev.catch(() => undefined)
    return await fn()
  } finally {
    release()
    if (locks.get(id) === chain) locks.delete(id)
  }
}
