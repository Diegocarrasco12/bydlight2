"use client";

import Link from "next/link";
import "./servicios.css";

export default function ServiciosPage() {
    return (
        <main className="servicios-page">

            {/* HERO */}
            <section className="servicios-hero">

                {/* VIDEO FONDO */}
                <video
                    className="servicios-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                >
                    <source src="/videos/hero5.mp4" type="video/mp4" />
                </video>

                {/* OVERLAY OSCURO */}
                <div className="servicios-overlay"></div>

                <div className="container">
                    <h1>Servicios de desarrollo de software</h1>

                    <p>
                        Creamos soluciones digitales a medida para empresas que necesitan escalar,
                        automatizar y optimizar sus procesos.
                    </p>

                    <Link href="/contacto" className="btn-primary">
                        Solicitar asesoría
                    </Link>
                </div>

            </section>
            {/* SERVICIOS DETALLADOS */}
            <section className="servicios-list">

                <div className="servicio-item">
                    <h2>Arquitectura de software</h2>
                    <p>
                        Diseñamos la base técnica para que tu sistema sea escalable, estable y eficiente.
                    </p>
                    <span>✔ Sistemas preparados para crecer</span>
                    <span>✔ Alto rendimiento</span>
                </div>

                <div className="servicio-item">
                    <h2>Sistemas a medida</h2>
                    <p>
                        Desarrollamos sistemas personalizados adaptados a los procesos de tu empresa.
                    </p>
                    <span>✔ Automatización interna</span>
                    <span>✔ Control total de operaciones</span>
                </div>

                <div className="servicio-item">
                    <h2>Automatización</h2>
                    <p>
                        Eliminamos tareas repetitivas conectando sistemas, APIs y procesos.
                    </p>
                    <span>✔ Ahorro de tiempo</span>
                    <span>✔ Reducción de errores</span>
                </div>

                <div className="servicio-item">
                    <h2>Desarrollo web</h2>
                    <p>
                        Creamos sitios web modernos, rápidos y enfocados en conversión.
                        Desde landing pages hasta plataformas completas.
                    </p>
                    <span>✔ Más clientes</span>
                    <span>✔ Mejor presencia digital</span>
                </div>

            </section>

            {/* BENEFICIOS */}
            <section className="servicios-benefits">
                <h2>¿Por qué trabajar con nosotros?</h2>

                <div className="benefits-grid">
                    <div>✔ Enfoque en resultados reales</div>
                    <div>✔ Soluciones escalables</div>
                    <div>✔ Comunicación directa</div>
                    <div>✔ Tecnología moderna</div>
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="servicios-cta">
                <h2>¿Listo para mejorar tu negocio?</h2>
                <Link href="/contacto" className="btn-primary">
                    Hablemos de tu proyecto
                </Link>
            </section>

        </main>
    );
}