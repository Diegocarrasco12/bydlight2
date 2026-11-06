import { webpayAnnounced } from "@/lib/payments/availability"

/** Senal discreta junto a un CTA de contratacion. Solo aparece cuando Webpay se anuncia (vista previa o checkout publico listo). No es un enlace ni cambia el CTA. */
export default function CtaTrust({ className = "" }: { className?: string }) {
  if (!webpayAnnounced()) return null
  return (
    <p className={`cta-trust ${className}`.trim()}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" />
      </svg>
      <span>Solicita tu cotización y paga tu anticipo de forma segura con Webpay Plus.</span>
    </p>
  )
}
