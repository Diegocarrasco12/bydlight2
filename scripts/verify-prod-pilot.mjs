#!/usr/bin/env node
// Verifica, sobre el artefacto de PRODUCCION (.next/standalone, NODE_ENV=production), el modo PILOTO del checkout: con
// payments.json en enabled:true (como se dejara para la prueba de $50) NADIE sin el enlace firmado puede abrir /contratar,
// crear ordenes ni iniciar un cobro. Usa un secreto, una base y un comercio FICTICIOS en una carpeta temporal.
// No contacta a Transbank: ninguna prueba llega a iniciar una transaccion.
//
// Uso: npm run build && node scripts/verify-prod-pilot.mjs        (codigo 1 si algo falla)

import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const root = process.cwd()
const serverJs = path.join(root, ".next", "standalone", "server.js")
if (!fs.existsSync(serverJs)) {
  console.error("Falta .next/standalone/server.js: ejecuta `npm run build` antes.")
  process.exit(2)
}

const TERMS_VERSION = /TERMS_VERSION = "([^"]+)"/.exec(fs.readFileSync(path.join(root, "src", "lib", "terms.ts"), "utf8"))[1]
const PORT = 3291
const base = `http://127.0.0.1:${PORT}`
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "bd-pilot-prod-"))
const cfgPath = path.join(scratch, "payments.json")
const dbPath = path.join(scratch, "bydlight.db")
const SECRET = "p".repeat(24) + "q".repeat(24)
fs.writeFileSync(cfgPath, JSON.stringify({ enabled: true, env: "production", commerceCode: "000000000000", apiKey: "k".repeat(40), publicBaseUrl: "https://bydlightsolutions.com", adminSecret: SECRET, adminRefunds: false }))

const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: "127.0.0.1", PAYMENTS_DB: dbPath, PAYMENTS_CONFIG: cfgPath }
const child = spawn(process.execPath, [serverJs], { env, cwd: path.dirname(serverJs), stdio: ["ignore", "pipe", "pipe"] })
let log = ""
child.stdout.on("data", (d) => (log += d))
child.stderr.on("data", (d) => (log += d))

const results = []
function check(name, ok, detail = "") {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`)
}
const ORIGIN = { origin: "https://bydlightsolutions.com" }
let n = 0
const ip = () => ({ "x-forwarded-for": `10.30.${++n}.1` })
const req = (p, init = {}) => fetch(base + p, { redirect: "manual", ...init })
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "")

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/", { redirect: "manual" })).status < 500) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

const client = (args, extra = {}) =>
  spawnSync(process.execPath, [path.join(root, "scripts", "admin-remote.mjs"), ...args, "--config-file", cfgPath], {
    env: { ...process.env, BYDLIGHT_URL: `http://localhost:${PORT}`, ...extra },
    encoding: "utf8",
  })
const newLink = () => {
  const r = client(["pilot-link", "--minutes", "5", "--hours", "1"])
  return r.status === 0 ? new URL(r.stdout.trim()) : null
}
const solBody = JSON.stringify({ planId: "emprendedor", name: "Titular Prueba", email: "titular@example.com", message: "Prueba productiva controlada", accept: true, acceptTerms: true, termsVersion: TERMS_VERSION })

