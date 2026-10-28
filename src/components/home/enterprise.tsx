import Link from "next/link"
import { SERVICES, SERVICE_GROUPS, photoSrc, photoSrcSet, type Service } from "@/lib/services"

// Presentacion de las soluciones empresariales (ERP y SaaS) y de los servicios agrupados por categoria.
// Son capacidades de desarrollo, implementacion, personalizacion e integracion; no productos propios ya disponibles.
// Las fotografias son ilustrativas (Pexels) y estan rotuladas como tales.

export function Photo({ photo, sizes, eager = false, className }: { photo: NonNullable<Service["photo"]>; sizes: string; eager?: boolean; className?: string }) {
  return (
    <img
      className={className}
      src={photoSrc(photo, 1280)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      width={photo.w}
      height={photo.h}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      alt={photo.alt}
    />
  )
}

export function EnterpriseCards() {
  const items = SERVICES.filter((s) => s.line === "empresa")
  return (
    <div className="ent-grid">
      {items.map((s) => (
        <Link key={s.slug} href={`/servicios/${s.slug}`} prefetch={false} className="ent-card rv">
          {s.photo && <Photo photo={s.photo} sizes="(max-width: 900px) 100vw, 50vw" className="ent-img" />}
          <div className="ent-body">
            <span className="ent-tag">{s.slug === "soluciones-erp" ? "ERP" : "SaaS"} · desarrollo e integración</span>
            <h3>{s.name}</h3>
            <p>{s.short}</p>
            <ul>
              {(s.benefits ?? []).slice(0, 3).map((b) => (
                <li key={b.t}>{b.t}</li>
              ))}
            </ul>
            <span className="more">Ver detalle →</span>
          </div>
          <span className="ent-credit">Imagen ilustrativa · Pexels</span>
        </Link>
      ))}
    </div>
  )
}

// Banda para la home: dos tarjetas con fotografia y una linea de aclaracion comercial.
export function EnterpriseBand() {
  return (
    <section className="bd-section ent" aria-labelledby="ent-title">
      <div className="bd-container">
        <div className="bd-head rv">
          <span className="bd-eyebrow">Soluciones empresariales</span>
          <h2 id="ent-title" className="bd-h2">ERP y plataformas SaaS, a la medida de tu operación</h2>
          <p className="bd-lead">Desarrollamos, implementamos, personalizamos e integramos. Trabajamos sobre lo que ya usas o construimos lo que falta.</p>
        </div>
        <EnterpriseCards />
        <p className="center-cta">
          <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary">Cotizar una solución</Link>
        </p>
      </div>
    </section>
  )
}

// /servicios: tres categorias; la empresarial lleva fotografia, el resto tarjetas con foto cuando existe.
export function ServicesByCategory() {
  return (
    <>
      {SERVICE_GROUPS.map((g, gi) => {
        const items = SERVICES.filter((s) => s.line === g.line)
        return (
          <section key={g.line} className={`bd-section cat${gi % 2 ? " bd-section-alt" : ""}`} aria-labelledby={`cat-${g.line}`}>
            <div className="bd-container">
              <div className="bd-head">
                <span className="bd-eyebrow">{`0${gi + 1}`}</span>
                <h2 id={`cat-${g.line}`} className="bd-h2">{g.label}</h2>
                <p className="bd-lead">{g.blurb}</p>
              </div>
              {g.line === "empresa" ? (
                <EnterpriseCards />
              ) : (
                <div className="bd-services">
                  {items.map((s) => (
                    <Link key={s.slug} href={`/servicios/${s.slug}`} prefetch={false} className={`bd-service${s.photo ? " has-photo" : ""}`}>
                      {s.photo && (
                        <span className="bd-service-ph">
                          <Photo photo={s.photo} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" />
                        </span>
                      )}
                      <h3>{s.name}</h3>
                      <p>{s.short}</p>
                      <span className="more">Ver detalle →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}
      <p className="bd-note cat-credit">Las fotografías son ilustrativas (Pexels) y no representan equipos, oficinas ni clientes de Byd Light Solutions.</p>
    </>
  )
}

