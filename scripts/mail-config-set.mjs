#!/usr/bin/env node
// Crea o actualiza mail.json (correo transaccional por la API de Gmail con OAuth2) en el servidor, sin dejar secretos en el
// historial de la shell ni en el repositorio: las credenciales se piden por entrada OCULTA.
//   node scripts/mail-config-set.mjs <ruta/mail.json> --init          pide clientId, clientSecret y refreshToken (sin eco)
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
  provider: cfg.provider ?? "gmail-oauth2",
  from: cfg.from ?? "bydlightsolutions@gmail.com",
  notifyTo: cfg.notifyTo ?? "bydlightsolutions@gmail.com",
  credencialesOAuth: Boolean(cfg.clientId && cfg.clientSecret && cfg.refreshToken),
})

if (rest.includes("--show")) {
  console.log(JSON.stringify(summary(), null, 2))
  process.exit(0)
}

if (rest.includes("--init")) {
  const clientId = await readHidden("clientId de OAuth (entrada oculta): ")
  const clientSecret = await readHidden("clientSecret (entrada oculta): ")
  const refreshToken = await readHidden("refreshToken (entrada oculta): ")
  if (!clientId || !clientSecret || !refreshToken) die("Faltan credenciales (se requiere una terminal interactiva). No se modifico nada.")
  cfg = { ...cfg, provider: "gmail-oauth2", clientId, clientSecret, refreshToken, from: "bydlightsolutions@gmail.com", notifyTo: "bydlightsolutions@gmail.com", enabled: false }
} else {
  if (rest.length === 0) die("Indique --init, enabled=true|false o --show.")
  for (const a of rest) {
    if (a !== "enabled=true" && a !== "enabled=false") die("Cambio no permitido: solo enabled=true|false (las credenciales solo se cambian con --init).")
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
