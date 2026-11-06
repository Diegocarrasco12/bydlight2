import { COMPANY } from "@/lib/company"
import { SITE } from "@/lib/site"
import { LEGAL_PAGES_PUBLISHED } from "@/lib/legal"
import { IVA_PERCENT, ivaBreakdown } from "@/lib/tax"
import { buildVoucher, formatClp, formatWhen } from "@/lib/payments/voucher"
import type { Attempt, Order } from "@/lib/payments/types"

// Plantillas de correo (identidad Bydlight Signature: cabecera oscura de marca con acento naranja/azul, tablas y estilos en linea
// para compatibilidad con clientes de correo, ancho fluido <= 600 px). Funciones puras: sin red, sin base de datos.
// Todo texto que viene del cliente se escapa. No se incluyen tokens, credenciales ni el numero completo de la tarjeta.

export type Rendered = { subject: string; html: string; text: string }

const ENT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENT[c])

const INK = "#04060c"
const BLUE = "#2f7bff"
const ORANGE = "#ff7a1a"
const orderUrl = (o: Order) => `${SITE.url}/orden/${o.id}`

type Block = { rows?: [string, string][]; para?: string[]; cta?: { label: string; href: string }; small?: string[] }

function layout(title: string, preheader: string, blocks: Block[]): { html: string; text: string } {
  const body = blocks
    .map((b) => {
      let h = ""
      for (const p of b.para ?? []) h += `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1b2335">${esc(p)}</p>`
      if (b.rows?.length) {
        h += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border-collapse:collapse">`
        for (const [k, v] of b.rows) {
          h += `<tr><td style="padding:8px 0;border-bottom:1px solid #e6eaf2;font-size:13px;color:#5b6682;width:42%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #e6eaf2;font-size:14px;color:#0d1426;font-weight:600;vertical-align:top">${esc(v)}</td></tr>`
        }
        h += `</table>`
      }
      if (b.cta) {
        h += `<p style="margin:8px 0 20px"><a href="${esc(b.cta.href)}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px">${esc(b.cta.label)}</a></p>`
      }
      for (const s of b.small ?? []) h += `<p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:#5b6682">${esc(s)}</p>`
      return h
    })
    .join("")
  const html =
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
    `<body style="margin:0;padding:0;background:#eef1f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">` +
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7"><tr><td align="center" style="padding:20px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">` +
    `<tr><td style="background:${INK};padding:22px 28px;border-bottom:3px solid ${ORANGE}"><img src="${SITE.url}${SITE.logo}" width="40" height="40" alt="" style="vertical-align:middle;border:0;margin-right:10px"><span style="color:#eef3ff;font-size:18px;font-weight:700;vertical-align:middle">${esc(COMPANY.tradeName)}</span></td></tr>` +
    `<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#0d1426">${esc(title)}</h1>${body}</td></tr>` +
    `<tr><td style="background:#f6f8fc;padding:18px 28px;font-size:12px;line-height:1.6;color:#5b6682"><strong style="color:#0d1426">${esc(COMPANY.legalName)}</strong> · RUT ${esc(COMPANY.rut)}<br>${esc(COMPANY.address)}<br>` +
    `<a href="mailto:${SITE.email}" style="color:${BLUE}">${SITE.email}</a> · WhatsApp ${esc(SITE.whatsappDisplay)} · <a href="${SITE.url}" style="color:${BLUE}">${SITE.url.replace("https://", "")}</a><br>` +
    `<span style="color:#8a94ab">Mensaje automático. Si no esperabas este correo, escríbenos y lo revisamos.</span></td></tr>` +
    `</table></td></tr></table></body></html>`
  const text = [
    title,
    "",
    ...blocks.flatMap((b) => [
      ...(b.para ?? []),
      ...(b.rows ?? []).map(([k, v]) => `${k}: ${v}`),
      ...(b.cta ? [`${b.cta.label}: ${b.cta.href}`] : []),
      ...(b.small ?? []),
      "",
    ]),
    `${COMPANY.legalName} · RUT ${COMPANY.rut} · ${COMPANY.address}`,
    `${SITE.email} · ${SITE.whatsappDisplay} · ${SITE.url}`,
  ].join("\n")
  return { html, text }
}

