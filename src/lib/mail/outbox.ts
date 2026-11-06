import "server-only"
import { paymentsEnabled } from "@/lib/payments/config"
import { openDb } from "@/lib/payments/db"
import { activeTransport, MailError, type MailMessage } from "./transport"

// Cola persistente (tabla mail_outbox, migracion 4). Garantias:
//  - Idempotencia: dedupe_key UNIQUE; el mismo hecho nunca genera dos correos aunque el callback se repita.
//  - Persistencia y reintentos con espera progresiva; tras MAX_ATTEMPTS queda FALLIDO (visible en `mail-status` y en la alerta).
//  - Recuperacion: un envio que quedo ENVIANDO por una caida vuelve a PENDIENTE tras 10 min.
//  - Entrega "al menos una vez": si el proceso cae justo despues de que el proveedor acepto el mensaje y antes de marcarlo,
//    podria reenviarse una vez (no hay forma de evitarlo sin una confirmacion del proveedor). Es preferible a perder el aviso.
//  - El fallo de un correo NUNCA afecta a pagos ni ordenes: el encolado se hace despues de confirmar el estado y sin propagar errores.

export const MAX_ATTEMPTS = 6
const BACKOFF_MIN = [1, 5, 30, 120, 720]
const CLAIM_MIN = 10

type Row = Record<string, unknown>
const iso = (ms = Date.now()) => new Date(ms).toISOString()

export type Enqueue = { dedupeKey: string; orderId?: string; template: string; to: string; subject: string; html: string; text: string }

/** Devuelve true si se encolo, false si ya existia (idempotente). */
export function enqueueMail(e: Enqueue): boolean {
  const r = openDb()
    .prepare(
      `INSERT OR IGNORE INTO mail_outbox (dedupe_key, order_id, template, to_addr, subject, body_html, body_text, status, attempts, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 0, ?, ?)`,
    )
    .run(e.dedupeKey, e.orderId ?? null, e.template, e.to, e.subject, e.html, e.text, iso(), iso()) as { changes: number | bigint }
  return Number(r.changes) > 0
}

let running = false

/** Envia los correos vencidos. Seguro de llamar en paralelo (un solo despachador por proceso). */
export async function dispatchDue(max = 10): Promise<{ sent: number; failed: number; retry: number; skipped?: string }> {
  const out = { sent: 0, failed: 0, retry: 0 }
  if (running) return { ...out, skipped: "en-curso" }
  const transport = activeTransport()
  if (!transport || !paymentsEnabled()) return { ...out, skipped: "correo-no-configurado" }
  running = true
  try {
    const db = openDb()
    // Recupera envios interrumpidos.
    db.prepare("UPDATE mail_outbox SET status = 'PENDIENTE' WHERE status = 'ENVIANDO' AND next_attempt_at <= ?").run(iso())
    const due = db
      .prepare("SELECT id FROM mail_outbox WHERE status = 'PENDIENTE' AND next_attempt_at <= ? ORDER BY id LIMIT ?")
      .all(iso(), max) as { id: number }[]
    for (const { id } of due) {
      const claim = db
        .prepare("UPDATE mail_outbox SET status = 'ENVIANDO', attempts = attempts + 1, next_attempt_at = ? WHERE id = ? AND status = 'PENDIENTE'")
        .run(iso(Date.now() + CLAIM_MIN * 60_000), id) as { changes: number | bigint }
      if (Number(claim.changes) === 0) continue
      const m = db.prepare("SELECT * FROM mail_outbox WHERE id = ?").get(id) as Row
      const msg: MailMessage = {
        to: String(m.to_addr),
        subject: String(m.subject),
        html: String(m.body_html),
        text: String(m.body_text),
        messageKey: String(m.dedupe_key),
      }
      const attempts = Number(m.attempts)
      try {
        await transport.send(msg)
        // Enviado: se conserva el registro y se vacia el cuerpo (menos datos personales almacenados).
        db.prepare("UPDATE mail_outbox SET status = 'ENVIADO', sent_at = ?, last_error = NULL, body_html = '', body_text = '' WHERE id = ?").run(iso(), id)
        out.sent++
      } catch (e) {
        const permanent = e instanceof MailError && e.permanent
        const msgErr = (e instanceof Error ? e.message : "error").slice(0, 200) // sin cuerpos de respuesta ni credenciales
        if (permanent || attempts >= MAX_ATTEMPTS) {
          db.prepare("UPDATE mail_outbox SET status = 'FALLIDO', last_error = ? WHERE id = ?").run(msgErr, id)
          out.failed++
        } else {
          const wait = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)]
          db.prepare("UPDATE mail_outbox SET status = 'PENDIENTE', last_error = ?, next_attempt_at = ? WHERE id = ?").run(msgErr, iso(Date.now() + wait * 60_000), id)
          out.retry++
        }
      }
    }
  } finally {
    running = false
  }
  if (out.sent + out.failed + out.retry > 0) console.info(JSON.stringify({ at: iso(), scope: "mail", event: "dispatch", ...out }))
  return out
}

export function outboxStats() {
  const db = openDb()
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM mail_outbox GROUP BY status").all() as { status: string; n: number }[]
  const failed = db
    .prepare("SELECT id, order_id AS orderId, template, attempts, last_error AS lastError, created_at AS createdAt FROM mail_outbox WHERE status = 'FALLIDO' ORDER BY id DESC LIMIT 20")
    .all()
  return { counts: Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])), failed }
}

let timer: ReturnType<typeof setInterval> | null = null

/** Despachador en segundo plano del proceso (cada 60 s). No hace nada mientras el correo o los pagos esten apagados. */
export function startMailTimer() {
  if (timer) return
  timer = setInterval(() => {
    void dispatchDue().catch(() => undefined)
  }, 60_000)
  timer.unref?.()
}

/** Despacha ahora, sin esperar (fuera del camino del pago). */
export function kickDispatch() {
  startMailTimer()
  setTimeout(() => void dispatchDue().catch(() => undefined), 0).unref?.()
}
