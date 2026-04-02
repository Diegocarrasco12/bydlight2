"use client"

import "./Footer.css"
import Link from "next/link"

export default function Footer() {
  return (
    <footer className="footer">

      <div className="footer-container">

        {/* 🔥 COLUMNA 1 - LOGO / MARCA */}
        <div className="footer-brand">

          <div className="footer-logo">
            <img src="/img/logos/logo1.png" alt="BYD Light Solutions" />
          </div>

          <p>
            Desarrollo de sistemas, plataformas y soluciones digitales a medida
            para empresas que buscan crecer y optimizar sus procesos.
          </p>

        </div>

        {/* 🔧 COLUMNA 2 - SERVICIOS */}
        <div className="footer-links">
          <h4>Servicios</h4>
          <ul>
            <li>Arquitectura de Software</li>
            <li>Desarrollo de Sistemas a Medida</li>
            <li>Automatización de Procesos</li>
            <li>Integración de Plataformas</li>
            <li>Desarrollo Web</li>
          </ul>
        </div>

        {/* 📂 COLUMNA 3 - NAVEGACIÓN */}
        <div className="footer-links">
          <h4>Navegación</h4>
          <ul>
            <li><Link href="/">Inicio</Link></li>
            <li><Link href="/servicios">Servicios</Link></li>
            <li><Link href="/proyectos">Proyectos</Link></li>
            <li><Link href="/nosotros">Nosotros</Link></li>
            <li><Link href="/contacto">Contacto</Link></li>
          </ul>
        </div>

        {/* 📞 COLUMNA 4 - CONTACTO */}
        <div className="footer-links">
          <h4>Contacto</h4>
          <ul>
            <li>Email: contacto@bydlightsolutions.com</li>
            <li>WhatsApp: +56 9 8324 9135</li>
            <li>Chile</li>
          </ul>
        </div>

      </div>

      {/* 🔻 BOTTOM */}
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} BYD Light Solutions. Todos los derechos reservados.</span>
      </div>

    </footer>
  )
}