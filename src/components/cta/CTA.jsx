"use client"

import "./CTA.css"
import Link from "next/link"


export default function CTA() {
  return (
    <section className="cta">

      {/* 🎥 VIDEO FONDO */}
      <video
        className="cta-video"
        src="/videos/hero4.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* 🔥 OVERLAY */}
      <div className="cta-overlay">

        <div className="cta-container">

          <h2>
            Lleva tu negocio al siguiente nivel
          </h2>

          <p>
            Soluciones digitales reales para empresas que quieren crecer.
          </p>

          <div className="cta-buttons">
            <Link href="/contacto" className="btn-primary">
              Solicitar propuesta
            </Link>

            <Link href="/proyectos" className="btn-secondary">
              Ver proyectos
            </Link>
          </div>

          <span className="cta-note">
            Respuesta en menos de 24 horas
          </span>

        </div>

      </div>

    </section>
  )
}