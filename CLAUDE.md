# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Protocolo Claude Code — Bydlight2

## Leer primero
1. `docs/ESTADO_ACTUAL.md` (dónde quedó el proyecto; SHA desplegado y de rollback).
2. `docs/PENDIENTES.md`. Detalle: `docs/ARQUITECTURA.md`, `docs/DESPLIEGUE.md`, `docs/DECISIONES_TECNICAS.md`, `docs/CALIDAD_Y_PRUEBAS.md`, `docs/CREDITOS-RECURSOS.md`.
3. Producción (confirmada por el administrador el 2026-11-09): `b28448196fb89f9814621a709475029ae086dd21` (anterior `13aaf17`), Etapa B desplegada y base SQLite migrada a v5; cobro real cerrado en el servidor (`payments.json` con `enabled:false`, devoluciones apagadas, `mail.json` inexistente, Brevo sin configurar). Ojo: en el código las dos llaves públicas están abiertas (`ONLINE_CHECKOUT_UI=true` en `src/lib/plans.ts` y `LEGAL_PAGES_PUBLISHED=true` en `src/lib/legal.ts`), de modo que el sitio anuncia Webpay Plus aunque el servidor no cobre; por decisión del titular (2026-11-10) esa publicidad y las páginas legales **se mantienen**; las gestiones legales/tributarias y la compra de $50 ya están hechas y no se repiten. Brevo: implementado y probado, sin clave instalada. La rama `etapa-b/checkout-publico` está solo en local: el push del 2026-11-10 falló con 403 (credencial de GitHub de otra cuenta, no la del titular de `Diegocarrasco12/bydlight2`); pendiente de autenticar la cuenta correcta. Detalle: `docs/ESTADO_ACTUAL.md`, `docs/PENDIENTES.md`.
   Commits posteriores de documentación no implican despliegue. Verificar siempre con `status` antes de afirmar el estado real.

## Alcance
Trabajar exclusivamente en el repositorio Bydlight2.
No modificar otros proyectos, contenedores, servicios ni configuraciones globales.

## Flujo de desarrollo
1. Revisar el estado de Git y comprender el cambio solicitado.
2. Modificar solamente los archivos necesarios.
3. Ejecutar pruebas, lint y build disponibles.
4. Revisar diferencias y detectar secretos antes de publicar.
5. Confirmar que GitHub utiliza Diegocarrasco12/bydlight2.
6. Solicitar autorización antes de push y despliegue.

## Despliegue
Utilizar exclusivamente el cliente restringido:

powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op status

Operaciones permitidas: status, preflight, verify, compose-diff,
list-releases, job-status, logs, fetch, build, up, rollback.

Nunca usar SSH directo, Docker remoto, sudo remoto ni modificar
Cloudflare, el dominio público o servicios de otros proyectos.

## Publicación
1. Obtener el SHA completo del commit autorizado.
2. Confirmar push exitoso a GitHub personal.
3. Ejecutar fetch con el SHA.
4. Ejecutar preflight y revisar compose-diff.
5. Ejecutar build y esperar su finalización.
6. Solicitar autorización para up.
7. Ejecutar verify y status.
8. Informar SHA, resultado y cualquier incidencia.

Si cambia Docker Compose o la política de infraestructura,
detenerse y solicitar aprobación administrativa.
No ejecutar accept-compose automáticamente.

## Fallos
Detenerse ante errores.
No realizar rollback sin autorización.
No modificar ni reiniciar otros contenedores.
No asumir que el despliegue local en puerto 8200 actualiza
automáticamente el sitio público.

## Proyecto (una línea)
Sitio corporativo de Byd Light Solutions SpA (ingeniería y desarrollo de software, Chile). Next.js 16 + React 19 + TypeScript, CSS propio (`src/styles/design.css`), hero three.js diferido,
contacto por EmailJS. Docker standalone en servidor Ubuntu propio (`bydlight-prod`, 127.0.0.1:8200, Cloudflare Tunnel). Español.