const first = (o: Order) => o.customer.name.split(/\s+/)[0] || "hola"
const legalLinks = (): string[] =>
  LEGAL_PAGES_PUBLISHED
    ? [`Términos de contratación: ${SITE.url}/terminos`, `Cancelación, retracto y devoluciones: ${SITE.url}/devoluciones`, `Política de privacidad: ${SITE.url}/privacidad`]
    : []
const NO_TAX_DOC = "Este correo y el comprobante de pago no reemplazan el documento tributario que corresponda emitir por separado conforme a la normativa del SII."

export function solicitudRecibida(o: Order): Rendered {
  const { html, text } = layout("Recibimos tu solicitud", "Revisaremos tus requisitos y te enviaremos una cotización.", [
    {
      para: [
        `Hola ${first(o)}, recibimos tu solicitud del plan ${o.planName}.`,
        "Esto aún no es una cotización ni un cobro: revisaremos tus requisitos y te enviaremos la cotización con el total (IVA incluido), el anticipo y el saldo. El pago del anticipo solo se habilita una vez aprobada.",
      ],
    },
    { rows: [["Código de tu orden", o.id], ["Plan", o.planName]], cta: { label: "Ver el estado de mi orden", href: orderUrl(o) } },
    { small: ["Guarda el código de tu orden: lo necesitarás para consultar el estado."] },
  ])
  return { subject: `Recibimos tu solicitud (${o.id})`, html, text }
}

export function nuevaSolicitudInterna(o: Order): Rendered {
  const c = o.customer
  const rows: [string, string][] = [
    ["Orden", o.id],
    ["Plan", o.planName],
    ["Tipo", c.type === "empresa" ? "Empresa" : "Persona natural"],
    ["Nombre", c.name],
    ["Correo", c.email],
  ]
  if (c.phone) rows.push(["Teléfono", c.phone])
  if (c.type === "empresa") {
    if (c.company) rows.push(["Razón social", c.company])
    if (c.taxId) rows.push(["RUT empresa", c.taxId])
    if (c.giro) rows.push(["Giro", c.giro])
    if (c.address) rows.push(["Dirección", c.address])
  }
  const { html, text } = layout("Nueva solicitud de cotización", `Orden ${o.id}: ${o.planName}`, [
    { rows, para: [`Mensaje del cliente: ${o.message.slice(0, 600)}`] },
    { small: ["Para cotizar: node scripts/admin-remote.mjs approve <ORDEN> --amount <TOTAL_CON_IVA> (el monto incluye IVA)."] },
  ])
  return { subject: `Nueva solicitud ${o.id} · ${o.planName}`, html, text }
}

export function cotizacionAprobada(o: Order): Rendered | null {
  const q = o.quote
  if (!q) return null
  const iva = ivaBreakdown(q.amount)
  const { html, text } = layout("Tu cotización está lista", `Total ${formatClp(q.amount)} (IVA incluido). Válida hasta ${formatWhen(q.validUntil)}.`, [
    { para: [`Hola ${first(o)}, aprobamos la cotización de tu orden ${o.id} (${o.planName}).`] },
    {
      rows: [
        ["Total (IVA incluido)", formatClp(q.amount)],
        [`IVA incluido (${IVA_PERCENT} %)`, formatClp(iva.iva)],
        [`Anticipo (${q.depositPercent} %)`, formatClp(q.depositAmount)],
        ["Saldo", formatClp(q.balanceAmount)],
        ["Válida hasta", formatWhen(q.validUntil)],
      ],
      cta: { label: "Ver la cotización y pagar el anticipo", href: orderUrl(o) },
      para: q.note ? [`Nota: ${q.note}`] : [],
    },
    { small: ["Montos en pesos chilenos (CLP). El pago se realiza con Webpay Plus de Transbank; los datos de tu tarjeta se ingresan solo en el sitio de Transbank.", NO_TAX_DOC] },
  ])
  return { subject: `Tu cotización ${o.id} · ${formatClp(q.amount)} (IVA incluido)`, html, text }
}

