"use client"

import "./projects.css"

export default function ProjectsPage() {
    return (
        <>
            {/* 🔥 HERO */}
            <section className="projects-hero">

                <video
                    className="projects-hero-video"
                    src="/videos/hero6.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                />

                <div className="projects-hero-overlay">

                    <h1>Resultados reales</h1>

                    <p>Software. Plataformas. Impacto.</p>

                </div>

            </section>

            {/* 🔥 PROYECTOS */}
            <section className="projects">

                <div className="projects-container">

                    <h2>Proyectos desarrollados</h2>

                    <p className="projects-sub">
                        Soluciones reales implementadas para empresas y clientes.
                    </p>

                    <p className="projects-message">
                        Cada proyecto está diseñado para resolver problemas reales, mejorar procesos
                        y aumentar la eficiencia de las empresas.
                    </p>

                    {/* 🔥 PROYECTO 1 */}
                    <div className="project-feature">

                        <div className="project-video">
                            <video src="/videos/demo1.mp4" autoPlay loop muted playsInline />
                        </div>

                        <div className="project-info">
                            <h3>LogisticControlCenter (LCC)</h3>
                            <p>
                                Software de control logístico en tiempo real para gestión de procesos industriales,
                                trazabilidad y optimización operativa.
                            </p>
                        </div>

                    </div>

                    {/* 🔥 PROYECTO 2 */}
                    <div className="project-feature reverse">

                        <div className="project-video">
                            <video src="/videos/demo2.mp4" autoPlay loop muted playsInline />
                        </div>

                        <div className="project-info">
                            <h3>Bolsa de Trabajo CFT Magallanes</h3>
                            <p>
                                Plataforma completa de empleo con gestión de usuarios, empresas,
                                postulaciones y administración avanzada.
                            </p>

                            <a href="https://bolsadetrabajo.cftdemagallanes.cl/" target="_blank">
                                Ver proyecto
                            </a>
                        </div>

                    </div>

                    {/* 🔥 PROYECTO 3 */}
                    <div className="project-feature">

                        <div className="project-video">
                            <video src="/videos/demo3.mp4" autoPlay loop muted playsInline />
                        </div>

                        <div className="project-info">
                            <h3>Plataforma GINFET</h3>
                            <p>
                                Sitio web corporativo desarrollado con enfoque en presentación profesional,
                                rendimiento y experiencia de usuario.
                            </p>

                            <a href="https://ginfet.cl/" target="_blank">
                                Ver proyecto
                            </a>
                        </div>

                    </div>

                    {/* 🧱 PROYECTOS SECUNDARIOS */}
                    <div className="projects-grid">

                        <a href="https://www.tufarmaciadigital.cl/" target="_blank" className="project-card">
                            <img src="/img/logos/logo4.png" alt="E-commerce Farmacia" />
                            <h4>E-commerce Farmacia</h4>
                            <p>Landing para ofrecer servicios farmacéuticos.</p>
                        </a>

                        <a href="https://mydconstruccionesspa.onrender.com/" target="_blank" className="project-card">
                            <img src="/img/logos/logo3.png" alt="Constructora MYD" />
                            <h4>Constructora MYD</h4>
                            <p>Sitio corporativo enfocado en captación de clientes.</p>
                        </a>

                        <a href="https://angelyeva.es/" target="_blank" className="project-card">
                            <img src="/img/logos/logo5.png" alt="Angel & Eva" />
                            <h4>Angel & Eva</h4>
                            <p>Landing de servicios y agenda de visitas. Colaboración con Teranube España</p>
                        </a>

                    </div>

                </div>

            </section>
        </>
    )
}