// Capturas Fase 2 (landing con seccion de pago seguro, planes, CTA, pie C). Requiere la vista previa en http://localhost:3100.
// Uso: node scripts/renders3d/capturas-pagos-fase2.mjs   Salida: docs/evidencias-pagos-fase2/<ancho>/<nombre>.png
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
const root = "C:/Users/dcarrasco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules"
const { chromium } = createRequire(root + "/x.js")("playwright-core")
const BASE = "http://localhost:3100"
const OUT = new URL("../../docs/evidencias-pagos-fase2/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const WIDTHS = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [320, 640]]
const SHOTS = [
  ["home-seccion-pagos", "/", ".sp"],
  ["home-planes", "/", "section[aria-label=\"Planes web\"]"],
  ["planes-pagos", "/planes", ".pt-var[data-place=plans] .pt"],
  ["planes-cta-final", "/planes", ".bd-cta"],
  ["pie-c", "/", ".pt-fixed-footer"],
  ["contratar", "/contratar?plan=profesional", ".pt-var[data-place=checkout] .pt"],
  ["resumen-pago", "/orden/DEMOCOTIZADA", ".pt-var[data-place=checkout] .pt"],
  ["comprobante", "/orden/DEMOAPROBADA", ".bd-voucher"],
]
const browser = await chromium.launch({ executablePath: "C:/Users/dcarrasco/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe" })
const rep = []
for (const [w, h] of WIDTHS) {
  const dir = `${OUT}${w}/`; mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const scroll = async () => { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)) } scrollTo(0, 0) }) }
  for (const [name, route, sel] of SHOTS) {
    await page.goto(BASE + route, { waitUntil: "load" })
    await page.addStyleTag({ content: "html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important}.pv-bar{display:none!important}header,[class*=mbar],[class*=mobile-bar],.bd-dock{display:none!important}" })
    await page.waitForTimeout(400); await scroll()
    const loc = page.locator(sel).filter({ visible: true }).first()
    await loc.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForFunction((s) => [...document.querySelectorAll(s + " img")].filter((i) => i.offsetParent).every((i) => i.complete), sel, { timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(300)
    const info = await page.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null)
      const imgs = el ? [...el.querySelectorAll("img")].filter((i) => i.offsetParent).map((i) => { const r = i.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth > 0, r: r.width / r.height, w: r.width, nat: i.naturalWidth } }) : []
      return { found: !!el, ov: document.documentElement.scrollWidth - innerWidth, imgs }
    }, sel)
    const bad = info.imgs.filter((i) => !i.ok)
    const blurry = info.imgs.filter((i) => i.nat && i.nat < i.w * 0.95)
    rep.push(`${w}px ${name} found=${info.found} desborde=${info.ov} logos=${info.imgs.length} rotos=${bad.length} subresolucion=${blurry.length}${info.ov > 0 || bad.length || blurry.length || !info.found ? " <<<" : ""}`)
    if (info.found) await loc.screenshot({ path: `${dir}${name}.png` }).catch((e) => rep.push("  sin captura " + String(e).slice(0, 60)))
  }
  // landing completa
  await page.goto(BASE + "/", { waitUntil: "load" })
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important}" })
  await page.waitForTimeout(400); await scroll(); await page.waitForTimeout(400)
  if (w === 1440 || w === 390) await page.screenshot({ path: `${dir}landing-completa.png`, fullPage: true })
  await ctx.close()
}
await browser.close()
console.log(rep.join("\n"))
