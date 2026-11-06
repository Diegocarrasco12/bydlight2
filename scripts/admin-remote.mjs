#!/usr/bin/env node
// Cliente de la API administrativa firmada (se ejecuta en la maquina del titular).
//   BYDLIGHT_URL=https://bydlightsolutions.com  node scripts/admin-remote.mjs <accion> [ID] [opciones]
//   list [--q texto] | audit | show <ID> | approve <ID> --amount N [--deposit-percent 50] [--valid-days 7] [--note "..."]
//   approve-test <ID>      cotizacion de PRUEBA PRODUCTIVA: $100, anticipo 50 % ($50), saldo $50, vigencia 1 dia, nota rotulada
//   pilot-link [--minutes 10] [--hours 2]   enlace de un solo uso que abre el checkout en modo piloto (no llama al servidor)
//   release-balance <ID> | close <ID> | reconcile
// El secreto solo se usa para firmar; nunca se envia ni se imprime. Origen del secreto (en este orden):
//   1. --config-file <payments.json>   lee `adminSecret` del archivo privado del servidor (recomendado: corre en el servidor
//                                      dentro de un contenedor efimero con el volumen montado de solo lectura; nadie lo ve ni lo copia)
//   2. --secret-file <ruta>            primera linea del archivo
//   3. BYDLIGHT_ADMIN_SECRET           variable de entorno
//   4. entrada oculta en la terminal   (sin eco; no queda en el historial de la shell)

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
function readHidden(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) return resolve("")
    process.stderr.write(prompt)
    let buf = ""
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off("data", onData)
          process.stderr.write("\n")
          return resolve(buf)
        }
        if (c === "\u0003") {
          process.stderr.write("\n")
          process.exit(130)
        }
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1)
        else buf += c
      }
    }
    process.stdin.on("data", onData)
  })
}

async function loadSecret() {
  const cfgFile = opt("config-file"), secretFile = opt("secret-file")
  if (cfgFile) {
    try {
      return String(JSON.parse(fs.readFileSync(cfgFile, "utf8")).adminSecret ?? "").trim()
    } catch {
      die("No se pudo leer adminSecret de --config-file.")
    }
  }
  if (secretFile) return fs.readFileSync(secretFile, "utf8").split(/\r?\n/)[0].trim()
  if (process.env.BYDLIGHT_ADMIN_SECRET) return process.env.BYDLIGHT_ADMIN_SECRET.trim()
  return (await readHidden("Secreto administrativo (entrada oculta): ")).trim()
}
const secret = await loadSecret()
if (secret.length < 32) die("Falta el secreto administrativo (--config-file, --secret-file, BYDLIGHT_ADMIN_SECRET o entrada oculta), minimo 32 caracteres.")

if (action === "pilot-link") {
  // Enlace de un solo uso para abrir el checkout en modo piloto. Mismo algoritmo que src/lib/payments/pilot.ts. No contacta al servidor.
  const minutes = Number(opt("minutes", "10")), hours = Number(opt("hours", "2"))
  if (!(minutes > 0 && minutes <= 10)) die("--minutes debe estar entre 0 y 10.")
  if (!Number.isInteger(hours) || hours < 1 || hours > 8) die("--hours debe ser un entero entre 1 y 8.")
  const exp = Math.floor(Date.now() / 1000) + Math.round(minutes * 60)
  const mac = createHmac("sha256", secret).update(`pilot-link.v1.${exp}.${hours}`).digest("hex")
  console.error(`Enlace de un solo uso, valido ${minutes} min; la sesion piloto dura ${hours} h. Abralo en SU navegador; no lo comparta ni lo pegue en chats.`)
  console.log(`${base}/api/acceso-piloto?t=v1.${exp}.${hours}.${mac}`)
  process.exit(0)
}

const TEST = { amount: 100, depositPercent: 50, validDays: 1, note: "PRUEBA PRODUCTIVA: cotización de $100, anticipo $50 y saldo $50. Orden de verificación del titular." }
const body = { action: action === "approve-test" ? "approve" : action }
if (maybeId && !maybeId.startsWith("--")) body.orderId = maybeId
if (action === "approve") {
  body.amount = Number(opt("amount"))
  if (opt("deposit-percent")) body.depositPercent = Number(opt("deposit-percent"))
  if (opt("valid-days")) body.validDays = Number(opt("valid-days"))
  if (opt("note")) body.note = opt("note")
}
if (action === "approve-test") Object.assign(body, TEST)
if (action === "list" && opt("q")) body.q = opt("q")
if (action === "refund") {
  // Devolucion: exige --amount y una clave de idempotencia (se genera si no se indica; guardala para reintentar la MISMA operacion).
  body.amount = Number(opt("amount"))
  body.idempotencyKey = opt("key") ?? randomBytes(16).toString("hex")
  if (opt("attempt")) body.attemptId = opt("attempt")
  if (opt("reason")) body.reason = opt("reason")
  console.error(`idempotencyKey: ${body.idempotencyKey}`)
}
if (action === "reconcile-refund") body.refundId = opt("refund")
if (!["list", "audit", "show", "approve", "approve-test", "release-balance", "close", "reconcile", "refund", "reconcile-refund"].includes(action ?? "")) {
  die("Acciones: list [--q texto] | audit | show <ID> | approve <ID> --amount N | approve-test <ID> | pilot-link | release-balance <ID> | close <ID> | reconcile | refund <ID> --amount N [--key K] [--attempt A] [--reason T] | reconcile-refund <ID> --refund RF...")
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
