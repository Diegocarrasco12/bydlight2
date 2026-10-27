import Link from "next/link"
import { DESKTOP_DEMO, FEATURED, OTHERS, type Project } from "@/lib/portfolio"

function Tech({ tech }: { tech: string[] }) {
  if (!tech.length) return null
  return (
    <ul className="bd-tags" aria-label="Tecnologías verificadas">
      {tech.map((t) => <li key={t}>{t}</li>)}
    </ul>
  )
}

export function PortfolioFeatured({ project = FEATURED, compact = false }: { project?: Project; compact?: boolean }) {
  const [main, ...rest] = project.images
  return (
    <article className="bd-feature" aria-labelledby={`pf-${project.slug}`}>
      <div className="bd-feature-media">
        <img src={main.src} alt={main.alt} width={main.width} height={main.height} loading="lazy" decoding="async" />
        {!compact && rest.length > 0 && (
          <div className="bd-thumbs">
            {rest.map((i) => (
              <img key={i.src} src={i.src} alt={i.alt} width={i.width} height={i.height} loading="lazy" decoding="async" />
            ))}
          </div>
        )}
      </div>
      <div className="bd-feature-body">
        <span className="bd-badge-inline">Proyecto destacado · {project.kind}</span>
        <h3 id={`pf-${project.slug}`}>{project.name}</h3>
        <p>{project.summary}</p>
        {!compact && (
          <ul className="bd-checks">
            {project.verified.map((v) => <li key={v}>{v}</li>)}
          </ul>
        )}
        <Tech tech={project.tech} />
        {project.url && (
          <a href={project.url} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-primary">
            Visitar sitio
          </a>
        )}
      </div>
    </article>
  )
}

export function PortfolioCard({ project }: { project: Project }) {
  const i = project.images[0]
  return (
    <article className="bd-pcard">
      <div className="bd-pcard-media">
        <img src={i.src} alt={i.alt} width={i.width} height={i.height} loading="lazy" decoding="async" />
        {project.demo && <span className="bd-ribbon">Demo propia · datos ficticios</span>}
      </div>
      <div className="bd-pcard-body">
        <span className="kind">{project.kind}</span>
        <h3>{project.name}</h3>
        <p>{project.summary}</p>
        <Tech tech={project.tech} />
        {project.url && (
          <a href={project.url} target="_blank" rel="noopener noreferrer" className="go">
            Ver proyecto →
          </a>
        )}
      </div>
    </article>
  )
}

export function PortfolioGrid({ projects = OTHERS }: { projects?: Project[] }) {
  return (
    <div className="bd-pgrid">
      {projects.map((p) => <PortfolioCard key={p.slug} project={p} />)}
    </div>
  )
}

export function DesktopShowcase() {
  const p = DESKTOP_DEMO
  const i = p.images[0]
  return (
    <section className="bd-section" aria-labelledby="desktop-title">
      <div className="bd-container bd-desktop">
        <div>
          <span className="bd-eyebrow">Software de escritorio</span>
          <h2 id="desktop-title" className="bd-h2">Aplicaciones para Windows con C# y .NET</h2>
          <p className="bd-lead">
            Además de sitios y plataformas web, desarrollamos aplicaciones de escritorio para Windows: gestión,
            inventario, administración y herramientas internas.
          </p>
          <ul className="bd-checks">
            {p.verified.map((v) => <li key={v}>{v}</li>)}
          </ul>
          <Tech tech={p.tech} />
          <p className="bd-note" style={{ textAlign: "left" }}>
            La imagen es una aplicación de demostración creada por Byd Light con datos ficticios; no corresponde a un
            proyecto de un cliente.
          </p>
          <Link href="/servicios/software-a-medida" prefetch={false} className="bd-btn bd-btn-ghost">
            Conocer el servicio
          </Link>
        </div>
        <figure className="bd-desktop-shot">
          <img src={i.src} alt={i.alt} width={i.width} height={i.height} loading="lazy" decoding="async" />
          <figcaption>Demostración propia · datos ficticios</figcaption>
        </figure>
      </div>
    </section>
  )
}
