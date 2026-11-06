// Capturas de paginas legales, pie y contacto (vista previa local en :3100) + desbordes y enlaces internos. Salida: docs/evidencias-legal/<ancho>/
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
const { chromium } = createRequire("C:/Users/dcarrasco/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/x.js")("playwright-core")
const BASE = "http://localhost:3100"
const OUT = new URL("../../docs/evidencias-legal/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const PAGES = ["/legal", "/terminos", "/privacidad", "/devoluciones", "/soporte", "/servicios-digitales", "/informacion-comercial", "/contacto"]
const b = await chromium.launch({ executablePath: "C:/Users/dcarrasco/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe" })
const rep = [], links = new Set()
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [320, 640]]) {
  const dir = `${OUT}${w}/`; mkdirSync(dir, { recursive: true })
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  for (const p of PAGES) {
    const r = await page.goto(BASE + p, { waitUntil: "load" })
    await page.addStyleTag({ content: ".rv{opacity:1!important;transform:none!important}.pv-bar,.bd-dock{display:none!important}" })
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => ({ ov: document.documentElement.scrollWidth - innerWidth, pend: /\[PENDIENTE/.test(document.body.innerText), rut: document.body.innerText.includes("78.161.844-6"), hrefs: [...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href").split("#")[0]) }))
    m.hrefs.forEach((x) => links.add(x))
    rep.push(`${w}px ${p} http=${r.status()} desborde=${m.ov} pendiente=${m.pend} rut=${m.rut}${m.ov > 0 || m.pend || r.status() !== 200 ? " <<<" : ""}`)
    if (w === 1440 || w === 390) await page.screenshot({ path: `${dir}${p.replace(/\//g, "") || "home"}.png`, fullPage: true })
  }
  await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(500)
  const f = page.locator("footer").first(); await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
  await f.screenshot({ path: `${dir}footer.png` })
}
for (const l of [...links].filter((x) => x && !x.startsWith("/_next") && !/\.(png|jpg|svg|webp|ico|css|js)$/.test(x))) {
  const r = await fetch(BASE + l).catch(() => ({ status: 0 }))
  rep.push(`enlace ${l} -> ${r.status}${r.status >= 400 || r.status === 0 ? " <<<" : ""}`)
}
await b.close(); console.log(rep.join("\n"))
