"use client"

// Imprime o guarda como PDF el comprobante con el dialogo del navegador. Solo existe en el cliente; no envia datos.
export default function PrintButton({ label = "Imprimir comprobante" }: { label?: string }) {
  return (
    <button type="button" className="bd-btn bd-btn-ghost bd-no-print" onClick={() => window.print()}>
      {label}
    </button>
  )
}
