// Datos de ejemplo (SOLO desarrollo local): siembra ordenes de ejemplo en una base SQLite de pruebas para poder
// revisar las pantallas de pago (cotizada, aprobada, rechazada, cancelada, pendiente, error).
// Usa el DOBLE del SDK de Transbank: no sale a la red, no hay credenciales ni cobros.
//   PAYMENTS_DB=<archivo de pruebas> node --import ./tests/register.mjs scripts/seed-ordenes-ejemplo.mjs
if (process.env.NODE_ENV === "production") throw new Error("seed-ordenes-ejemplo no se ejecuta en produccion")
if (!process.env.PAYMENTS_DB) throw new Error("Define PAYMENTS_DB con una base de pruebas (nunca la de produccion).")
process.env.PAYMENTS_ENABLED = "true"
process.env.PAYMENTS_CONFIG ??= `${process.env.PAYMENTS_DB}.none.json`

const root = new URL("../", import.meta.url).href
const svc = await import(root + "src/lib/payments/service.ts")
const admin = await import(root + "src/lib/payments/adminOps.ts")
const store = await import(root + "src/lib/payments/store.ts")

let n = 0
globalThis.__tbk = {
  create: async () => ({ token: `labtoken${++n}${"x".repeat(24)}`, url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction" }),
  commit: async () => {
    throw new Error("sin red")
  },
  status: async () => {
    throw new Error("sin red")
  },
}

const BASE = "http://localhost:3000"
async function make(name, plan, amount) {
  const o = await svc.createOrder(
    svc.parseSolicitud({ planId: plan, name: `Lab ${name}`, email: "lab@example.com", message: `Orden de ejemplo del laboratorio: ${name}`, accept: true }).data,
  )
  if (amount) await admin.approveQuote(o.id, { amount, depositPercent: 50 })
  return o.id
}
async function pay(id, commit) {
  const s = await svc.startPayment(id, "anticipo", BASE)
  if (!s.ok) throw new Error(s.reason)
  const o = await store.readOrder(id)
  globalThis.__tbk.commit = commit(o, o.attempts[0])
  await svc.handleReturn(id, { tokenWs: s.token })
  return id
}
const ok = (extra = {}) => (o, a) => async () => ({
  status: "AUTHORIZED", response_code: 0, buy_order: a.buyOrder, session_id: o.id, amount: a.amount,
  authorization_code: "1213", payment_type_code: "VC", installments_number: 3, installments_amount: Math.round(a.amount / 3),
  transaction_date: new Date().toISOString(), card_detail: { card_number: "6623" }, ...extra,
})

const out = {}
out.solicitada = await make("Solicitada", "emprendedor", 0)
out.cotizada = await make("Cotizada", "emprendedor", 299990)
out.aprobada = await pay(await make("Aprobada", "emprendedor", 299990), ok())
out.rechazada = await pay(await make("Rechazada", "emprendedor", 299990), () => async () => ({ status: "FAILED", response_code: -1 }))
out.pendiente = await pay(await make("Pendiente", "emprendedor", 299990), () => async () => {
  throw new Error("sin red")
})
{
  const id = await make("Cancelada", "emprendedor", 299990)
  const s = await svc.startPayment(id, "anticipo", BASE)
  await svc.handleReturn(id, { tbkToken: s.token, tbkOrden: "x", tbkSesion: id })
  out.cancelada = id
}
{
  const id = await make("Error", "emprendedor", 299990)
  const s = await svc.startPayment(id, "anticipo", BASE)
  await svc.handleReturn(id, { tokenWs: s.token, tbkToken: s.token })
  out.error = id
}
console.log(JSON.stringify(out, null, 2))
