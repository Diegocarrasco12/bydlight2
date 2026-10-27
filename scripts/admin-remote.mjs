#!/usr/bin/env node
// Cliente de la API administrativa firmada (se ejecuta en la maquina del titular).
//   BYDLIGHT_URL=https://bydlightsolutions.com  BYDLIGHT_ADMIN_SECRET=<secreto>  node scripts/admin-remote.mjs <accion> [ID] [opciones]
//   list | show <ID> | approve <ID> --amount N [--deposit-percent 50] [--valid-days 7] [--note "..."]
//   release-balance <ID> | close <ID> | reconcile
// El secreto solo se usa para firmar; no se envia. Alternativa: --secret-file <ruta> (primera linea).

import { createHash, createHmac, randomBytes } from "node:crypto"
import fs from "node:fs"

const args = process.argv.slice(2)
const [action, maybeId] = args
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const die = (m) => {
  console.error(m)
  process.exit(1)
}

const base = (process.env.BYDLIGHT_URL ?? "").replace(/\/$/, "")
if (!base.startsWith("https://") && !base.startsWith("http://localhost")) die("Define BYDLIGHT_URL con https:// (o http://localhost para pruebas).")
const secretFile = opt("secret-file")
const secret = (secretFile ? fs.readFileSync(secretFile, "utf8").split(/\r?\n/)[0] : process.env.BYDLIGHT_ADMIN_SECRET ?? "").trim()
if (secret.length < 32) die("Falta el secreto administrativo (BYDLIGHT_ADMIN_SECRET o --secret-file), minimo 32 caracteres.")

const body = { action }
if (maybeId && !maybeId.startsWith("--")) body.orderId = maybeId
if (action === "approve") {
  body.amount = Number(opt("amount"))
  if (opt("deposit-percent")) body.depositPercent = Number(opt("deposit-percent"))
  if (opt("valid-days")) body.validDays = Number(opt("valid-days"))
  if (opt("note")) body.note = opt("note")
}
if (!["list", "show", "approve", "release-balance", "close", "reconcile"].includes(action ?? "")) {
  die("Acciones: list | show <ID> | approve <ID> --amount N | release-balance <ID> | close <ID> | reconcile")
}

const raw = JSON.stringify(body)
const ts = Date.now()
const nonce = randomBytes(16).toString("hex")
const pathname = "/api/admin"
const sig = createHmac("sha256", secret)
  .update(`${ts}.${nonce}.POST.${pathname}.${createHash("sha256").update(raw).digest("hex")}`)
  .digest("hex")

const res = await fetch(base + pathname, {
  method: "POST",
  headers: { "content-type": "application/json", "x-admin-timestamp": String(ts), "x-admin-nonce": nonce, "x-admin-signature": sig },
  body: raw,
})
const text = await res.text()
let out = text
try { out = JSON.stringify(JSON.parse(text), null, 2) } catch { /* texto plano */ }
console.log(`HTTP ${res.status}\n${out}`)
process.exitCode = res.ok ? 0 : 1
