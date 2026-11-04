# Fase 6 — Auditoría de pre-publicación (2026-11-04)

Estado: **solo local; sin commit, sin push, sin despliegue, sin tocar el servidor.** Producción: Webpay apagado e invisible.
Documentos de esta fase: [identidad visual](FASE6-IDENTIDAD-VISUAL-SIGNATURE.md) · [personalización Webpay](FASE6-WEBPAY-PERSONALIZACION.md) · [seguridad y feature flags](FASE6-SEGURIDAD-FEATURE-FLAGS.md) · [plan de despliegue](FASE6-PLAN-DESPLIEGUE.md) · [checklist de activación](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md). Antecedentes: [Fase 4](FASE4-CONSOLIDACION-SIGNATURE-WEBPAY.md), [expediente Webpay](WEBPAY-EXPEDIENTE-CERTIFICACION.md), [despliegue](DESPLIEGUE.md).

## 1. Qué versión está publicada y qué falta (sin asumir)
| Dato | Valor | Fuente / verificación |
|---|---|---|
| Rama de trabajo | `feature/rediseno-2026` | `git branch` |
| `HEAD` local | `a6baee7` (Webpay Plus fase 2), **ya está en `origin/main`** | `git branch -vv` |
| `main` local | `0d06acf`, **19 commits detrás** de `origin/main` | `git branch -vv` |
| Producción según la documentación | `5fef157` (hero + SEO 1-2), rollback esperado `5f00015` | `CLAUDE.md`, `ESTADO_ACTUAL.md` |
| **Verificación real de producción** | **NO realizada** | La instrucción de esta fase prohíbe ejecutar `bd-deploy`. Debe correrse `-Op status` (solo lectura) antes de cualquier publicación |
| Commits no desplegados | `e04ed7f` (docs) y **`a6baee7` (código de Webpay fase 2, nunca desplegado)** | `git log 5fef157..HEAD` |
| Cambios sin confirmar | 18 archivos modificados + nuevos (Signature, Webpay fase 5, esta fase) | `git status` |

**Consecuencia importante:** el próximo despliegue lleva a producción, por primera vez, **todo el código de Webpay** (rutas, SQLite, API administrativa). Está apagado por diseño, pero ya no es «código inexistente»: por eso se agregó una verificación sobre el artefacto de producción (ver [seguridad](FASE6-SEGURIDAD-FEATURE-FLAGS.md)).

## 2. Infraestructura y mecanismo de despliegue (revisado sin ejecutar)
- Cliente restringido `C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1` (no se ejecutó). Ejecutor `deploy/executor` (Python, política cerrada), usuario `bddeploy`, proyecto Docker **`bydlight-prod`**, un solo servicio `web` en `127.0.0.1:8200`, Cloudflare Tunnel administrado por el titular. Independiente de `oe-deploy` y de otros proyectos.
- **Aislamiento de Bydlight:** el ejecutor solo recibe operaciones fijas (`status … rollback`), SHA de 40 hex y números de líneas; nunca nombres de contenedor, rutas ni comandos. `preflight` guarda una línea base de contenedores ajenos (18 al 2026-10-27) y `verify` avisa si algo ajeno cambió. **Conclusión: el proceso existente sí aísla a Bydlight; no es necesario detenerse por este motivo.**
- **Cambios de infraestructura entre `5fef157` y lo que se publicaría: ninguno.** `Dockerfile`, `docker-compose.prod.yml`, `next.config.ts`, `.dockerignore`, `package-lock.json` y `deploy/` sin diferencias; en `package.json` solo se añadió el script `verify:prod`. No se requiere `accept-compose`.
- Servidor compartido (Ubuntu con otros contenedores): no se tocó. No se modificó Cloudflare, DNS, túnel ni certificados.

## 3. Cambios ajenos y preservación
No se encontraron cambios ajenos a este trabajo en el árbol. Sin seguimiento y **no incluidos en la propuesta de commit** (se preservan intactos): `demos/windows-inventory/obj/` (artefactos de compilación de otro demo), `r-og.png`, `docs/fase4-capturas/`, `docs/fase5-capturas/`. No se borró ni se limpió nada (`git clean` no se usó).

