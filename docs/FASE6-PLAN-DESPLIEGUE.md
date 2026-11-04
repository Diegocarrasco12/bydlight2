# Fase 6 — Plan de despliegue (SIN EJECUTAR; requiere autorización expresa del titular)

**Nada de este plan se ha ejecutado.** No hay commit, push, `fetch`, `build`, `up` ni `rollback`. Contexto: [auditoría](FASE6-AUDITORIA-PREPUBLICACION.md) · [seguridad y feature flags](FASE6-SEGURIDAD-FEATURE-FLAGS.md) · procedimiento comprobado en [DESPLIEGUE.md](DESPLIEGUE.md).

## 0. Actualización Fase 6.1 (2026-11-04) — BLOQUEOS ANTES DE PUBLICAR
- **El cliente `bd-deploy.ps1` no está en `C:\Users\dcarrasco\.claude\tools\bd-deploy\`** (solo queda el guard). `status` y `list-releases` autorizados **no pudieron ejecutarse**; el SHA publicado y la existencia de un release anterior siguen **NO VERIFICADOS**. Debe restaurarlo el administrador desde `deploy/executor/claude-code/bd-deploy.ps1`. Detalle y estado del rollback: [FASE6-VERIFICACION-ROLLBACK.md](FASE6-VERIFICACION-ROLLBACK.md).
- **Condición para publicar:** `status` muestra `desplegado` (esperado `5fef157…`), `anterior` presente y distinto, `salud: OK` y línea base «aceptada»; `list-releases` lista ≥ 2 releases.
- **Rendimiento:** el código **no cambió** en la Fase 6.1 (mediana Lighthouse móvil de Inicio 84; ver [FASE6-OPTIMIZACION-RENDIMIENTO.md](FASE6-OPTIMIZACION-RENDIMIENTO.md)). Queda una decisión suya sobre el temporizador del 3D (opción 2 del §6 de ese documento) que, si la aprueba, añadiría **un archivo** (`HeroNetwork.tsx`) al commit 1.
- **Respaldo previo:** no existe nada que respaldar en datos (Bydlight no tiene volumen); lo recomendable es una copia de solo lectura del estado del ejecutor hecha por el administrador (§6 del documento de rollback). Requiere su autorización.
- `fetch` informará «ATENCION cambios de infraestructura» solo si cambian `Dockerfile`, `docker-compose.prod.yml`, `package-lock.json` o `next.config.ts`; ninguno cambió respecto de `5fef157`, de modo que no debe aparecer.
- **Comandos exactos previstos** (cada uno requiere su autorización; `<sha40>` = `git rev-parse HEAD` tras el push):
  ```
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op status
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op list-releases
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op fetch -OpArgs <sha40>
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op preflight
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op compose-diff
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op build -OpArgs <sha40>
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op job-status -OpArgs <id>
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op up -OpArgs <sha40>
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op verify
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op status
  # solo si hace falta y con autorización expresa:
  powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op rollback
  ```
- Antes del `fetch`: repetir en local `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git checkout next-env.d.ts` y **`npm run verify:prod`** (último resultado 2026-11-04: 41/41 y 29/29).

## 1. Qué cambia en producción
| Componente | Cambio |
|---|---|
| Imagen `web` (único servicio de `bydlight-prod`) | Nueva imagen `bydlight-web:<sha12>` con: diseño Signature, 404/error, logo optimizado, experiencia de pago (apagada), código de Webpay fase 2 (apagado) y documentación excluida de la imagen |
| `Dockerfile`, `docker-compose.prod.yml`, `next.config.ts`, política del ejecutor, `package-lock.json`, dependencias | **Sin cambios** (verificado con `git diff 5fef157`) → **no hay `accept-compose`** |
| Variables de entorno, volúmenes, redes, puertos (`127.0.0.1:8200`) | Sin cambios; sin `payments.json` ni volumen `/data` (Webpay sigue sin dónde persistir ni credenciales) |
| Cloudflare, túnel, DNS, certificados, otros contenedores o sitios | **No se tocan** |
| Otros proyectos del servidor | No participan; el ejecutor no acepta nombres de contenedor ni comandos libres; `preflight` guarda la línea base de ajenos y `verify` avisa si algo ajeno cambió |

## 2. Riesgos para servicios compartidos y mitigación
| Riesgo | Mitigación |
|---|---|
| Compilar la imagen consume CPU/RAM del servidor compartido | `build` corre en segundo plano con el ejecutor (`job-status`); hacerlo en horario de baja carga |
| Reemplazo del contenedor `web` | `up -d --no-deps --no-build --wait`: solo `web`; revierte solo si no sana |
| El código de Webpay llega por primera vez | Apagado por defecto y verificado en el artefacto (`verify:prod` 29/29); `build` y `verify` en el servidor lo confirman |
| Error humano (activar sin querer) | No existe `payments.json` ni `PAYMENTS_ENABLED`; activar requiere crear archivo en el servidor (acción del titular) |
| Imagen mayor por archivos de logo sin uso | Peso ≈ 4,9 MB; no crítico (decisión opcional del titular) |

**Si el proceso del ejecutor no aislara a Bydlight habría que detenerse; no es el caso** (operaciones cerradas, un solo servicio y línea base de ajenos).

## 3. Commits (CREADOS en local el 2026-11-04, SIN push; instrucciones finales en [ENTREGA-FASE6.md](ENTREGA-FASE6.md))
Orden real: **1 `08be2c7` visual → 2 `08e3d29` seguridad → 3 `ec1bf0a` experiencia de pago → 4 documentación.** Los commits 2 y 3 se intercambiaron respecto de la propuesta porque `orden/[id]/page.tsx` importa `availability.ts` (seguridad); así cada commit compila por separado. La tabla siguiente es la propuesta original (el contenido por commit coincide; solo cambia el orden 2↔3 y `docs/archivo-laboratorio/` pasó al commit de documentación).
Se incluirían **solo archivos explícitos** (`git add <archivo>`); no se incluyen `demos/windows-inventory/obj/`, `r-og.png`, `docs/fase4-capturas/`, `docs/fase5-capturas/` (ajenos) ni los directorios pesados `docs/evidencias-diseno/` (82 MB) y `docs/evidencias-fase4-signature/` (14 MB): se sugiere **no versionarlos** (quedan en disco local).

| # | Mensaje propuesto | Archivos |
|---|---|---|
| 1 | `feat(web): consolidacion visual Bydlight Signature, paginas 404 y error, logo optimizado` | `src/styles/signature.css`, `src/styles/design.css`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/home/blocks.tsx`, `src/components/navbar/Navbar.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/lib/site.ts`, `public/img/logos/logo2-512.png`, `docs/archivo-laboratorio/` |
| 2 | `feat(pagos): experiencia de pago Signature, comprobante imprimible y pantalla de redireccion` | `src/app/orden/[id]/page.tsx`, `src/components/checkout/PrintButton.tsx`, `src/app/api/pagos/iniciar/route.ts` |
| 3 | `fix(seguridad): controles de activacion de Webpay, mensaje de la casilla y verificacion del artefacto` | `src/lib/payments/availability.ts`, `src/lib/payments/service.ts`, `src/app/planes/page.tsx`, `src/components/footer/Footer.tsx`, `src/components/home/sections.tsx`, `tests/payments.test.mjs`, `scripts/verify-prod-lockdown.mjs`, `scripts/seed-ordenes-ejemplo.mjs`, `package.json` |
| 4 | `docs: expediente Webpay, propuestas legales, fase 4-6 y evidencias` | `docs/WEBPAY-*.md`, `docs/FASE4-*.md`, `docs/FASE6-*.md`, `docs/LABORATORIO-DISENO-ABC.md`, `docs/ESTADO_ACTUAL.md`, `docs/PENDIENTES.md`, `docs/EVIDENCIAS-INTEGRACION-WEBPAY.md`, `docs/evidencias-webpay/f5-*.png`, `docs/evidencias-webpay/logo-130x59.png`, `docs/evidencias-fase6/` (5,3 MB) |

