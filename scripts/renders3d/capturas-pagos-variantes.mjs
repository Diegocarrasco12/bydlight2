// Capturas de las propuestas A/B/C de «pagos seguros» (solo vista previa local en http://localhost:3100) + medicion de desbordes.
// Uso: node scripts/renders3d/capturas-pagos-variantes.mjs   Salida: docs/evidencias-pagos-variantes/<ancho>/<variante>-<lugar>.png
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
const root = "C:/Users/dcarrasco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules"
const { chromium } = createRequire(root + "/x.js")("playwright-core")
const BASE = "http://localhost:3100"
const OUT = new URL("../../docs/evidencias-pagos-variantes/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const WIDTHS = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]]
const SHOTS = [
  ["home", "/", ".pt-var[data-place=home] .pt"],
  ["planes", "/planes", ".pt-var[data-place=plans] .pt"],
  ["pie", "/", ".pt-var[data-place=footer] .pt"],
  ["contratar", "/contratar?plan=profesional", ".pt-var[data-place=checkout] .pt"],
  ["cotizacion", "/orden/DEMOCOTIZADA", ".pt-var[data-place=checkout] .pt"],
  ["aprobada", "/orden/DEMOAPROBADA", ".bd-voucher"],
]
const browser = await chromium.launch({ executablePath: "C:/Users/dcarrasco/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe" })
const rep = []
for (const [w, h] of WIDTHS) {
  const dir = `${OUT}${w}/`; mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  for (const v of ["a", "b", "c"]) {
    for (const [name, route, sel] of SHOTS) {
      await page.goto(`${BASE}${route}${route.includes("?") ? "&" : "?"}pay=${v}`, { waitUntil: "load" })
      await page.addStyleTag({ content: "html{scroll-behavior:auto!important}.rv{opacity:1!important;transform:none!important}" })
      await page.waitForTimeout(400)
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } scrollTo(0, 0) })
      await page.locator(sel).filter({ visible: true }).first().scrollIntoViewIfNeeded().catch(() => {})
      await page.waitForFunction((s) => [...document.querySelectorAll(s + ' img')].filter((i) => i.offsetParent).every((i) => i.complete), sel, { timeout: 4000 }).catch(() => {})
      await page.waitForTimeout(300)
      const info = await page.evaluate(([s]) => {
        const el = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed")
        const imgs = el ? [...el.querySelectorAll("img")].filter((i) => i.offsetParent).map((i) => ({ ok: i.complete && i.naturalWidth > 0, ratio: +(i.getBoundingClientRect().width / i.getBoundingClientRect().height).toFixed(3), nat: +(i.naturalWidth / i.naturalHeight).toFixed(3) })) : []
        return { found: !!el, ov: document.documentElement.scrollWidth - innerWidth, imgs }
      }, [sel])
      const bad = info.imgs.filter((i) => !i.ok || Math.abs(i.ratio - i.nat) > 0.12)
      rep.push(`${w}px ${v} ${name} found=${info.found} desborde=${info.ov} logos=${info.imgs.length} deformados/rotos=${bad.length}${info.ov > 0 || bad.length ? " <<<" : ""}`)
      if (info.found) { try { await page.locator(sel).filter({ visible: true }).first().screenshot({ path: `${dir}${v}-${name}.png` }) } catch (e) { rep.push(`  (sin captura: ${String(e).slice(0, 60)})`) } }
    }
  }
  await ctx.close()
}
await browser.close()
console.log(rep.join("\n"))
