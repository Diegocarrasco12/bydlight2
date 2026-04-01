import "./Navbar.css"

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">

        <div className="navbar-logo">
          Byd Light Solutions
        </div>

        <ul className="navbar-menu">
          <li>Servicios</li>
          <li>Proyectos</li>
          <li>Nosotros</li>
          <li>Contacto</li>
        </ul>

        <button className="navbar-cta">
          Solicitar asesoría
        </button>

      </div>
    </nav>
  )
}