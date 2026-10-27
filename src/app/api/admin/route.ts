import { verifyAdminRequest } from "@/lib/payments/adminAuth"
import { approveQuote, closeOrder, listOrders, reconcilePending, releaseBalance, showOrder } from "@/lib/payments/adminOps"
import { paymentsEnabled } from "@/lib/payments/config"
import { json } from "@/lib/payments/http"
import { storageWritable } from "@/lib/payments/store"

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
      return json({ orders: listOrders(typeof b.limit === "number" ? b.limit : 50) })
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
      })
      return r.ok ? json(r.data) : json({ error: r.error }, 422)
    }
    case "release-balance": {
      const r = await releaseBalance(id)
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 422)
    }
    case "close": {
      const r = await closeOrder(id)
      return r.ok ? json({ ok: true }) : json({ error: r.error }, 422)
    }
    case "reconcile":
      return json(await reconcilePending())
    default:
      return json({ error: "Accion desconocida." }, 400)
  }
}
