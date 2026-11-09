#!/usr/bin/env node
// Verifica que, con Webpay APAGADO, el artefacto de PRODUCCION (.next/standalone, NODE_ENV=production) no expone
// ninguna operacion de pago. Arranca el servidor en un puerto local, sin configuracion de pagos, con una base y una
// configuracion inexistentes, y prueba cada ruta por URL directa y con peticiones manipuladas. No hace cobros.
//
// Uso: npm run build && node scripts/verify-prod-lockdown.mjs        (sale con codigo 1 si algo queda expuesto)
// Con una base inexistente tambien se comprueba que NO se crea ningun archivo de datos.

import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const root = process.cwd()
const serverJs = path.join(root, ".next", "standalone", "server.js")
if (!fs.existsSync(serverJs)) {
  console.error("Falta .next/standalone/server.js: ejecuta `npm run build` antes.")
  process.exit(2)
}

const PORT = 3290
const base = `http://127.0.0.1:${PORT}`
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "bd-lockdown-"))
const dbPath = path.join(scratch, "no-debe-existir.db")
const cfgPath = path.join(scratch, "no-existe.json")

// Entorno minimo: NADA de TBK_*, PAYMENTS_ENABLED ni ADMIN_API_SECRET (lo que hay hoy en produccion).
const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  NODE_ENV: "production",
  PORT: String(PORT),
  HOSTNAME: "127.0.0.1",
  PAYMENTS_DB: dbPath,
  PAYMENTS_CONFIG: cfgPath,
}
const child = spawn(process.execPath, [serverJs], { env, cwd: path.dirname(serverJs), stdio: ["ignore", "pipe", "pipe"] })
let log = ""
child.stdout.on("data", (d) => (log += d))
child.stderr.on("data", (d) => (log += d))

const results = []
function check(name, ok, detail = "") {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`)
}
const req = (p, init = {}) => fetch(base + p, { redirect: "manual", ...init })
const ORIGIN = { origin: "https://bydlightsolutions.com" } // origen oficial: asi se llega al control de pagos y no al de CSRF
let n = 0
const ip = () => ({ "x-forwarded-for": `10.20.${++n}.1` }) // evita el limite por IP entre sondeos

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + "/", { redirect: "manual" })
      if (r.status < 500) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

function adminHeaders(secret, body) {
  const ts = String(Date.now())
  const nonce = crypto.randomBytes(16).toString("hex")
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${nonce}.${body}`).digest("hex")
  return { "content-type": "application/json", "x-bd-timestamp": ts, "x-bd-nonce": nonce, "x-bd-signature": sig }
}

