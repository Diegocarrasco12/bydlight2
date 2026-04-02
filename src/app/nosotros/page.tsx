"use client"

import "./nosotros.css"

export default function NosotrosPage() {
    return (
        <>
            {/* 🔥 HERO */}
            <section className="about-hero">

                <video
                    className="about-video"
                    src="/videos/hero7.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                />

                <div className="about-overlay">
                    <h1>Construimos soluciones reales</h1>
                    <p>Tecnología aplicada a resultados</p>
                </div>

            </section>

            {/* 🧠 QUIÉNES SOMOS */}
            <section className="about-section">

                <div className="container">

                    <h2>Quiénes somos</h2>

                    <p className="about-text">
                        En BYD Light Solutions creamos soluciones digitales enfocadas en resolver problemas reales.
                        Desde sistemas empresariales hasta plataformas web, trabajamos con un enfoque práctico,
                        eficiente y orientado a resultados.
                    </p>

                </div>

            </section>

            {/* ⚙️ METODOLOGÍA */}
            <section className="about-process">

                <div className="process-wrapper">

                    {/* VIDEO */}
                    <div className="process-video">
                        <video
                            src="/videos/hero3.mp4"
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    </div>

                    {/* CONTENIDO */}
                    <div className="process-content">

                        <h2>Cómo trabajamos</h2>

                        <div className="process-grid">

                            <div>
                                <h3>01</h3>
                                <p>Analizamos tu necesidad y detectamos el problema real.</p>
                            </div>

                            <div>
                                <h3>02</h3>
                                <p>Diseñamos una solución clara, eficiente y escalable.</p>
                            </div>

                            <div>
                                <h3>03</h3>
                                <p>Desarrollamos el sistema o plataforma.</p>
                            </div>

                            <div>
                                <h3>04</h3>
                                <p>Implementamos y optimizamos en producción.</p>
                            </div>

                        </div>

                    </div>

                </div>

            </section>

            {/* 🧠 EXPERIENCIA */}
            <section className="about-experience">

                <div className="experience-wrapper">

                    {/* CONTENIDO */}
                    <div className="experience-content">

                        <h2>Experiencia</h2>

                        <p>
                            Más de 13 años trabajando en operaciones reales, desarrollando soluciones
                            para empresas, automatizando procesos y optimizando sistemas.
                        </p>

                        <div className="experience-highlights">
                            <span>✔ Sistemas en producción</span>
                            <span>✔ Experiencia en terreno</span>
                            <span>✔ Soluciones reales</span>
                        </div>

                    </div>

                    {/* VIDEO */}
                    <div className="experience-video">
                        <video
                            src="/videos/hero8.mp4"
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    </div>

                </div>

            </section>

            {/* 🎯 CTA */}
            <section className="about-cta">

                <video
                    className="about-cta-video"
                    src="/videos/hero2.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                />

                <div className="about-cta-overlay">

                    <h2>¿Tienes un proyecto en mente?</h2>

                    <p>Hablemos y construyamos algo real.</p>

                    <a href="/contacto" className="btn-primary">
                        Solicitar asesoría
                    </a>

                </div>

            </section>
        </>
    )
}