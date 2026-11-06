// Capturas y medicion de desbordes con viewports reales (Playwright global, Chromium). Uso: node scripts/renders3d/capturas.mjs
// Requiere la vista previa en http://localhost:3100 (npm run preview:pagos). Salida: docs/evidencias-3d-pagos/<ancho>/...
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
const root = "C:/Users/dcarrasco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules"
const { chromium } = createRequire(root + "/x.js")("playwright-core")
const BASE = "http://localhost:3100"
const OUT = new URL("../../docs/evidencias-3d-pagos/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const WIDTHS = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]]
const ROUTES = { home: "/", planes: "/planes", servicios: "/servicios", contratar: "/contratar?plan=profesional", cotizacion: "/orden/DEMOCOTIZADA", aprobada: "/orden/DEMOAPROBADA" }
const CROPS = { home: [".bx-grid", ".pb-hero"], planes: [".pb-hero"], contratar: [".pb-checkout"], cotizacion: [".bd-pay"], servicios: [".pb-compact"] }

const browser = await chromium.launch({ executablePath: "C:/Users/dcarrasco/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe" })
const rep = []
for (const [w, h] of WIDTHS) {
  const dir = `${OUT}${w}/`; mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "no-preference" })
  const page = await ctx.newPage()
  for (const [name, route] of Object.entries(ROUTES)) {
    await page.goto(BASE + route, { waitUntil: "load" })
    await page.addStyleTag({ content: "html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important}" })
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)) } scrollTo(0, 0) })
    await page.waitForTimeout(500)
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    rep.push(`${w}px ${route} desborde=${ov}${ov > 0 ? " <<< DESBORDE" : ""}`)
    for (const sel of CROPS[name] || []) {
      try { await page.locator(sel).first().screenshot({ path: `${dir}${name}-${sel.replace(/[^a-z]/g, "")}.png` }) } catch (e) { rep.push(`  (sin captura ${sel}: ${String(e).slice(0, 60)})`) }
    }
  }
  await ctx.close()
}
await browser.close()
console.log(rep.join("\n"))