try {
  if (!(await waitUp())) {
    console.error("El servidor no arranco.\n" + log.slice(-800))
    process.exit(2)
  }

  // --- Paginas privadas de pago ---
  for (const p of ["/orden", "/orden/ABCDEFGHJKMN", "/orden/INVALIDO", "/orden/ABCDEFGHJKMN?aviso=error"]) {
    const r = await req(p, { headers: ip() })
    check(`GET ${p} no existe`, r.status === 404, `HTTP ${r.status}`)
  }
  const c = await req("/contratar?plan=profesional", { headers: ip() })
  check("GET /contratar redirige a /contacto (sin checkout)", c.status >= 300 && c.status < 400 && (c.headers.get("location") ?? "").includes("/contacto"), `HTTP ${c.status} ${c.headers.get("location")}`)

  // --- Pagina 404 propia: la ven tambien las rutas reservadas; no revela si existen ni habla de pagos ---
  const nf = await req("/orden/ABCDEFGHJKMN", { headers: ip() })
  const nfHtml = await nf.text()
  check("La 404 (tambien la de /orden) esta en espanol, con marca y sin mencionar pagos", nf.status === 404 && nfHtml.includes("No encontramos esa página") && !/could not be found/i.test(nfHtml) && !/webpay|transbank|pago/i.test(nfHtml.replace(/<script[\s\S]*?<\/script>/g, "")))

  // --- Paginas legales PUBLICADAS (Etapa B): visibles, sin banner de borrador ni marcadores pendientes ---
  for (const p of ["/terminos", "/devoluciones", "/soporte", "/servicios-digitales", "/privacidad", "/informacion-comercial", "/legal"]) {
    const r = await req(p, { headers: ip() })
    const t = r.status === 200 ? await r.text() : ""
    check(`GET ${p} publicada, sin banner de borrador ni [PENDIENTE]`, r.status === 200 && !/BORRADOR/.test(t) && !/\[PENDIENTE/.test(t), `HTTP ${r.status}`)
  }

  // --- Vista previa local: no existe en produccion ---
  {
    const r = await req("/vista-previa", { headers: ip() })
    check("GET /vista-previa (solo desarrollo) no existe en produccion", r.status === 404, `HTTP ${r.status}`)
  }
  {
    for (const f of ["webpay-plus.png", "visa.svg", "mastercard.svg"]) {
      const r = await req(`/vista-previa/logos/${f}`, { headers: ip() })
      check(`GET /vista-previa/logos/${f}: marcas no verificadas no se sirven en produccion`, r.status === 404, `HTTP ${r.status}`)
    }
  }

  // --- Solicitudes y pagos ---
  const sol = await req("/api/solicitudes", {
    method: "POST",
    headers: { "content-type": "application/json", ...ORIGIN, ...ip() },
    body: JSON.stringify({ planId: "emprendedor", name: "Prueba", email: "p@example.com", message: "Mensaje de prueba largo", accept: true }),
  })
  check("POST /api/solicitudes no crea ordenes", sol.status === 503, `HTTP ${sol.status}`)

  const fd = () => {
    const f = new FormData()
    f.set("orderId", "ABCDEFGHJKMN")
    f.set("kind", "anticipo")
    f.set("amount", "1")
    return f
  }
  const ini = await req("/api/pagos/iniciar", { method: "POST", headers: { ...ORIGIN, ...ip() }, body: fd() })
  const iniBody = ini.status === 200 ? await ini.text() : ""
  check("POST /api/pagos/iniciar no inicia transacciones", ini.status !== 200 && !iniBody.includes("token_ws"), `HTTP ${ini.status} ${ini.headers.get("location") ?? ""}`)
  const iniOtro = await req("/api/pagos/iniciar", { method: "POST", headers: { origin: "https://evil.example", ...ip() }, body: fd() })
  check("POST /api/pagos/iniciar con origen ajeno se rechaza", iniOtro.status === 403, `HTTP ${iniOtro.status}`)
  const g = await req("/api/pagos/iniciar", { headers: ip() })
  check("GET /api/pagos/iniciar no inicia nada", g.status === 405 || g.status === 404, `HTTP ${g.status}`)

  const ver = await req("/api/pagos/verificar", { method: "POST", headers: { ...ORIGIN, ...ip() }, body: fd() })
  check("POST /api/pagos/verificar es inerte (solo redirige)", ver.status >= 300 && ver.status < 400, `HTTP ${ver.status}`)

  // Retornos: se mantienen por razones tecnicas pero con pagos apagados no consultan ni confirman nada.
  const tok = "a".repeat(64)
  for (const q of [`token_ws=${tok}`, `TBK_TOKEN=${tok}&TBK_ORDEN_COMPRA=BLABCDEFGHJKMN-01&TBK_ID_SESION=ABCDEFGHJKMN`, `token_ws=${tok}&TBK_TOKEN=${tok}`, ""]) {
    const r = await req(`/api/pagos/retorno/ABCDEFGHJKMN?${q}`, { headers: ip() })
    check(`GET retorno (${q.slice(0, 12) || "sin parametros"}…) no confirma ni cambia estado`, r.status >= 300 && r.status < 400, `HTTP ${r.status}`)
  }
  const rp = await req("/api/pagos/retorno/ABCDEFGHJKMN", { method: "POST", headers: ip(), body: new URLSearchParams({ token_ws: tok }) })
  check("POST retorno es inerte", rp.status >= 300 && rp.status < 400, `HTTP ${rp.status}`)

  // --- API administrativa y devoluciones ---
  const noSecret = await req("/api/admin", { method: "POST", headers: { "content-type": "application/json", ...ip() }, body: JSON.stringify({ action: "list" }) })
  check("POST /api/admin sin secreto configurado = 404", noSecret.status === 404, `HTTP ${noSecret.status}`)
  const body = JSON.stringify({ action: "refund", orderId: "ABCDEFGHJKMN", amount: 1000, idempotencyKey: "x".repeat(20) })
  const fake = await req("/api/admin", { method: "POST", headers: { ...adminHeaders("s".repeat(40), body), ...ip() }, body })
  check("POST /api/admin con firma inventada = 404 (la API no existe)", fake.status === 404, `HTTP ${fake.status}`)
  const getAdmin = await req("/api/admin", { headers: ip() })
  check("GET /api/admin no expone nada", getAdmin.status === 404 || getAdmin.status === 405, `HTTP ${getAdmin.status}`)

  // --- Secretos y cabeceras ---
  const home = await req("/", { headers: ip() })
  const html = await home.text()
  check("La portada no contiene credenciales ni palabras de pago interno", !/TBK_API_KEY|597055555532|adminSecret|payments\.json|Tbk-Api-Key/i.test(html))
  const publicTexts = []
  for (const p of ["/", "/planes", "/servicios", "/nosotros", "/contacto", "/proyectos"]) {
    const t = await (await req(p, { headers: ip() })).text()
    publicTexts.push([p, t])
  }
  const claims = /(paga(r)? (tu )?anticipo|pagos? en l[ií]nea|Webpay|Transbank|tarjeta de cr[eé]dito|Pagos procesados)/i
  const leaking = publicTexts.filter(([, t]) => claims.test(t.replace(/<script[\s\S]*?<\/script>/g, "")))
  // Etapa B: con las dos llaves de codigo abiertas el sitio anuncia Webpay Plus; el cobro real sigue cerrado en el servidor (este script no crea payments.json).
  check("Etapa B: la portada anuncia el pago con Webpay Plus", leaking.some(([p]) => p === "/"), leaking.map(([p]) => p).join(", "))
  const wp = publicTexts.filter(([, t]) => /wordpress|\bdivi\b/i.test(t))
  check("Ninguna pagina publica menciona WordPress/Divi", wp.length === 0, wp.map(([p]) => p).join(", "))
  check("Cabecera anti-clickjacking presente", (home.headers.get("x-frame-options") ?? "").toUpperCase() === "DENY")

  // --- Sin efectos en disco ---
  check("No se creo la base de datos ni su carpeta", !fs.existsSync(dbPath))
  check("No se creo ningun archivo en el directorio de datos de prueba", fs.readdirSync(scratch).length === 0, fs.readdirSync(scratch).join(","))
} finally {
  child.kill()
  fs.rmSync(scratch, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
process.exit(failed.length ? 1 : 0)
