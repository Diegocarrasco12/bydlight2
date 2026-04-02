# Byd Light Solutions – Plataforma Web Corporativa

Sitio web profesional desarrollado para la presentación de servicios tecnológicos enfocados en **arquitectura de software, desarrollo de sistemas y soluciones digitales para empresas**.

El objetivo principal es generar oportunidades de negocio mediante una experiencia clara, moderna y orientada a conversión.

---

# 🧠 Descripción del Proyecto

Byd Light Solutions es una plataforma web construida bajo una arquitectura moderna con **Next.js**, diseñada para:

* Presentar servicios tecnológicos de alto valor
* Mostrar proyectos y capacidades técnicas
* Captar clientes mediante un formulario funcional
* Transmitir profesionalismo y confianza

No es solo una landing page, sino una **base escalable para futuras soluciones digitales**, incluyendo e-commerce, sistemas empresariales y automatizaciones.

---

# ⚙️ Stack Tecnológico

### Frontend

* **Next.js (App Router)**
* **React**
* **TypeScript**
* **CSS puro (sin frameworks)**

### Integraciones

* **EmailJS**

  * Envío de formularios sin backend
  * Comunicación directa con cliente vía correo

### Multimedia

* Videos optimizados en `/public/videos`
* Uso de video como background para impacto visual

---

# 🏗️ Arquitectura del Proyecto

El proyecto sigue una arquitectura clara, modular y escalable:

```
src/
 ├── app/
 │   ├── page.tsx (Home)
 │   ├── contacto/
 │   ├── servicios/
 │   ├── proyectos/
 │   ├── nosotros/
 │
 ├── components/
 │   ├── hero/
 │   ├── services/
 │   ├── projects/
 │   ├── contact/
 │   ├── navbar/
 │   ├── footer/
 │   ├── cta/
 │   ├── trust/
 │
 ├── styles/
 │
public/
 ├── videos/
 ├── img/
```

---

# 🧩 Lógica del Sistema

## 🔹 1. Navegación

* SPA basada en App Router de Next.js
* Navegación fluida sin recargas

---

## 🔹 2. Renderizado

* Componentes reutilizables
* Separación clara por responsabilidades (UI modular)

---

## 🔹 3. Formulario de Contacto

Flujo:

```
Usuario → Formulario → EmailJS → Correo del cliente
```

### Características:

* Sin backend (rápido de implementar)
* Validación básica en frontend
* Integración directa con EmailJS
* Uso de variables dinámicas:

  * nombre
  * email
  * mensaje

---

## 🔹 4. UX/UI Strategy

* Diseño oscuro + contraste alto
* Uso de video para impacto visual
* Mensajes claros y orientados a negocio
* CTA estratégicos

---

# 🎯 Enfoque del Proyecto

Este proyecto está diseñado con mentalidad de:

✔ Venta de servicios
✔ Escalabilidad
✔ Reutilización para clientes
✔ Base para productos digitales

---

# 🔐 Seguridad y Buenas Prácticas

* Uso de variables de entorno (`.env.local`)
* Evitar exposición de datos sensibles
* `.gitignore` configurado correctamente
* Separación de configuración y lógica

---

# 🚀 Cómo ejecutar el proyecto

```bash
npm install
npm run dev
```

Abrir en:

```
http://localhost:3000
```

---

# 🌐 Despliegue

Recomendado:

* **Vercel** (óptimo para Next.js)
* Compatible con cualquier hosting Node

---

# 📈 Próximas Mejoras

* Sistema de notificaciones (toast)
* Loader en envío de formulario
* Integración backend (Node + DB)
* Panel administrativo
* SEO avanzado
* Analytics

---

# 🧑‍💻 Autor

**Diego Carrasco**
Desarrollador Full Stack JavaScript
Arquitectura de software y soluciones digitales

---

# 💡 Filosofía

> No construimos páginas web.
> Construimos soluciones digitales que generan resultados.

---
