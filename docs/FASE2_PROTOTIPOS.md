# Fase 2 y Fase 3: hero «red de nodos», ERP/SaaS y fotografía

Estado: **integrado en la portada en la Fase 3 (2026-10-28)**. Lo que corre en producción (SHA) está en `ESTADO_ACTUAL.md`.

## Qué contiene
- **Hero «red de nodos»** (`src/components/hero/HeroNetwork.tsx`, `scene-network.ts`): es el hero de `/`. Ver `ARQUITECTURA.md` §5.
- **Servicios ERP y SaaS** (`src/lib/services.ts`): `/servicios/soluciones-erp` y `/servicios/soluciones-saas`, presentados como capacidades de desarrollo, implementación,
  personalización e integración. Cada una trae una aclaración de alcance: no se ofrece un ERP ni un SaaS propio. SAP Business One y Service Layer figuran solo como capacidad técnica, sin clientes.
- **`/servicios`** agrupado en tres categorías (`ServicesByCategory`), con fotografía; **menú** con categorías en escritorio (CSS puro, hover y foco) y accesos ERP/SaaS en el menú móvil.
- **Portada**: banda `EnterpriseBand` (ERP/SaaS) tras el hero. **`/nosotros`**: banda fotográfica ilustrativa.
- Estilos nuevos en `src/styles/fase2.css` (importado tras `design.css`); cambio mínimo en `design.css` para el menú móvil.
- Fotografías: seis de Pexels, ver `CREDITOS-RECURSOS.md`.

## Por qué reaparecía el átomo (corregido)
La ruta `/` seguía importando `HeroStage` (átomo); el hero nuevo vivía solo en la ruta de comparación `/prototipo`. Entrar a `/`, recargar o pulsar el logo (enlaza a `/`) mostraba el átomo.
No era caché: no hay service worker y el HTML se revalida siempre (`next.config.ts`). Corrección: `src/app/page.tsx` usa `HeroNetwork`; la ruta `/prototipo` se eliminó.
`HeroStage.tsx` y `scene.ts` quedan como **código legado sin uso** (ninguna ruta los importa; el bundle de la portada no los incluye). Retirarlos, junto con las reglas `.hx*` de `design.css`, es una limpieza opcional posterior.

## Mediciones (Lighthouse 12, Chromium de Playwright, `next start` local, con bloqueo del script de Kaspersky)
| | Móvil rendimiento | Móvil TBT | Escritorio rendimiento | Escritorio TBT |
|---|---|---|---|---|
| Portada anterior (átomo) | 80, 87, 81 | 150–310 ms | 99 | 40 ms |
| Hero nuevo, arranque al quedar ocioso | 58–60 | 1.470–1.670 ms | 89 | 260 ms |
| **Hero nuevo, arranque diferido (Fase 3)** | **85, 85, 86** | **70–110 ms** | **99** | **10 ms** |

Accesibilidad 100 y SEO 100 en ambas. Son mediciones de laboratorio, no datos de usuarios reales.

## Limitaciones conocidas
- No se midió fps ni GPU en un teléfono real (el navegador automatizado limita `requestAnimationFrame`).
- En teléfonos de ~640 px de alto, el botón principal del hero queda detrás de la barra inferior fija al cargar (la barra ofrece la misma acción); el 3D sí queda visible.
