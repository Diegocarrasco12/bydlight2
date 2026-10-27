import Link from "next/link"
import { DESKTOP_DEMO, FEATURED, OTHERS, type Project } from "@/lib/portfolio"
import { AppFrame, BrowserFrame } from "./Frames"

function hostOf(url?: string) {
  if (!url) return ""
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function Tech({ tech }: { tech: string[] }) {
  if (!tech.length) return null
  return (
    <ul className="bd-tags" aria-label="Tecnologías verificadas">
      {tech.map((t) => <li key={t}>{t}</li>)}
    </ul>
  )
}

/** Proyecto protagonista: ventana grande sobre un escenario de luz, con las demas capturas como miniaturas. */
export function ProjectFeature({ project = FEATURED, more = true }: { project?: Project; more?: boolean }) {
  const [main, ...rest] = project.images
  return (
    <article className="pf" aria-labelledby={`pf-${project.slug}`}>
      <div className="pf-stage">
        <BrowserFrame image={main} url={hostOf(project.url)} className="pf-main" />
        {rest.length > 0 && (
          <div className="pf-thumbs" aria-label="Más capturas">
            {rest.map((i, k) => (
              <BrowserFrame key={i.src} image={i} url={hostOf(project.url)} className={`pf-thumb pf-thumb-${k + 1}`} />
            ))}
          </div>
        )}
      </div>
      <div className="pf-body">
        <span className="bd-eyebrow">Proyecto destacado · {project.kind}</span>
        <h3 id={`pf-${project.slug}`}>{project.name}</h3>
        <p>{project.summary}</p>
        <Tech tech={project.tech} />
        <div className="pf-actions">
          <Link href={`/proyectos/${project.slug}`} prefetch={false} className="bd-btn bd-btn-primary">
            Ver el proyecto
          </Link>
          {project.url && (
            <a href={project.url} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-ghost">
              Visitar sitio
            </a>
          )}
        </div>
        {more && (
          <ul className="bd-checks pf-list">
            {project.verified.slice(0, 4).map((v) => <li key={v}>{v}</li>)}
          </ul>
        )}
      </div>
    </article>
  )
}

export function ProjectCard({ project }: { project: Project }) {
  const i = project.images[0]
  return (
    <Link href={`/proyectos/${project.slug}`} prefetch={false} className="pc">
      <div className="pc-media">
        {project.demo ? (
          <AppFrame image={i} title={project.name} />
        ) : (
          <BrowserFrame image={i} url={hostOf(project.url)} />
        )}
        {project.demo && <span className="bd-ribbon">Demo propia · datos ficticios</span>}
      </div>
      <div className="pc-body">
        <span className="kind">{project.kind}</span>
        <h3>{project.name}</h3>
        <p>{project.summary}</p>
        <span className="go">Ver proyecto <i aria-hidden="true">→</i></span>
      </div>
    </Link>
  )
}

export function ProjectGrid({ projects = OTHERS }: { projects?: Project[] }) {
  return (
    <div className="pgrid">
      {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
    </div>
  )
}

/** Demostracion propia de software de escritorio (C# / .NET). No es un proyecto de cliente. */
export function DesktopShowcase() {
  const p = DESKTOP_DEMO
  return (
    <section className="bd-section" aria-labelledby="desktop-title">
      <div className="bd-container desk">
        <div className="desk-copy">
          <span className="bd-eyebrow">Software de escritorio</span>
          <h2 id="desktop-title" className="bd-h2">Aplicaciones para Windows con C# y .NET</h2>
          <p className="bd-lead">
            Además de sitios y plataformas web, desarrollamos aplicaciones de escritorio: gestión, inventario,
            administración y herramientas internas.
          </p>
          <Tech tech={p.tech} />
          <p className="bd-note left">
            La imagen es una aplicación de demostración creada por Byd Light con datos ficticios; no corresponde a un
            proyecto de un cliente.
          </p>
          <Link href="/servicios/software-a-medida" prefetch={false} className="bd-btn bd-btn-ghost">
            Conocer el servicio
          </Link>
        </div>
        <div className="desk-stage">
          <AppFrame image={p.images[0]} title="Inventario · demostración" />
          <span className="bd-ribbon">Demo propia · datos ficticios</span>
        </div>
      </div>
    </section>
  )
}
