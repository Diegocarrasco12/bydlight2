import Link from "next/link"
import {
  COMPARISON_ROWS,
  MAINTENANCE,
  PLANS,
  PLAN_RULES,
  IVA_LABEL,
  PRICE_NOTE,
  planHref,
  planWhatsappMessage,
} from "@/lib/plans"
import { SERVICES } from "@/lib/services"
import { whatsappLink } from "@/lib/site"

export function ServicesGrid() {
  return (
    <section className="bd-section bd-section-alt" aria-labelledby="services-title">
      <div className="bd-container">
        <div className="bd-head">
          <span className="bd-eyebrow">Servicios</span>
          <h2 id="services-title" className="bd-h2">Soluciones digitales para empresas</h2>
        </div>
        <div className="bd-services">
          {SERVICES.map((s) => (
            <Link key={s.slug} href={`/servicios/${s.slug}`} prefetch={false} className="bd-service">
              <h3>{s.name}</h3>
              <p>{s.short}</p>
              <span className="more">Ver detalle →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PlansGrid({ headingLevel = "h2", showHead = true }: { headingLevel?: "h1" | "h2"; showHead?: boolean }) {
  const Heading = headingLevel
  const custom = PLANS.find((p) => p.priceFrom === null)
  return (
    <section className="bd-section" id="planes" aria-labelledby={showHead ? "plans-title" : undefined} aria-label={showHead ? undefined : "Planes y precios"}>
      <div className="bd-container">
        {showHead && (
          <div className="bd-head center">
          <span className="bd-eyebrow">Planes y precios</span>
          <Heading id="plans-title" className="bd-h2">Elige el plan que se ajusta a tu proyecto</Heading>
          <p className="bd-lead">
            Cada plan indica qué incluye, cuántas páginas y revisiones tiene y qué queda fuera. Sin sorpresas.
          </p>
        </div>
        )}

        <div className="bd-plans">
          {PLANS.filter((p) => p.priceFrom !== null).map((p) => (
            <article key={p.id} className={`bd-plan${p.recommended ? " recommended" : ""}`}>
              {p.recommended && <span className="bd-badge">Recomendado</span>}
              <h3>{p.name}</h3>
              <p className="tag">{p.tagline}</p>
              <div className="bd-price">
                {p.priceFrom !== null && <small>Desde</small>}
                <strong className={p.priceFrom === null ? "small" : undefined}>{p.priceLabel}</strong>
                {p.priceFrom !== null && <span className="iva">{IVA_LABEL}</span>}
              </div>
              <ul className="feat">
                {p.includes.slice(0, 5).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <div className="meta">
                <span>Páginas: {p.limits.pages}</span>
                <span>Plazo: {p.limits.delivery}</span>
                <span>Revisiones: {p.limits.revisions}</span>
              </div>
              <div className="actions">
                <Link
                  href={planHref(p.id)}
                  prefetch={false}
                  className={`bd-btn bd-btn-block ${p.recommended ? "bd-btn-primary" : "bd-btn-ghost"}`}
                >
                  Solicitar este plan
                </Link>
                <a
                  href={whatsappLink(planWhatsappMessage(p))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bd-textlink"
                >
                  Consultar por WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>
        {custom && (
          <article className="bd-custom">
            <div>
              <span className="bd-line-tag">Ingeniería y software a medida</span>
              <h3>{custom.name}</h3>
              <p>{custom.tagline} Sistemas empresariales, plataformas, APIs, automatización y arquitectura de software.</p>
            </div>
            <div className="bd-custom-side">
              <strong>{custom.priceLabel}</strong>
              <Link href={planHref("software")} prefetch={false} className="bd-btn bd-btn-ghost">
                Cotizar proyecto
              </Link>
            </div>
          </article>
        )}
        <p className="bd-note">{PRICE_NOTE} Hosting y dominio se contratan aparte.</p>
      </div>
    </section>
  )
}

export function PlanComparison() {
  const core = PLANS.filter((p) => p.id !== "software")
  return (
    <section className="bd-section bd-section-alt" id="comparativa" aria-labelledby="compare-title">
      <div className="bd-container">
        <div className="bd-head">
          <span className="bd-eyebrow">Comparativa</span>
          <h2 id="compare-title" className="bd-h2">Qué incluye cada plan web</h2>
        </div>
        <div className="bd-table-wrap" role="region" aria-label="Comparativa de planes" tabIndex={0}>
          <table className="bd-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Característica</span></th>
                {core.map((p) => (
                  <th key={p.id} scope="col" className={p.recommended ? "rec" : undefined}>
                    {p.name}
                    {p.recommended ? " (recomendado)" : ""}
                    <br />
                    <small>Desde {p.priceLabel} {IVA_LABEL}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {core.map((p) => (
                    <td key={p.id} className={p.recommended ? "rec" : undefined}>{p.limits[row.key]}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Qué entregas tú</th>
                {core.map((p) => (
                  <td key={p.id} className={p.recommended ? "rec" : undefined}>{p.clientProvides.join(", ")}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">No incluido</th>
                {core.map((p) => (
                  <td key={p.id} className={p.recommended ? "rec" : undefined}>{p.excluded.join("; ")}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function MaintenanceBlock() {
  return (
    <section className="bd-section" id="mantenimiento" aria-labelledby="maint-title">
      <div className="bd-container">
        <div className="bd-head">
          <span className="bd-eyebrow">Opcional</span>
          <h2 id="maint-title" className="bd-h2">Mantenimiento mensual</h2>
          <p className="bd-lead">
            Mantenimiento, hosting, dominio y desarrollo adicional son servicios distintos. El mantenimiento cuida tu sitio
            después de entregado; no incluye soporte 24/7.
          </p>
        </div>
        <div className="bd-two">
          {MAINTENANCE.map((m) => (
            <article key={m.id} className="bd-maint">
              <h3>{m.name}</h3>
              <div className="bd-price"><small>Desde</small><strong>{m.priceLabel}</strong><span className="iva">{IVA_LABEL}</span></div>
              <ul className="inc">{m.includes.map((i) => <li key={i}>{i}</li>)}</ul>
              <h4>No incluye</h4>
              <ul className="exc">{m.excluded.map((i) => <li key={i}>{i}</li>)}</ul>
            </article>
          ))}
        </div>
        <ul className="bd-rules">
          {PLAN_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>
    </section>
  )
}

export function Faq({ items, title = "Preguntas frecuentes" }: { items: { q: string; a: string }[]; title?: string }) {
  return (
    <section className="bd-section bd-section-alt" aria-labelledby="faq-title">
      <div className="bd-container">
        <div className="bd-head center">
          <span className="bd-eyebrow">FAQ</span>
          <h2 id="faq-title" className="bd-h2">{title}</h2>
        </div>
        <div className="bd-faq">
          {items.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCta({ title = "¿Tienes un proyecto en mente?" }: { title?: string }) {
  return (
    <section className="bd-section">
      <div className="bd-container">
        <div className="bd-cta">
          <h2>{title}</h2>
          <p>Cuéntanos qué necesitas y te respondemos con una propuesta clara de alcance, plazo y valor.</p>
          <div className="bd-hero-actions">
            <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary">Solicitar cotización</Link>
            <a
              href={whatsappLink("Hola, quisiera conversar sobre un proyecto.")}
              target="_blank"
              rel="noopener noreferrer"
              className="bd-btn bd-btn-ghost"
            >
              Escribir por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
