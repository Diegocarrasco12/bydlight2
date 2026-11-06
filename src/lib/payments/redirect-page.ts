import "server-only"
import { SITE } from "@/lib/site"

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const CSS = `
*{box-sizing:border-box}
body{background:#08090b;color:#f1f2f4;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;line-height:1.55}
.card{width:100%;max-width:440px;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:36px 28px 30px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));display:grid;gap:14px;justify-items:center}
img{margin:-34px 0 -26px}
h1{margin:0;font-size:1.2rem;font-weight:600;letter-spacing:-.01em}
p{margin:0;color:#a1a5b0;font-size:.93rem}
.lock{display:inline-flex;align-items:center;gap:8px;color:#a1a5b0;font-size:.82rem;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:6px 14px}
.spin{width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.12);border-top-color:#ff8a3d;animation:r 0.9s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none;border-top-color:rgba(255,255,255,.12);border-right-color:#ff8a3d}}
.btn{display:inline-block;margin-top:6px;padding:12px 22px;border:0;border-radius:10px;background:#ff8a3d;color:#1a0d02;font-weight:700;cursor:pointer;text-decoration:none;font-size:.95rem}
.tag{font-family:ui-monospace,monospace;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:#ffab70;border:1px dashed rgba(255,171,112,.6);border-radius:8px;padding:6px 10px}
`

const LOCK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`

function shell(body: string) {
  return `<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Redirigiendo a Webpay…</title><style>${CSS}</style></head><body>${body}</body></html>`
}

/** Pantalla de redireccion a Webpay Plus: el navegador envia token_ws por POST (formulario auto-enviado). */
export function redirectToWebpayHtml(opts: { url: string; token: string; amountLabel?: string }) {
  return shell(`<form id="f" class="card" method="post" action="${esc(opts.url)}"><input type="hidden" name="token_ws" value="${esc(opts.token)}">
<img src="${esc(SITE.logoSmall)}" alt="${esc(SITE.name)}" width="150" height="150">
<div class="spin" role="progressbar" aria-label="Redirigiendo"></div>
<h1>Te llevamos a Webpay Plus para completar el pago</h1>
${opts.amountLabel ? `<p>Monto a pagar: <strong style="color:#f1f2f4">${esc(opts.amountLabel)}</strong></p>` : ""}
<span class="lock">${LOCK} Conexión segura con Transbank</span>
<p>Los datos de tu tarjeta se ingresan en el sitio de Webpay. No cierres esta ventana.</p>
<noscript><button type="submit" class="btn">Continuar a Webpay</button></noscript></form>
<script>document.getElementById("f").submit()</script>`)
}

/** Pantalla de SIMULACION (vista previa local): no envia nada a Transbank. */
export function redirectPreviewHtml(opts: { backHref: string; amountLabel?: string }) {
  return shell(`<div class="card">
<img src="${esc(SITE.logoSmall)}" alt="${esc(SITE.name)}" width="150" height="150">
<span class="tag">Vista previa · simulación</span>
<h1>Aquí el cliente sería llevado a Webpay Plus</h1>
${opts.amountLabel ? `<p>Monto a pagar: <strong style="color:#f1f2f4">${esc(opts.amountLabel)}</strong></p>` : ""}
<p>En la vista previa no se contacta a Transbank ni se realiza ningún cobro. El formulario de pago real lo aloja Transbank y no forma parte de este diseño.</p>
<a class="btn" href="${esc(opts.backHref)}">Volver a la vista previa</a></div>`)
}
