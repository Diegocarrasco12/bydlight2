# Estado actual de Bydlight2

> Documento de entrada para retomar el proyecto en una sesión nueva. Léelo junto con `CLAUDE.md`.
> Última actualización: **2026-11-06** (ver «Punto de retoma» más abajo; el resto es histórico). Antes: **2026-10-28** (hero cinematográfico `5f00015` y SEO Fases 1-2 `5fef157`, desplegados por el titular). Jornada anterior: `docs/CIERRE_JORNADA_2026-10-27.md`.

> **Punto de retoma (2026-11-06, cierre del desarrollo de Webpay):** producción (verificada por el titular) = `530b95c645fff70b3a2385fbc1ca4c41fe09d423` con volumen `bydlight-prod_bydlight_data` en `/data`, credenciales productivas y secreto HMAC ya instalados, `payments.json` con `enabled:false` y `adminRefunds:false`. Rollback = la versión anterior que indique `list-releases`. El repositorio (`origin/main`) contiene, **sin desplegar**: modo piloto del checkout (`checkoutMode` closed/pilot/public, enlace firmado de un solo uso, cookie HMAC), logotipos oficiales de Webpay Plus y Transbank (autorizados por escrito por Transbank; sin marcas de tarjeta), cliente administrativo seguro (`admin-remote.mjs`: `--config-file`, `pilot-link`, `approve-test`), `payments-config-set.mjs`, `verify:pilot`. Checkout público bloqueado por código (`ONLINE_CHECKOUT_UI=false`, `LEGAL_PAGES_PUBLISHED=false`). Siguiente (lo hace el titular): `docs/DESPLIEGUE-WEBPAY-UBUNTU.md`; después la compra real de $50. Detalle: `docs/PLAN-ACTIVACION-WEBPAY-PRODUCCION.md`. Datos pendientes: `docs/LEGAL-DATOS-PENDIENTES.md`.
>
> **Webpay, código de comercio productivo (2026-11-05):** Transbank informó la creación del código de comercio **`597053109914`** (identificador, **no es la API Key**; la llave productiva se entrega solo tras aprobar la validación). Afiliación `1-12087316724`. **Webpay sigue apagado en producción** (verificado 2026-11-05: `/contratar` 307 a `/contacto`, `/orden*` y legales 404, `POST /api/solicitudes` 503, portada sin «Webpay»/«Transbank»). El formulario oficial de validación es público y exige tokens de transacciones de integración **con menos de 7 días**: ver `docs/WEBPAY-FORMULARIO-VALIDACION-RESPUESTAS.md` (campos, respuestas, bloqueos). Formulario **no enviado**.
>
> **Transbank confirmó pase a producción (2026-11-05, correo de soporte):** credenciales productivas (Api-Key-Id y Api-Key-Secret) asignadas y entregadas al titular; Transbank pide cambiar de integración a producción, habilitar un producto de $50 y hacer una compra real con tarjeta. **Las credenciales no están en el repositorio ni en este chat; las instala el titular directamente en el servidor.** Estado real: **Webpay sigue apagado** (sin volumen `/data`, sin `payments.json`, `ONLINE_CHECKOUT_UI=false`, `LEGAL_PAGES_PUBLISHED=false`). Bloqueos antes de cobrar: (1) cambio de Compose + `accept-compose` por el administrador, (2) páginas legales con campos `[PENDIENTE]` sin completar, (3) compilar con la interfaz de pago activa. Seguir `docs/FASE6-CHECKLIST-ACTIVACION-WEBPAY.md` (etapas 1-4). Nota: el correo menciona `Tbk-Api-Key-Id`; el código usa `commerceCode` = `597053109914` (verificar con Transbank que Api-Key-Id y código de comercio coinciden).
>
> **Punto de retoma (2026-11-05, cierre):** `main` = `8d58bea7747e21c958ac45b828d8acc38a00def7` (parche de volumen `/data`, política del ejecutor, script de credenciales; **no desplegado**). Siguiente: con autorización, `status → fetch → preflight → compose-diff → build` (sin `up`); luego administrador (política + `bd-approve accept-compose`), `up`, credenciales por entrada oculta del titular, compra de $50 con el titular presente, y datos legales. Todo en `docs/WEBPAY-PROCEDIMIENTO-ACTIVACION.md` y `docs/WEBPAY-DATOS-LEGALES-REQUERIDOS.md`.
>
> **DESPLEGADO (2026-11-05, verificado con `status`):** refinamiento Signature (sello 13+ con volumen, ritmo de contraste, `src/styles/refine.css`) + borradores `/privacidad` e `/informacion-comercial`. SHA desplegado `df19553c28e0c0c24d3d725e7eae373fa366a00c`; **rollback = `611353ef1b0db5baf33af0700c5bbac9973ab510`** (`anterior` según `status`; salud OK, compose aceptado). Lo ejecutó el titular (`up`, `verify`); Claude hizo push, `fetch`, `preflight`, `compose-diff` (CUMPLE, línea base igual) y `build`. Verificación pública de solo lectura: `/` y `/nosotros` 200 (CSS con el sello publicado), `/privacidad`, `/informacion-comercial`, `/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales`, `/orden*` 404, `/contratar` 307 a `/contacto`, `POST /api/solicitudes` sin origen 403, portada sin «Webpay/Transbank/WordPress/Divi». Webpay apagado y legales sin publicar. Informe previo: `docs/INFORME-CIERRE-PREACTIVACION-WEBPAY-2026-11-05.md`.
>
> **Anterior (2026-11-04):** el titular publicó y validó la Fase 6 por su cuenta (Claude no accede al servidor). SHA de la entrega `611353ef1b0db5baf33af0700c5bbac9973ab510` (commits `08be2c7`, `08e3d29`, `ec1bf0a` + docs); `origin/main` = `611353e` (verificado con `git fetch`); **el SHA exacto desplegado en el servidor no fue verificado por Claude**. Rollback esperado `5fef157`. Webpay sigue apagado e invisible (código presente pero inerte). Reservado hasta Transbank: pagos, `/contratar`, `/orden*`, admin/devoluciones, páginas legales en borrador. Pendientes: `docs/PENDIENTES.md`.
>
> **Fase 6.1 (2026-11-04):** rendimiento y rollback. Lighthouse móvil de Inicio: mediana 84 (rango 63–85, bimodal por el arranque del 3D a los 3,5 s); 3 experimentos medidos y revertidos, **sin cambios de código** (`FASE6-OPTIMIZACION-RENDIMIENTO.md`). Rollback: lógica verificada en simulación (129 pruebas del ejecutor) pero **estado real NO VERIFICADO**: el cliente `bd-deploy.ps1` falta en `~/.claude/tools/bd-deploy/` y `status`/`list-releases` no pudieron ejecutarse (`FASE6-VERIFICACION-ROLLBACK.md`). **Decisión del titular (2026-11-04):** el despliegue lo hace el equipo directamente (Claude no accede al servidor); hero y temporizador de 3,5 s sin cambios; rendimiento cerrado. 4 commits locales (`08be2c7`, `08e3d29`, `ec1bf0a` y documentación), sin push. Instrucciones de publicación, verificaciones y rollback: `docs/ENTREGA-FASE6.md`.
>
> **Fase 6 (2026-11-04, local; sin commit, push ni despliegue):** paquete de publicación Signature preparado con Webpay apagado (`docs/FASE6-*.md`: auditoría, identidad visual, personalización Webpay, seguridad, plan de despliegue, checklist de activación). `npm test` 41/41, tsc, lint y build OK; `npm run verify:prod` 29/29 sobre el artefacto. Producción documentada en `5fef157` (no verificada con `status` en esta fase). Espera autorización para `status`, commits (4 propuestos), push y despliegue.
>
> **Webpay Plus, Fase 5 (2026-11-04, local; sin commit, sin despliegue):** integración probada con casos reales en el ambiente de integración de Transbank y expediente de validación preparado (`docs/WEBPAY-EXPEDIENTE-CERTIFICACION.md`, `WEBPAY-CHECKLIST-CERTIFICACION.md`, `WEBPAY-REQUISITOS-OFICIALES.md`, `WEBPAY-PROPUESTAS-LEGALES.md`, `WEBPAY-CORREO-CERTIFICACION.md` borrador no enviado). 41 pruebas. Estado: **NO LISTO para pedir validación**: Transbank solo valida con código de comercio productivo (afiliación `1-12087316724` sin confirmar). Producción sigue en `5fef157` con Webpay apagado.
>
> **Webpay Plus, Fase 2 (2026-11-04, solo código local; NO desplegado):** comprobante, estado `PENDIENTE`, abandono, devoluciones administrativas, 4 páginas legales en borrador (404 en producción) y 40 pruebas. Producción sigue en `5fef157` con Webpay apagado. Ver `docs/WEBPAY-CERTIFICACION.md` y `docs/EVIDENCIAS-INTEGRACION-WEBPAY.md`.

