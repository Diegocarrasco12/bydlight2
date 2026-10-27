"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SITE } from "@/lib/site"

const LINKS = [
  { href: "/servicios", label: "Servicios" },
  { href: "/planes", label: "Planes y precios" },
  { href: "/proyectos", label: "Proyectos" },
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

  return (
    <header className={`bd-header${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
      <div className="bd-container bd-header-inner">
        <Link href="/" className="bd-logo" prefetch={false} aria-label={`${SITE.name}, inicio`}>
          <img src={SITE.logo} alt={SITE.name} width={112} height={40} />
        </Link>

        <nav className="bd-nav" id="menu-principal" aria-label="Principal">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={pathname === l.href || pathname.startsWith(l.href + "/") ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/contacto" prefetch={false} onClick={() => setOpen(false)} className="bd-btn bd-btn-primary bd-nav-cta">
            Cotizar proyecto
          </Link>
        </nav>

        <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary bd-header-cta">
          Cotizar proyecto
        </Link>

        <button
          type="button"
          className="bd-burger"
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
    </header>
  )
}
