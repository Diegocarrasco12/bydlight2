"use client"

import { useState } from "react"
import "./Contact.css"

export default function Contact(){

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    mensaje: ""
  })

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // 🔥 OPCIÓN SIMPLE (WhatsApp)
    const texto = `Hola Diego, mi nombre es ${form.nombre}. ${form.mensaje}`
    const url = `https://wa.me/56983249135?text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  return (
    <section id="contacto" className="contact">

      <div className="contact-container">

        <h2>Hablemos de tu proyecto</h2>

        <p>
          Cuéntame qué necesitas y te responderé con una propuesta clara.
        </p>

        <form onSubmit={handleSubmit} className="contact-form">

          <input
            type="text"
            name="nombre"
            placeholder="Tu nombre"
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Tu correo"
            onChange={handleChange}
            required
          />

          <textarea
            name="mensaje"
            placeholder="Cuéntame tu proyecto..."
            rows="5"
            onChange={handleChange}
            required
          ></textarea>

          <button type="submit">
            Enviar mensaje
          </button>

        </form>

      </div>

    </section>
  )
}