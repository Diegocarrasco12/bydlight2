import Link from "next/link"
import ContactForm from "@/components/contact/ContactForm"
import { ProjectFeature, ProjectGrid } from "@/components/portfolio/Portfolio"
import { SERVICES } from "@/lib/services"
import { IVA_LABEL, PLANS } from "@/lib/plans"
import { OTHERS } from "@/lib/portfolio"
import { SITE, whatsappLink } from "@/lib/site"

// Bloques de la home. Poco texto: cada bloque tiene un objeto visual o un dato verificable.

const ICONS: Record<string, React.ReactNode> = {
  "software-a-medida": <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  "desarrollo-web": <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
  ecommerce: <><path d="M3 4h2l2.4 11h10.2L20 8H6.2" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  "integraciones-y-apis": <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H14a3 3 0 013 3v6.5M15.5 18H10a3 3 0 01-3-3V8.5" /></>,
  "automatizacion-de-procesos": <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.2" /></>,
  "arquitectura-de-software": <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9" /></>,
}

const HOME_SERVICES = [
  "software-a-medida",
  "desarrollo-web",
  "ecommerce",
  "integraciones-y-apis",
  "automatizacion-de-procesos",
  "arquitectura-de-software",
]

// Ilustracion decorativa (no es codigo real): barras que pasan de "plano" a interfaz.
function Blueprint() {
  const rows = [78, 52, 66, 38, 58, 44]
  return (
    <div className="bp" aria-hidden="true">
      <div className="bp-code">
        {rows.map((w, i) => <i key={i} style={{ width: `${w}%` }} data-c={i % 3} />)}
      </div>
      <div className="bp-ui">
        <b />
        <span><i /><i /><i /></span>
      </div>
    </div>
  )
}

export function Capabilities() {
  const items = HOME_SERVICES.map((slug) => SERVICES.find((s) => s.slug === slug)!).filter(Boolean)
  return (
    <section className="bd-section" aria-labelledby="cap-title">
      <div className="bd-container">
        <div className="bd-head rv">
          <span className="bd-eyebrow">Capacidades</span>
          <h2 id="cap-title" className="bd-h2">Lo que construimos</h2>
        </div>
        <div className="bento">
          {items.map((s, i) => (
            <Link key={s.slug} href={`/servicios/${s.slug}`} prefetch={false} className={`bento-tile t${i + 1} rv`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[s.slug]}
              </svg>
              <h3>{s.name}</h3>
              <p>{s.short}</p>
              {i === 0 && <Blueprint />}
              <span className="more" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProjectsShowcase() {
  return (
    <section className="bd-section showcase" aria-labelledby="proj-title">
      <div className="bd-container">
        <div className="bd-head rv">
          <span className="bd-eyebrow">Proyectos</span>
          <h2 id="proj-title" className="bd-h2">Producto real, en producción</h2>
        </div>
        <ProjectFeature />
        <ProjectGrid projects={OTHERS.slice(0, 3)} />
        <p className="center-cta">
          <Link href="/proyectos" prefetch={false} className="bd-btn bd-btn-ghost">Ver todos los proyectos</Link>
        </p>
      </div>
    </section>
  )
}

const STEPS = [
  ["Analizamos", "Entendemos tu negocio y definimos el alcance antes de proponer nada."],
  ["Diseñamos", "Estructura, interfaz y tecnología adecuadas para tu caso."],
  ["Construimos", "Desarrollo por etapas, con revisiones y pruebas durante el proceso."],
  ["Lanzamos y evolucionamos", "Publicamos, te acompañamos y, si quieres, seguimos mejorando."],
]

export function Method() {
  return (
    <section className="bd-section method" aria-labelledby="method-title">
      <div className="bd-container">
        <div className="bd-head rv">
          <span className="bd-eyebrow">Método</span>
          <h2 id="method-title" className="bd-h2">Del plano al producto</h2>
        </div>
        <ol className="method-list">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rv">
              <span className="n" aria-hidden="true">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const STACK = ["Next.js", "React", "C#", ".NET 8", "Windows Forms", "WordPress"]

export function StackStrip() {
  return (
    <section className="stack" aria-label="Tecnologías de proyectos reales">
      <div className="bd-container">
        <p>Tecnologías en nuestros proyectos publicados</p>
        <ul>
          {STACK.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
    </section>
  )
}

export function PlansTeaser() {
  const from = Math.min(...PLANS.filter((p) => p.priceFrom !== null).map((p) => p.priceFrom as number))
  const price = `$${from.toLocaleString("es-CL")}`
  return (
    <section className="bd-section" aria-label="Planes web">
      <div className="bd-container">
        <div className="teaser rv">
          <div>
            <span className="bd-eyebrow">Sitios con alcance definido</span>
            <h2 className="bd-h2">Páginas web desde {price} {IVA_LABEL}</h2>
            <p className="bd-lead">Planes con páginas, revisiones y plazos por escrito. Y para proyectos más complejos, cotización a medida.</p>
          </div>
          <Link href="/planes" prefetch={false} className="bd-btn bd-btn-ghost">Ver planes y precios</Link>
        </div>
      </div>
    </section>
  )
}

export function HomeContact() {
  return (
    <section className="bd-section home-contact" aria-labelledby="hc-title">
      <div className="bd-container hc-grid">
        <div className="rv">
          <span className="bd-eyebrow">Contacto</span>
          <h2 id="hc-title" className="bd-h2">¿Tienes una idea?<br />Hagámosla funcionar.</h2>
          <p className="bd-lead">Cuéntanos qué necesitas y te respondemos con una propuesta clara.</p>
          <div className="hc-ways">
            <a className="bd-btn bd-btn-primary" href={whatsappLink("Hola, quiero cotizar un proyecto con Byd Light Solutions.")} target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </a>
            <a className="bd-btn bd-btn-ghost" href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </div>
        </div>
        <div className="rv"><ContactForm /></div>
      </div>
    </section>
  )
}
