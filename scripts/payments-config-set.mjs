#!/usr/bin/env node
// Cambia SOLO los interruptores no secretos de payments.json sin mostrar ni tocar las credenciales.
//   node scripts/payments-config-set.mjs <ruta/payments.json> enabled=true|false [access=pilot|public]
//   node scripts/payments-config-set.mjs <ruta/payments.json> --show        (resumen sin secretos)
// Claves permitidas: enabled, access. Cualquier otra se rechaza (no se puede cambiar env, credenciales, secreto ni adminRefunds).
// Escritura atomica (archivo temporal + rename) conservando permisos 0600. Los cambios rigen en <= 5 s, sin redeploy.
import fs from "node:fs"
import path from "node:path"

const [file, ...rest] = process.argv.slice(2)
const die = (m) => {
  console.error(m)
  process.exit(1)
}
if (!file) die("Uso: payments-config-set.mjs <payments.json> enabled=true|false [access=pilot|public] | --show")

let cfg
try {
  cfg = JSON.parse(fs.readFileSync(file, "utf8"))
} catch {
  die("No se pudo leer el archivo de configuracion (inexistente o JSON invalido). No se modifico nada.")
}
if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) die("Configuracion invalida. No se modifico nada.")

const summary = () => ({
  enabled: cfg.enabled === true,
  access: cfg.access ?? "(por defecto: pilot)",
  env: cfg.env ?? "(integration)",
  adminRefunds: cfg.adminRefunds === true,
  publicBaseUrl: cfg.publicBaseUrl ?? null,
  credencialesTransbank: Boolean(cfg.commerceCode && cfg.apiKey),
  secretoAdministrativo: typeof cfg.adminSecret === "string" && cfg.adminSecret.length >= 32,
})

if (rest.length === 1 && rest[0] === "--show") {
  console.log(JSON.stringify(summary(), null, 2))
  process.exit(0)
}

const ALLOWED = { enabled: ["true", "false"], access: ["pilot", "public"] }
if (rest.length === 0) die("Indique al menos un cambio (enabled=... o access=...).")
for (const a of rest) {
  const m = /^([a-z]+)=([a-z]+)$/.exec(a)
  if (!m || !ALLOWED[m[1]]) die(`Cambio no permitido: solo ${Object.keys(ALLOWED).join(", ")}.`)
  if (!ALLOWED[m[1]].includes(m[2])) die(`Valor no permitido para ${m[1]}: use ${ALLOWED[m[1]].join(" o ")}.`)
  cfg[m[1]] = m[1] === "enabled" ? m[2] === "true" : m[2]
}

const tmp = path.join(path.dirname(file), `.payments.${process.pid}.tmp`)
fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 })
fs.renameSync(tmp, file)
try {
  fs.chmodSync(file, 0o600)
} catch {
  /* sistemas sin chmod */
}
console.log(JSON.stringify(summary(), null, 2))
