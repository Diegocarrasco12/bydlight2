// Acceso controlado al checkout (modo piloto para la prueba productiva) y flujo completo de la compra de $50.
// SQLite real temporal + doble del SDK. Nada toca la red ni credenciales.
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "bd-pilot-"))
const SECRET = "s".repeat(20) + "e".repeat(20)
const CFG = join(dir, "payments.json")
process.env.PAYMENTS_DB = join(dir, "t.db")
process.env.PAYMENTS_CONFIG = CFG
delete process.env.PAYMENTS_ENABLED
delete process.env.PAYMENTS_ACCESS
delete process.env.TBK_ENV
delete process.env.ADMIN_API_SECRET
process.env.NODE_ENV = "production"

const cfg = await import("../src/lib/payments/config.ts")
const pilot = await import("../src/lib/payments/pilot.ts")
const access = await import("../src/lib/payments/access.ts")
const svc = await import("../src/lib/payments/service.ts")
const admin = await import("../src/lib/payments/adminOps.ts")
const store = await import("../src/lib/payments/store.ts")
const db = await import("../src/lib/payments/db.ts")
const { TERMS_VERSION } = await import("../src/lib/terms.ts")
const solicitudesRoute = await import("../src/app/api/solicitudes/route.ts")
const pilotRoute = await import("../src/app/api/acceso-piloto/route.ts")
const iniciarRoute = await import("../src/app/api/pagos/iniciar/route.ts")

const writeCfg = (o) => {
  writeFileSync(CFG, JSON.stringify(o))
  cfg.resetConfigCache()
}

const calls = { create: 0, commit: 0 }
let counter = 0
beforeEach(() => {
  Object.assign(calls, { create: 0, commit: 0 })
  writeCfg({ enabled: true, adminSecret: SECRET, publicBaseUrl: "https://bydlightsolutions.com" })
  globalThis.__tbk = {
    create: async () => {
      calls.create++
      return { token: `tok${++counter}${"x".repeat(20)}`, url: "https://webpay3g.transbank.cl/webpayserver/initTransaction" }
    },
    commit: async () => {
      calls.commit++
      throw new Error("sin configurar")
    },
    status: async () => ({ status: "INITIALIZED" }),
  }
})

const ORIGIN = "https://bydlightsolutions.com"
let ipn = 0
const ip = () => ({ "cf-connecting-ip": `10.9.${++ipn}.1` })
const body = { planId: "emprendedor", name: "Titular Prueba", email: "titular@example.com", message: "Prueba productiva controlada", accept: true, acceptTerms: true, termsVersion: TERMS_VERSION }
const postSol = (headers = {}) =>
  solicitudesRoute.POST(new Request(`${ORIGIN}/api/solicitudes`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...ip(), ...headers }, body: JSON.stringify(body) }))
const cookieOf = (res) => /bd_piloto=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1]
let tick = 0 // cada enlace de prueba tiene una vigencia distinta: dos enlaces emitidos en el mismo segundo serian identicos
async function enter(minutes = 5, hours = 2) {
  const t = pilot.signPilotLink(SECRET, Date.now() + ++tick * 1000, minutes, hours)
  return pilotRoute.GET(new Request(`${ORIGIN}/api/acceso-piloto?t=${t}`, { headers: ip() }))
}

test("P1. modos de acceso: apagado = closed; produccion sin 'access' = pilot; 'public' exige las banderas del codigo", () => {
  writeCfg({ enabled: false, access: "public" })
  assert.equal(cfg.checkoutMode(), "closed")
  writeCfg({})
  assert.equal(cfg.checkoutMode(), "closed")
  writeCfg({ enabled: true })
  assert.equal(cfg.checkoutMode(), "pilot") // por defecto en produccion: NO publico
  writeCfg({ enabled: true, access: "pilot" })
  assert.equal(cfg.checkoutMode(), "pilot")
  writeCfg({ enabled: true, access: "public" })
  assert.equal(cfg.publicCheckoutReady(), true) // Etapa B: ONLINE_CHECKOUT_UI y LEGAL_PAGES_PUBLISHED en true
  assert.equal(cfg.checkoutMode(), "public") // las dos llaves de codigo abiertas + access=public en payments.json
  writeCfg({ enabled: true, access: "pilot" })
  assert.equal(cfg.checkoutMode(), "pilot") // sin access=public el checkout sigue cerrado al publico (la 3a llave)
  process.env.PAYMENTS_ENABLED = "false"
  assert.equal(cfg.checkoutMode(), "closed") // el interruptor de emergencia por entorno apaga todo
  delete process.env.PAYMENTS_ENABLED
  process.env.NODE_ENV = "development"
  writeCfg({ enabled: true })
  assert.equal(cfg.checkoutMode(), "public") // desarrollo/sandbox
  process.env.NODE_ENV = "production"
})

