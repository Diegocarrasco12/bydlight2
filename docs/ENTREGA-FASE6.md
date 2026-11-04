# Entrega Fase 6 — Bydlight Signature (para publicar por el equipo)

Quien despliega: **el equipo** (el administrador desde PowerShell normal). Claude **no** accedió al servidor, **no** hizo push y **no** desplegó. Estado: ver el veredicto al final. Detalles: [plan](FASE6-PLAN-DESPLIEGUE.md) · [rollback](FASE6-VERIFICACION-ROLLBACK.md) · [rendimiento](FASE6-OPTIMIZACION-RENDIMIENTO.md) · [seguridad](FASE6-SEGURIDAD-FEATURE-FLAGS.md) · [activación de Webpay](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md).

## 1. Commits locales (rama `feature/rediseno-2026`, base `a6baee7`)
| # | SHA | Contenido |
|---|---|---|
| 1 | `08be2c7` | Diseño Signature, 404 y error propias, logo optimizado (`signature.css`, `layout`, `blocks`, `Navbar`, `site.ts`, `logo2-512.png`) |
| 2 | `08e3d29` | Controles de Webpay: `availability.ts`, textos condicionados, `verify:prod`, pruebas, ordenes de ejemplo |
| 3 | `ec1bf0a` | Experiencia de pago (comprobante imprimible, redirección con marca) — invisible con pagos apagados |
| 4 | **ver `git log -1`** | Documentación y evidencias |

**SHA a publicar = el del commit 4 (`git rev-parse HEAD`).** El código de la imagen es el mismo desde el commit 3; `.dockerignore` excluye `docs/`.
Excluido a propósito (sin versionar, siguen en disco): `demos/windows-inventory/obj/`, `r-og.png`, `docs/fase4-capturas/`, `docs/fase5-capturas/` (ajenos o temporales) y `docs/evidencias-diseno/` (82 MB), `docs/evidencias-fase4-signature/` (14 MB). Sin secretos en lo versionado (revisado con patrones de claves/tokens; la única coincidencia es el código público de integración de Transbank dentro de una prueba).

## 2. Antes de publicar (en su equipo)
1. Verificar el estado productivo: `-Op status` y `-Op list-releases`. Anotar el SHA **desplegado** (esperado `5fef157…`) y el **anterior**. Condición: `salud: OK`, línea base de Compose «aceptada», al menos 2 releases y `anterior` distinto del desplegado. Si no, **no publicar**.
2. Respaldo previo (solo lectura): copia de `/var/lib/bd-deploy` (estado del ejecutor, sin claves) y anotar los tags `bydlight-web:<sha12>` existentes. Bydlight no tiene volúmenes ni datos.
3. `git push origin feature/rediseno-2026` y llevar los commits a `origin/main` (el ejecutor solo trae `origin/main`, avance simple). Confirmar el remoto `Diegocarrasco12/bydlight2`.
4. `git rev-parse HEAD` → `<sha40>`.
5. (Opcional, local) `npm ci && npm test && npx tsc --noEmit && npm run lint && npm run build && git checkout next-env.d.ts && npm run verify:prod` → debe dar 41/41 y **29/29**.

## 3. Publicación (orden comprobado)
```
bd-deploy.ps1 -Op fetch -OpArgs <sha40>
bd-deploy.ps1 -Op preflight
bd-deploy.ps1 -Op compose-diff        # debe decir "linea base: igual"; si DIFIERE, detenerse
bd-deploy.ps1 -Op build -OpArgs <sha40>
bd-deploy.ps1 -Op job-status -OpArgs <id>   # repetir hasta "done"
bd-deploy.ps1 -Op up -OpArgs <sha40>
bd-deploy.ps1 -Op verify
bd-deploy.ps1 -Op status
```
(`fetch` no debe avisar «cambios de infraestructura»: `Dockerfile`, Compose, `package-lock.json` y `next.config.ts` no cambiaron respecto de `5fef157`.) Si el ejecutor devuelve código 21 dentro de Claude Code, ejecútenlo en PowerShell normal. Interrupción esperada: segundos al recrear el contenedor `web`; `up` revierte solo si el release nuevo no sana.

## 4. Verificaciones posteriores (dominio público, solo lectura)
- `https://bydlightsolutions.com/` con el diseño nuevo y el hero 3D (el 3D aparece tras la primera interacción o a los 3,5 s); `/servicios`, `/planes`, `/nosotros`, `/proyectos`, `/contacto` → 200; una URL inexistente muestra la 404 nueva.
- **Webpay apagado:** `/orden`, `/orden/ABCDEFGHJKMN`, `/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales` → **404**; `/contratar` → redirige a `/contacto`; `POST /api/solicitudes` → 503; `POST /api/admin` → 404.
- Ninguna página pública menciona «Webpay», «Transbank» ni «pagar anticipo»; ninguna menciona «WordPress» ni «Divi».
- `status` muestra el SHA nuevo como `desplegado` y el anterior como `anterior`; contenedores ajenos sin cambios (`verify` sin avisos).

## 5. Rollback (lo ejecutan ustedes)
- **Automático:** si `up` no sana (salud o HTTP), el ejecutor vuelve solo al release anterior.
- **Manual:** `bd-deploy.ps1 -Op rollback` → `-Op verify` → `-Op status`. Reactiva `bydlight-web:<sha12 anterior>` solo sobre el servicio `web`; no reinicia Docker, no toca otros contenedores, Cloudflare, DNS ni datos. Requiere que exista el release anterior (punto 1 de «Antes de publicar»).
- No usar `down -v`, `docker system prune` ni acciones sobre otros contenedores. Detalle y límites: [FASE6-VERIFICACION-ROLLBACK.md](FASE6-VERIFICACION-ROLLBACK.md).
- Con Webpay apagado el rollback no pierde datos (no existen). **Cuando se active Webpay**, apagarlo primero (`enabled:false`) y conciliar con Transbank antes de volver a una imagen sin código de pagos.

## 6. Publicable ahora vs. reservado hasta Transbank
| Publicable ahora | Reservado hasta la autorización de Transbank (apagado y verificado) |
|---|---|
| Diseño Signature en Inicio, Servicios, Planes, Nosotros, Proyectos, Contacto; logo; 404 y error; imágenes; navegación; formulario de contacto (EmailJS); SEO; accesibilidad (axe 0 violaciones); hero 3D sin cambios | Inicio de transacciones (`/api/pagos/iniciar`), `/contratar`, `/orden*`, confirmación y consulta de pagos, API administrativa y devoluciones, comprobante, credenciales productivas, páginas legales en borrador (`/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales`), cualquier texto que afirme pagos en línea |
El código de Webpay viaja en la imagen pero **no puede operar**: depende de `paymentsEnabled()` en el servidor, apagado sin `PAYMENTS_ENABLED` ni `/data/config/payments.json` (no existen). Activarlo: [checklist](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md). Recibir el código de comercio no equivale a autorización para cobrar.

## 7. Rendimiento (medido, cerrado)
Lighthouse móvil de Inicio: mediana **84** (rango 63–85; oscila por el arranque del 3D a los 3,5 s, que se mantiene por decisión del titular). Accesibilidad 100, SEO 100, CLS 0. Mediciones de laboratorio, no datos de usuarios.
