# Fase 5 — Hero definitivo (alternativa C) · autorizado para publicación

Estado: **el titular autorizó commit, push y despliegue si las verificaciones críticas pasan.** Producción sigue en `67287c0` hasta confirmar el despliegue (ver `ESTADO_ACTUAL.md`). Las carpetas de capturas no se versionan.
Base: `FASE4_PROPUESTAS_HERO.md` (se aprobó la alternativa C). Capturas: `docs/fase5-capturas/`.

## Qué cambió (resumen simple)
- **Escritorio**: foto de centro de datos de fondo (oscurecida y teñida al azul de marca) y la red 3D a pantalla completa, desplazada a la derecha para no pisar el texto.
- **Integración foto + 3D**: la misma foto alimenta los reflejos del metal (mapa de entorno PMREM), así los nodos reflejan los racks y la luz de la foto. Se quitaron los anillos «tipo Saturno», se redujeron pulsos y puntos de fondo y los nodos lejanos se funden con la oscuridad (niebla atmosférica). Movimiento: deriva orgánica lenta de cada nodo, giro muy lento y paralaje suave con el puntero.
- **Móvil**: sin cambios (misma escena `scene-network` y mismo CSS; la foto no se descarga en móvil).
- **Respaldo sin WebGL**: foto de fondo + red SVG grande a la derecha, sin errores de consola (se prueba el contexto antes de crear el renderer).
- **`prefers-reduced-motion`**: un solo cuadro 3D sobre la foto; sin bucle de animación.

## Archivos
| Archivo | Cambio |
|---|---|
| `src/components/hero/HeroNetwork.tsx` | **Modificado**: capas `hn-photo`/`hn-haze`/crédito; escritorio carga `scene-hero`, móvil `scene-network`; importa `hero-c.css` |
| `src/components/hero/scene-hero.ts` | **Nuevo**: escena de escritorio (entorno desde la foto, 3 acabados PBR, cuadros adaptativos 60 con interacción / 30 en reposo) |
| `src/styles/hero-c.css` | **Nuevo**: todo el estilo de escritorio (`@media (min-width: 901px)`); en móvil `display:none` |
| `src/components/hero/HeroNetworkClassic.tsx` | **Nuevo**: copia de la versión publicada, **respaldo** sin uso (volver = cambiar el import en `src/app/page.tsx`) |
| `src/components/hero/lab/`, `src/app/lab/` | **Eliminados** (laboratorio de la Fase 4; se comprobó que nada los importaba) |
| `docs/FASE4_PROPUESTAS_HERO.md`, `docs/FASE5_HERO_DEFINITIVO.md` | Nuevos (documentación). Las capturas (`docs/fase4-capturas/`, `docs/fase5-capturas/`, ~35 MB) quedan locales, sin versionar |

No se tocaron `page.tsx`, `layout.tsx`, `fase2.css`, `design.css`, servicios, navegación, Docker ni Webpay. `r-og.png` y `demos/windows-inventory/obj/` siguen sin versionar.

## Validación
| Comprobación | Resultado |
|---|---|
| `tsc --noEmit`, ESLint, `npm test` | sin errores · 18/18 |
| `npm run build` | correcto |
| Logo y recarga (escritorio 1440 y móvil 390) | `.hn` presente, `.hx` ausente, 0 errores de consola |
| Desborde horizontal 1366 / 1440 / 1920 / 1024 / 390 / 360 | ninguno (nueva y publicada) |
| Fotos | 1366–1499 px: `centro-de-datos-1280.webp` (200); ≥1500 px: `…-1920.webp` (200), una sola descarga; **móvil: ninguna** |
| Sin WebGL (escritorio) | foto + SVG visible, 0 errores (la versión publicada emite 3 errores de three.js en este caso) |
| `prefers-reduced-motion` | 5 operaciones de limpieza al inicio (compilación del entorno) y 0 después de 3 s: sin bucle |
| Contraste del texto (fondo detrás del bloque, sin texto; peor 5 % más claro) | subtítulo ≥ 6,7:1, titular ≥ 15,8:1, cian ≥ 11,9:1 (1024–1920 px) |
| Lighthouse (local, `next start`, 3 corridas, bloqueando Kaspersky) | ver abajo |

### Lighthouse (mediana de 3; misma sesión y equipo para ambas)
| | Rendimiento | LCP | TBT | CLS | SEO / A11y |
|---|---|---|---|---|---|
| Publicada · móvil | 64 / 66 / 68 | 3,81 s | 747 ms | 0 | 100 / 100 |
| **Nueva · móvil** | 61 / 66 / 64 | 3,94 s | 817 ms | 0 | 100 / 100 |
| Publicada · escritorio | 99 / 99 / 99 | 0,84 s | 2 ms | 0 | 100 / 100 |
| **Nueva · escritorio** | 99 / 99 / 99 | 0,97 s | 3 ms | 0 | 100 / 100 |

