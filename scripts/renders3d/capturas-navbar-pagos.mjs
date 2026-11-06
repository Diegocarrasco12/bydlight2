// Capturas del navbar con la insignia de pago seguro (vista previa local, http://localhost:3100) + pruebas de menu movil y ancla.
// Salida: docs/evidencias-pagos-navbar/<ancho>/*.png
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
const { chromium } = createRequire("C:/Users/dcarrasco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/x.js")("playwright-core")
const BASE = "http://localhost:3100"
const OUT = new URL("../../docs/evidencias-pagos-navbar/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const b = await chromium.launch({ executablePath: "C:/Users/dcarrasco/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe" })
const rep = []
for (const [w, h] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]]) {
  const dir = `${OUT}${w}/`; mkdirSync(dir, { recursive: true })
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  await page.addStyleTag({ content: "" }).catch(() => {})
  await page.goto(BASE + "/planes", { waitUntil: "load" })
  await page.addStyleTag({ content: ".pv-bar{display:none!important}" })
  await page.waitForTimeout(600)
  const hdr = page.locator("header.bd-header")
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { x: Math.round(q.left), r: Math.round(q.right), w: Math.round(q.width), h: Math.round(q.height), vis: e.offsetParent !== null } }
    const hd = document.querySelector(".bd-header-inner").getBoundingClientRect()
    const img = document.querySelector(".nb-pay-bar img"), a = document.querySelector(".nb-pay-bar")
    return { headerH: Math.round(hd.height), logo: r(".bd-logo"), nav: r(".bd-nav"), pay: r(".nb-pay-bar"), cta: r(".bd-header-cta"), burger: r(".bd-burger"), ov: document.documentElement.scrollWidth - innerWidth, imgOk: img ? img.complete && img.naturalWidth > 0 : null, label: a?.getAttribute("aria-label") }
  })
  const els = ["logo", "nav", "pay", "cta", "burger"].map((k) => m[k]).filter((e) => e && e.vis).sort((p, q) => p.x - q.x)
  let overlap = false; for (let i = 1; i < els.length; i++) if (els[i].x < els[i - 1].r) overlap = true
  rep.push(`${w}px altura=${m.headerH} desborde=${m.ov} solape=${overlap} img=${m.imgOk} pay=${JSON.stringify(m.pay)} logo=${JSON.stringify(m.logo)}`)
  await hdr.screenshot({ path: `${dir}navbar-inicial.png` })
  await page.evaluate(() => scrollTo(0, 600)); await page.waitForTimeout(500)
  await page.screenshot({ path: `${dir}navbar-sticky.png`, clip: { x: 0, y: 0, width: w, height: 90 } })
  if (w <= 900) {
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator(".bd-burger").click(); await page.waitForTimeout(900)
    await page.screenshot({ path: `${dir}menu-movil-abierto.png` })
    const sheetBadge = await page.locator(".nb-pay-sheet").isVisible()
    rep.push(`  menu abierto: insignia visible=${sheetBadge} aria-expanded=${await page.locator(".bd-burger").getAttribute("aria-expanded")}`)
    await page.locator(".nb-pay-sheet").click(); await page.waitForTimeout(3500)
    rep.push(`  ancla desde menu: url=${page.url()} menuCerrado=${(await page.locator(".bd-burger").getAttribute("aria-expanded")) === "false"}`)
  } else {
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator(".nb-pay-bar").click(); await page.waitForTimeout(3500)
    rep.push(`  ancla: url=${page.url()}`)
  }
  const sp = await page.evaluate(() => { const e = document.querySelector("#pagos-seguros"); if (!e) return null; const t = e.getBoundingClientRect().top; return Math.round(t) })
  rep.push(`  seccion #pagos-seguros top=${sp} (debe quedar bajo la barra, >= 56)`)
  await page.screenshot({ path: `${dir}tras-ancla.png` })
  await page.keyboard.press("Tab")
  if (w <= 900) { await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(500); await page.screenshot({ path: `${dir}menu-movil-cerrado.png`, clip: { x: 0, y: 0, width: w, height: 90 } }) }
}
await b.close()
console.log(rep.join("\n"))