## 1. Producción (2026-10-28: desplegado por el titular desde PowerShell; verificado en el dominio público; `status` no ejecutable desde Claude Code por el código 21)

| Dato | Valor |
|---|---|
| Sitio público | https://bydlightsolutions.com/ |
| Proyecto Docker | `bydlight-prod` (contenedor en `127.0.0.1:8200`, expuesto por Cloudflare Tunnel) |
| **Commit desplegado** | `5fef157411e565c093f1be62ecc79ae22ae0b69e` (SEO Fases 1-2; incluye el hero cinematográfico `5f000150f40529abaa70c1dd7d39e4c486c129e2`). Confirmado por el titular y por el HTML público (títulos, `legalName`, favicon); el campo `desplegado` de `status` no se leyó desde Claude Code |
| **Commit de rollback** | esperado `5f000150f40529abaa70c1dd7d39e4c486c129e2` (hero); anterior a ese `67287c08d1f57c327aa22aa888a8a301df781b0d` (Fase 3). **Verificar con `-Op status` / `list-releases` en PowerShell**: en un despliegue previo `anterior` quedó igual a `desplegado` por ejecutar `up` dos veces |
| Releases construidos | 5 según `status` |
| Salud / `verify` / `status` | OK |
| `preflight` / `compose-diff` | OK / política CUMPLE, línea base igual |
| Contenedores ajenos en la línea base | 18 (no se tocan) |

