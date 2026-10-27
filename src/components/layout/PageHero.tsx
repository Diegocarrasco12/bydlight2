import Link from "next/link"

// Cabecera de paginas internas: plano tecnico + resplandor, sin video ni imagen pesada.
export default function PageHero({
  eyebrow,
  title,
  lead,
  crumbs,
  children,
}: {
  eyebrow?: string
  title: React.ReactNode
  lead?: string
  crumbs?: { href?: string; label: string }[]
  children?: React.ReactNode
}) {
  return (
    <section className="ph">
      <div className="ph-bg" aria-hidden="true" />
      <div className="bd-container ph-body">
        {crumbs && (
          <nav className="bd-crumbs" aria-label="Migas de pan">
            <Link href="/" prefetch={false}>Inicio</Link>
            {crumbs.map((c) => (
              <span key={c.label}>
                {" / "}
                {c.href ? <Link href={c.href} prefetch={false}>{c.label}</Link> : c.label}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <span className="bd-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p className="bd-lead">{lead}</p>}
        {children}
      </div>
    </section>
  )
}