## 4. Configuración por entorno
| Entorno | Pagos | Origen de la configuración |
|---|---|---|
| Desarrollo (`next dev`) | **Encendidos por defecto** (ambiente de integración, credenciales públicas del SDK) | `paymentsEnabled()` |
| Pruebas (`npm test`) | Doble (mock) del SDK; sin red | `tests/register.mjs` |
| Producción (hoy) | **Apagados**: sin `PAYMENTS_ENABLED`, sin `payments.json`, sin volumen `/data`, `ONLINE_CHECKOUT_UI=false` | verificado en el artefacto, ver [seguridad](FASE6-SEGURIDAD-FEATURE-FLAGS.md) |

## 5. Hallazgos de la auditoría y qué se hizo
| # | Hallazgo | Acción |
|---|---|---|
| 1 | La 404 era la genérica de Next, en inglés («This page could not be found»), sin pie ni marca; lo mismo para las rutas reservadas (`/orden`) | **Corregido**: `src/app/not-found.tsx` con Signature, español y accesos |
| 2 | Sin página de error inesperado propia | **Corregido**: `src/app/error.tsx` |
| 3 | Logo de datos estructurados (JSON-LD) apuntaba a un PNG de **1,4 MB** | **Corregido**: derivado `logo2-512.png` de **19 KB**; original intacto |
| 4 | Comprobante sin versión imprimible | **Corregido**: botón «Imprimir comprobante», cabecera con logo y hoja A4 limpia |
| 5 | Pantalla «Redirigiendo a Webpay» sin marca | **Corregido** sin cambiar su lógica |
| 6 | No había prueba que demostrara el apagado de Webpay en el artefacto de producción | **Agregado**: `npm run verify:prod` (29 comprobaciones) |
| 7 | Imágenes de logo sin uso y pesadas en `public/` (`logo1`, `logo3-6`, `favicon.png` 1,3 MB, `logo2.png` 1,4 MB) viajan dentro de la imagen Docker | **No se borraron** (son recursos oficiales/alternativas). Propuesta: moverlos a `docs/` o eliminarlos con su autorización |
| 8 | Inicio en móvil: Lighthouse 69 (TBT ~500 ms, LCP 3,9 s) por la carga de three.js del hero | **Sin cambio**: el hero está aprobado y no se modifica. Medición de laboratorio con CPU móvil simulada, no datos de usuarios |
| 9 | Dos errores de consola en pruebas locales | Provienen del script que **Kaspersky inyecta** en el navegador de prueba (`gc.kes.v2.scr.kaspersky-labs.com`); no son del sitio. Sin otros errores (solo el 404 esperado de `/no-existe`) |

## 6. Estado de los documentos legales
Detalle completo en [WEBPAY-PROPUESTAS-LEGALES.md](WEBPAY-PROPUESTAS-LEGALES.md) (22 campos pendientes, 13 decisiones). Resumen de lo que **no** se publica:
| Contenido | Estado | ¿Se publica con este despliegue? |
|---|---|---|
| Páginas públicas del sitio (inicio, servicios, planes, nosotros, proyectos, contacto) | Aprobadas | **Sí** |
| `/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales` | Borradores con 22 `[PENDIENTE]` | **No** (404 en producción; `LEGAL_PAGES_PUBLISHED=false`; verificado por `verify:prod`) |
| Política de privacidad | No existe | No |
| Textos de Webpay en planes/pie/cotización | Solo si el checkout está habilitado | **No** (verificado: ninguna página pública afirma pagos online) |

**Lo que usted debe completar personalmente:** RUT y domicilio de la sociedad; régimen/IVA; plazos de saldo y atraso; propiedad intelectual; garantía y soporte posterior; condiciones de cancelación y devolución; ley, tribunales y reclamos; horario y tiempos de respuesta; contenido de la política de privacidad (con abogado). La cuenta de abono y la confirmación de requisitos de Transbank dependen de su respuesta a su correo.

## 7. Evidencias
Capturas en `docs/evidencias-fase6/` (`antes/` y `despues/`): 404, estados de pago (aprobado, rechazado, cancelado, pendiente, error, solicitud, cotización) en 1366 y 390 px, comprobante A4 (PNG y PDF) y hero 3D en el build de producción.