- **Móvil**: la diferencia está dentro del ruido entre corridas (peso de página 676 KB contra 673 KB; código móvil idéntico). Las cifras móviles de hoy son más bajas que las de la Fase 3 (85) porque el equipo estaba más cargado; **solo son comparables entre sí**, no con datos de usuarios.
- **Escritorio**: mismo puntaje; +0,13 s de LCP y +134 KB de peso por la fotografía (1280 px).

### Fluidez en GPU real (AMD Radeon integrada, Direct3D 11, Chromium de Playwright, 10 s por corrida, 3 corridas)
| | Cuadros de escena | p95 / máx. de intervalo | Cuadros > 33 ms | CPU del proceso GPU |
|---|---|---|---|---|
| Publicada, 1440 / 1920 | 27 fps (tope efectivo, ver nota) | 18,1 / 19,1 ms | 0 / ~1080 | 6,2 % / 5,6 % |
| Nueva, 1440 / 1920 | ~51 fps | 17,9 / 19,3 ms | 0 / ~1530 | 15,7 % / 15,1 % |

Notas: (1) las corridas usan `--disable-frame-rate-limit` (sin sincronía vertical, rAF ≈ 150 Hz); en una pantalla de 60 Hz la nueva escena apunta a 60 cuadros. La escena publicada tiene un tope de «45 fps» que, por cómo filtra los ticks, produce 30 en 60 Hz; en la nueva se corrigió el tope (~60). (2) A igual tasa de cuadros (primera medición, ambas con tope de 45) la nueva consumió ~35 % más CPU en el proceso GPU (8,4 % contra 6,2 %); la nueva renderiza más píxeles (canvas a pantalla completa) y más geometría. (3) Ningún cuadro superó 33 ms en ninguna de las dos.

### Optimizaciones finales de bajo riesgo (revisión previa a publicar)
- Cuadros adaptativos: 60 fps durante 1,8 s tras mover el puntero y 30 fps en reposo (movimiento lento, sin pérdida visible). Suavizado del puntero dependiente del tiempo.
- La foto del entorno se reduce a 1024 px antes de generar el mapa PMREM (menos memoria GPU y trabajo inicial).
- La niebla se crea una vez y solo se actualizan `near/far` al redimensionar.
- Se conservan la pausa fuera de pantalla, la pausa con pestaña oculta, la carga diferida y la liberación de recursos.
- Resultado en GPU real (AMD integrada): CPU del proceso GPU en reposo ~8,5 % (antes de optimizar ~16 %; publicada 6,2 % a 27 fps). Con interacción continua ~51 fps sin cuadros > 33 ms.
- Móvil (5 corridas Lighthouse, nueva): rendimiento 64–65, LCP ~3,84 s, TBT 817–887 ms; la publicada midió 64–68 y 747 ms. Diferencia pequeña y no atribuible con certeza (el código y los recursos móviles son idénticos); se reporta como dentro del ruido, sin demostrar.

## Límites de la validación (sin afirmar de más)
- **GPU real medida: solo una integrada AMD Radeon en escritorio.** No se midió en GPU dedicada, en portátiles sin GPU decente ni en teléfonos o tabletas. **El rendimiento NO está validado en dispositivos móviles ni en equipos de gama baja**, aunque en móvil el código y los recursos no cambian.
- No se pudo atribuir un porcentaje de uso de GPU: el contador de Windows tenía una línea base de ~27 % por otras aplicaciones (ruido mayor que la señal).
- Lighthouse es una medición de laboratorio local (HTTP, sin CDN), no datos de usuarios.
- El respaldo sin WebGL y reduced-motion se probaron con indicadores de Chromium en 1440 px; no en otros navegadores (Safari, Firefox).
- Revisión visual manual en pantallas reales: pendiente (la hace el titular).

## Riesgos y pendientes
- Dependencia de una foto de stock (Pexels): siempre rotulada «Imagen ilustrativa · Pexels», sin presentarla como instalaciones de Byd Light.
- +134 KB en escritorio; si se quiere ahorrar, generar un WebP 1280 más liviano o una variante de 1024 px.
- La escena consume algo más de GPU que la publicada (~8,5 % contra 6,2 % del proceso GPU en reposo); si preocupa, bajar `FRAME_ACTIVE` en `scene-hero.ts`.
- Con `HeroNetworkClassic.tsx` + `scene-network` desktop sin uso, queda código duplicado hasta decidir su limpieza (`HeroStage.tsx`, `scene.ts` y `.hx*` ya eran legado).
- Antes de producción: confirmar, tras el despliegue, el hero en el dominio público (escritorio y móvil, logo, recarga) con el flujo documentado.

## Recomendación de publicación
Publicar **cuando el titular valide visualmente** las capturas y la animación en su pantalla: la integración visual es sólida, el móvil no cambia, Lighthouse de escritorio es igual y no hay errores de consola. Condiciones: (1) revisión visual del titular, (2) idealmente probarlo en un portátil de gama media o un equipo sin GPU dedicada antes del despliegue, (3) commit y despliegue solo con su autorización expresa. Rollback: el commit anterior (`67287c0`) o cambiar el import a `HeroNetworkClassic`.
