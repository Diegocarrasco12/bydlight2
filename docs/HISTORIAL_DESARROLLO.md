# Historial de desarrollo

Reconstruido a partir del historial de Git y de las sesiones de trabajo. Las fechas de los commits son las de Git; lo no registrado en Git está marcado.

## Cronología

| Fecha | Hito |
|---|---|
| 2026-10-26 | Ejecutor `bd-deploy` instalado y operativo en el servidor propio; primer release `0d06acf` desplegado (clon, deploy key de solo lectura, línea base de Compose aceptada). Dominio público aún servía un sitio estático antiguo |
| 2026-10-27 (mañana) | Auditoría de seguridad de dependencias (`b21f3e4`, 0 vulnerabilidades). Rediseño previo, planes con precios, SEO y portafolio (`55ae10c` en la cadena local), Webpay en sandbox (`ab87c01`), optimización de videos/imágenes y «+ IVA» (`090be48`), persistencia SQLite (`b6f95b4`), API administrativa firmada (`073bac6`) |
| 2026-10-27 | **Publicación A** (`b21f3e4`) → fetch/preflight/compose-diff/build/up/verify por el ejecutor |
| 2026-10-27 | **Publicación B** (`6c2f640`): checkout y Webpay ocultos mientras los pagos están apagados (`ONLINE_CHECKOUT_UI=false`) y documento de activación |
| 2026-10-27 | **Dominio:** el administrador cambió el ingress del túnel para que `bydlightsolutions.com`/`www` apunten al contenedor (`127.0.0.1:8200`); Claude solo entregó comandos. El dominio pasó a servir el sitio nuevo |
| 2026-10-27 | Auditoría de diseño (solo análisis) de tres sitios de referencia y propuesta de tres conceptos; decisión: «Del plano al producto» + «Núcleo de luz» |
| 2026-10-27 | **Reconstrucción total** (`af71054`): hero 3D, páginas rediseñadas, móvil propio, detalle de proyectos, corrección de caché, Lighthouse inicial. Desplegada por el administrador |
| 2026-10-27 | Diagnóstico del ejecutor en Claude Code (código 21): sin causa demostrada; el administrador despliega desde PowerShell normal |
| 2026-10-27 | `26a4cea`: contraste, fotografía de Pexels, tecnologías reales, APIs/SAP, sin WordPress (publicado, no desplegado por separado) |
| 2026-10-27 | `56fdcf1`: tecnologías por categoría, servicio de apps móviles, responsive 77/77, rendimiento y accesibilidad. **Desplegado por el administrador** (rollback: `af71054`) |
| 2026-10-27 | Cierre técnico y documentación (este conjunto de documentos) |

## Commits relevantes (Git)

```
56fdcf1  feat(web): tecnologias por categoria, servicio de apps moviles, rendimiento y responsive      ← DESPLEGADO
26a4cea  feat(web): contraste, fotografia, tecnologias reales, APIs/SAP y sin WordPress
af71054  feat(web): reconstruccion visual completa "Del plano al producto / Nucleo de luz"             ← rollback
6c2f640  feat(web): ocultar checkout y Webpay mientras los pagos estan apagados
073bac6  feat(pagos): API administrativa firmada, configuracion por archivo, endurecimiento y pruebas
b6f95b4  feat(pagos): persistencia en SQLite con migraciones, respaldo y restauracion
090be48  perf(web): optimizar videos e imagenes, redisenar Nosotros y Contacto, precios + IVA
ab87c01  feat(pagos): solicitud de contratacion y anticipo con Webpay Plus (solo sandbox)
```

## Incidencias de la jornada (y cómo se resolvieron)

- **HTML viejo en caché / página sin estilos** → causa: HTML estático antiguo cacheado apuntando a `/_next/static` inexistentes; solución: `Cache-Control` de revalidación (`next.config.ts`).
  Las cachés ya existentes expiran solas o con recarga forzada; no se purgó Cloudflare.
- **TBT alto en la home** → sondeo de WebGL y arranque temprano de la escena; solución: sin sondeo, escena diferida (`requestIdleCallback`; en móvil con la primera interacción), EmailJS diferido.
- **Desbordamientos horizontales** (proyectos, home en 430–768 px, contacto a 320 px) → ver `docs/CALIDAD_Y_PRUEBAS.md` §2.
- **Mediciones Lighthouse alteradas** por un script inyectado por Kaspersky → bloqueo solo en el navegador de prueba (`docs/CALIDAD_Y_PRUEBAS.md` §3).
- **`bd-deploy.ps1` desaparecía** (tres veces) y **código 21** en Claude Code → `docs/DESPLIEGUE.md` §4 y §9.
- Errores menores: `logs` exige número de líneas; el guard bloquea comandos multilínea o con `echo` que mencionen el ejecutor; Playwright escribe capturas en el directorio de trabajo.

## Cómo se organizó el trabajo

Sesiones con Claude Code (modelo Sonnet 5.5) con aprobación del titular en cada etapa sensible (push, `up`, dominio). Los despliegues finales (`af71054`, `56fdcf1`) los ejecutó el administrador.
