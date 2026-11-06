import "server-only"
import { createHash } from "node:crypto"
import { enqueueMail, kickDispatch } from "@/lib/mail/outbox"
import { internalTo } from "@/lib/mail/notify"
import { alertaInterna } from "@/lib/mail/templates"
import { activeTransport } from "@/lib/mail/transport"
import { auditPayments, type AuditFinding } from "./adminOps"

/**
 * Monitoreo de SOLO LECTURA: ejecuta la auditoria (no llama a Transbank, no crea cobros, no modifica estados) y, si hay hallazgos
 * de severidad alta o media, encola UNA alerta por correo al titular (idempotente: mismo conjunto de hallazgos el mismo dia = un correo).
 * La correccion siempre es humana (o `reconcile`, que consulta a Transbank). Se ejecuta de forma programada desde el servidor
 * del titular con `admin-remote.mjs monitor` (ver docs/CONCILIACION-Y-MONITOREO.md); no se instala nada automaticamente.
 */
export async function monitorAndAlert(): Promise<{ checkedOrders: number; findings: AuditFinding[]; alerted: boolean }> {
  const { checkedOrders, findings } = await auditPayments()
  const actionable = findings.filter((f) => f.severity !== "info")
  let alerted = false
  if (actionable.length && activeTransport()) {
    const day = new Date().toISOString().slice(0, 10)
    const sig = createHash("sha256").update(actionable.map((f) => `${f.orderId}|${f.type}`).sort().join(";")).digest("hex").slice(0, 16)
    const lines = actionable.slice(0, 25).map((f) => `[${f.severity}] ${f.orderId} ${f.type}: ${f.detail}`)
    if (actionable.length > 25) lines.push(`... y ${actionable.length - 25} más`)
    const r = alertaInterna(`Hallazgos de conciliación (${actionable.length})`, lines)
    alerted = enqueueMail({ dedupeKey: `monitor:${day}:${sig}`, template: "alerta_conciliacion", to: internalTo(), subject: r.subject, html: r.html, text: r.text })
    if (alerted) kickDispatch()
  }
  return { checkedOrders, findings, alerted }
}
