# Cierre de jornada — 2026-10-27

La jornada de desarrollo de Bydlight2 del 27 de octubre de 2026 queda **finalizada y aprobada por el titular**. Este cierre solo documenta; no cambia código ni producción.

## Estado de producción

- Sitio: https://bydlightsolutions.com/ — proyecto Docker `bydlight-prod` (127.0.0.1:8200).
- **Desplegado: `56fdcf1cb6e05632a5425272dc3603364d0ec0cd`** (imagen `bydlight-web:56fdcf1cb6e0`). **Rollback disponible: `af710546c42ef4edb91eb2a5494a5b4e8033de69`.**
- Ejecutado por el administrador desde PowerShell normal con `bd-deploy`: `fetch` ok → `preflight` OK → `compose-diff` CUMPLE/línea base igual → `build` ok →
  `up` ok (salud y HTTP) → `verify` OK → `status` salud OK. 5 releases construidos; 18 contenedores ajenos en la línea base, sin cambios.
- El commit que añade esta documentación es **posterior** al desplegado; **no se despliega** por ello. Lo que corre en producción sigue siendo `56fdcf1`.

## Qué se logró en la jornada

- Despliegue seguro por etapas (A: `b21f3e4`, B: `6c2f640`), con pagos Webpay construidos pero apagados e invisibles.
- Dominio público apuntado al contenedor por el administrador (túnel de Cloudflare, sin intervención de Claude).
- Reconstrucción visual completa (`af71054`) y evolución a un sitio con contraste, fotografía ilustrativa, tecnologías, APIs/SAP y apps móviles (`26a4cea`, `56fdcf1`).
- WordPress eliminado de toda la experiencia pública.
- Corrección de la caché del HTML (causa real del sitio sin estilos).
- Calidad: 18/18 pruebas, `tsc` y `lint` limpios, build OK, 77/77 combinaciones responsive sin desbordes, Lighthouse (local, con la inyección de Kaspersky bloqueada solo en el navegador de prueba):
  home móvil 80–85, otras páginas móviles 86–94, escritorio 98; accesibilidad y SEO 100 en las páginas medidas, con la excepción de `/planes` (a11y 98).

## Mapa de documentación

| Documento | Contenido |
|---|---|
| `CLAUDE.md` | Instrucciones breves y permanentes para Claude Code |
| `docs/ESTADO_ACTUAL.md` | **Punto de entrada**: dónde quedó el proyecto y cómo retomar |
| `docs/ARQUITECTURA.md` | Arquitectura, componentes, hero 3D, rutas, SEO, seguridad, pagos apagados |
| `docs/DISENO_Y_UX.md` | Evolución visual y decisiones de diseño |
| `docs/DECISIONES_TECNICAS.md` | Decisiones con motivo y ubicación; lo que no se debe hacer |
| `docs/CALIDAD_Y_PRUEBAS.md` | Resultados reales y limitaciones de las mediciones |
| `docs/CREDITOS-RECURSOS.md` | Inventario de recursos visuales, procedencia y licencias |
| `docs/DESPLIEGUE.md` y `DEPLOY.md` | Procedimiento de despliegue comprobado; guía del ejecutor |
| `docs/HISTORIAL_DESARROLLO.md` | Cronología e incidencias |
| `docs/PENDIENTES.md` | Pendientes para próximas jornadas (no ejecutados) |
| `docs/ACTIVACION-WEBPAY.md`, `docs/PAGOS-SQLITE.md` | Pagos: estado apagado y procedimiento futuro |

## Memoria persistente

- En el repositorio: `CLAUDE.md` + `docs/ESTADO_ACTUAL.md` (versionados en GitHub).
- Memoria propia de Claude Code (fuera del repositorio, local a este PC): `C:\Users\dcarrasco\.claude\projects\C--Users-dcarrasco-Desktop-Proyectos-bydlight2\memory\`
  (índice `MEMORY.md`; archivos `bydlight2-*.md`). No forma parte de GitHub.

## Cómo retomar

Leer `CLAUDE.md` y `docs/ESTADO_ACTUAL.md`; ejecutar `git fetch` y comprobar que `origin/main` contiene `56fdcf1`; consultar `docs/PENDIENTES.md`. Antes de decir algo sobre producción, `status` y revisar el dominio público.