## Comandos
`npm ci` · `npm test` (173 pruebas al 2026-11-10; requiere Node >= 22.13 por `node:sqlite`) · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run dev`.
Una sola prueba: `node --import ./tests/register.mjs --test --test-name-pattern="D3" tests/payments.test.mjs`.
Otros: `npm run preview:pagos` (vista previa local de pagos), `npm run verify:prod` / `verify:pilot` (comprueban el bloqueo de checkout / modo piloto).
Tras el build: `git checkout next-env.d.ts`. No versionar `tsconfig.tsbuildinfo`. Commits con `git add <archivos>` explícitos.

## Arquitectura (lo que no se ve en un solo archivo)
- Pruebas sin dependencias: `node:test` + cargador `tests/register.mjs`/`tests/hooks.mjs`, que ejecuta TypeScript de `src/` directamente, resuelve el alias `@/` y sustituye `server-only`, `next/navigation` y `transbank-sdk` por los stubs de `tests/stubs/`. Una importación nueva del lado servidor puede requerir un stub nuevo.
- Pagos (`src/lib/payments/`): `availability.ts` decide qué se anuncia en público (solo constantes del código: `ONLINE_CHECKOUT_UI`, `LEGAL_PAGES_PUBLISHED`) frente a lo que el servidor permite cobrar (`config.ts`, `payments.json` en `/data`); `pilot.ts`/`access.ts` manejan el acceso piloto; `db.ts`/`store.ts`/`migrations.mjs` persisten en SQLite (`node:sqlite`); `adminAuth.ts` firma HMAC para `/api/admin` y devoluciones (`refunds.ts`, apagadas por defecto). Rutas: `src/app/api/pagos/{iniciar,retorno/[orderId],verificar}`, `/contratar`, `/orden`.
- Contenido comercial centralizado en `src/lib/` (`services.ts`, `plans.ts`, `portfolio.ts`, `seo.ts`, `site.ts`, `legal.ts`); las páginas de `src/app/` lo consumen.
- `next.config.ts`: `output: "standalone"` (imagen Docker), cabeceras `no-store`/`noindex` para `/orden` y `/api`, y `assets-pendientes/` y `assets-fuente/` excluidos de la imagen.
- `AGENTS.md` es el protocolo equivalente para Codex; el bloque `nextjs-agent-rules` lo regenera `next dev` (Next 16 difiere de lo conocido: consultar `node_modules/next/dist/docs/`).

## Restricciones permanentes
- **Webpay/Transbank: cobro cerrado en el servidor** (`payments.json` `enabled:false`; el código ya anuncia Webpay Plus con `ONLINE_CHECKOUT_UI=true`). No activar pagos, `/contratar`, `/orden` ni endpoints de cobro sin autorización expresa (`docs/ACTIVACION-WEBPAY.md`).
- **La palabra «WordPress» (ni «Divi») no debe aparecer** en la experiencia pública (textos, metadatos, JSON-LD, tarjetas, tecnologías).
- No inventar clientes, cifras, testimonios, certificaciones, resultados ni licencias. Tecnologías = capacidades técnicas declaradas por el titular; proyectos demostrables solo con evidencia
  (`src/lib/portfolio.ts`). Fotos de stock = ilustrativas y rotuladas, nunca presentadas como oficinas o equipo de Bydlight.
- No exponer ni versionar secretos, claves SSH, hosts reales ni IDs de túnel. Revisar `git diff` antes de publicar.
- No modificar Cloudflare, túneles, DNS, otros contenedores ni proyectos. No `docker system prune`, no `down -v`, no `accept-compose` automático, no cambiar Compose sin revisar política y línea base.
- No eludir el sandbox, las reglas `deny` ni el hook `bd-deploy-guard`. No `git reset --hard`, `git clean -fd` ni force push.
- Mantener rollback; no hacer `rollback` sin autorización.

## Despliegue: precisiones
- `fetch`, `build` y `up` (y `accept-compose`) llevan el SHA completo de 40 hex (`-OpArgs <sha40>`); `job-status` lleva el id del trabajo; `logs` lleva un número de líneas.
- Orden comprobado: `status → fetch → preflight → compose-diff → build → job-status → up → verify → status`. Detalle en `docs/DESPLIEGUE.md`.
- Si falta el cliente, el administrador lo restaura desde `deploy/executor/claude-code/bd-deploy.ps1` hacia `C:\Users\dcarrasco\.claude\tools\bd-deploy\bd-deploy.ps1` (Claude no puede escribir allí).
- **Problema conocido:** a veces el ejecutor devuelve código 21 dentro de Claude Code y funciona en PowerShell normal. Causa raíz no demostrada; no culpar a Kaspersky ni a SSH sin evidencia.
  Alternativa validada: el administrador despliega desde PowerShell normal. Ver `docs/DESPLIEGUE.md` §9.
- Mediciones Lighthouse locales: Kaspersky inyecta un script en el navegador de prueba; se bloquea solo ahí (`--blocked-url-patterns`). No presentar mediciones de laboratorio como datos de usuarios.

## Preferencias del titular
Sitio premium, realista y profesional; alto contraste entre secciones; menos texto y más demostración visual; español natural y comercial, sin frases grandilocuentes; móvil de primera clase;
rendimiento sin sacrificar la calidad. Trabajo autónomo hasta el final, deteniéndose solo ante operaciones sensibles (producción, Cloudflare, secretos, Webpay).
