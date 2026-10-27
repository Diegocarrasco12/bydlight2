"use client"

import { useRef, useState } from "react"
import emailjs from "@emailjs/browser"

// Formulario de contacto original (EmailJS). Los identificadores de EmailJS son publicos por diseno.
export default function ContactForm() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formRef.current || sending) return
    setSending(true)
    setStatus(null)
    try {
      await emailjs.sendForm("service_z3s5mho", "template_jnsxd4o", formRef.current, "_sCMwpxerur2jJ7SP")
      setStatus({ ok: true, text: "Mensaje enviado correctamente. Te responderemos pronto." })
      formRef.current.reset()
    } catch {
      setStatus({ ok: false, text: "No se pudo enviar el mensaje. Intenta nuevamente o escríbenos por WhatsApp." })
    } finally {
      setSending(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bd-form bd-panel">
      <div className="bd-field">
        <label htmlFor="c-nombre">Nombre</label>
        <input id="c-nombre" type="text" name="nombre" autoComplete="name" required />
      </div>
      <div className="bd-field">
        <label htmlFor="c-email">Correo electrónico</label>
        <input id="c-email" type="email" name="email" autoComplete="email" required />
      </div>
      <div className="bd-field">
        <label htmlFor="c-mensaje">Cuéntanos tu proyecto</label>
        <textarea id="c-mensaje" name="mensaje" rows={5} required />
      </div>
      <button type="submit" className="bd-btn bd-btn-primary" disabled={sending}>
        {sending ? "Enviando..." : "Enviar mensaje"}
      </button>
      {status && (
        <p role="status" className={status.ok ? "bd-msg-ok" : "bd-msg-err"}>
          {status.text}
        </p>
      )}
    </form>
  )
}
