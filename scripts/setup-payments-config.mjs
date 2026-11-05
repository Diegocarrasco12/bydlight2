// Crea payments.json de produccion pidiendo los secretos por consola OCULTA.
// Se ejecuta EN EL SERVIDOR (o donde viva el volumen), por el titular. Nunca por Claude ni por chat.
//   node scripts/setup-payments-config.mjs /ruta/al/volumen/config/payments.json
// Resultado: enabled:false, env:production, permisos 0600. Los secretos no se imprimen ni van a Git.
import fs from "node:fs"
import crypto from "node:crypto"

const target = process.argv[2]
if (!target) {
  console.error("Uso: node scripts/setup-payments-config.mjs <ruta/payments.json>")
  process.exit(1)
}
if (fs.existsSync(target)) {
  console.error(`Ya existe ${target}. Editalo a mano o borralo conscientemente.`)
  process.exit(1)
}

if (!process.stdin.isTTY) {
  console.error("Este script exige una terminal interactiva (entrada oculta). No se aceptan secretos por pipe ni argumentos.")
  process.exit(1)
}

function askHidden(label) {
  return new Promise((resolve) => {
    process.stdout.write(label)
    let buf = ""
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding("utf8")
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off("data", onData)
          process.stdout.write("\n")
          return resolve(buf.trim())
        }
        if (ch === "\u0003") { process.stdout.write("\n"); process.exit(130) }
        if (ch === "\u007f" || ch === "\b") buf = buf.slice(0, -1)
        else buf += ch
      }
    }
    process.stdin.on("data", onData)
  })
}

const commerceCode = await askHidden("Codigo de comercio / Tbk-Api-Key-Id: ")
const apiKey = await askHidden("Tbk-Api-Key-Secret: ")
if (!commerceCode || apiKey.length < 20) {
  console.error("Valores vacios o llave demasiado corta; no se escribio nada.")
  process.exit(1)
}
const adminSecret = crypto.randomBytes(32).toString("hex")
const cfg = {
  enabled: false,
  env: "production",
  commerceCode,
  apiKey,
  publicBaseUrl: "https://bydlightsolutions.com",
  adminSecret,
}
const dir = target.replace(/[\\/][^\\/]*$/, "")
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(target, JSON.stringify(cfg, null, 2), { mode: 0o600 })
// El contenedor corre como uid 1000: si esto se ejecuta como root en el host, el archivo debe pertenecerle o no podra leerlo.
if (typeof process.getuid === "function" && process.getuid() === 0) {
  fs.chownSync(dir, 1000, 1000)
  fs.chownSync(target, 1000, 1000)
}
console.log(`Escrito ${target} (enabled:false, 0600). El adminSecret (BYDLIGHT_ADMIN_SECRET en tu equipo) esta dentro del archivo; leelo de ahi, no se imprime.`)