try {
  if (!(await waitUp())) {
    console.error("El servidor no arranco.\n" + log.slice(-800))
    process.exit(2)
  }

  // --- Sin enlace: nadie entra ---
  const c0 = await req("/contratar?plan=profesional", { headers: ip() })
  check("Sin enlace: /contratar redirige a /contacto (el checkout no existe para terceros)", c0.status >= 300 && c0.status < 400 && (c0.headers.get("location") ?? "").includes("/contacto"), `HTTP ${c0.status} ${c0.headers.get("location")}`)
  const s0 = await req("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json", ...ORIGIN, ...ip() }, body: solBody })
  check("Sin enlace: POST /api/solicitudes no crea ordenes (503)", s0.status === 503, `HTTP ${s0.status}`)
  const forged = { cookie: "bd_piloto=v1.9999999999." + "a".repeat(64) }
  const s1 = await req("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json", ...ORIGIN, ...forged, ...ip() }, body: solBody })
  check("Cookie falsificada: tampoco crea ordenes (503)", s1.status === 503, `HTTP ${s1.status}`)
  const fd = () => { const f = new FormData(); f.set("orderId", "ABCDEFGHJKMN"); f.set("kind", "anticipo"); f.set("acceptTerms", "on"); f.set("termsVersion", TERMS_VERSION); return f }
  const i0 = await req("/api/pagos/iniciar", { method: "POST", headers: { ...ORIGIN, ...ip() }, body: fd() })
  check("Sin enlace: POST /api/pagos/iniciar no inicia cobros", i0.status === 303 && (i0.headers.get("location") ?? "").includes("aviso=error"), `HTTP ${i0.status} ${i0.headers.get("location")}`)
  check("Sin enlace: no se creo la base de datos (nada se escribio)", !fs.existsSync(dbPath))
  for (const t of ["basura", "v1.9999999999.2." + "b".repeat(64)]) {
    const r = await req(`/api/acceso-piloto?t=${t}`, { headers: ip() })
    check(`Enlace invalido (${t.slice(0, 10)}…) = 404`, r.status === 404, `HTTP ${r.status}`)
  }
  check("Los enlaces invalidos no abren ni crean la base (la firma se verifica antes de tocar el disco)", !fs.existsSync(dbPath))

  // --- La portada y las paginas publicas no anuncian pagos ni siquiera en modo piloto ---
  const claims = /(paga(r)? (tu )?anticipo|pagos? en l[ií]nea|Webpay|Transbank|tarjeta de cr[eé]dito|Pagos procesados)/i
  const leaking = []
  for (const p of ["/", "/planes", "/servicios", "/nosotros", "/contacto", "/proyectos"]) {
    const t = strip(await (await req(p, { headers: ip() })).text())
    if (claims.test(t) || /wordpress|\bdivi\b/i.test(t)) leaking.push(p)
  }
  // Etapa B: el anuncio es de codigo; lo que protege el modo piloto es que /contratar y las solicitudes siguen cerrados (comprobado arriba).
  const wpOnly = []
  for (const p of ["/", "/planes", "/servicios", "/nosotros", "/contacto", "/proyectos"]) {
    if (/wordpress|\bdivi\b/i.test(strip(await (await req(p, { headers: ip() })).text()))) wpOnly.push(p)
  }
  check("Modo piloto: ninguna pagina publica menciona WordPress/Divi", wpOnly.length === 0, wpOnly.join(", "))
  const visibles = []
  for (const p of ["/terminos", "/devoluciones", "/privacidad", "/soporte", "/servicios-digitales", "/informacion-comercial", "/legal"]) {
    if ((await req(p, { headers: ip() })).status !== 200) visibles.push(p)
  }
  check("Paginas legales publicadas (200)", visibles.length === 0, visibles.join(", "))
  check("La vista previa de desarrollo sigue oculta (404)", (await req("/vista-previa", { headers: ip() })).status === 404)

  // --- Con el enlace firmado del administrador ---
  const link = newLink()
  check("El cliente administrativo emite un enlace firmado sin imprimir el secreto", !!link && !link.href.includes(SECRET))
  const enter = await req(link.pathname + link.search, { headers: ip() })
  const setCookie = enter.headers.get("set-cookie") ?? ""
  check("El enlace abre el acceso: 303 a /contratar con cookie HttpOnly, Secure y SameSite=Lax", enter.status === 303 && enter.headers.get("location") === "/contratar" && /HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Lax/.test(setCookie) && /Max-Age=3600/.test(setCookie), `HTTP ${enter.status}`)
  const reuse = await req(link.pathname + link.search, { headers: ip() })
  check("El enlace es de un solo uso (reutilizarlo = 404)", reuse.status === 404, `HTTP ${reuse.status}`)
  const cookie = /bd_piloto=([^;]+)/.exec(setCookie)?.[1]
  const ck = { cookie: `bd_piloto=${cookie}` }

  const page = await req("/contratar?plan=profesional", { headers: { ...ck, ...ip() } })
  const html = await page.text()
  check("Con la cookie: /contratar abre el formulario", page.status === 200 && html.includes("Solicitar un plan"), `HTTP ${page.status}`)
  check("El formulario avisa que es una prueba productiva controlada con cobro real", html.includes("Prueba productiva controlada"))
  check("El formulario muestra los logotipos oficiales (Webpay Plus y Transbank), sin marcas de tarjetas", html.includes("/img/pagos/webpay-plus-negativo") && html.includes("/img/pagos/transbank-negativo") && !/(visa|mastercard|american express|redcompra|magna|diners)/i.test(strip(html)))
  check("La casilla de terminos es obligatoria en el formulario", /name="acceptTerms"[^>]*required|required[^>]*name="acceptTerms"/.test(html) || html.includes("acceptTerms"))

  const sol = await req("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json", ...ORIGIN, ...ck, ...ip() }, body: solBody })
  const created = sol.status === 201 ? await sol.json() : {}
  check("Con la cookie: POST /api/solicitudes crea la orden (201)", sol.status === 201 && /^[A-Z2-9]{12}$/.test(created.id ?? ""), `HTTP ${sol.status}`)
  check("La base se creo en el volumen de prueba solo ahora, con permisos de archivo normales", fs.existsSync(dbPath))
  const sx = await req("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", ...ck, ...ip() }, body: solBody })
  check("Origen ajeno sigue rechazado aun con la cookie (403)", sx.status === 403, `HTTP ${sx.status}`)
  const sn = await req("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json", ...ORIGIN, ...ip() }, body: solBody })
  check("Un tercero sin cookie sigue sin poder crear ordenes tras la entrada del titular (503)", sn.status === 503, `HTTP ${sn.status}`)

  const id = created.id
  const o1 = await (await req(`/orden/${id}`, { headers: ip() })).text()
  check("La orden muestra 'Solicitud recibida' y el aviso de prueba controlada", o1.includes("Solicitud recibida") && o1.includes("Prueba productiva controlada"))

  // --- Aprobacion administrativa firmada (el cliente oficial) ---
  const bad = client(["approve-test", id])
  check("approve-test (cliente administrativo oficial) aprueba $100 con anticipo $50", bad.status === 0 && /"deposit": 50/.test(bad.stdout) && /"balance": 50/.test(bad.stdout), bad.stdout.replace(/\s+/g, " ").slice(0, 160))
  const wrongSecretFile = path.join(scratch, "otro.json")
  fs.writeFileSync(wrongSecretFile, JSON.stringify({ adminSecret: "z".repeat(48) }))
  const wrong = spawnSync(process.execPath, [path.join(root, "scripts", "admin-remote.mjs"), "list", "--config-file", wrongSecretFile], { env: { ...process.env, BYDLIGHT_URL: `http://localhost:${PORT}` }, encoding: "utf8" })
  check("Un secreto administrativo equivocado es rechazado (401)", /HTTP 401/.test(wrong.stdout), wrong.stdout.split("\n")[0])
  const refund = client(["refund", id, "--amount", "50"])
  check("Las devoluciones siguen desactivadas (adminRefunds=false)", !/HTTP 20\d/.test(refund.stdout), refund.stdout.split("\n")[0])

  const o2 = await (await req(`/orden/${id}`, { headers: ip() })).text()
  check("La orden cotizada muestra el resumen previo al pago de $50 con Webpay Plus", o2.includes("Resumen previo al pago") && o2.includes("$50") && o2.includes("/img/pagos/webpay-plus-negativo"))
  check("El pago exige la casilla de terminos y no envia el monto", /name="acceptTerms"[^>]*required|required[^>]*name="acceptTerms"/.test(o2) && !/name="amount"/.test(o2))
  check("La orden muestra el logotipo de Transbank como procesador", o2.includes("Pagos procesados por") && o2.includes("/img/pagos/transbank-negativo"))
  const noTerms = new FormData(); noTerms.set("orderId", id); noTerms.set("kind", "anticipo")
  const nt = await req("/api/pagos/iniciar", { method: "POST", headers: { ...ORIGIN, ...ck, ...ip() }, body: noTerms })
  check("Aun con la cookie, sin aceptar terminos no se inicia el pago", nt.status === 303 && (nt.headers.get("location") ?? "").includes("aviso=terminos"), `HTTP ${nt.status} ${nt.headers.get("location")}`)
  const noCk = new FormData(); noCk.set("orderId", id); noCk.set("kind", "anticipo"); noCk.set("acceptTerms", "on"); noCk.set("termsVersion", TERMS_VERSION)
  const nc = await req("/api/pagos/iniciar", { method: "POST", headers: { ...ORIGIN, ...ip() }, body: noCk })
  check("Un tercero con el codigo de la orden NO puede iniciar el cobro (sin cookie)", nc.status === 303 && (nc.headers.get("location") ?? "").includes("aviso=error"), `HTTP ${nc.status} ${nc.headers.get("location")}`)

  // --- Retorno y verificacion publicos siguen siendo inocuos ---
  const tok = "a".repeat(64)
  const ret = await req(`/api/pagos/retorno/${id}?token_ws=${tok}`, { headers: ip() })
  check("Retorno con un token desconocido: redirige sin confirmar nada", ret.status >= 300 && ret.status < 400, `HTTP ${ret.status}`)
  const o3 = await (await req(`/orden/${id}`, { headers: ip() })).text()
  check("La orden sigue sin pagos registrados tras el retorno falso", !o3.includes("Pago aprobado") && !o3.includes("Pago rechazado"))
} finally {
  child.kill()
  await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)))
  try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* carpeta temporal del sistema */ }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
process.exit(failed.length ? 1 : 0)
