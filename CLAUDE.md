# Protocolo Claude Code — Bydlight2

## Leer primero
1. `docs/ESTADO_ACTUAL.md` (dónde quedó el proyecto; SHA desplegado y de rollback).
2. `docs/PENDIENTES.md`. Detalle: `docs/ARQUITECTURA.md`, `docs/DESPLIEGUE.md`, `docs/DECISIONES_TECNICAS.md`, `docs/CALIDAD_Y_PRUEBAS.md`, `docs/CREDITOS-RECURSOS.md`.
3. Producción (2026-10-28): **desplegado `5fef157411e565c093f1be62ecc79ae22ae0b69e`** (hero cinematográfico + SEO 1-2, desplegado por el titular), rollback esperado `5f000150f40529abaa70c1dd7d39e4c486c129e2` (verificar con `status`).
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
`npm ci` · `npm test` (18 pruebas; requiere Node >= 22.13 por `node:sqlite`) · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run dev`.
Tras el build: `git checkout next-env.d.ts`. No versionar `tsconfig.tsbuildinfo`. Commits con `git add <archivos>` explícitos.

## Restricciones permanentes
- **Webpay/Transbank: apagados e invisibles** (`ONLINE_CHECKOUT_UI=false`). No activar pagos, `/contratar`, `/orden` ni endpoints de cobro sin autorización expresa (`docs/ACTIVACION-WEBPAY.md`).
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