Observación: `signature.css` contiene también los estilos del comprobante imprimible (commit 2); si se prefiere separación estricta, se divide con `git add -p`. Git avisa de conversión LF/CRLF en la copia de trabajo (comportamiento previo del repositorio). Después del push, el SHA completo de 40 hex a publicar es el del **último commit de código** (el 3, o el 4 si se prefiere publicar la documentación también; la documentación no altera la imagen porque `.dockerignore` excluye `docs/`).

## 4. Procedimiento de publicación (cada paso con autorización; orden comprobado)
Cliente: `powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op <op> [-OpArgs <arg>]`
0. **Antes de todo:** `status` y `list-releases` (solo lectura) para confirmar la versión realmente publicada (se espera `5fef157`) y que el `anterior` existe y es distinto del `desplegado` (pendiente conocido de verificar el rollback).
1. Git: commits según §3 → **autorización del titular** → `git push origin feature/rediseno-2026` y fusión a `origin/main` (el ejecutor solo trae commits de `origin/main`, fast-forward). Confirmar que el remoto es `Diegocarrasco12/bydlight2`.
2. `git rev-parse HEAD` → SHA de 40 hex.
3. `fetch <sha40>` → `preflight` → `compose-diff` (debe indicar **sin cambios**; si hay diferencia, **detenerse**: exigiría aprobación administrativa).
4. `build <sha40>` → `job-status <id>` hasta `done`.
5. **Solicitar autorización** → `up <sha40>` → `verify` → `status`.
6. Comprobaciones posteriores (§5). Informar SHA, resultado e incidencias.
Si el ejecutor devuelve código 21 dentro de Claude Code (problema conocido), no culpar a Kaspersky ni a SSH sin evidencia: el administrador despliega desde PowerShell normal ([DESPLIEGUE.md](DESPLIEGUE.md) §9).