test("P2. enlace y cookie: validos, vencidos, manipulados o con otro secreto se rechazan", () => {
  const now = Date.now()
  const ok = pilot.signPilotLink(SECRET, now, 5, 2)
  const v = pilot.verifyPilotLink(ok, now)
  assert.equal(v.ok, true)
  assert.equal(v.hours, 2)
  assert.equal(pilot.verifyPilotLink(ok, now + 6 * 60_000).ok, false) // vencido
  assert.equal(pilot.verifyPilotLink(pilot.signPilotLink(SECRET, now, 11, 2), now).ok, false) // vigencia mayor a 10 min
  assert.equal(pilot.verifyPilotLink(ok.replace(".2.", ".8."), now).ok, false) // horas alteradas
  assert.equal(pilot.verifyPilotLink(pilot.signPilotLink(SECRET, now, 5, 9), now).ok, false) // mas de 8 horas
  assert.equal(pilot.verifyPilotLink(pilot.signPilotLink("o".repeat(40), now, 5, 2), now).ok, false) // otro secreto
  assert.equal(pilot.verifyPilotLink(ok.slice(0, -1) + (ok.endsWith("0") ? "1" : "0"), now).ok, false)
  assert.equal(pilot.verifyPilotLink("", now).ok, false)
  const c = pilot.makePilotCookie(2, now)
  assert.equal(pilot.pilotCookieValid(c.value, now), true)
  assert.equal(pilot.pilotCookieValid(c.value, now + 2 * 3600_000 + 1000), false) // vencida
  assert.equal(pilot.pilotCookieValid(c.value.replace(/.$/, (x) => (x === "0" ? "1" : "0")), now), false)
  assert.equal(pilot.pilotCookieValid(pilot.makePilotCookie(2, now, "o".repeat(40)).value, now), false)
  assert.equal(pilot.pilotCookieValid(undefined, now), false)
  // Una cookie no sirve como enlace ni un enlace como cookie (separacion de dominios del HMAC).
  assert.equal(pilot.pilotCookieValid(ok, now), false)
  writeCfg({ enabled: true }) // sin secreto administrativo nadie entra
  assert.equal(pilot.verifyPilotLink(ok, now).ok, false)
  assert.equal(pilot.pilotCookieValid(c.value, now), false)
})

test("P3. /api/acceso-piloto: un solo uso, cookie HttpOnly/Secure/SameSite, y 404 uniforme ante cualquier fallo", async () => {
  const r = await enter()
  assert.equal(r.status, 303)
  assert.equal(r.headers.get("location"), "/contratar")
  const sc = r.headers.get("set-cookie")
  assert.match(sc, /HttpOnly/)
  assert.match(sc, /SameSite=Lax/)
  assert.match(sc, /Secure/)
  assert.match(sc, /Max-Age=7200/)
  assert.equal(r.headers.get("referrer-policy"), "no-referrer")
  const t = pilot.signPilotLink(SECRET, Date.now() + ++tick * 1000, 5, 2)
  assert.equal((await pilotRoute.GET(new Request(`${ORIGIN}/api/acceso-piloto?t=${t}`, { headers: ip() }))).status, 303)
  assert.equal((await pilotRoute.GET(new Request(`${ORIGIN}/api/acceso-piloto?t=${t}`, { headers: ip() }))).status, 404) // reutilizacion
  assert.equal((await pilotRoute.GET(new Request(`${ORIGIN}/api/acceso-piloto?t=basura`, { headers: ip() }))).status, 404)
  assert.equal((await pilotRoute.GET(new Request(`${ORIGIN}/api/acceso-piloto`, { headers: ip() }))).status, 404)
  writeCfg({ enabled: false, adminSecret: SECRET })
  assert.equal((await enter()).status, 404) // apagado
})

