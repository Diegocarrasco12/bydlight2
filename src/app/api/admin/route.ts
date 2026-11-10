import { verifyAdminRequest } from "@/lib/payments/adminAuth"
import { approveQuote, auditPayments, exportCustomerData, closeOrder, listOrders, reconcilePending, releaseBalance, showOrder } from "@/lib/payments/adminOps"
import { adminRefundsEnabled, paymentsEnabled } from "@/lib/payments/config"
import { reconcileRefund, refundPayment } from "@/lib/payments/refunds"
import { activeTransport, checkMailSetup } from "@/lib/mail/transport"
import { internalTo } from "@/lib/mail/notify"
import { alertaInterna } from "@/lib/mail/templates"
import { dispatchDue, enqueueMail, outboxStats } from "@/lib/mail/outbox"
import { monitorAndAlert } from "@/lib/payments/monitor"
import { json } from "@/lib/payments/http"
import { listTaxDocuments, markTaxDocumentIssued, pendingTaxDocuments, registerTaxDocument, voidTaxDocument } from "@/lib/payments/taxDocs"
import { storageWritable } from "@/lib/payments/store"
import { eraseOrder, rectifyCustomer, retentionRun } from "@/lib/payments/privacy"

export const dynamic = "force-dynamic"

// API administrativa: solo peticiones firmadas con el secreto del titular (ver adminAuth.ts).
// Sin secreto configurado responde 404, como si no existiera.
export async function POST(req: Request) {
  const raw = await req.text()
  if (raw.length > 4_000) return json({ error: "Solicitud demasiado grande." }, 413)
  const auth = verifyAdminRequest(req, raw)
  if (!auth.ok) {
    return auth.status === 404 ? new Response(null, { status: 404 }) : json({ error: "No autorizado." }, auth.status)
  }
  if (!paymentsEnabled() || !(await storageWritable())) return json({ error: "Servicio no disponible." }, 503)

  let b: Record<string, unknown>
  try {
    b = JSON.parse(raw)
  } catch {
    return json({ error: "JSON invalido." }, 400)
  }
  const id = typeof b.orderId === "string" ? b.orderId : ""
  const n = (v: unknown) => (typeof v === "number" ? v : NaN)
  switch (b.action) {
    case "list":
      return json({ orders: listOrders(typeof b.limit === "number" ? b.limit : 50, typeof b.q === "string" ? b.q : undefined) })
    case "audit":
      return json(await auditPayments())
    case "show": {
      const o = await showOrder(id)
      return o ? json({ order: o }) : json({ error: "Orden no encontrada." }, 404)
    }
    case "approve": {
      const r = await approveQuote(id, {
        amount: n(b.amount),
        depositPercent: b.depositPercent === undefined ? undefined : n(b.depositPercent),
        validDays: b.validDays === undefined ? undefined : n(b.validDays),
        note: typeof b.note === "string" ? b.note : undefined,
        allowBelowPlanPrice: b.allowBelowPlanPrice === true,
      })
      return r.ok ? json(r.data) : json({ error: r.error }, 422)
    }
    case "taxdoc-register": {
      const r = await registerTaxDocument(id, {
        attemptId: typeof b.attemptId === "string" ? b.attemptId : undefined,
        kind: typeof b.kind === "string" ? b.kind : "",
        folio: typeof b.folio === "string" ? b.folio : undefined,
        issuedAt: typeof b.issuedAt === "string" ? b.issuedAt : undefined,
        receiverTaxId: typeof b.receiverTaxId === "string" ? b.receiverTaxId : undefined,
        receiverName: typeof b.receiverName === "string" ? b.receiverName : undefined,
        refDocId: typeof b.refDocId === "number" ? b.refDocId : undefined,
        totalAmount: typeof b.totalAmount === "number" ? b.totalAmount : undefined,
        note: typeof b.note === "string" ? b.note : undefined,
      })
      return r.ok ? json({ document: r.data }, 201) : json({ error: r.error }, 422)
    }
    case "taxdoc-issue": {
      const r = await markTaxDocumentIssued(id, n(b.docId), { folio: typeof b.folio === "string" ? b.folio : "", issuedAt: typeof b.issuedAt === "string" ? b.issuedAt : "" })
      return r.ok ? json({ document: r.data }) : json({ error: r.error }, 422)
    }
    case "taxdoc-void": {
      const r = await voidTaxDocument(id, n(b.docId), typeof b.reason === "string" ? b.reason : undefined)
      return r.ok ? json({ document: r.data }) : json({ error: r.error }, 422)
    }
    case "taxdoc-list":
      return json({ documents: listTaxDocuments(id) })
    case "taxdoc-pending": {
      const pending = pendingTaxDocuments()
      // Resumen para la conciliacion manual: solo agrupa por tipo de cliente y de pago; no decide ni emite ningun documento.
      const summary: Record<string, { count: number; total: number }> = {}
      for (const p of pending) {
        const k = `${p.customerType}/${p.kind}`
        summary[k] ??= { count: 0, total: 0 }
        summary[k].count += 1
        summary[k].total += p.amount
      }
      return json({ pending, summary })
    }
    case "release-balance": {
      const r = await releaseBalance(id)
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 422)
    }
    case "close": {
      const r = await closeOrder(id)
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 422)
    }
    case "refund":
    case "reconcile-refund": {
      // Permiso explicito aparte de la firma: sin `adminRefunds` la operacion no existe para el exterior.
      if (!adminRefundsEnabled()) return json({ error: "Devoluciones no habilitadas." }, 403)
      if (b.action === "reconcile-refund") {
        const r = await reconcileRefund(id, typeof b.refundId === "string" ? b.refundId : "")
        return r.ok ? json({ refund: r.data }) : json({ error: r.error }, 422)
      }
      const r = await refundPayment({
        orderId: id,
        attemptId: typeof b.attemptId === "string" ? b.attemptId : undefined,
        amount: n(b.amount),
        reason: typeof b.reason === "string" ? b.reason : undefined,
        idempotencyKey: typeof b.idempotencyKey === "string" ? b.idempotencyKey : "",
        requestedBy: "admin-api",
      })
      return r.ok ? json({ refund: r.data, replayed: r.replayed ?? false }) : json({ error: r.error }, 422)
    }
    case "monitor": // auditoria de solo lectura + alerta por correo (idempotente por dia); pensada para correr cada 15-30 min
      return json(await monitorAndAlert())
    case "mail-status":
      return json(outboxStats())
    case "mail-check": // diagnostico de solo lectura (clave, IP, remitente); no envia correos
      return json(await checkMailSetup())
    case "mail-test": {
      // Correo de prueba SOLO al titular (nunca a clientes): verifica credenciales y entrega. Un envio por minuto como maximo.
      if (!activeTransport()) return json({ error: "Correo no habilitado o sin credenciales (mail.json)." }, 409)
      const r = alertaInterna("Prueba de correo transaccional", ["Si lees esto, el envío desde el servidor funciona."])
      const key = `prueba:${Math.floor(Date.now() / 60_000)}`
      const queued = enqueueMail({ dedupeKey: key, template: "prueba", to: internalTo(), subject: r.subject, html: r.html, text: r.text })
      return json({ queued, ...(await dispatchDue(5)) })
    }
    case "mail-dispatch":
      return json(await dispatchDue(20))
    // Privacidad: SIMULACION salvo `execute: true`. Solo anonimiza solicitudes sin contratacion ni pago (ver privacy.ts).
    case "privacy-scan":
      return json(retentionRun({ execute: b.execute === true, limit: typeof b.limit === "number" ? b.limit : undefined, months: typeof b.months === "number" ? b.months : undefined }))
    case "privacy-erase": {
      const r = eraseOrder(id, { execute: b.execute === true })
      return r.ok ? json(r) : json(r, 422)
    }
    case "privacy-rectify": {
      const r = rectifyCustomer(id, {
        name: typeof b.name === "string" ? b.name : undefined,
        email: typeof b.email === "string" ? b.email : undefined,
        phone: typeof b.phone === "string" ? b.phone : undefined,
        company: typeof b.company === "string" ? b.company : undefined,
      })
      return r.ok ? json(r) : json(r, 422)
    }
    case "customer-data":
      return json(await exportCustomerData(typeof b.email === "string" ? b.email : ""))
    case "reconcile":
      return json(await reconcilePending())
    default:
      return json({ error: "Accion desconocida." }, 400)
  }
}
