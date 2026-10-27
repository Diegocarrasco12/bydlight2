# Calidad y pruebas (resultados reales, 2026-10-27)

Todo lo de este documento se midió **en local** (build de producción servido con `next start`) salvo que se indique lo contrario.
**No son resultados de usuarios reales ni del dominio público.**

## 1. Verificaciones automáticas (commit `56fdcf1`)

| Verificación | Resultado |
|---|---|
| `npm test` (Node 22) | **18/18** pasan (pagos + smoke de módulos). Requiere Node ≥ 22.13 por `node:sqlite` |
| `npx tsc --noEmit` | Sin errores |
| `npm run lint` (ESLint 9 + `eslint-config-next`) | 0 errores, 0 warnings |
| `npm run build` | Compila (Turbopack); 22 páginas generadas; rutas listadas en `docs/ARQUITECTURA.md` |
| Pruebas del ejecutor (`deploy/executor`, Python) | 129 según el registro del 2026-10-26 (`CLAUDE.md` anterior); **no se repitieron en esta jornada** |

Sobre ESLint: los 7 warnings `@next/next/no-img-element` se resolvieron desactivando esa regla en `eslint.config.mjs` con justificación (WebP ya optimizado, `srcset`
y dimensiones explícitas; `next/image` exigiría el optimizador en runtime, `sharp`, dentro del contenedor de solo lectura).

## 2. Pruebas responsive

- Script de Playwright (Chromium) sobre el servidor local: **11 páginas × 7 anchos = 77 combinaciones** (320, 375, 390, 430, 768, 1024, 1440 px).
  Páginas: `/`, `/servicios`, `/servicios/integraciones-y-apis`, `/servicios/aplicaciones-moviles`, `/servicios/desarrollo-web`, `/proyectos`,
  `/proyectos/only-energy`, `/proyectos/ginfet`, `/planes`, `/nosotros`, `/contacto`. Comprobó desbordamiento horizontal (`scrollWidth > clientWidth`),
  elementos que sobresalen del viewport e imágenes rotas.
- **Primera pasada: había desbordamientos reales** — `/proyectos` (375–1024 px), home y `/nosotros` (430–768 px): provenían del resplandor decorativo y de la
  inclinación 3D de la sección de proyectos, que sobresalían del contenedor. Además, a 320 px, el contacto de la home ensanchaba la columna (grid `1fr` con *min-content*).
  **Correcciones:** `overflow-x: clip` en secciones decorativas, `minmax(0,1fr)` en cuadrículas de una columna y `min-width: 0` en hijos de grid (`design.css`).
- **Resultado final: 77/77 sin desbordamientos, sin imágenes rotas, sin enlaces internos rotos (18 comprobados).**
- Revisión visual con capturas reales: hero en tres puntos del scroll, banda de infraestructura, APIs, método, tecnologías y pie en 320, 430 y 768 px;
  home, `/nosotros` y detalle de proyecto en escritorio; menú móvil abierto en 390 px. **No se revisó manualmente cada página interna en cada ancho** (solo la
  comprobación automática de desbordes). INP no se midió (no es medible en laboratorio).
- Funcional (Playwright): menú móvil abre/cierra con Escape (`inert` al cerrar); formulario precarga el plan (`?plan=profesional`), valida campos y carga EmailJS solo al
  enviar (el envío se probó **interceptando** la llamada; no salió correo real); con `prefers-reduced-motion` el hero queda estático sin canvas; a DPR 2 se elige la variante
  de 1920 px de la foto de la banda.

## 3. Lighthouse (v12, Chromium de Playwright, `next start` local)

### Mediciones y su limitación (importante)

El equipo de pruebas tiene **Kaspersky Endpoint Security**, que **inyecta un script** (`gc.kes.v2.scr.kaspersky-labs.com/.../main.js`, ≈124 KB, bloqueante) en las páginas
que carga el navegador de prueba. Ese script no es de Bydlight y distorsionaba Lighthouse (la home móvil bajaba de ~80 a 55–62 y aparecía como recurso bloqueante de 1,2 s).
Para medir solo el sitio se bloqueó **exclusivamente en el navegador de prueba**, con la opción de Lighthouse `--blocked-url-patterns="*kaspersky-labs.com*"` (bloqueo por
CDP de esa URL). (`--host-resolver-rules` no funcionó porque la intercepción ocurre a nivel de red del equipo.) **No se modificó la configuración de Kaspersky ni la seguridad
del equipo.** Aun así, la varianza entre corridas es alta (p. ej. 62–82 para la misma página con la inyección presente) y el TBT depende de cuándo arranca la escena 3D.

