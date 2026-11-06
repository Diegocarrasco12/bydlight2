"use client"

import { useEffect, useSyncExternalStore } from "react"

/**
 * Selector LOCAL de la propuesta visual de pagos (A/B/C). Solo se monta desde PreviewBar (vista previa, nunca en produccion).
 * La eleccion vive en html[data-pay] (la lee el CSS), se recuerda en sessionStorage y acepta ?pay=a|b|c.
 */
const OPTS = [
  { v: "a", label: "A", title: "A · Premium minimalista" },
  { v: "b", label: "B", title: "B · Confianza tecnológica" },
  { v: "c", label: "C", title: "C · Signature Payments" },
] as const

const valid = (x: string | null | undefined): x is "a" | "b" | "c" => x === "a" || x === "b" || x === "c"

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pay"] })
  return () => mo.disconnect()
}
const snapshot = () => document.documentElement.getAttribute("data-pay") ?? "c"

function choose(v: string) {
  document.documentElement.setAttribute("data-pay", v)
  try { sessionStorage.setItem("bd-pay", v) } catch { /* sin almacenamiento: no se recuerda */ }
}

export default function PayVariantSwitch() {
  const v = useSyncExternalStore(subscribe, snapshot, () => "c")
  useEffect(() => {
    let q: string | null = null
    let s: string | null = null
    try { q = new URLSearchParams(window.location.search).get("pay"); s = sessionStorage.getItem("bd-pay") } catch { /* idem */ }
    choose([q, s].find(valid) ?? "c")
  }, [])
  return (
    <span className="pv-pay" role="group" aria-label="Propuesta visual de pagos">
      <span className="pv-pay-l">Pagos</span>
      {OPTS.map((o) => (
        <button key={o.v} type="button" title={o.title} aria-label={o.title} aria-pressed={v === o.v} onClick={() => choose(o.v)}>{o.label}</button>
      ))}
    </span>
  )
}
