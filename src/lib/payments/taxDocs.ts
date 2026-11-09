import "server-only"
import { openDb } from "./db"
import { isValidOrderId, readOrder, withOrderLock } from "./store"
import { ivaBreakdown } from "@/lib/tax"
import { normalizeRut } from "@/lib/rut"

// Modelo de documentos tributarios. SOLO REGISTRA lo que el titular emitio por los canales autorizados del SII (sistema gratuito de
// boletas, facturacion, etc.): este modulo NO emite, NO firma y NO se comunica con el SII. Un voucher de Webpay no se asume como documento:
// cada pago autorizado queda «pendiente de documento» hasta que se registra uno... salvo que el voucher electronico del medio de pago tenga validez
// tributaria: entonces se registra como `voucher_pago` (NO_REQUERIDO) y no se emite nada adicional (un pago NO siempre requiere boleta). Reglas: un solo documento vigente por pago (indice unico en la
// base), folio unico por tipo, y el importe sale siempre del pago autorizado (nunca del operador).

export type TaxKind = "boleta" | "factura" | "factura_exportacion" | "nota_credito" | "voucher_pago"
export type TaxStatus = "PENDIENTE" | "EMITIDO" | "ANULADO" | "NO_REQUERIDO"

export type TaxDocument = {
  id: number
  orderId: string
  attemptId?: string
  kind: TaxKind
  status: TaxStatus
  folio?: string
  issuedAt?: string
  totalAmount: number
  netAmount?: number
  vatAmount?: number
  receiverTaxId?: string
  receiverName?: string
  refDocId?: number
  note?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type TaxResult<T> = { ok: true; data: T } | { ok: false; error: string }
const fail = (error: string): TaxResult<never> => ({ ok: false, error })

type Row = Record<string, unknown>
const str = (v: unknown) => (v == null ? undefined : String(v))
const num = (v: unknown) => (v == null ? undefined : Number(v))

function rowToDoc(r: Row): TaxDocument {
  return {
    id: Number(r.id),
    orderId: String(r.order_id),
    attemptId: str(r.attempt_id),
    kind: r.kind as TaxKind,
    status: r.status as TaxStatus,
    folio: str(r.folio),
    issuedAt: str(r.issued_at),
    totalAmount: Number(r.total_amount),
    netAmount: num(r.net_amount),
    vatAmount: num(r.vat_amount),
    receiverTaxId: str(r.receiver_tax_id),
    receiverName: str(r.receiver_name),
    refDocId: num(r.ref_doc_id),
    note: str(r.note),
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

const KINDS: TaxKind[] = ["boleta", "factura", "factura_exportacion", "nota_credito", "voucher_pago"]
const FOLIO_RE = /^[0-9A-Za-z-]{1,20}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && d.getTime() <= Date.now() + 86_400_000
}

export type RegisterInput = {
  attemptId?: string
  kind: string
  folio?: string
  issuedAt?: string // AAAA-MM-DD
  receiverTaxId?: string // factura de exportacion: identificador tributario del receptor extranjero
  receiverName?: string
  refDocId?: number // nota de credito: documento que corrige
  totalAmount?: number // solo nota de credito (parcial); en los demas, el monto del pago
  note?: string
  createdBy?: string
}

/**
 * Registra un documento para un pago AUTORIZADO. Con folio y fecha queda EMITIDO; sin ellos, PENDIENTE (preparado, aun no emitido).
 * Las validaciones por tipo impiden mezclar boleta/factura con datos del cliente que no corresponden.
 */
export async function registerTaxDocument(orderId: string, p: RegisterInput): Promise<TaxResult<TaxDocument>> {
  if (!isValidOrderId(orderId)) return fail("ID de orden invalido.")
  if (!KINDS.includes(p.kind as TaxKind)) return fail("kind debe ser boleta, factura, factura_exportacion, nota_credito o voucher_pago.")
  const kind = p.kind as TaxKind
  if (p.folio !== undefined && !FOLIO_RE.test(p.folio)) return fail("folio invalido (1 a 20 letras, numeros o guion).")
  if (p.issuedAt !== undefined && !validDate(p.issuedAt)) return fail("issuedAt debe ser una fecha AAAA-MM-DD valida y no futura.")
  if (kind === "voucher_pago" && (p.folio || p.issuedAt)) return fail("El voucher de pago no lleva folio ni fecha: no es un documento emitido por Bydlight.")
  if (Boolean(p.folio) !== Boolean(p.issuedAt)) return fail("Indique folio e issuedAt juntos (documento emitido) o ninguno (pendiente).")
  if (p.note && p.note.length > 300) return fail("note es demasiado larga.")
  return withOrderLock(orderId, async () => {
    const order = await readOrder(orderId)
    if (!order) return fail("Orden no encontrada.")
    const db = openDb()
    const now = new Date().toISOString()
    const status: TaxStatus = kind === "voucher_pago" ? "NO_REQUERIDO" : p.folio ? "EMITIDO" : "PENDIENTE"
    let total: number
    let attemptId: string | null = null
    let refDocId: number | null = null
    let receiverTaxId: string | null = null
    let receiverName: string | null = null
    let net: number | null = null
    let vat: number | null = null

    if (kind === "nota_credito") {
      if (!Number.isInteger(p.refDocId)) return fail("La nota de credito requiere refDocId (documento que corrige).")
      const ref = db.prepare("SELECT * FROM tax_documents WHERE id = ? AND order_id = ?").get(p.refDocId as number, orderId) as Row | undefined
      if (!ref || ref.kind === "nota_credito") return fail("Documento de referencia no valido para esta orden.")
      if (ref.status !== "EMITIDO") return fail("Solo se corrige un documento EMITIDO.")
      const t = p.totalAmount ?? Number(ref.total_amount)
      if (!Number.isInteger(t) || t < 1 || t > Number(ref.total_amount)) return fail("totalAmount debe ser entero y no superar el documento corregido.")
      total = t
      refDocId = Number(p.refDocId)
      attemptId = str(ref.attempt_id) ?? null
      receiverTaxId = str(ref.receiver_tax_id) ?? null
      receiverName = str(ref.receiver_name) ?? null
      if (ref.kind === "factura_exportacion") {
        net = total
        vat = 0
      } else {
        const b = ivaBreakdown(total)
        net = b.net
        vat = b.iva
      }
    } else {
      if (!p.attemptId) return fail("attemptId es obligatorio (el documento corresponde a un pago).")
      const attempt = order.attempts.find((a) => a.id === p.attemptId)
      if (!attempt) return fail("El pago no pertenece a esta orden.")
      if (attempt.status !== "AUTORIZADO") return fail(`Solo se documentan pagos AUTORIZADOS (estado actual: ${attempt.status}).`)
      total = attempt.amount // el importe sale del pago, nunca del operador
      attemptId = attempt.id
      if (kind === "voucher_pago") {
        // El voucher del medio de pago cubre el pago: no se emite boleta adicional. Se registra para que el pago deje de figurar como pendiente.
        const b = ivaBreakdown(total)
        net = b.net
        vat = b.iva
      } else if (kind === "boleta") {
        const b = ivaBreakdown(total)
        net = b.net
        vat = b.iva
        receiverName = order.customer.name
      } else if (kind === "factura") {
        const c = order.customer
        if (c.type !== "empresa" || !c.taxId || !c.company) return fail("La factura nacional requiere un cliente empresa con razon social y RUT en la orden.")
        const b = ivaBreakdown(total)
        net = b.net
        vat = b.iva
        receiverTaxId = c.taxId
        receiverName = c.company
      } else {
        // Exportacion: receptor extranjero. No se asume IVA; el tratamiento tributario lo determina el contador (decision pendiente del titular).
        const taxId = (p.receiverTaxId ?? "").trim()
        const name = (p.receiverName ?? "").trim()
        if (taxId.length < 3 || taxId.length > 40 || name.length < 2 || name.length > 120) return fail("La factura de exportacion requiere receiverTaxId y receiverName del receptor extranjero.")
        if (normalizeRut(taxId)) return fail("Un RUT chileno corresponde a factura nacional, no de exportacion.")
        net = total
        vat = 0
        receiverTaxId = taxId
        receiverName = name
      }
    }
    try {
      const r = db
        .prepare(
          `INSERT INTO tax_documents (order_id, attempt_id, kind, status, folio, issued_at, total_amount, net_amount, vat_amount, receiver_tax_id, receiver_name, ref_doc_id, note, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(orderId, attemptId, kind, status, p.folio ?? null, p.issuedAt ?? null, total, net, vat, receiverTaxId, receiverName, refDocId, p.note ?? null, p.createdBy ?? "admin-api", now, now) as { lastInsertRowid: number | bigint }
      const row = db.prepare("SELECT * FROM tax_documents WHERE id = ?").get(Number(r.lastInsertRowid)) as Row
      db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, ?, ?)").run(orderId, now, "DOCUMENTO_TRIBUTARIO_REGISTRADO", `${kind} ${status}${p.folio ? ` folio ${p.folio}` : ""}`)
      return { ok: true, data: rowToDoc(row) }
    } catch (e) {
      const m = e instanceof Error ? e.message : ""
      if (/UNIQUE/i.test(m) && /folio/.test(m)) return fail("Ya existe un documento de ese tipo con ese folio.")
      if (/UNIQUE/i.test(m)) return fail("Este pago ya tiene un documento vigente (anule el anterior para registrar otro).")
      return fail("No se pudo registrar el documento.")
    }
  })
}

/** Pasa un documento PENDIENTE a EMITIDO con su folio y fecha reales. */
export async function markTaxDocumentIssued(orderId: string, docId: number, p: { folio: string; issuedAt: string }): Promise<TaxResult<TaxDocument>> {
  if (!isValidOrderId(orderId) || !Number.isInteger(docId)) return fail("Datos invalidos.")
  if (!FOLIO_RE.test(p.folio)) return fail("folio invalido (1 a 20 letras, numeros o guion).")
  if (!validDate(p.issuedAt)) return fail("issuedAt debe ser una fecha AAAA-MM-DD valida y no futura.")
  return withOrderLock(orderId, async () => {
    const db = openDb()
    const d = db.prepare("SELECT * FROM tax_documents WHERE id = ? AND order_id = ?").get(docId, orderId) as Row | undefined
    if (!d) return fail("Documento no encontrado.")
    if (d.status !== "PENDIENTE") return fail(`Solo se emite un documento PENDIENTE (estado actual: ${String(d.status)}).`)
    try {
      db.prepare("UPDATE tax_documents SET status = 'EMITIDO', folio = ?, issued_at = ?, updated_at = ? WHERE id = ? AND status = 'PENDIENTE'").run(p.folio, p.issuedAt, new Date().toISOString(), docId)
    } catch {
      return fail("Ya existe un documento de ese tipo con ese folio.")
    }
    return { ok: true, data: rowToDoc(db.prepare("SELECT * FROM tax_documents WHERE id = ?").get(docId) as Row) }
  })
}

/** Marca un documento como ANULADO (queda el registro; el pago puede volver a documentarse). Anular aqui no anula nada ante el SII. */
export async function voidTaxDocument(orderId: string, docId: number, reason?: string): Promise<TaxResult<TaxDocument>> {
  if (!isValidOrderId(orderId) || !Number.isInteger(docId)) return fail("Datos invalidos.")
  if (reason && reason.length > 300) return fail("reason es demasiado larga.")
  return withOrderLock(orderId, async () => {
    const db = openDb()
    const d = db.prepare("SELECT * FROM tax_documents WHERE id = ? AND order_id = ?").get(docId, orderId) as Row | undefined
    if (!d) return fail("Documento no encontrado.")
    if (d.status === "ANULADO") return fail("El documento ya esta anulado.")
    const now = new Date().toISOString()
    db.prepare("UPDATE tax_documents SET status = 'ANULADO', note = COALESCE(?, note), updated_at = ? WHERE id = ?").run(reason ?? null, now, docId)
    db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?, ?, ?, ?)").run(orderId, now, "DOCUMENTO_TRIBUTARIO_ANULADO", `id ${docId}`)
    return { ok: true, data: rowToDoc(db.prepare("SELECT * FROM tax_documents WHERE id = ?").get(docId) as Row) }
  })
}

export function listTaxDocuments(orderId: string): TaxDocument[] {
  if (!isValidOrderId(orderId)) return []
  return (openDb().prepare("SELECT * FROM tax_documents WHERE order_id = ? ORDER BY id").all(orderId) as Row[]).map(rowToDoc)
}

/** Pagos AUTORIZADOS sin documento vigente (de venta): lo que el titular aun debe documentar. Solo lectura. */
export function pendingTaxDocuments(limit = 100): { orderId: string; attemptId: string; kind: string; amount: number; customerType: string; paidAt: string }[] {
  const rows = openDb()
    .prepare(
      `SELECT a.order_id AS order_id, a.id AS attempt_id, a.kind AS kind, a.amount AS amount, o.cust_type AS cust_type, a.updated_at AS paid_at
         FROM attempts a JOIN orders o ON o.id = a.order_id
        WHERE a.status = 'AUTORIZADO'
          AND NOT EXISTS (SELECT 1 FROM tax_documents t WHERE t.attempt_id = a.id AND t.kind <> 'nota_credito' AND t.status <> 'ANULADO')
        ORDER BY a.updated_at LIMIT ?`,
    )
    .all(Math.min(Math.max(1, limit), 500)) as Row[]
  return rows.map((r) => ({ orderId: String(r.order_id), attemptId: String(r.attempt_id), kind: String(r.kind), amount: Number(r.amount), customerType: String(r.cust_type), paidAt: String(r.paid_at) }))
}
