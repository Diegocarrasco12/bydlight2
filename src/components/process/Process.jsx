"use client"

import "./Process.css"

export default function Process(){
  return (
    <section className="process">

      <div className="process-container">

        <h2>Cómo trabajamos</h2>

        <p className="process-sub">
          Un proceso claro, estructurado y enfocado en resultados reales.
        </p>

        <div className="process-grid">

          {/* 1 */}
          <div className="process-card">
            <span className="process-number">01</span>
            <h3>Análisis</h3>
            <p>
              Entendemos tu negocio, procesos y necesidades reales antes de proponer cualquier solución.
            </p>
          </div>

          {/* 2 */}
          <div className="process-card">
            <span className="process-number">02</span>
            <h3>Diseño de Arquitectura</h3>
            <p>
              Definimos la mejor estructura tecnológica para asegurar escalabilidad, rendimiento y control.
            </p>
          </div>

          {/* 3 */}
          <div className="process-card">
            <span className="process-number">03</span>
            <h3>Desarrollo</h3>
            <p>
              Construimos soluciones robustas, enfocadas en eficiencia operativa y automatización.
            </p>
          </div>

          {/* 4 */}
          <div className="process-card">
            <span className="process-number">04</span>
            <h3>Implementación y Mejora</h3>
            <p>
              Acompañamos la puesta en marcha y optimizamos continuamente el sistema.
            </p>
          </div>

        </div>

      </div>

    </section>
  )
}