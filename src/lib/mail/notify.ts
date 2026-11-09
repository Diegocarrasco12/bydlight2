import "server-only"
import { TERMS_VERSION } from "@/lib/terms"
import type { Order } from "@/lib/payments/types"
import { mailCredentials, MAIL_REPLY_TO } from "./config"
import { enqueueMail, kickDispatch } from "./outbox"
import * as T from "./templates"
import { activeTransport } from "./transport"

// Correos por TRANSICION de estado: se compara una foto de la orden tomada antes de operar con el estado ya guardado.
// Asi solo hay correos para hechos NUEVOS (una orden historica nunca genera correos retroactivos) y, junto con la
// dedupe_key unica de la cola, un callback repetido no duplica nada. Los correos de pago salen unicamente cuando el intento
// paso a AUTORIZADO/RECHAZADO con datos ya validados contra Transbank. Nada de esto puede lanzar errores hacia el pago.

export type OrderSnapshot = { stage: string; quoteApprovedAt?: string; attempts: Record<string, string> }

export function snapshotOf(o: Order): OrderSnapshot {
  return { stage: o.stage, quoteApprovedAt: o.quote?.approvedAt, attempts: Object.fromEntries(o.attempts.map((a) => [a.id, a.status])) }
}

export function internalTo(): string {
  return mailCredentials()?.notifyTo ?? MAIL_REPLY_TO
}

export async function notifyChanges(before: OrderSnapshot | null, o: Order): Promise<void> {
  try {
    if (!activeTransport()) return // correo no habilitado/configurado: no se encola nada
    let queued = 0
    const q = (key: string, template: string, to: string, r: T.Rendered | null) => {
      if (!r) return
      if (enqueueMail({ dedupeKey: key, orderId: o.id, template, to, subject: r.subject, html: r.html, text: r.text })) queued++
    }
    const cust = o.customer.email
    if (!before) {
      q(`solicitud:${o.id}`, "solicitud_recibida", cust, T.solicitudRecibida(o))
      q(`interna-solicitud:${o.id}`, "nueva_solicitud", internalTo(), T.nuevaSolicitudInterna(o))
    } else {
      if (o.quote && o.quote.approvedAt !== before.quoteApprovedAt) {
        q(`cotizacion:${o.id}:${o.quote.approvedAt}`, "cotizacion_aprobada", cust, T.cotizacionAprobada(o))
      }
      if (o.stage === "SALDO_HABILITADO" && before.stage !== "SALDO_HABILITADO") {
        q(`saldo-habilitado:${o.id}`, "saldo_habilitado", cust, T.saldoHabilitado(o))
      }
      for (const a of o.attempts) {
        const was = before.attempts[a.id]
        if (was === a.status) continue
        if (a.status === "AUTORIZADO") {
          if (a.kind === "anticipo") {
            const ev = o.events.filter((e) => e.type === "TERMINOS_ACEPTADOS").pop()
            q(`contratacion:${o.id}`, "contratacion_confirmada", cust, T.contratacionConfirmada(o, TERMS_VERSION, ev?.at))
          }
          q(`pago:${a.id}`, "pago_autorizado", cust, T.pagoAutorizado(o, a))
        } else if (a.status === "RECHAZADO") {
          q(`rechazo:${a.id}`, "pago_rechazado", cust, T.pagoRechazado(o, a))
        } else if (a.status === "ERROR") {
          q(`interna-error:${a.id}`, "alerta_interna", internalTo(), T.alertaInterna(`Pago con revisión manual · orden ${o.id}`, [`${a.buyOrder}: ${a.note ?? "intento en ERROR"}`, `Revisa con: node scripts/admin-remote.mjs show ${o.id}`]))
        }
      }
    }
    if (queued) kickDispatch()
  } catch (e) {
    // Un problema de correo jamas debe revertir ni duplicar un pago: solo se registra (sin datos personales).
    console.error(JSON.stringify({ at: new Date().toISOString(), scope: "mail", event: "enqueue_error", orderId: o.id, error: (e as Error).message }))
  }
}