test("P4. solicitudes en modo piloto: terceros no crean ordenes; con la cookie del administrador si (y queda rotulada)", async () => {
  const count = () => db.openDb().prepare("SELECT COUNT(*) n FROM orders").get().n
  const cookie = cookieOf(await enter())
  const before = count()
  assert.equal((await postSol()).status, 503) // sin cookie
  assert.equal((await postSol({ cookie: "bd_piloto=v1.9999999999." + "a".repeat(64) })).status, 503) // cookie falsificada
  assert.equal((await postSol({ cookie: `bd_piloto=${pilot.makePilotCookie(2, Date.now() - 3 * 3600_000).value}` })).status, 503) // vencida
  assert.equal(count(), before)
  const ok = await postSol({ cookie: `bd_piloto=${cookie}` })
  assert.equal(ok.status, 201)
  const { id } = await ok.json()
  const o = await store.readOrder(id)
  assert.ok(o.events.some((e) => e.type === "ACCESO_PILOTO"))
  assert.ok(o.events.some((e) => e.type === "TERMINOS_ACEPTADOS"))
  assert.equal((await postSol({ cookie: `bd_piloto=${cookie}`, origin: "https://evil.example" })).status, 403) // CSRF sigue activo
})

test("P5. inicio de pago en modo piloto: sin cookie no se llama a Transbank; con cookie se inicia una sola transaccion", async () => {
  const cookie = `bd_piloto=${cookieOf(await enter())}`
  const created = await (await postSol({ cookie })).json()
  assert.ok((await admin.approveQuote(created.id, { amount: 100, depositPercent: 50 })).ok)
  const form = () => {
    const f = new FormData()
    f.set("orderId", created.id)
    f.set("kind", "anticipo")
    f.set("acceptTerms", "on")
    f.set("termsVersion", TERMS_VERSION)
    f.set("amount", "1")
    return f
  }
  const post = (headers) => iniciarRoute.POST(new Request(`${ORIGIN}/api/pagos/iniciar`, { method: "POST", headers: { origin: ORIGIN, ...ip(), ...headers }, body: form() }))
  const denied = await post({})
  assert.equal(denied.status, 303)
  assert.match(denied.headers.get("location"), /aviso=error/)
  assert.equal(calls.create, 0)
  const go = await post({ cookie })
  assert.equal(go.status, 200)
  assert.match(await go.text(), /token_ws/)
  assert.equal(calls.create, 1)
  const o = await store.readOrder(created.id)
  assert.equal(o.attempts.length, 1)
  assert.equal(o.attempts[0].amount, 50) // el amount=1 del navegador se ignora
  const again = await post({ cookie })
  assert.equal(again.status, 303) // no se crea otra transaccion mientras la primera sigue vigente
  assert.equal(calls.create, 1)
})

test("P6. la compra de $50 de extremo a extremo: anticipo $50, saldo $50, retornos duplicados y trazabilidad", async () => {
  const cookie = `bd_piloto=${cookieOf(await enter())}`
  const { id } = await (await postSol({ cookie })).json()
  assert.ok((await admin.approveQuote(id, { amount: 100, depositPercent: 50, validDays: 1, note: "PRUEBA PRODUCTIVA" })).ok)
  const pay = async (kind) => {
    const s = await svc.startPayment(id, kind, "https://bydlightsolutions.com", { accepted: true })
    assert.ok(s.ok, JSON.stringify(s))
    const o = await store.readOrder(id)
    const a = o.attempts[o.attempts.length - 1]
    globalThis.__tbk.commit = async () => {
      calls.commit++
      return { status: "AUTHORIZED", response_code: 0, buy_order: a.buyOrder, session_id: id, amount: a.amount, authorization_code: "1213", payment_type_code: "VD", installments_number: 0, card_detail: { card_number: "6623" } }
    }
    await svc.handleReturn(id, { tokenWs: s.token })
    await svc.handleReturn(id, { tokenWs: s.token }) // retorno duplicado: no se confirma dos veces
    return (await store.readOrder(id)).attempts.find((x) => x.id === a.id)
  }
  const a1 = await pay("anticipo")
  assert.equal(a1.amount, 50)
  assert.equal(a1.status, "AUTORIZADO")
  assert.equal(calls.commit, 1)
  assert.equal((await store.readOrder(id)).stage, "ANTICIPO_PAGADO")
  assert.ok((await admin.releaseBalance(id)).ok)
  const a2 = await pay("saldo")
  assert.equal(a2.amount, 50)
  assert.equal(a2.status, "AUTORIZADO")
  assert.equal(calls.commit, 2)
  const o = await store.readOrder(id)
  assert.equal(o.stage, "PAGADA")
  const types = o.events.map((e) => e.type)
  for (const t of ["SOLICITUD_CREADA", "ACCESO_PILOTO", "TERMINOS_ACEPTADOS", "COTIZACION_APROBADA", "PAGO_INICIADO", "PAGO_AUTORIZADO", "SALDO_HABILITADO"]) {
    assert.ok(types.includes(t), `falta el evento ${t}`)
  }
  assert.doesNotMatch(JSON.stringify(o), /4051885600446623/)
})

