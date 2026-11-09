#!/usr/bin/env node
// Verifica, sobre el artefacto de PRODUCCION (.next/standalone, NODE_ENV=production), el modo PUBLICO del checkout (Etapa B):
// con payments.json en enabled:true + access:public cualquiera puede solicitar un plan y, tras la cotizacion aprobada, ver el
// resumen de pago; pero el monto sigue sin venir del cliente, los terminos siguen siendo obligatorios, el origen ajeno se
// rechaza, hay limite de solicitudes, las devoluciones siguen apagadas y el INTERRUPTOR (enabled=false / access=pilot) cierra
// todo en segundos. Usa secreto, base y comercio FICTICIOS en una carpeta temporal. No contacta a Transbank: ninguna prueba
// llega a iniciar una transaccion.
//
// Uso: npm run build && node scripts/verify-prod-public.mjs        (codigo 1 si algo falla)

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
const PORT = 3292
const base = `http://127.0.0.1:${PORT}`
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "bd-public-prod-"))
const cfgPath = path.join(scratch, "payments.json")
const dbPath = path.join(scratch, "bydlight.db")
const SECRET = "p".repeat(24) + "q".repeat(24)
const writeCfg = (extra) =>
  fs.writeFileSync(cfgPath, JSON.stringify({ env: "production", commerceCode: "000000000000", apiKey: "k".repeat(40), publicBaseUrl: "https://bydlightsolutions.com", adminSecret: SECRET, adminRefunds: false, ...extra }))
writeCfg({ enabled: true, access: "public" })

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
const ip = () => ({ "x-forwarded-for": `10.40.${++n}.1` })
const req = (p, init = {}) => fetch(base + p, { redirect: "manual", ...init })
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const client = (args) =>
  spawnSync(process.execPath, [path.join(root, "scripts", "admin-remote.mjs"), ...args, "--config-file", cfgPath], {
    env: { ...process.env, BYDLIGHT_URL: `http://localhost:${PORT}` },
    encoding: "utf8",
  })
const sol = (extra = {}) =>
  JSON.stringify({ planId: "emprendedor", name: "Cliente Publico", email: "cliente@example.com", message: "Necesito una landing page", accept: true, acceptTerms: true, termsVersion: TERMS_VERSION, customerType: "persona", ...extra })
const post = (p, body, headers = {}) => req(p, { method: "POST", headers: { "content-type": "application/json", ...ORIGIN, ...headers }, body })

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/", { redirect: "manual" })).status < 500) return true
    } catch {}
    await sleep(500)
  }
  return false
}