/** Confirmacion escrita de la contratacion (se envia al autorizarse el anticipo). */
export function contratacionConfirmada(o: Order, termsVersion: string, termsAt?: string): Rendered | null {
  const q = o.quote
  if (!q) return null
  const { html, text } = layout("Contratación confirmada", `Confirmamos tu contratación de ${o.planName}.`, [
    { para: [`Hola ${first(o)}, confirmamos por escrito la contratación del servicio ${o.planName}, tras recibir el pago del anticipo.`] },
    {
      rows: [
        ["Proveedor", `${COMPANY.legalName} · RUT ${COMPANY.rut}`],
        ["Orden", o.id],
        ["Servicio", o.planName],
        ["Total (IVA incluido)", formatClp(q.amount)],
        [`Anticipo pagado (${q.depositPercent} %)`, formatClp(q.depositAmount)],
        ["Saldo", formatClp(q.balanceAmount)],
        ["Términos aceptados", termsAt ? `versión ${termsVersion}, el ${formatWhen(termsAt)}` : `versión ${termsVersion}`],
      ],
      cta: { label: "Ver mi orden", href: orderUrl(o) },
    },
    {
      small: [
        "El alcance, entregables, plazos y condiciones específicas de tu proyecto constan en la cotización aceptada y en los términos de contratación indicados.",
        `Si contrataste como consumidor a través de este sitio, puedes ejercer el derecho de retracto que contempla la Ley N° 19.496 en los términos y plazos legales, escribiéndonos a ${SITE.email} con el código de tu orden. Conserva este correo como respaldo.`,
        ...legalLinks(),
        NO_TAX_DOC,
      ],
    },
  ])
  return { subject: `Contratación confirmada · orden ${o.id}`, html, text }
}

export function pagoAutorizado(o: Order, a: Attempt): Rendered | null {
  const v = buildVoucher(o, a)
  if (!v) return null
  const { html, text } = layout(`Pago autorizado: ${formatClp(a.amount)}`, `Recibimos tu pago (${a.kind}). Este es tu comprobante.`, [
    { para: [`Hola ${first(o)}, Transbank autorizó tu pago. Este es tu comprobante.`] },
    { rows: v.rows.map((r) => [r.label, r.value] as [string, string]), cta: { label: "Ver mi orden y el comprobante", href: orderUrl(o) } },
    { small: [NO_TAX_DOC] },
  ])
  return { subject: `Comprobante de pago · orden ${o.id} · ${formatClp(a.amount)}`, html, text }
}

export function pagoRechazado(o: Order, a: Attempt): Rendered {
  const { html, text } = layout("Tu pago no fue autorizado", "No se realizó ningún cargo.", [
    {
      para: [
        `Hola ${first(o)}, el pago de ${formatClp(a.amount)} de tu orden ${o.id} no fue autorizado por el medio de pago. No se realizó ningún cargo por esta operación.`,
        "Puedes reintentar con la misma u otra tarjeta desde la página de tu orden.",
      ],
    },
    { cta: { label: "Reintentar el pago", href: orderUrl(o) } },
  ])
  return { subject: `Pago no autorizado · orden ${o.id}`, html, text }
}

export function saldoHabilitado(o: Order): Rendered | null {
  const q = o.quote
  if (!q) return null
  const { html, text } = layout("Ya puedes pagar el saldo", `Saldo ${formatClp(q.balanceAmount)} (IVA incluido).`, [
    { para: [`Hola ${first(o)}, habilitamos el pago del saldo de tu orden ${o.id}.`] },
    { rows: [["Saldo (IVA incluido)", formatClp(q.balanceAmount)]], cta: { label: "Pagar el saldo", href: orderUrl(o) } },
  ])
  return { subject: `Saldo habilitado · orden ${o.id}`, html, text }
}

export function alertaInterna(title: string, lines: string[]): Rendered {
  const { html, text } = layout(title, title, [{ para: lines }, { small: ["Alerta automática de solo lectura: no se modificó ningún estado."] }])
  return { subject: `[Bydlight] ${title}`, html, text }
}
