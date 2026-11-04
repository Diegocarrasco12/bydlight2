# Fase 6.1 — Optimización del rendimiento móvil de Inicio

Estado: **medido y diagnosticado; no se incorporó ningún cambio de código** (ninguna prueba fue mejora demostrable y sin riesgo). Contexto: [identidad visual](FASE6-IDENTIDAD-VISUAL-SIGNATURE.md) §2 · [plan de despliegue](FASE6-PLAN-DESPLIEGUE.md).

## 1. Condiciones de medición (iguales en todas las pruebas)
Build de producción local (`next start`, `127.0.0.1`), Lighthouse 12 con la configuración **por defecto** de móvil (CPU ×4, 4G lenta simulada), solo categoría Rendimiento, bloqueando únicamente el script que Kaspersky inyecta (`--blocked-url-patterns="*kaspersky*"`). No se tocaron la simulación, el perfil ni los umbrales. Mismo equipo y misma sesión. Son mediciones de laboratorio, **no datos de usuarios reales**.

## 2. Línea base real: el «69» era una sola corrida
| Corrida | Puntaje | FCP | LCP | TBT | SI |
|---|---|---|---|---|---|
| 1 | 84 | 2,2 s | 3,9 s | 100 ms | 3,3 s |
| 2 | 85 | 2,2 s | 3,9 s | 100 ms | 2,2 s |
| 3 | 63 | 2,7 s | 3,8 s | 750 ms | 5,1 s |
| **Mediana (rango)** | **84 (63–85)** | 2,19 s (2,17–2,66) | 3,95 s (3,84–3,95) | 100 ms (96–750) | 3,26 s (2,19–5,09) |

CLS = 0 en todas. La medición es **bimodal**: o ≈ 85 (TBT ≈ 40–100 ms) o 63–72 (TBT 560–830 ms). El 69 informado antes correspondía a una corrida del grupo malo.

## 3. Causas medidas (no supuestas)
| Hallazgo | Evidencia | Efecto |
|---|---|---|
| **El TBT alto aparece solo cuando el arranque del 3D cae dentro de la ventana medida.** El hero inicia la escena con la primera interacción o a los **3,5 s** (`HeroNetwork.tsx`). En el *trace*, una tarea de 168 ms (≈ 3,9 s) y otra de 65 ms; en las corridas malas el fragmento de la escena suma ~980 ms de script simulado | trace de Lighthouse; corridas 3 de la línea base | Explica la oscilación 85 ↔ 63–72 |
| Three.js **no** se carga ni se ejecuta en la carga inicial | solicitudes: 8 scripts de ≈ 150 KB en total antes del primer pintado; la escena llega después | Three.js no es la causa del LCP/FCP |
| Con CPU ×4 en un navegador con GPU, el arranque del 3D produce solo 2 tareas largas (54 y 116 ms) y **ninguna** durante la carga | `PerformanceObserver` de *long tasks* con estrangulamiento de CPU | El Chrome de Lighthouse renderiza WebGL por software: el costo del 3D está **sobrestimado** respecto de un teléfono real |
| FCP 2,1–2,5 s y LCP 3,8–3,9 s son un **suelo común del sitio** en este entorno (Contacto, sin 3D, mide LCP 3,0 s y FCP similar) | comparación con las demás páginas de la Fase 6 | No es un problema específico del hero |
| LCP = el `h1` (texto), sin imagen; 88 % «retraso de renderizado» | auditoría `lcp-breakdown`; el titular no depende de JS ni de animaciones (verificado en CSS) | No hay imagen LCP que optimizar |
| CSS bloqueante: 2 hojas (18 KB + 1 KB), ≈ 330–460 ms estimados | auditoría `render-blocking` | Ver §4-B |
| JS sin usar ≈ 54–95 KiB; JS «legacy» ≈ 14 KiB; imágenes sobredimensionadas ≈ 131 KiB | auditorías `unused-javascript`, `legacy-javascript`, `image-delivery` | Ganancias pequeñas y de riesgo medio; las imágenes ya son `loading="lazy"` |
| Fuentes: `display: swap`, las dos primeras precargadas | `layout.tsx` y solicitudes | Correcto |

