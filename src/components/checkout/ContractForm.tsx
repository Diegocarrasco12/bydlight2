"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type PlanOption = { id: string; name: string; priceLabel: string; fixed: boolean }

export default function ContractForm({ plans, initialPlan }: { plans: PlanOption[]; initialPlan: string }) {
  const router = useRouter()
  const [planId, setPlanId] = useState(initialPlan)
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
      company: f.get("company"),
      message: f.get("message"),
      accept: f.get("accept") === "on",
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
    <form className="bd-form" onSubmit={onSubmit} noValidate>
      <div className="bd-field">
        <label htmlFor="plan">Plan</label>
        <select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.fixed ? `desde ${p.priceLabel} + IVA` : p.priceLabel}
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

      <div className="bd-field-row">
        <div className="bd-field">
          <label htmlFor="phone">Teléfono (opcional)</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
        </div>
        <div className="bd-field">
          <label htmlFor="company">Empresa (opcional)</label>
          <input id="company" name="company" autoComplete="organization" maxLength={80} />
        </div>
      </div>

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

      {error && <p className="bd-error" role="alert">{error}</p>}

      <button type="submit" className="bd-btn bd-btn-primary" disabled={busy}>
        {busy ? "Enviando…" : "Solicitar este plan"}
      </button>
    </form>
  )
}
