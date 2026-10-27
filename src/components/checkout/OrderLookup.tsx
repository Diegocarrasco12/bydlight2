"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function OrderLookup() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!/^[A-Z2-9]{12}$/.test(c)) {
      setError("El código tiene 12 caracteres (letras y números).")
      return
    }
    router.push(`/orden/${c}`)
  }

  return (
    <form className="bd-form" onSubmit={onSubmit} noValidate>
      <div className="bd-field">
        <label htmlFor="code">Código de tu orden</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={14} autoComplete="off" placeholder="Ej.: K7M2Q9XR4TBA" />
      </div>
      {error && <p className="bd-error" role="alert">{error}</p>}
      <button type="submit" className="bd-btn bd-btn-primary">Consultar estado</button>
    </form>
  )
}
