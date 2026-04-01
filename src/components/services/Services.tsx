"use client"

import "./Services.css"

export default function Services() {
    return (
        <section className="services">

            <div className="services-container">

                <h2>Soluciones digitales para empresas</h2>

                <p className="services-sub">
                    Diseñamos arquitectura, sistemas y soluciones tecnológicas para empresas que quieren escalar.
                </p>

                <div className="services-grid">

                    {/* 1. ARQUITECTURA (TU FUERTE) */}
                    <div className="service-card">
                        <h3>Arquitectura de Software</h3>
                        <p>
                            Diseñamos la estructura tecnológica de tu empresa para asegurar escalabilidad, rendimiento y estabilidad.
                        </p>
                    </div>

                    {/* 2. SISTEMAS */}
                    <div className="service-card">
                        <h3>Sistemas a Medida</h3>
                        <p>
                            Creamos soluciones adaptadas a tus procesos reales, mejorando eficiencia y control operativo.
                        </p>
                    </div>

                    {/* 3. AUTOMATIZACIÓN */}
                    <div className="service-card">
                        <h3>Automatización de Procesos</h3>
                        <p>
                            Eliminamos tareas manuales, reducimos errores y optimizamos tu operación con tecnología inteligente.
                        </p>
                    </div>

                    {/* 4. DESARROLLO WEB */}
                    <div className="service-card">
                        <h3>Desarrollo Web</h3>
                        <p>
                            Sitios modernos y optimizados para presencia digital y captación de clientes.
                        </p>
                    </div>

                </div>

                {/* 🔥 IMÁGENES PRO */}
                <div className="services-video">
                    <video
                        src="/videos/hero3.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
                </div>

            </div>

        </section>
    )
}