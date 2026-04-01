"use client"

import "./Footer.css"

export default function Footer(){
  return (
    <footer className="footer">

      <div className="footer-container">

        {/* 🔥 COLUMNA 1 - LOGO / MARCA */}
        <div className="footer-brand">
          <div className="footer-logo">
            {/* aquí luego puedes poner imagen */}
            <span>BYD Light Solutions</span>
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
            <li>Desarrollo de sistemas</li>
            <li>E-commerce</li>
            <li>Landing pages</li>
            <li>Automatización</li>
          </ul>
        </div>

        {/* 📂 COLUMNA 3 - NAVEGACIÓN */}
        <div className="footer-links">
          <h4>Navegación</h4>
          <ul>
            <li><a href="#proyectos">Proyectos</a></li>
            <li><a href="#contacto">Contacto</a></li>
            <li><a href="#">Inicio</a></li>
          </ul>
        </div>

        {/* 📞 COLUMNA 4 - CONTACTO */}
        <div className="footer-links">
          <h4>Contacto</h4>
          <ul>
            <li>Email: contacto@tudominio.com</li>
            <li>WhatsApp: +56 9 XXXX XXXX</li>
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