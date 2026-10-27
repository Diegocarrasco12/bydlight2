"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SITE, whatsappLink } from "@/lib/site"

const LINKS = [
  { href: "/servicios", label: "Servicios" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/planes", label: "Planes" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // El menu movil bloquea el scroll del fondo y se cierra con Escape.
  useEffect(() => {
    document.documentElement.classList.toggle("bd-lock", open)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.documentElement.classList.remove("bd-lock")
    }
  }, [open])

  const current = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <>
      <header className={`bd-header${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
        <div className="bd-header-inner">
          <Link href="/" className="bd-logo" prefetch={false} aria-label={`${SITE.name}, inicio`} onClick={() => setOpen(false)}>
            <img src={SITE.logoSmall} alt={SITE.name} width={112} height={40} />
          </Link>

          <nav className="bd-nav" aria-label="Principal">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} prefetch={false} aria-current={current(l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>

          <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary bd-header-cta">
            Cotizar proyecto
          </Link>

          <button
            type="button"
            className="bd-burger"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      <div id="menu-movil" className={`bd-sheet${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
        <nav aria-label="Menú móvil">
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={current(l.href) ? "page" : undefined}
              style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }}
            >
              <small>0{i + 1}</small>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="bd-sheet-foot">{SITE.email}</p>
      </div>

      {/* Barra inferior solo en movil: la accion comercial siempre al alcance del pulgar. */}
      <div className="bd-dock" role="group" aria-label="Contacto rápido">
        <a href={whatsappLink("Hola, quiero cotizar un proyecto con Byd Light Solutions.")} target="_blank" rel="noopener noreferrer" className="bd-dock-wa">
          WhatsApp
        </a>
        <Link href="/contacto" prefetch={false} className="bd-dock-cta">
          Cotizar proyecto
        </Link>
      </div>
    </>
  )
}