## 5. Comprobaciones posteriores y confirmación de que Webpay sigue apagado
Con el SHA nuevo ya servido, ejecutar desde el equipo del titular contra el dominio público (solo lecturas, sin pagos):
- `status` / `verify` del ejecutor en verde y contenedores ajenos sin cambios.
- `https://bydlightsolutions.com/` carga con el diseño nuevo y el hero 3D; `/servicios`, `/planes`, `/nosotros`, `/proyectos`, `/contacto` responden 200; una URL inexistente muestra la 404 nueva.
- **Webpay apagado:** `/orden`, `/orden/ABCDEFGHJKMN`, `/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales` → **404**; `/contratar` → redirige a `/contacto`; `POST /api/solicitudes` → 503; `POST /api/admin` → 404. La misma batería está automatizada en `scripts/verify-prod-lockdown.mjs` (que prueba el artefacto local; en el dominio público basta con las peticiones anteriores).
- Ninguna página pública menciona «Webpay», «Transbank» ni «pagar anticipo».
- Prueba de envío del formulario de contacto (EmailJS), con autorización, solo si se desea.

## 6. Rollback
| Situación | Acción | Efecto |
|---|---|---|
| `up` no sana | El ejecutor **revierte solo** al release anterior | Automático |
| Problema detectado después | `rollback` (**requiere autorización**) → reactiva `bydlight-web:<sha12 anterior>` (se conservan los últimos 5 releases) → `verify` → `status` | Vuelve a `5fef157`, sin tocar datos ni infraestructura |
| Verificación previa | `list-releases` antes de publicar: debe listar el release anterior | Hace el rollback **verificable** (no se ha probado en esta fase: sería ejecutar el ejecutor) |
No usar `down -v`, `docker system prune` ni acciones sobre otros contenedores. No hay datos de Webpay que revertir (no hay base ni volumen).

## 7. Indisponibilidad estimada
Un solo servicio sin réplicas: el reemplazo del contenedor corta la atención durante el arranque (`start_period` 20 s del healthcheck); **estimación: del orden de segundos a decenas de segundos, no medida**. Cloudflare puede servir caché de páginas estáticas durante el corte. Publicar en horario de bajo tráfico. Tiempo de `build`: no medido en este servidor (corre en segundo plano).

## 8. Lo que necesito de usted para ejecutar
(1) Autorizar `status`/`list-releases` de solo lectura; (2) aprobar los 4 commits (§3) y el push; (3) autorizar `fetch → preflight → compose-diff → build`; (4) autorizar `up`; (5) decidir sobre los archivos de logo sin uso y las carpetas de evidencia pesadas.
