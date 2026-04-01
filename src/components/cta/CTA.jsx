"use client"

import "./CTA.css"

export default function CTA(){
  return (
    <section className="cta">

      <div className="cta-container">

        <h2>
          Lleva tu negocio al siguiente nivel con una solución digital profesional
        </h2>

        <p>
          Desarrollo sistemas, e-commerce y plataformas a medida para empresas que quieren crecer de verdad.
        </p>

        <div className="cta-buttons">
          <a href="#contacto" className="btn-primary">
            Solicitar propuesta
          </a>

          <a href="#proyectos" className="btn-secondary">
            Ver proyectos
          </a>
        </div>

        <span className="cta-note">
          Respuesta en menos de 24 horas
        </span>

      </div>

    </section>
  )
}