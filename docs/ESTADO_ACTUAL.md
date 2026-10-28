# Estado actual de Bydlight2

> Documento de entrada para retomar el proyecto en una sesión nueva. Léelo junto con `CLAUDE.md`.
> Última actualización: **2026-10-28** (Fase 3: hero «red de nodos», ERP/SaaS y fotografía, desplegado). Jornada anterior: `docs/CIERRE_JORNADA_2026-10-27.md`.

## 1. Producción (confirmado con `status` y con pruebas en el dominio público el 2026-10-28)

| Dato | Valor |
|---|---|
| Sitio público | https://bydlightsolutions.com/ |
| Proyecto Docker | `bydlight-prod` (contenedor en `127.0.0.1:8200`, expuesto por Cloudflare Tunnel) |
| **Commit desplegado** | `67287c08d1f57c327aa22aa888a8a301df781b0d` (imagen `bydlight-web:67287c08d1f5`) |
| **Commit de rollback** | `56fdcf1cb6e05632a5425272dc3603364d0ec0cd` |
| Releases construidos | 5 según `status` |
| Salud / `verify` / `status` | OK |
| `preflight` / `compose-diff` | OK / política CUMPLE, línea base igual |
| Contenedores ajenos en la línea base | 18 (no se tocan) |

`fetch`, `preflight`, `compose-diff` (CUMPLE / línea base igual) y `build` los ejecutó Claude Code; el `up` y el `verify` los ejecutó el administrador desde PowerShell normal porque el cliente del ejecutor desapareció de su carpeta antes del `up` (ver §5 y `docs/DESPLIEGUE.md`).
**Los commits de documentación posteriores a `67287c0` no cambian lo que corre en producción** y no requieren despliegue.
Para saber qué corre hoy, la fuente de verdad es `bd-deploy.ps1 -Op status`, no este documento.

## 2. Repositorio

- Remoto: `https://github.com/Diegocarrasco12/bydlight2.git`. Rama de publicación: `main`.
- Rama de trabajo local: `feature/rediseno-2026` (se publica con `git push origin HEAD:main`; siempre fast-forward).
- Cadena de commits desplegables: `6c2f640` → `af71054` → `26a4cea` (no desplegado por separado) → `56fdcf1` → `a52dc12` (solo documentación) → `67287c0` (Fase 3, **desplegado**).
- Archivos del usuario que no se deben alterar sin pedirlo: `AGENTS.md` (protocolo para Codex), `r-og.png` y `demos/windows-inventory/obj/` (sin versionar).

## 3. Qué es el sitio (resumen)

Sitio corporativo de **Byd Light Solutions SpA** (Chile): ingeniería y desarrollo de software. Next.js 16 (App Router) + React 19 +
TypeScript, CSS propio (`design.css` + `fase2.css`), hero 3D «red de nodos» con three.js (`HeroNetwork`), formulario por EmailJS. Pagos con Webpay **construidos pero desactivados e invisibles**.
Arquitectura en `docs/ARQUITECTURA.md`; diseño y decisiones en `docs/DISENO_Y_UX.md` y `docs/DECISIONES_TECNICAS.md`.

## 4. Restricciones vigentes (resumen; lista completa en `CLAUDE.md`)

- **Webpay/Transbank deshabilitados e invisibles.** No activar pagos sin autorización explícita (`docs/ACTIVACION-WEBPAY.md`).
- **WordPress no debe aparecer** en ninguna parte de la experiencia pública.
- No tocar Cloudflare, túneles, DNS, otros contenedores ni otros proyectos del servidor.
- Despliegue solo por el ejecutor restringido y solo con orden expresa. Si `compose-diff` difiere, detenerse (no `accept-compose` automático).
- No inventar clientes, cifras, certificaciones, resultados ni licencias.

## 5. Problemas conocidos

0. **Hero antiguo (átomo):** reaparecía porque `/` importaba `HeroStage`. Corregido en `67287c0`: `/` usa `HeroNetwork`. `HeroStage.tsx`, `scene.ts` y `.hx*` quedan como código legado sin uso. Detalle en `docs/FASE2_PROTOTIPOS.md`.
1. **Claude Code recibe a veces código de salida 21 del ejecutor** (desde PowerShell normal funciona). Causa raíz **no demostrada**.
   Alternativa validada: el administrador ejecuta el despliegue en PowerShell normal. Ver `docs/DESPLIEGUE.md` §9.
2. `bd-deploy.ps1` desapareció tres veces antes y **una cuarta el 2026-10-28** (entre `job-status` y `up`; al ejecutar `status` más tarde ya estaba disponible) de `C:\Users\dcarrasco\.claude\tools\bd-deploy\` (causa no confirmada). Se restaura desde
   `deploy/executor/claude-code/bd-deploy.ps1`.
3. Las mediciones Lighthouse locales están alteradas por un script que inyecta Kaspersky (ver `docs/CALIDAD_Y_PRUEBAS.md`).

## 6. Pendientes

Lista priorizada en `docs/PENDIENTES.md` (medición 3D en teléfono real, retirar código legado del átomo, Lighthouse en el dominio público, HSTS/CSP, texto «13+ años», material real de portafolio,
prueba real del formulario, diagnóstico del código 21, rendimiento móvil, Transbank).

## 7. Cómo retomar en una sesión nueva

1. Leer `CLAUDE.md` y este archivo; luego `docs/PENDIENTES.md`.
2. `git status`, `git log --oneline -5`, `git fetch` (comprobar que `origin/main` contiene `67287c0`).
3. Para trabajar: Node **22.13 o superior** (el proyecto usa `node:sqlite`; producción corre Node 22.23.4). Comandos:
   `npm ci`, `npm test` (18 pruebas), `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run dev`.
4. Después de `npm run build`: `git checkout next-env.d.ts` (el build lo modifica) y no versionar `tsconfig.tsbuildinfo`.
5. Para publicar: commit con `git add <archivos>` explícitos → push a `main` solo con autorización → el administrador despliega
   (o la sesión usa el ejecutor si el código 21 no ocurre y el usuario lo ordena).
6. Antes de afirmar cualquier cosa sobre producción, ejecutar `status` y verificar el dominio público.
