"use client"

import { useState, useEffect } from "react"
import "./Navbar.css"
import Link from "next/link"


export default function Navbar() {

  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-container">

        <Link href="/" className="navbar-logo">
          <img src="/img/logos/logo1.png" alt="BYD Light Solutions" />
        </Link>

        {/* MENU */}
        <ul className={`navbar-menu ${menuOpen ? "active" : ""}`}>

          <li onClick={() => setMenuOpen(false)}>
            <Link href="/servicios">Servicios</Link>
          </li>

          <li onClick={() => setMenuOpen(false)}>
            <Link href="/proyectos">Proyectos</Link>
          </li>

          <li onClick={() => setMenuOpen(false)}>
            <Link href="/nosotros">Nosotros</Link>
          </li>

          <li onClick={() => setMenuOpen(false)}>
            <Link href="/contacto">Contacto</Link>
          </li>

        </ul>

        {/* CTA */}
        <Link href="/contacto" className="navbar-cta">
          Solicitar asesoría
        </Link>

        {/* HAMBURGUESA */}
        <div
          className={`navbar-toggle ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

      </div>
    </nav>
  )
}