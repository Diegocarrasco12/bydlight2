# Validación final en producción (postdespliegue), 2026-11-10

Sitio: https://bydlightsolutions.com. Release desplegado según `bd-run status` (confirmado por el administrador, no verificable desde aquí): `1970e4c77a7425f714bd5406ed67edf1ae218373` (anterior `b28448196fb89f9814621a709475029ae086dd21`). Ventana de pruebas: 17:27–17:40 UTC. **Modo estrictamente de solo lectura**: no se envió ningún formulario, no se creó ninguna solicitud, pago ni correo, y no se tocó el servidor ni Cloudflare. Capturas en `docs/auditorias/capturas-validacion-2026-11-10/`.

## A. Veredicto: **APTO CON OBSERVACIONES**
El sitio publicado corresponde al release final, todas las páginas se renderizan sin errores ni recursos fallidos, el checkout se recorre hasta el último paso sin efectos y el sitio estuvo estable durante la ventana de pruebas. Quedan un pendiente externo (HTTP sin redirigir) y un riesgo de disponibilidad sin causa identificada (502 anteriores, no reproducidos hoy). El flujo transaccional real no se re-ejecutó: se respalda en pruebas locales y en evidencia anterior.

## B. Matriz de resultados
| Área | Estado | Evidencia | URL | Método | Riesgo |
|---|---|---|---|---|---|
| Identidad del release | OK | HSTS, CSP Report-Only y `method="post"` presentes; los 13 archivos `/_next/static` de `/contratar` existen con el mismo nombre en el build local, y 3 comparados byte a byte (SHA-256) son idénticos | `/contratar` | Producción (GET) + comparación con el build local | Bajo |
| Recorrido de 8 páginas | OK | `/`, `/servicios`, `/planes`, `/contratar`, `/contacto`, `/terminos`, `/privacidad`, `/devoluciones`: 200, título único, 1 H1, 0 imágenes rotas o sin `alt`, 0 errores de consola, 0 errores de hidratación, 0 respuestas ≥400, sin desborde horizontal | cada una | Playwright (contexto aislado limpio) + curl | Bajo |
| Enlaces | OK | 27 enlaces internos de la portada: los 17 de servicios/proyectos/legales no recorridos por el navegador responden 200; externos (`wa.me`, `onlyenergyspa.cl`) no comprobados | `/` | curl | Bajo |
| Estáticos (CSS, JS, fuentes, imágenes) | OK | 13/13 en 200; sin videos en las páginas actuales (los `hero*.mp4` de versiones antiguas ya no se piden) | `/contratar`, `/` | curl + red del navegador | Bajo |
| Checkout `/contratar` | OK hasta el último paso sin efectos | ver §G | `/contratar` | Playwright | Medio (envío y pago no probados) |
| Formularios: POST y sin filtración | OK | `/contratar`: `post /api/solicitudes`; `/contacto`: `post`; la URL no cambió tras interactuar; sin JavaScript el formulario se muestra y mantiene `post`; sin secretos en el HTML | `/contratar`, `/contacto` | DOM + curl | Bajo |
| HTTPS / TLS | OK | TLS 1.3, certificado `CN=bydlightsolutions.com` (Let's Encrypt), vigente del 2026-10-26 al 2027-01-24 | `/` | openssl | Bajo |
| **HTTP→HTTPS** | **PENDIENTE EXTERNO** | `http://bydlightsolutions.com/` y `/contratar` responden **200 sin redirigir** | `http://…` | curl | Medio |
| HSTS | OK | `strict-transport-security: max-age=86400` (sin includeSubDomains ni preload) | `/contratar` | curl -I | Bajo |
| CSP | **Solo informe** | `content-security-policy-report-only` presente; **0 violaciones** vistas en consola en las 8 páginas. No bloquea nada ni protege todavía | todas | Playwright | Medio |
| Otras cabeceras | OK | `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy`, `cache-control: public, max-age=0, must-revalidate` | `/contratar` | curl -I | Bajo |
| Responsive 360/390/768/1440 | OK | 4 páginas × 4 anchos: `scrollWidth = clientWidth`; la tabla de `/planes` está en un contenedor con scroll horizontal y la maqueta de la portada recortada (`overflow-x: clip`); menú móvil abre y cierra con Escape; barra flotante WhatsApp/Cotizar no tapa el formulario en las capturas | `/`, `/planes`, `/contratar`, `/contacto` | Playwright + capturas | Bajo |
| Accesibilidad básica | OK | etiquetas `for` en los 6 campos de texto; orden de tabulación lógico; foco visible (contorno de 2 px); botón de menú con `aria-label`. Contraste solo revisado a ojo, sin medición | `/contratar` | Playwright | Bajo |
| SEO | OK con 1 observación | title, description, canonical, Open Graph y JSON-LD en las páginas indexables; `robots.txt` con `Sitemap:`; `sitemap.xml` con 21 URL; legales `noindex` fuera del sitemap (correcto) | varias | curl + DOM | Bajo |
| Disponibilidad 502 | **NO REPRODUCIDO** | ver §E | `/`, `/img/…` | curl espaciado | Medio |
| Webpay (interfaz) | OK | marca Webpay Plus/Transbank visible; texto de pago seguro; el servidor ya figuraba `production/public` | `/contratar` | DOM | Bajo |
| Webpay (iniciar, retorno, comprobante) | **No verificado hoy** | respaldado por 195 pruebas locales y por el pago real de $50 anterior | — | — | Medio |
| Brevo | **No verificado hoy** | respaldado por la evidencia confirmada (HTTP 200, correo recibido, cola `ENVIADO=1`) | — | — | Bajo |

## C. Hallazgos
| Pri. | Hallazgo | Tipo | Evidencia | Acción |
|---|---|---|---|---|
| P1 | Cortes 502/timeouts del día (14:50–14:55 y 16:11–16:13 UTC) sin causa identificada | **Defecto observado, causa = hipótesis** | Ver §E | TI: logs del origen y del túnel (comandos en `docs/deploy/RELEASE_FINAL_BYDLIGHT2_2026-11-10.md` §13) |
| P2 | HTTP no redirige a HTTPS | **Confirmado** | `curl -sI http://bydlightsolutions.com/` → 200 | TI: activar *Always Use HTTPS* en Cloudflare |
| P3 | Páginas `noindex` (`/terminos`, `/privacidad`, `/devoluciones`, `/informacion-comercial`, `/servicios-digitales`, `/soporte`) declaran `canonical` hacia la portada (`https://bydlightsolutions.com`), heredado de `src/app/layout.tsx:50` | **Confirmado**, sin impacto práctico (están `noindex`) | HTML de cada página | Definir su propio canonical o quitarlo |
| P3 | El formulario usa `noValidate` y no valida en el cliente: los `required` no actúan y los errores salen del servidor tras enviar | **Confirmado por inspección**; los mensajes no se pudieron ver sin enviar | DOM (`noValidate: true`, 5 `required`) | Valorar validación cliente; el servidor ya valida (pruebas 17/17b) |
| P3 | El campo trampa `website` tiene etiqueta y queda fuera de pantalla (`left ≈ -9897 px`, `tabindex=-1`); no se verificó si lectores de pantalla lo anuncian | **Hipótesis** | DOM | Marcarlo `aria-hidden` si se confirma |
| Info | El navegador de pruebas tiene Kaspersky, que inyecta un script con conexión larga (`gc.kes…`): la espera `networkidle` agotó 45 s en las 8 páginas, aunque cada una se había renderizado. Sin Kaspersky no se ha comprobado | Observación del entorno de pruebas | Peticiones `ERR_ABORTED` al dominio de Kaspersky | No atribuible al sitio |

## D. Cobertura
- **Verificado directamente en producción:** estados HTTP, cabeceras, TLS, redirección HTTP, renderizado y consola de 8 páginas en contexto limpio, formularios (método, acción, campos, etiquetas, teclado, comportamiento sin JavaScript), recursos estáticos y su coincidencia con el build local, 4 resoluciones, menú móvil, SEO básico y muestreo de disponibilidad.
- **Respaldado por pruebas locales (195/195, 0 fallidas, 0 omitidas):** montos, términos, retorno aprobado/rechazado/cancelado, duplicados, idempotencia, timeouts, persistencia y comprobante (`payments.test.mjs`, `webpay-fase2.test.mjs`); correo y reintentos (`brevo.test.mjs`); formularios, cabeceras y CSP (`cierre-seguridad.test.mjs`); respaldo (`backup-release-final.test.mjs`). Además, la comparación de código entre `b28448196fb` y el release muestra que **no cambió ningún archivo de pagos**: solo formularios, cabeceras, `mail-check` y la configuración.
- **Respaldado por evidencia histórica (confirmada por el administrador, no verificable aquí):** pago real de $50, Webpay `production/public`, credenciales y reembolsos apagados, Brevo HTTP 200, correo recibido, cola `ENVIADO=1`, SHA desplegado, `verify`, `compose-diff` y respaldo.
- **No verificado:** envío del formulario y sus mensajes de error; inicio de pago, redirección y retorno de Webpay en producción; recepción de un correo real; violaciones CSP en la redirección a Webpay; navegación «hacia atrás»; protección contra doble clic en vivo (solo por código, `disabled={busy}`); contraste medido; enlaces externos; estado del servidor y de Cloudflare (sin acceso).

## E. Disponibilidad
**NO REPRODUCIDO.** Muestreo pasivo, espaciado y sin concurrencia, entre 17:30:29 y 17:36:37 UTC: **14 rondas × 2 solicitudes** (`/?m=n` y `/img/logos/logo2.png`, una cada 30 s) con **28 de 28 en 200**, TTFB de 0,09–0,17 s para la portada y de 0,04–0,07 s para el logo. Además, 14 páginas en curl a las 17:27 (todas 200, una `robots.txt` con TTFB de 1,56 s), 8 páginas + 16 vistas responsivas + 17 enlaces internos sin un solo ≥400. Los Ray ID quedaron en el registro de la prueba (`…-SCL`, por ejemplo `a586c464bdf0aa92`, `a586d208ac1388b2`).
- Los **404 y la portada antigua** vistos en el navegador de pruebas anterior eran **caché del navegador** (`transferSize 0`, HTML de una versión anterior al 2026-10-27); en un contexto limpio no aparecen, y los 13 archivos actuales coinciden con el build.
- Los **502 y timeouts reales** (14:50–14:55 y 16:11–16:13 UTC) **no se explican** con estos datos. Que hoy no aparezcan no prueba que estén resueltos. Hipótesis sin demostrar: reinicio u OOM del contenedor (`mem_limit 512m`) o reconexión del túnel. Falta la comprobación de TI con logs.

## F. Seguridad
- **HTTPS:** TLS 1.3 y certificado válido. **La redirección de HTTP no está activa** (pendiente de Cloudflare).
- **HSTS:** activo con `max-age=86400`; vigencia deliberadamente corta.
- **CSP:** **solo Report-Only: no bloquea nada**. Sin violaciones observadas, pero la redirección a Webpay no se vio.
- **Formularios:** POST en producción, sin datos personales en la URL, sin secretos en el HTML de `/contratar` (la única coincidencia de la búsqueda fue la palabra «ecommerce»). Los formularios no se enviaron. (Que `GET` a `/api/solicitudes`, `/api/pagos/*` y `/api/admin` responde 405 se comprobó en la auditoría previa al despliegue y hoy no se repitió, para no tocar endpoints de escritura.)

## G. Checkout
Recorrido en `/contratar`, con el navegador aislado: carga del formulario → lista de planes (Emprendedor $149.990, Web Profesional $299.990 [preseleccionado], Web Empresa $499.990, Ecommerce $699.990, todos «IVA incluido»; nota «Valores en pesos chilenos (CLP) con IVA incluido») → cambio a «Empresa» (aparecen razón social* y RUT* obligatorios, giro y dirección opcionales) y de vuelta a «Persona natural» → casilla de solicitud, aviso de derecho de retracto y casilla de términos/privacidad con enlaces → navegación con teclado por todos los campos hasta el botón «Solicitar este plan» (habilitado). **Me detuve ahí, sin pulsarlo ni escribir datos**, porque envía una solicitud real. No hay un resumen previo al pago en esta página: aparece solo tras la aprobación de la cotización en `/orden/<id>` (no verificado hoy). El flujo posterior depende de aprobar la cotización a mano.

## H. Decisión final
**¿Puede Bydlight2 recibir clientes y pagos reales con un nivel de seguridad y disponibilidad aceptable? Sí, con condiciones.**
- **Qué lo respalda:** el sitio publicado es el del release (cabeceras, formularios y archivos idénticos al build); ninguna página falla ni en escritorio ni en móvil; los formularios ya no pueden filtrar datos por la URL; la ruta de pagos no cambió desde el release donde se cobró y concilió el pago real de $50; 195 pruebas locales aprobadas; 28/28 solicitudes espaciadas correctas.
- **Qué no se ha demostrado:** que el envío del formulario, la redirección a Webpay, el retorno y el correo funcionen **con este release**; y que la intermitencia del origen esté resuelta.
- **Riesgos que permanecen:** (1) cortes 502 sin causa conocida, que podrían interrumpir a un cliente en pleno pago, por lo que TI debería revisar los logs antes de una campaña; (2) HTTP sin redirigir; (3) CSP sin aplicar; (4) validación del formulario solo en el servidor.
- **Recomendación:** antes de promocionar el sitio, TI activa *Always Use HTTPS* y entrega la salida del diagnóstico de los 502; y el titular, si quiere cerrar la prueba de extremo a extremo con este release, hace él mismo una solicitud propia (no la hago yo, porque crea registros reales).
