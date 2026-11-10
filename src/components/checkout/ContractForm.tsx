"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RETRACTO_NOTICE } from "@/lib/legal"

type PlanOption = { id: string; name: string; priceLabel: string; fixed: boolean }

export default function ContractForm({ plans, initialPlan, termsVersion, legalLinks }: { plans: PlanOption[]; initialPlan: string; termsVersion: string; legalLinks: boolean }) {
  const router = useRouter()
  const [planId, setPlanId] = useState(initialPlan)
  const [customerType, setCustomerType] = useState<"persona" | "empresa">("persona")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setBusy(true)
    const f = new FormData(e.currentTarget)
    const body = {
      planId,
      name: f.get("name"),
      email: f.get("email"),
      phone: f.get("phone"),
      customerType,
      company: customerType === "empresa" ? f.get("company") : "",
      taxId: customerType === "empresa" ? f.get("taxId") : "",
      giro: customerType === "empresa" ? f.get("giro") : "",
      address: customerType === "empresa" ? f.get("address") : "",
      message: f.get("message"),
      accept: f.get("accept") === "on",
      acceptTerms: f.get("acceptTerms") === "on",
      termsVersion,
      website: f.get("website"),
    }
    try {
      const res = await fetch("/api/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "No pudimos enviar la solicitud. Intenta nuevamente.")
        setBusy(false)
        return
      }
      router.push(`/orden/${data.id}?aviso=creada`)
    } catch {
      setError("No pudimos conectar. Revisa tu conexión e intenta nuevamente.")
      setBusy(false)
    }
  }

  const selected = plans.find((p) => p.id === planId)

  return (
    // method/action explicitos: si el JavaScript aun no cargo (o fallo), el navegador NO debe enviar por GET (nombre,
    // correo y mensaje irian en la URL, historial y registros). Con POST los datos viajan en el cuerpo; sin JS el
    // endpoint responde con error y no crea nada (solo acepta JSON).
    <form className="bd-form" method="post" action="/api/solicitudes" onSubmit={onSubmit} noValidate>
      <div className="bd-field">
        <label htmlFor="plan">Plan</label>
        <select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.fixed ? `desde ${p.priceLabel}, IVA incluido` : p.priceLabel}
            </option>
          ))}
        </select>
        {selected && <small>El valor final se confirma en la cotización, una vez revisados tus requisitos.</small>}
      </div>

      <div className="bd-field-row">
        <div className="bd-field">
          <label htmlFor="name">Nombre</label>
          <input id="name" name="name" autoComplete="name" required maxLength={80} />
        </div>
        <div className="bd-field">
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={120} />
        </div>
      </div>

      <fieldset className="bd-field bd-type">
        <legend>Contratas como</legend>
        <label className="bd-check">
          <input type="radio" name="customerType" value="persona" checked={customerType === "persona"} onChange={() => setCustomerType("persona")} />
          <span>Persona natural</span>
        </label>
        <label className="bd-check">
          <input type="radio" name="customerType" value="empresa" checked={customerType === "empresa"} onChange={() => setCustomerType("empresa")} />
          <span>Empresa</span>
        </label>
      </fieldset>

      <div className="bd-field">
        <label htmlFor="phone">Teléfono (opcional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
      </div>

      {customerType === "empresa" && (
        <>
          <div className="bd-field-row">
            <div className="bd-field">
              <label htmlFor="company">Razón social</label>
              <input id="company" name="company" autoComplete="organization" required maxLength={80} />
            </div>
            <div className="bd-field">
              <label htmlFor="taxId">RUT de la empresa</label>
              <input id="taxId" name="taxId" inputMode="text" placeholder="76.123.456-7" required maxLength={20} />
            </div>
          </div>
          <div className="bd-field-row">
            <div className="bd-field">
              <label htmlFor="giro">Giro (opcional)</label>
              <input id="giro" name="giro" maxLength={80} />
            </div>
            <div className="bd-field">
              <label htmlFor="address">Dirección tributaria (opcional)</label>
              <input id="address" name="address" autoComplete="street-address" maxLength={120} />
            </div>
          </div>
          <small>Usaremos estos datos solo para emitir el documento tributario que corresponda. Si algo falta, te lo pediremos después.</small>
        </>
      )}

      <div className="bd-field">
        <label htmlFor="message">Cuéntanos qué necesitas</label>
        <textarea id="message" name="message" rows={5} required minLength={10} maxLength={1500} />
      </div>

      {/* Campo trampa para bots: oculto a personas */}
      <div className="bd-trap" aria-hidden="true">
        <label htmlFor="website">No completar</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="bd-check">
        <input type="checkbox" name="accept" required />
        <span>
          Entiendo que esto es una <strong>solicitud</strong>: Bydlight revisará requisitos y disponibilidad y me
          enviará una cotización. El pago del anticipo solo se habilita una vez aprobada la cotización.
        </span>
      </label>

      <p className="bd-note left" id="retracto-aviso">{RETRACTO_NOTICE} <a href="/devoluciones" target="_blank" rel="noopener">Ver cómo ejercerlo</a>.</p>
      <label className="bd-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          {legalLinks ? (
            <>Acepto los <a href="/terminos" target="_blank" rel="noopener">términos de contratación</a>, la <a href="/devoluciones" target="_blank" rel="noopener">política de cancelación y devoluciones</a> y la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a>.</>
          ) : (
            <>Acepto los términos de contratación, la política de cancelación y devoluciones y la política de privacidad.</>
          )}
        </span>
      </label>

      {error && <p className="bd-error" role="alert">{error}</p>}

      <button type="submit" className="bd-btn bd-btn-primary" disabled={busy}>
        {busy ? "Enviando…" : "Solicitar este plan"}
      </button>
    </form>
  )
}