## 4. Experimentos (cada uno con 5 corridas y reversión si no mejoraba)
| Variante | Puntajes | Mediana | FCP / LCP / TBT / SI (medianas) | Decisión |
|---|---|---|---|---|
| **Base** (3 corridas) | 84, 85, 63 | 84 | 2,19 s / 3,95 s / 100 ms / 3,26 s | — |
| **A.** `content-visibility: auto` en las 7 secciones bajo el pliegue | 72, 87, 72, 86, 67 | 72 | 2,13 s / 3,77 s / 560 ms / 2,95 s | **Descartada**: diferencias dentro del ruido y riesgo real: a 768 px las secciones no pintadas se estiman en 760 px frente a 480–2815 px reales (altura total 12 798 vs 15 253 px hasta recorrerlas), lo que descoloca la barra de scroll y los saltos a anclas. A 390 y 1366 px la altura final era idéntica |
| **B.** `experimental.inlineCss` (CSS dentro del HTML) | 74, 57, 74, 74, 74 | 74 | **3,34 s / 5,07 s** / 41 ms / 3,34 s | **Descartada**: empeora (HTML de 152 KB → 425 KB) |
| **C.** Temporizador de respaldo del 3D de 3,5 s → 8 s (**solo para medir**) | 84, 84, 86, 86, 84 | **84** | 2,13 s / 3,78 s / **47 ms (38–99)** / 4,45 s | **No aplicada**: cambia el momento en que aparece el 3D para quien no interactúa; requiere su decisión (ver §6) |

Los tres cambios se revirtieron: el árbol de código es idéntico al previo (18 archivos modificados, 148 inserciones, sin diferencias en `src/components/hero/` ni en `next.config.ts`).

## 5. Veredicto sobre el objetivo 85/100
- **Mediana actual: 84 (rango 63–85).** El objetivo no se alcanza de forma estable sin cambiar el comportamiento del hero.
- **Límite técnico:** con el 3D fuera de la ventana medida el puntaje queda estable en **84–86** (variante C). El resto (FCP ≈ 2,1 s, LCP ≈ 3,8 s) es el suelo del sitio en el laboratorio: HTML de ≈ 150 KB, 2 hojas CSS bloqueantes y ≈ 150 KB de JS de React/Next. Bajar de ahí exige reducir CSS/JS globales (riesgo sobre el diseño aprobado) y no se justifica para ganar 1–2 puntos.
- No se manipularon las condiciones de Lighthouse; la variante C modifica el sitio, no la medición.

## 6. Decisión sobre el hero (RESUELTA 2026-11-04: opción 1; el titular mantiene el temporizador de 3,5 s y da por cerrada la optimización)
| Opción | Efecto en Lighthouse | Efecto en el hero |
|---|---|---|
| **1. Dejarlo como está (recomendado por no alterar nada)** | Mediana 84, con oscilaciones a 63–72 | Ninguno |
| 2. Respaldo del 3D a los **8 s** (la primera interacción sigue iniciándolo de inmediato) | Estable 84–86 | Quien no mueva, toque ni desplace tarda 4,5 s más en ver el 3D (la red estática SVG se ve igual mientras tanto). **Es un cambio perceptible para visitantes pasivos**, por eso no lo apliqué |

## 7. Hero: confirmación
No se modificó ningún archivo del hero (`git diff -- src/components/hero` vacío). Comprobado en el build de producción con el mismo código del hero (capturas «antes»): el canvas WebGL se activa (`hn--gl`) tras la primera interacción en 390 y 1366 px. El build final no se volvió a abrir en el navegador porque no cambió ningún archivo respecto de ese. Referencia visual: `docs/evidencias-fase6/rendimiento/antes/` (`hero-movil-390.png`, `hero-escritorio-1366.png`, `pagina-movil-390.png`, `pagina-escritorio-1366.png`). No hay carpeta «después» porque el código final es idéntico al de las capturas.

## 8. Validación posterior
`npm test` 41/41 · `tsc` OK · `lint` OK · `build` OK · **`npm run verify:prod` 29/29** (Webpay sigue apagado e invisible en el artefacto).