`fetch`, `preflight`, `compose-diff` (CUMPLE / línea base igual) y `build` los ejecutó Claude Code; el `up` y el `verify` los ejecutó el administrador desde PowerShell normal porque el cliente del ejecutor desapareció de su carpeta antes del `up` (ver §5 y `docs/DESPLIEGUE.md`).
**Los commits de documentación posteriores a `5fef157` no cambian lo que corre en producción** y no requieren despliegue.
Para saber qué corre hoy, la fuente de verdad es `bd-deploy.ps1 -Op status`, no este documento.

## 2. Repositorio

- Remoto: `https://github.com/Diegocarrasco12/bydlight2.git`. Rama de publicación: `main`.
- Rama de trabajo local: `feature/rediseno-2026` (se publica con `git push origin HEAD:main`; siempre fast-forward).
- Cadena de commits desplegables: `6c2f640` → `af71054` → `26a4cea` (no desplegado por separado) → `56fdcf1` → `a52dc12` (solo documentación) → `67287c0` (Fase 3) → `5f00015` (hero cinematográfico) → `5298696` (SEO 1) → `5fef157` (SEO 2, **desplegado**).
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

0. **Hero antiguo (átomo):** reaparecía porque `/` importaba `HeroStage`. Corregido en `67287c0`: `/` usa `HeroNetwork`. `HeroStage.tsx`, `scene.ts` y `.hx*` quedan como código legado sin uso. Detalle en `docs/FASE2_PROTOTIPOS.md` y documentación técnica en `docs/FASE3_DOCUMENTACION_TECNICA.md`.
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
2. `git status`, `git log --oneline -5`, `git fetch` (comprobar que `origin/main` contiene `5fef157`).
3. Para trabajar: Node **22.13 o superior** (el proyecto usa `node:sqlite`; producción corre Node 22.23.4). Comandos:
   `npm ci`, `npm test` (18 pruebas), `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run dev`.
4. Después de `npm run build`: `git checkout next-env.d.ts` (el build lo modifica) y no versionar `tsconfig.tsbuildinfo`.
5. Para publicar: commit con `git add <archivos>` explícitos → push a `main` solo con autorización → el administrador despliega
   (o la sesión usa el ejecutor si el código 21 no ocurre y el usuario lo ordena).
6. Antes de afirmar cualquier cosa sobre producción, ejecutar `status` y verificar el dominio público.