test("P7. cliente administrativo: el enlace que emite pilot-link lo acepta el servidor (mismo algoritmo) y no imprime el secreto", async () => {
  const run = (args, env = {}) => spawnSync(process.execPath, ["scripts/admin-remote.mjs", ...args], { env: { ...process.env, BYDLIGHT_URL: ORIGIN, ...env }, encoding: "utf8" })
  const file = join(dir, "cfg-admin.json")
  writeFileSync(file, JSON.stringify({ enabled: true, adminSecret: SECRET }))
  const r = run(["pilot-link", "--minutes", "5", "--hours", "1", "--config-file", file])
  assert.equal(r.status, 0, r.stderr)
  assert.ok(!(r.stdout + r.stderr).includes(SECRET))
  const url = new URL(r.stdout.trim())
  assert.equal(url.pathname, "/api/acceso-piloto")
  const res = await pilotRoute.GET(new Request(`${ORIGIN}${url.pathname}${url.search}`, { headers: ip() }))
  assert.equal(res.status, 303)
  assert.match(res.headers.get("set-cookie"), /Max-Age=3600/)
  assert.notEqual(run(["pilot-link", "--minutes", "30", "--config-file", file]).status, 0) // mas de 10 min: rechazado
  assert.notEqual(run(["pilot-link", "--hours", "9", "--config-file", file]).status, 0)
  assert.notEqual(run(["pilot-link"], { BYDLIGHT_ADMIN_SECRET: "" }).status, 0) // sin terminal ni secreto: no inventa nada
})

test("P8. /contratar valida el acceso en el servidor antes de armar el formulario y la UI publica esta habilitada por codigo (Etapa B)", () => {
  const page = readFileSync(new URL("../src/app/contratar/page.tsx", import.meta.url), "utf8")
  assert.ok(page.indexOf("checkoutOpenFor(") > 0 && page.indexOf("checkoutOpenFor(") < page.indexOf("const initial"))
  assert.match(readFileSync(new URL("../src/lib/plans.ts", import.meta.url), "utf8"), /export const ONLINE_CHECKOUT_UI = true/)
  assert.match(readFileSync(new URL("../src/lib/legal.ts", import.meta.url), "utf8"), /export const LEGAL_PAGES_PUBLISHED = true/)
  assert.equal(access.checkoutOpenFor(undefined), false)
  assert.equal(access.checkoutOpenFor(`bd_piloto=${pilot.makePilotCookie(1).value}`), true)
})

test("P9. payments-config-set: cambia solo enabled/access, conserva credenciales y no imprime secretos", () => {
  const f = join(dir, "set.json")
  writeFileSync(f, JSON.stringify({ enabled: false, env: "production", commerceCode: "597000000001", apiKey: "K".repeat(40), adminSecret: SECRET, publicBaseUrl: ORIGIN, adminRefunds: false }))
  const run = (...a) => spawnSync(process.execPath, ["scripts/payments-config-set.mjs", f, ...a], { encoding: "utf8" })
  const r = run("enabled=true", "access=pilot")
  assert.equal(r.status, 0, r.stderr)
  assert.ok(!(r.stdout + r.stderr).includes(SECRET) && !r.stdout.includes("K".repeat(10)) && !r.stdout.includes("597000000001"))
  const after = JSON.parse(readFileSync(f, "utf8"))
  assert.deepEqual([after.enabled, after.access, after.env, after.commerceCode, after.apiKey, after.adminSecret, after.adminRefunds], [true, "pilot", "production", "597000000001", "K".repeat(40), SECRET, false])
  for (const bad of [["env=integration"], ["adminRefunds=true"], ["adminSecret=x"], ["enabled=yes"], ["access=todos"], []]) assert.notEqual(run(...bad).status, 0, bad.join(" "))
  assert.deepEqual(JSON.parse(readFileSync(f, "utf8")), after) // los rechazos no modifican nada
  assert.equal(run("--show").status, 0)
  writeFileSync(f, "{roto")
  assert.notEqual(run("enabled=true").status, 0)
  assert.equal(readFileSync(f, "utf8"), "{roto") // archivo ilegible: no se toca
})
