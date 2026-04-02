"use client"

import { useRef } from "react"
import emailjs from "@emailjs/browser"
import "./contacto.css"

export default function ContactoPage() {

    const formRef = useRef<HTMLFormElement | null>(null)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!formRef.current) return

        emailjs.sendForm(
            "service_z3s5mho",
            "template_jnsxd4o",
            formRef.current,
            "_sCMwpxerur2jJ7SP"
        )
        .then(() => {
            alert("Mensaje enviado correctamente 🚀")
            formRef.current?.reset()
        })
        .catch((error) => {
            console.log(error)
            alert("Error al enviar ❌")
        })
    }

    return (
        <>
            {/* 🔥 HERO */}
            <section className="contact-hero">

                <video 
                    className="contact-video"
                    src="/videos/hero4.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                />

                <div className="contact-overlay">
                    <h1>Hablemos de tu proyecto</h1>
                    <p>Soluciones reales para empresas reales</p>
                </div>

            </section>

            {/* 📩 CONTACTO */}
            <section className="contact-section">

                <div className="contact-wrapper">

                    {/* TEXTO */}
                    <div className="contact-info">

                        <h2>Cuéntanos lo que necesitas</h2>

                        <p>
                            Analizamos tu caso y te proponemos una solución clara,
                            sin compromisos y enfocada en resultados.
                        </p>

                        <div className="contact-points">
                            <span>✔ Respuesta rápida</span>
                            <span>✔ Sin compromiso</span>
                            <span>✔ Enfoque profesional</span>
                        </div>

                    </div>

                    {/* FORMULARIO */}
                    <form 
                        ref={formRef}
                        onSubmit={handleSubmit}
                        className="contact-form"
                    >

                        <input 
                            type="text" 
                            name="nombre"
                            placeholder="Nombre" 
                            required 
                        />

                        <input 
                            type="email" 
                            name="email"
                            placeholder="Correo electrónico" 
                            required 
                        />

                        <textarea 
                            name="mensaje"
                            placeholder="Cuéntanos tu proyecto..." 
                            rows={5} 
                            required 
                        />

                        <button type="submit">Enviar mensaje</button>

                    </form>

                </div>

            </section>

            {/* 📧 EXTRA */}
            <section className="contact-extra">

                <p>
                    También puedes escribir directamente a: <strong>contacto@bydlightsolutions.com</strong>
                </p>

            </section>

        </>
    )
}