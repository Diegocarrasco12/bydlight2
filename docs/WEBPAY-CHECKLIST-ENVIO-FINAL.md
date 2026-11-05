# Webpay Plus — checklist final de envío (2026-11-05)

Detalle y respuestas campo por campo: `WEBPAY-FORMULARIO-VALIDACION-RESPUESTAS.md`. Estado técnico: **8/8 pruebas de integración PASS**, tokens validados con Transbank (`status`). Webpay sigue **apagado** en producción. **Formulario no enviado.**

**Plazo duro: enviar antes del 2026-11-12 12:36 (hora de Chile).** Si no, repetir la campaña de pruebas (T1–T8) el mismo día del envío.

## Antes de abrir el formulario
1. [ ] Llamar a Transbank (600 638 6380 / +56 2 2661 2700) y preguntar: **¿quién es el titular del código `597053109914` y con qué RUT?** ¿Persona natural o la SpA? (inconsistencia en §11).
2. [ ] Confirmar que la **moneda contratada es CLP** y que el **rubro declarado** corresponde a servicios de desarrollo de software.
3. [ ] Decidir el **logo**: `docs/evidencias-webpay/logo-130x59-v2.png` (recomendado) o el anterior.
4. [ ] (Recomendado, no bloquea) Activar **«Always Use HTTPS»** en Cloudflare.

## En el formulario (https://form.typeform.com/to/ibXdg6Av)
5. [ ] Código de comercio: `597053109914`. RUT asociado: el del paso 1. Nombre, correo y teléfono: los suyos.
6. [ ] PSP: **No**. Integrador: **No**. App móvil: **No**.
7. [ ] Subir el logo elegido.
8. [ ] Revisión del sitio: **«No, aún me faltan algunos requisitos»** (permite continuar; ver §10 de las respuestas), o «Sí» solo si usted lo considera cierto.
9. [ ] URL a revisar y de producción: `https://bydlightsolutions.com`. Moneda: **CLP**. Tipo: **SDK oficial**. Lenguaje: **Node.js**. Producto: **Webpay Plus**.
10. [ ] Pegar los **8 tokens** (T1 a T8) desde la tabla del §4 de las respuestas, cada uno en su campo. «¿Implementaste anulaciones?»: **Sí**.
11. [ ] Notas (opcional): texto del §6.
12. [ ] Revisar todo y **enviar** (solo usted). Transbank escribirá al contacto comercial y técnico del código: responda esa confirmación.

## Después del envío
13. [ ] Esperar la API Key (≈24 h hábiles). **No** la pegue en ningún chat ni en Git: va solo en `payments.json` del servidor.
14. [ ] Con la API Key: infraestructura (`/data`, `payments.json`, `accept-compose`), textos legales aprobados, activación y **compra real de $50** (autorización expresa, por separado).
