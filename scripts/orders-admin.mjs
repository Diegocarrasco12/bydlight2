#!/usr/bin/env node
// Administracion de ordenes (solo desde el equipo del administrador; no es un endpoint web).
// Uso:
//   node scripts/orders-admin.mjs list
//   node scripts/orders-admin.mjs show <ID>
//   node scripts/orders-admin.mjs approve <ID> --amount <CLP> [--deposit-percent 50] [--valid-days 7] [--note "texto"]
//   node scripts/orders-admin.mjs release-balance <ID>
//   node scripts/orders-admin.mjs close <ID>
// Directorio de datos: ORDERS_DIR o ./.data/orders

import { promises as fs } from "node:fs"
import path from "node:path"

const dir = process.env.ORDERS_DIR ?? path.join(process.cwd(), ".data", "orders")
const ID_RE = /^[A-Z2-9]{12}$/

const [cmd, id, ...rest] = process.argv.slice(2)
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : def
}
const die = (m) => {
  console.error(m)
  process.exit(1)
}
const file = (i) => path.join(dir, `${i}.json`)
const load = async (i) => {
  if (!ID_RE.test(i ?? "")) die("ID de orden invalido.")
  try {
    return JSON.parse(await fs.readFile(file(i), "utf8"))
  } catch {
    die("Orden no encontrada.")
  }
}
const save = async (o) => {
  o.updatedAt = new Date().toISOString()
  const tmp = `${file(o.id)}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(o, null, 2), { mode: 0o600 })
  await fs.rename(tmp, file(o.id))
}
const clp = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)

if (cmd === "list") {
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json"))
  for (const f of files) {
    const o = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"))
    console.log(`${o.id}  ${o.stage.padEnd(16)} ${o.planName.padEnd(18)} ${o.customer.name} <${o.customer.email}>`)
  }
  if (!files.length) console.log("(sin ordenes)")
} else if (cmd === "show") {
  const o = await load(id)
  console.log(JSON.stringify({ ...o, attempts: o.attempts.map(({ token, ...a }) => a) }, null, 2)) // no imprime tokens
} else if (cmd === "approve") {
  const o = await load(id)
  if (o.stage !== "SOLICITADA" && o.stage !== "COTIZADA") die(`No se puede cotizar una orden en estado ${o.stage}.`)
  if (o.attempts.some((a) => a.status === "AUTORIZADO")) die("La orden ya tiene un pago autorizado.")
  const amount = Number(opt("amount"))
  const pct = Number(opt("deposit-percent", "50"))
  const days = Number(opt("valid-days", "7"))
  if (!Number.isInteger(amount) || amount < 100) die("--amount debe ser un entero en CLP (minimo 100).")
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) die("--deposit-percent debe estar entre 1 y 100.")
  if (!Number.isInteger(days) || days < 1 || days > 60) die("--valid-days debe estar entre 1 y 60.")
  const deposit = Math.round((amount * pct) / 100)
  const now = new Date()
  o.quote = {
    amount,
    depositPercent: pct,
    depositAmount: deposit,
    balanceAmount: amount - deposit,
    approvedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + days * 86_400_000).toISOString(),
    note: opt("note"),
  }
  o.stage = "COTIZADA"
  o.events.push({ at: now.toISOString(), type: "COTIZACION_APROBADA", detail: `${amount} / anticipo ${deposit}` })
  await save(o)
  console.log(`Cotizacion aprobada: total ${clp(amount)}, anticipo ${clp(deposit)} (${pct}%), saldo ${clp(amount - deposit)}.`)
} else if (cmd === "release-balance") {
  const o = await load(id)
  if (o.stage !== "ANTICIPO_PAGADO") die(`Solo se habilita el saldo tras el anticipo (estado actual: ${o.stage}).`)
  o.stage = "SALDO_HABILITADO"
  o.events.push({ at: new Date().toISOString(), type: "SALDO_HABILITADO" })
  await save(o)
  console.log("Saldo habilitado.")
} else if (cmd === "close") {
  const o = await load(id)
  o.stage = "CERRADA"
  o.events.push({ at: new Date().toISOString(), type: "ORDEN_CERRADA" })
  await save(o)
  console.log("Orden cerrada.")
} else {
  die("Comandos: list | show <ID> | approve <ID> --amount N | release-balance <ID> | close <ID>")
}
