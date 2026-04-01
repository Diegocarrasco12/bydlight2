"use client"

import "./Trust.css"

export default function Trust(){
  return (
    <section className="trust">

      <div className="trust-container">

        <h2>Empresas que han confiado</h2>

        <p className="trust-sub">
          Proyectos desarrollados para clientes reales en distintos rubros.
        </p>

        <div className="trust-grid">

          {/* CFT */}
          <div className="trust-card">
            <img src="/img/clients/cft.png" alt="CFT Magallanes" />
            <span>CFT Magallanes</span>
          </div>

          {/* MYD */}
          <div className="trust-card">
            <img src="/img/clients/myd.png" alt="MYD Construcciones" />
            <span>MYD Construcciones</span>
          </div>

          {/* GINFET */}
          <div className="trust-card">
            <img src="/img/clients/ginfet.png" alt="GINFET" />
            <span>GINFET</span>
          </div>

          {/* FARMACIA */}
          <div className="trust-card">
            <img src="/img/clients/farmacia.png" alt="Tu Farmacia Digital" />
            <span>Tu Farmacia Digital</span>
          </div>

        </div>

      </div>

    </section>
  )
}