### Resultados con el bloqueo en el navegador de prueba (build `56fdcf1`)

| Página | Dispositivo | Rendimiento | LCP | TBT | CLS | Accesib. | SEO | Mejores prácticas |
|---|---|---|---|---|---|---|---|---|
| Home (3 corridas) | Móvil | **82, 85, 80** | 3,6–3,9 s | 190–310 ms | 0 | 100 | 100 | 82 |
| Nosotros | Móvil | 86 | 3,6 s | 200 ms | 0 | 100 | 100 | 82 |
| Proyectos | Móvil | 91 | 3,5 s | 60 ms | 0 | 100 | 100 | 82 |
| Servicio de APIs | Móvil | 94 | 2,9 s | 130 ms | 0 | 100 | 100 | 82 |
| Home | Escritorio | 98 | 0,8 s | 110 ms | 0 | 100 | 100 | 81 |

- «Mejores prácticas» 81–82: lo único que falla es `is-on-https` (la prueba es por HTTP local).
- **Objetivo orientativo de 85 en la home móvil: alcanzado en 1 de 3 corridas, no de forma estable.** El LCP es el `<h1>` (texto, no imagen). En la traza observada el LCP real fue
  ≈ 0,65 s; la cifra de ~3,7 s es la **simulación** de móvil lento de Lighthouse (CPU 4×, red 4G lenta) con CSS (≈ 11 KB) y JavaScript (~124 KB de runtime de Next/React, ~70 KB sin usar
  en la carga inicial) bloqueantes. La caché y el HTTP/2 del dominio real pueden cambiarlo.
- Historial (mismo método con la inyección presente, no comparable estrictamente): reconstrucción `af71054` — home escritorio 91, móvil 71; tras añadir fotos y secciones, antes de optimizar
  — home móvil 55; tras optimizar (escena móvil diferida, 380 partículas, fuente mono sin precarga) — 78–82.
- Peso: fotos nuevas 38–39 KB (código y fibra) y 131 KB (centro de datos, 1280 px; 348 KB en 1920 px solo para alta densidad), todas con carga diferida y fuera del primer pantallazo.

### Qué falta medir
Lighthouse/PageSpeed sobre `https://bydlightsolutions.com/` (con HTTPS, HTTP/2 y caché reales), preferiblemente desde un equipo sin la inyección de Kaspersky, y datos de campo (CrUX) cuando
haya tráfico. Pendiente en `docs/PENDIENTES.md`.

## 4. Accesibilidad, SEO, seguridad y rutas (verificado en local)

- Accesibilidad (Lighthouse): 100 en home, `/nosotros`, `/servicios/integraciones-y-apis` y `/proyectos` (tras corregir el orden de encabezados). `/planes` móvil dio 98 por `heading-order` en la última medición: **pendiente de revisar y corregir**.
- SEO: 100. Títulos, descripción, canonical, Open Graph, 4 bloques JSON-LD en la home, un `h1`, `lang="es"`, sitemap de 19 URL (incluye `aplicaciones-moviles`; excluye `/contratar` y `/orden`),
  `robots.txt` con la URL del sitemap.
- Cabeceras de seguridad del origen: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`; `Cache-Control` del HTML `public, max-age=0, must-revalidate`.
  **Sin HSTS ni CSP en el origen** (pendiente de evaluación).
- Rutas restringidas: `/contratar` 307 → `/contacto`; `/orden`, `/orden/x` 404; `GET /api/admin` 405 y `POST /api/admin/x` 404; `GET /api/pagos/iniciar` 405; `POST /api/solicitudes` 403.
- WordPress: 0 coincidencias (insensible a mayúsculas) en `src`, `public` y HTML renderizado de las páginas probadas (la documentación interna menciona la palabra solo como regla de exclusión). Webpay/Transbank: 0 menciones en las páginas.

## 5. Comprobaciones en producción (administrador)

`verify` OK, `status` salud OK, HTTP OK tras `up` de `56fdcf1`. La auditoría visual del dominio público tras el despliegue la hizo el administrador; no hay capturas de esa
comprobación en el repositorio.
