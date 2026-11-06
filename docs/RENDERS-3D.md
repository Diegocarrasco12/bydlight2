# Renders 3D de «Lo que construimos» (2026-11-06)

Imágenes originales, generadas por código (no hay herramienta de generación de imágenes disponible): escenas three.js (MIT) renderizadas en un navegador sin cabeza y convertidas con `sharp`. No usan fotografías, marcas de terceros ni datos reales; las cifras de las interfaces son de ejemplo (la sección lo declara).

- Fuentes: `scripts/renders3d/scenes.js` (escenas, materiales, luces, texturas de interfaz) y `render.html`. Servir la raíz del repo (`python -m http.server 8765`) y abrir `render.html?scene=s1..s6`.
- Maestros PNG: `assets-fuente/renders3d/` (versionables; fuera de `public/` y de Docker).
- Optimización: `node scripts/renders3d/optimize.mjs` → `public/img/servicios3d/` (AVIF q62 y WebP q86, dos anchos). Se usa `<picture>` con `srcset`/`sizes`, `width`/`height`/`aspect-ratio` reservados y `loading="lazy"` (consistente con el resto del sitio; no se usa `next/image` para no depender del optimizador en el servidor).

| Imagen | Servicio | Maestro | AVIF / WebP (ancho menor) | AVIF / WebP (ancho mayor) |
|---|---|---|---|---|
| software | Software a medida | 1200x1100 | 672 px: 17.7 KB / 25.6 KB | 1200 px: 35.6 KB / 54.7 KB |
| web | Desarrollo web | 1000x520 | 560 px: 8.5 KB / 12.5 KB | 1000 px: 16.7 KB / 24.7 KB |
| moviles | Aplicaciones móviles | 1000x520 | 560 px: 7.6 KB / 10.9 KB | 1000 px: 15.8 KB / 23.1 KB |
| integraciones | Integración de sistemas | 1000x560 | 560 px: 10.3 KB / 16.0 KB | 1000 px: 18.0 KB / 34.4 KB |
| automatizacion | Automatización | 800x600 | 448 px: 8.4 KB / 10.7 KB | 800 px: 15.8 KB / 23.9 KB |
| arquitectura | Arquitectura | 800x600 | 448 px: 10.4 KB / 14.6 KB | 800 px: 19.9 KB / 33.3 KB |

Total en disco (24 archivos): ~0,5 MB; cada visitante descarga solo un formato y un ancho por tarjeta, y solo cuando la tarjeta se acerca a la pantalla.

## Medición Lighthouse móvil (build de producción local, `/`, 3 corridas, 2026-11-06)
Rendimiento 69 · 79 · 77 (la primera corrida es en frío) · FCP 2,0 s · **LCP 2,0 s** · **CLS 0** · TBT 2.020 / 770 / 870 ms. Las imágenes 3D no se descargan en la carga inicial (están bajo el pliegue y son lazy): 0 KB de renders en el LCP. El trabajo de hilo principal (Estilo y diseño ~1,4 s con CPU ×4) viene de la página completa; no se pudo medir una línea base idéntica sin estos cambios (el árbol limpio no compila con enlaces a `node_modules`), así que no se afirma mejora ni regresión: la medición anterior (84) se hizo en otra máquina y otra fecha. Es un dato de laboratorio, no de usuarios reales.
