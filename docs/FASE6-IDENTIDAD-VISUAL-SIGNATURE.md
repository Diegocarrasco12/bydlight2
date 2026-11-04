# Fase 6 — Identidad visual Bydlight Signature (consolidación y verificación)

Identidad aprobada: variante **D · Bydlight Signature** (minimalismo premium + precisión técnica; Space Grotesk, Inter, IBM Plex Mono; fondo oscuro `#07090d`, acento naranja `#ff7a1a`). Origen, decisiones y comparativas A/B/C/D: [FASE4-CONSOLIDACION-SIGNATURE-WEBPAY.md](FASE4-CONSOLIDACION-SIGNATURE-WEBPAY.md) y [LABORATORIO-DISENO-ABC.md](LABORATORIO-DISENO-ABC.md). Contexto: [auditoría](FASE6-AUDITORIA-PREPUBLICACION.md).

## 1. Alcance verificado (build de producción local, Webpay apagado)
| Área | Resultado |
|---|---|
| Páginas: Inicio, Servicios (y detalle), Planes, Nosotros, Proyectos (y detalle), Contacto | Coherentes con Signature; 0 violaciones WCAG 2.1 AA (axe) |
| Navegación y pie | Logo oficial, enlaces correctos; sin enlaces rotos (20 rutas internas comprobadas) |
| Formularios | Contacto (EmailJS) sin cambios de comportamiento; estados de envío ya existentes |
| Páginas de error | **Nuevas:** 404 (`not-found.tsx`) y error inesperado (`error.tsx`), en español, con marca, navegación y contacto |
| Responsive | Sin desbordamiento horizontal a 390, 768 y 1366 px en 9 páginas |
| Hero 3D | **Sin modificar** (sus archivos no figuran en `git status`); canvas WebGL activo en el build de producción |
| SEO | Título, descripción (125–161 car.), canónica, Open Graph y un `h1` por página; 404 con `noindex` |

## 2. Métricas (Lighthouse 12, móvil, build de producción en `http://127.0.0.1`, bloqueando el script que Kaspersky inyecta)
| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Inicio | 69 | 100 | 82* | 100 | 3,9 s | 0 | 500 ms |
| Planes | 93 | 100 | 82* | 100 | 3,1 s | 0 | 50 ms |
| Contacto | 93 | 100 | 82* | 100 | 3,0 s | 0 | 90 ms |

\* Única observación: `is-on-https`, porque la medición es en HTTP local; no es un defecto del sitio (en producción el dominio va por Cloudflare; ver pendiente HTTPS forzado en el [plan](FASE6-PLAN-DESPLIEGUE.md)).
Inicio: el LCP es el título del hero y el peso lo explican three.js y el CSS bloqueante; el hero está aprobado y no se rediseña. Son mediciones de laboratorio con CPU móvil simulada (×4), **no datos de usuarios reales**. Posible mejora futura sin tocar el diseño: diferir three.js tras el primer pintado (requiere aprobación porque toca el hero).

## 3. Logo corporativo
| Uso | Archivo | Estado |
|---|---|---|
| Cabecera y pie | `public/img/logos/logo2-sm.png` (480×480, transparente; el CSS recorta el margen) | Correcto sobre fondo oscuro |
| Datos estructurados (Organization/LocalBusiness) | **`logo2-512.png` (19 KB)**, antes `logo2.png` (1,4 MB) | Corregido |
| Original de alta resolución | `logo2.png` (1024×1024) | Intacto |
| Favicon / ícono | `favicon.ico`, `icon-192.png` | Correctos |
| Imagen para compartir | `og-image.png` (1200×630, 41 KB) | Correcta |
| Comprobante de pago (pantalla, impresión y PDF) | `logo2-sm.png` | **Nuevo**: cabecera de marca al imprimir |
| Formulario de validación de Transbank | `docs/evidencias-webpay/logo-130x59.png` (derivado, fondo blanco) | **Requiere su aprobación** |

El logo es de un solo color de marca (azul) sobre transparente. **No existe una versión clara/oscura separada**: sobre el fondo oscuro del sitio se ve bien y sobre papel blanco también (comprobante). Si necesita una versión monocroma o vertical para otros usos, debe proporcionar el archivo vectorial (SVG/AI) original; no se inventó ni modificó ningún logo.

## 4. Imágenes y recursos
- Sitio público: 6,6 MB en `public/img`, pero las imágenes realmente servidas son WebP de 40–350 KB (centro de datos 1280/1920 px, portafolio, stock). Peso total de la portada: 685 KiB.
- Las fotos de stock están rotuladas «Imagen ilustrativa · Pexels» y nunca se presentan como oficinas o equipo de Bydlight (regla del proyecto); procedencia en [CREDITOS-RECURSOS.md](CREDITOS-RECURSOS.md).
- No se reemplazó ninguna imagen aprobada.
- Pendiente de su decisión: `logo1/3/4/5/6.png`, `favicon.png` y `logo2.png` (≈ 4,9 MB) no se usan en el sitio pero viajan en la imagen Docker. Opciones: dejarlos, moverlos a `docs/` o eliminarlos.

## 5. Estados y mensajes
Mensajes de formulario existentes sin cambios. Mensaje de la casilla de `/contratar` corregido en la Fase 5 (ver [propuestas legales](WEBPAY-PROPUESTAS-LEGALES.md) §5). Experiencia de pago: ver [FASE6-WEBPAY-PERSONALIZACION.md](FASE6-WEBPAY-PERSONALIZACION.md).

## 6. Evidencias visuales
`docs/evidencias-fase6/antes/` (404 de Next en inglés, 1366 y 390) vs `despues/` (404 Signature, hero 3D en producción, inicio 390). Comparativas A/B/C/D en `docs/evidencias-diseno/`.
