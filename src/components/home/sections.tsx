import Link from "next/link"
import {
  COMPARISON_ROWS,
  MAINTENANCE,
  PLANS,
  PLAN_RULES,
  PRICE_NOTE,
  planWhatsappMessage,
} from "@/lib/plans"
import { SERVICES } from "@/lib/services"
import { OTHERS } from "@/lib/portfolio"
import { whatsappLink } from "@/lib/site"
import { PortfolioFeatured, PortfolioGrid } from "@/components/portfolio/Portfolio"

export function HomeHero() {
  return (
    <section className="bd-hero" aria-labelledby="hero-title">
      <div className="bd-container bd-hero-grid">
        <div>
          <span className="bd-eyebrow bd-rise">Desarrollo web y software en Chile</span>
          <h1 id="hero-title" className="bd-rise d2">
            Páginas web y <span>software a medida</span> para hacer crecer tu negocio
          </h1>
          <p className="sub bd-rise d3">
            Sitios web con precio y alcance claros para emprendedores y pymes. Sistemas empresariales, integraciones y
            arquitectura de software para proyectos de mayor complejidad.
          </p>
          <div className="bd-hero-actions bd-rise d3">
            <Link href="/planes" prefetch={false} className="bd-btn bd-btn-primary">
              Ver planes y precios
            </Link>
            <a
              href={whatsappLink("Hola, quisiera cotizar un proyecto con Byd Light Solutions.")}
              target="_blank"
              rel="noopener noreferrer"
              className="bd-btn bd-btn-ghost"
            >
              Cotizar por WhatsApp
            </a>
          </div>
          <ul className="bd-chips">
            <li>Diseño responsive</li>
            <li>SEO base incluido</li>
            <li>Alcance y plazos por escrito</li>
          </ul>
        </div>

        <aside className="bd-quote bd-rise d3" aria-label="Precios de referencia">
          <h2>Cuánto puede costar</h2>
          <ul>
            <li><span>Landing page</span><strong>Desde $149.990</strong></li>
            <li><span>Web profesional</span><strong>Desde $299.990</strong></li>
            <li><span>Ecommerce</span><strong>Desde $699.990</strong></li>
            <li><span>Software a medida</span><strong>Cotización</strong></li>
          </ul>
          <small>{PRICE_NOTE}</small>
        </aside>
      </div>
    </section>
  )
}

export function TwoLines() {
  return (
    <section className="bd-section" aria-labelledby="lines-title">
      <div className="bd-container">
        <div className="bd-head center">
          <span className="bd-eyebrow">Qué hacemos</span>
          <h2 id="lines-title" className="bd-h2">Dos líneas de trabajo, según lo que necesites</h2>
          <p className="bd-lead">
            Soluciones estandarizadas con precio definido, y proyectos de ingeniería con cotización personalizada.
          </p>
        </div>

        <div className="bd-lines">
          <article className="bd-line-card">
            <span className="bd-line-tag">Desarrollo web</span>
            <h3>Sitios web y tiendas con alcance definido</h3>
            <p>Planes cerrados con páginas, revisiones y plazos claros desde el primer día.</p>
            <ul>
              <li>Landing pages y sitios corporativos</li>
              <li>Tiendas online</li>
              <li>SEO base y mantenimiento mensual</li>
            </ul>
            <Link href="/planes" prefetch={false} className="bd-btn bd-btn-primary">Ver planes web</Link>
          </article>

          <article className="bd-line-card">
            <span className="bd-line-tag">Ingeniería y software a medida</span>
            <h3>Sistemas y plataformas para tu operación</h3>
            <p>Proyectos más complejos, diseñados y cotizados según tu proceso y tus sistemas.</p>
            <ul>
              <li>Sistemas empresariales y plataformas web</li>
              <li>Integraciones y APIs</li>
              <li>Automatización y arquitectura de software</li>
            </ul>
            <Link href="/servicios/software-a-medida" prefetch={false} className="bd-btn bd-btn-ghost">Conocer el servicio</Link>
          </article>
        </div>
      </div>
    </section>
  )
}

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

export function PlansGrid({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel
  const custom = PLANS.find((p) => p.priceFrom === null)
  return (
    <section className="bd-section" id="planes" aria-labelledby="plans-title">
      <div className="bd-container">
        <div className="bd-head center">
          <span className="bd-eyebrow">Planes y precios</span>
          <Heading id="plans-title" className="bd-h2">Elige el plan que se ajusta a tu proyecto</Heading>
          <p className="bd-lead">
            Cada plan indica qué incluye, cuántas páginas y revisiones tiene y qué queda fuera. Sin sorpresas.
          </p>
        </div>

        <div className="bd-plans">
          {PLANS.filter((p) => p.priceFrom !== null).map((p) => (
            <article key={p.id} className={`bd-plan${p.recommended ? " recommended" : ""}`}>
              {p.recommended && <span className="bd-badge">Recomendado</span>}
              <h3>{p.name}</h3>
              <p className="tag">{p.tagline}</p>
              <div className="bd-price">
                {p.priceFrom !== null && <small>Desde</small>}
                <strong className={p.priceFrom === null ? "small" : undefined}>{p.priceLabel}</strong>
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
                  href={`/contratar?plan=${p.id}`}
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
              <Link href="/contratar?plan=software" prefetch={false} className="bd-btn bd-btn-ghost">
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
                    <small>Desde {p.priceLabel}</small>
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
              <div className="bd-price"><small>Desde</small><strong>{m.priceLabel}</strong></div>
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

export function PortfolioPreview() {
  return (
    <section className="bd-section bd-section-alt" aria-labelledby="projects-title">
      <div className="bd-container">
        <div className="bd-head">
          <span className="bd-eyebrow">Portafolio</span>
          <h2 id="projects-title" className="bd-h2">Proyectos reales en producción</h2>
          <p className="bd-lead">Tiendas, plataformas y sitios que hemos desarrollado. Puedes visitarlos y revisarlos tú mismo.</p>
        </div>
        <PortfolioFeatured compact />
        <PortfolioGrid projects={OTHERS.slice(0, 3)} />
        <p className="bd-note">
          <Link href="/proyectos" prefetch={false} className="bd-btn bd-btn-ghost">Ver portafolio completo</Link>
        </p>
      </div>
    </section>
  )
}

export function ProcessSteps() {
  const steps = [
    ["Análisis", "Entendemos tu negocio y definimos el alcance antes de proponer una solución."],
    ["Diseño", "Definimos la estructura, el diseño y las tecnologías adecuadas para tu caso."],
    ["Desarrollo", "Construimos por etapas, con revisiones y pruebas durante el proceso."],
    ["Entrega y mejora", "Publicamos, te acompañamos en la puesta en marcha y, si quieres, seguimos mejorando."],
  ]
  return (
    <section className="bd-section" aria-labelledby="process-title">
      <div className="bd-container">
        <div className="bd-head center">
          <span className="bd-eyebrow">Cómo trabajamos</span>
          <h2 id="process-title" className="bd-h2">Un proceso claro, de la idea a la entrega</h2>
        </div>
        <ol className="bd-steps">
          {steps.map(([t, d]) => (
            <li key={t}><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
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
