#!/usr/bin/env node
// Crea o actualiza mail.json (correo transaccional por la API de Brevo) en el servidor, sin dejar secretos en el historial de la
// shell ni en el repositorio: la clave API se pide por entrada OCULTA.
//   node scripts/mail-config-set.mjs <ruta/mail.json> --init          pide la clave API de Brevo (sin eco)
//   node scripts/mail-config-set.mjs <ruta/mail.json> enabled=true|false
//   node scripts/mail-config-set.mjs <ruta/mail.json> --show          resumen sin secretos
// Escritura atomica con permisos 0600. Los cambios rigen en <= 5 s, sin redeploy. Ver docs/CORREOS-TRANSACCIONALES.md.
import fs from "node:fs"
import path from "node:path"

const [file, ...rest] = process.argv.slice(2)
const die = (m) => {
  console.error(m)
  process.exit(1)
}
if (!file) die("Uso: mail-config-set.mjs <mail.json> --init | enabled=true|false | --show")

let cfg = {}
try {
  cfg = JSON.parse(fs.readFileSync(file, "utf8"))
} catch {
  if (!rest.includes("--init")) die("No se pudo leer mail.json. Use --init para crearlo.")
}

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
          return resolve(buf.trim())
        }
        if (c === "\u0003") process.exit(130)
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1)
        else buf += c
      }
    }
    process.stdin.on("data", onData)
  })
}

const summary = () => ({
  enabled: cfg.enabled === true,
  provider: "brevo",
  from: cfg.from ?? "notificaciones@bydlightsolutions.com",
  replyTo: cfg.replyTo ?? "contacto@bydlightsolutions.com",
  notifyTo: cfg.notifyTo ?? "contacto@bydlightsolutions.com",
  claveApiBrevo: Boolean(cfg.apiKey),
})

if (rest.includes("--show")) {
  console.log(JSON.stringify(summary(), null, 2))
  process.exit(0)
}

if (rest.includes("--init")) {
  const apiKey = await readHidden("Clave API de Brevo (entrada oculta): ")
  if (!apiKey) die("Falta la clave (se requiere una terminal interactiva). No se modifico nada.")
  if (/\s/.test(apiKey) || apiKey.length < 20) die("La clave no parece valida (sin espacios, minimo 20 caracteres). No se modifico nada.")
  // Se descartan los campos de proveedores anteriores (Gmail) y se conservan from/replyTo/notifyTo si ya existian.
  cfg = { provider: "brevo", apiKey, from: cfg.from, replyTo: cfg.replyTo, notifyTo: cfg.notifyTo, enabled: false }
  for (const k of Object.keys(cfg)) if (cfg[k] === undefined) delete cfg[k]
} else {
  if (rest.length === 0) die("Indique --init, enabled=true|false o --show.")
  for (const a of rest) {
    if (a !== "enabled=true" && a !== "enabled=false") die("Cambio no permitido: solo enabled=true|false (la clave solo se cambia con --init).")
    cfg.enabled = a === "enabled=true"
  }
}

const tmp = path.join(path.dirname(file), `.mail.${process.pid}.tmp`)
fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 })
fs.renameSync(tmp, file)
try {
  fs.chmodSync(file, 0o600)
} catch {
  /* sistemas sin chmod */
}
console.log(JSON.stringify(summary(), null, 2))