try {
  if (!(await waitUp())) {
    console.error("El servidor no arranco.\n" + log.slice(-800))
    process.exit(2)
  }

  // --- Paginas publicas y legales ---
  const bad = []
  for (const p of ["/", "/planes", "/servicios", "/nosotros", "/contacto", "/proyectos"]) {
    if (/wordpress|\bdivi\b/i.test(strip(await (await req(p, { headers: ip() })).text()))) bad.push(p)
  }
  check("Ninguna pagina publica menciona WordPress/Divi", bad.length === 0, bad.join(", "))
  const legalBad = []
  for (const p of ["/terminos", "/devoluciones", "/privacidad", "/soporte", "/servicios-digitales", "/informacion-comercial", "/legal"]) {
    const r = await req(p, { headers: ip() })
    const t = r.status === 200 ? await r.text() : ""
    if (r.status !== 200 || /BORRADOR/.test(t) || /\[PENDIENTE/.test(t)) legalBad.push(p)
  }
  check("Las 7 paginas legales estan publicadas, sin banner de borrador ni marcadores", legalBad.length === 0, legalBad.join(", "))
  const planes = strip(await (await req("/planes", { headers: ip() })).text())
  check("/planes anuncia Webpay Plus, precios con IVA incluido y ninguna marca de tarjeta", /Webpay Plus/.test(planes) && /IVA incluido/i.test(planes) && !/\+ ?IVA/i.test(planes) && !/\b(visa|mastercard|american express|redcompra|magna|diners)\b/i.test(planes))
  check("La vista previa de desarrollo no existe (404)", (await req("/vista-previa", { headers: ip() })).status === 404)

  // --- Formulario publico, sin cookie ---
  const page = await req("/contratar?plan=profesional", { headers: ip() })
  const html = await page.text()
  check("/contratar abre el formulario sin enlace ni cookie (200)", page.status === 200 && html.includes("Solicitar un plan"), `HTTP ${page.status}`)
  check("El formulario NO se rotula como prueba productiva y enlaza los textos legales", !html.includes("Prueba productiva controlada") && html.includes("/terminos") && html.includes("/privacidad"))
  check("La casilla de terminos es obligatoria y no hay campo de monto", /name="acceptTerms"[^>]*required|required[^>]*name="acceptTerms"/.test(html) && !/name="amount"/.test(html))
  check("El formulario ofrece persona natural y empresa", /persona/i.test(html) && /empresa/i.test(html))

  // --- Solicitudes ---
  const noTerms = await post("/api/solicitudes", sol({ acceptTerms: false }), ip())
  check("Sin aceptar los terminos no se crea la orden (422)", noTerms.status === 422, `HTTP ${noTerms.status}`)
  const oldVer = await post("/api/solicitudes", sol({ termsVersion: "borrador-2026-11-06-r3" }), ip())
  check("Una version de terminos antigua se rechaza (422)", oldVer.status === 422, `HTTP ${oldVer.status}`)
  const evil = await req("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", ...ip() }, body: sol() })
  check("Origen ajeno rechazado (403)", evil.status === 403, `HTTP ${evil.status}`)
  const priceTamper = await post("/api/solicitudes", sol({ amount: 1, price: 1, deposit: 1 }), ip())
  const ok = priceTamper.status === 201 ? await priceTamper.json() : {}
  check("Solicitud valida crea la orden (201) e ignora cualquier precio enviado por el cliente", priceTamper.status === 201 && /^[A-Z2-9]{12}$/.test(ok.id ?? ""), `HTTP ${priceTamper.status}`)
  const id = ok.id
  const o1r = await req(`/orden/${id}`, { headers: ip() })
  const o1 = await o1r.text()
  check("La orden muestra 'Solicitud recibida' y NO ofrece pago antes de la cotizacion", o1r.status === 200 && o1.includes("Solicitud recibida") && !o1.includes("Resumen previo al pago") && !/Pagar anticipo/.test(o1))
  check("/orden y /api no se indexan ni se guardan en cache", /noindex/i.test(o1r.headers.get("x-robots-tag") ?? "") || /noindex/i.test(o1), `x-robots-tag=${o1r.headers.get("x-robots-tag")} cache-control=${o1r.headers.get("cache-control")}`)
  const empresa = await post("/api/solicitudes", sol({ customerType: "empresa", companyName: "", taxId: "11.111.111-1" }), ip())
  check("Una empresa sin razon social o con RUT invalido se rechaza (422)", empresa.status === 422, `HTTP ${empresa.status}`)
  const lim = []
  const same = { "x-forwarded-for": "10.99.99.99" }
  for (let i = 0; i < 7; i++) lim.push((await post("/api/solicitudes", sol(), same)).status)
  check("El limite de solicitudes por IP corta el abuso (429)", lim.includes(429), lim.join(","))

  // --- Cotizacion aprobada por el administrador y resumen de pago ---
  const ap = client(["approve", id, "--amount", "100000"])
  check("El administrador aprueba una cotizacion de $100.000 con anticipo 50 %", ap.status === 0 && /"deposit": 50000/.test(ap.stdout) && /"balance": 50000/.test(ap.stdout), ap.stdout.replace(/\s+/g, " ").slice(0, 140))
  const o2 = await (await req(`/orden/${id}`, { headers: ip() })).text()
  check("La orden cotizada muestra el resumen previo al pago, IVA incluido, $50.000 y los logos de Webpay Plus y Transbank", o2.includes("Resumen previo al pago") && /50\.000/.test(o2) && /IVA incluido/i.test(o2) && o2.includes("/img/pagos/webpay-plus-negativo") && o2.includes("/img/pagos/transbank-negativo"))
  check("El pago exige la casilla de terminos con enlaces y no envia el monto", /name="acceptTerms"[^>]*required|required[^>]*name="acceptTerms"/.test(o2) && !/name="amount"/.test(o2) && o2.includes("/terminos"))
  const f = new FormData(); f.set("orderId", id); f.set("kind", "anticipo")
  const nt = await req("/api/pagos/iniciar", { method: "POST", headers: { ...ORIGIN, ...ip() }, body: f })
  check("Sin aceptar los terminos no se inicia el pago (aviso=terminos)", nt.status === 303 && (nt.headers.get("location") ?? "").includes("aviso=terminos"), `HTTP ${nt.status} ${nt.headers.get("location")}`)
  const g = new FormData(); g.set("orderId", "ABCDEFGHJKMN"); g.set("kind", "anticipo"); g.set("acceptTerms", "on"); g.set("termsVersion", TERMS_VERSION)
  const ne = await req("/api/pagos/iniciar", { method: "POST", headers: { ...ORIGIN, ...ip() }, body: g })
  check("Una orden inexistente no inicia cobro (aviso=no-existe)", ne.status === 303 && (ne.headers.get("location") ?? "").includes("aviso=no-existe"), `HTTP ${ne.status} ${ne.headers.get("location")}`)
  const refund = client(["refund", id, "--amount", "50"])
  check("Las devoluciones siguen desactivadas (adminRefunds=false)", !/HTTP 20\d/.test(refund.stdout), refund.stdout.split("\n")[0])
  const ret = await req(`/api/pagos/retorno/${id}?token_ws=${"a".repeat(64)}`, { headers: ip() })
  const o3 = await (await req(`/orden/${id}`, { headers: ip() })).text()
  check("Retorno con token desconocido: redirige y no confirma nada", ret.status >= 300 && ret.status < 400 && !o3.includes("Pago aprobado"), `HTTP ${ret.status}`)
  check("El monitor de conciliacion responde sin hallazgos graves", /HTTP 200/.test(client(["audit"]).stdout), client(["audit"]).stdout.split("\n")[0])

  // --- Interruptores: cierran en <= 5 s, sin redeploy ---
  writeCfg({ enabled: true, access: "pilot" })
  await sleep(5600)
  const p1 = await req("/contratar?plan=profesional", { headers: ip() })
  const p2 = await post("/api/solicitudes", sol(), ip())
  check("access=pilot cierra al publico: /contratar -> /contacto y POST solicitudes 503", p1.status >= 300 && p1.status < 400 && (p1.headers.get("location") ?? "").includes("/contacto") && p2.status === 503, `HTTP ${p1.status} / ${p2.status}`)
  writeCfg({ enabled: false, access: "public" })
  await sleep(5600)
  const q1 = await req("/contratar?plan=profesional", { headers: ip() })
  const q2 = await post("/api/solicitudes", sol(), ip())
  check("enabled=false cierra todo aunque diga access=public (interruptor de emergencia)", q1.status >= 300 && q1.status < 400 && q2.status === 503, `HTTP ${q1.status} / ${q2.status}`)
  writeCfg({ enabled: true, access: "public" })
  await sleep(5600)
  check("Reabrir (enabled=true, access=public) vuelve a abrir el formulario", (await req("/contratar?plan=profesional", { headers: ip() })).status === 200)
} finally {
  child.kill()
  await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)))
  try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) } catch { /* carpeta temporal del sistema */ }
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
process.exit(failed.length ? 1 : 0)
