# Webpay Plus — procedimiento de activación en producción (2026-11-05)

Estado: **preparado, nada aplicado en el servidor**. Webpay sigue apagado. Complementa `ACTIVACION-WEBPAY.md` y `FASE6-CHECKLIST-ACTIVACION-WEBPAY.md`. Ningún valor secreto aparece aquí ni debe aparecer en Git, logs, chats ni capturas.

Quién hace cada cosa: **[Claude]** local/solo lectura/build con autorización · **[ADMIN]** root del servidor · **[TITULAR]** Diego.

## Qué cambia (parche ya listo en el repo)
| Archivo | Cambio |
|---|---|
| `Dockerfile` | `mkdir -p /data/config && chown -R node:node /data` (el volumen nuevo hereda dueño uid 1000) |
| `docker-compose.prod.yml` | un volumen nombrado `bydlight_data` montado en `/data` (se conserva `read_only`, `cap_drop ALL`, límites) |
| `deploy/executor/bd_lib.py` | el validador acepta **solo** el volumen que declare la política (`project.data_volume`); sin esa clave sigue rechazando todo volumen. Rechaza bind, otro destino, otro nombre, `external`, `driver_opts`, más de un montaje |
| `deploy/executor/policy.example.json` | declara `data_volume` (plantilla; el real lo edita el ADMIN) |
| `deploy/executor/tests/` | fixture regenerado + 4 pruebas nuevas (133 en total, OK) |
| `scripts/setup-payments-config.mjs` | crea `payments.json` con entrada oculta (exige terminal real; rechaza pipes) |

Verificado en local con Docker (imagen de prueba ya eliminada): `/data` y `/data/config` pertenecen a `node`; escritura como uid 1000 con raíz de solo lectura; el archivo persiste entre contenedores; SQLite en modo WAL funciona en `/data`.

## Fase A — Infraestructura (pagos siguen apagados)
1. **[Claude]** `status` (SHA desplegado y rollback actuales; anotar), `fetch <sha>`, `preflight`, `compose-diff`, `build <sha>`, `job-status`. El `compose-diff` mostrará el cambio estructural (volumen) y **bloqueará `up`** hasta aceptar la línea base: es lo esperado.
2. **[ADMIN]** Revisar el diff de política y Compose. Copiar a `/usr/local/lib/bd-deploy/` el `bd_lib.py` nuevo (misma versión del SHA) y añadir en `/etc/bd-deploy/policy.json`, dentro de `project`:
   `"data_volume": {"name": "bydlight_data", "target": "/data"}`
   Reejecutar la autoprueba de la instalación si procede.
3. **[ADMIN]** Antes del `up`, respaldo de lo existente: anotar `list-releases` (imagen anterior = rollback) y confirmar que el Compose aceptado actual está guardado.
4. **[ADMIN]** `sudo bd-approve accept-compose <sha40> 30` (un solo uso, ligado al SHA). **[Claude]** `accept-compose <sha40>`.
5. **[TITULAR]** autoriza `up`. **[Claude o titular]** `up <sha40>` → `verify` → `status`. El **primer** `up` debe ser con la imagen nueva (así el volumen nace con dueño `node`).
6. Comprobar: sitio igual que antes, `/contratar` 307 a `/contacto`, `POST /api/solicitudes` 503.

## Fase B — Credenciales (las pone el TITULAR; Claude no las ve)
Requiere Fase A completa. En el servidor, **terminal interactiva**, con el tag de la imagen desplegada (`<tag>` = el `tag` de `list-releases`; `<app_dir>` = `/srv/bydlight-prod/app`):

```
docker run --rm -it --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -v bydlight-prod_bydlight_data:/data -v <app_dir>/scripts:/s:ro \
  bydlight-web:<tag> node /s/setup-payments-config.mjs /data/config/payments.json
```
Pide por **entrada oculta**: (1) código de comercio / `Tbk-Api-Key-Id`, (2) `Tbk-Api-Key-Secret`. Genera `adminSecret` aleatorio, escribe `enabled:false`, `env:production`, permisos 0600, dueño uid 1000. Si algo falla no escribe nada. Verificar sin mostrar secretos:

```
docker run --rm --user 1000:1000 -v bydlight-prod_bydlight_data:/data bydlight-web:<tag> ls -l /data/config/payments.json
```
Debe mostrar `-rw------- node node`. **Antes de pegar la llave, confirmar con Transbank que `Tbk-Api-Key-Id` equivale al código de comercio** que usa el código (`commerceCode`, 597053109914 según el estado del proyecto).

## Fase C — Compra real de $50 (titular presente, con su tarjeta)
Por qué no se necesita cambiar código: la cotización mínima es $100 y el cobro mínimo $50; **cotización de $100 con anticipo 50% = cobro de exactamente $50** (prueba `1b` lo demuestra). `/contratar` funciona por URL directa aunque la interfaz pública siga oculta (`noindex`).
1. **[TITULAR]** `enabled` → `true` en `payments.json` (efecto ≤ 5 s, sin redeploy). Ventana abierta mientras dure la prueba.
2. **[TITULAR]** Abrir `https://bydlightsolutions.com/contratar`, enviar una solicitud con datos propios; anotar el código de orden.
3. **[TITULAR]** Aprobar la cotización desde su equipo (el secreto es el `adminSecret` leído del servidor; no se pega en el chat):
   `BYDLIGHT_URL=https://bydlightsolutions.com node scripts/admin-remote.mjs approve <ID> --amount 100 --deposit-percent 50 --secret-file <archivo>`
4. **[TITULAR]** En `/orden/<ID>` pagar el anticipo ($50) con tarjeta real. Verificar comprobante, estado `ANTICIPO_PAGADO`, autorización.
5. **[TITULAR]** Volver `enabled` → `false` hasta tener las páginas legales publicadas (o `true` si decide operar ya; ver Fase D).
6. Si falla: llamar a Transbank (600 638 6380, +562 2661 2700, soporteweb@transbank.cl); no reintentar a ciegas. Revisar `logs` y `reconcile`.
7. Devolución de la compra de prueba (opcional): solo si `adminRefunds:true`; ver `WEBPAY-CERTIFICACION.md`.

## Fase D — Operación pública (después de Fase C y de los datos legales)
Cambios de código a aprobar (**no aplicados**): `ONLINE_CHECKOUT_UI = true` (`src/lib/plans.ts`) y `LEGAL_PAGES_PUBLISHED = true` (`src/lib/legal.ts`), con las páginas ya sin `[PENDIENTE]` (ver `WEBPAY-DATOS-LEGALES-REQUERIDOS.md`). Luego `npm test`, `tsc`, `lint`, `build`, commit, push, `fetch → preflight → compose-diff (igual) → build → up → verify → status`. Con `enabled:false` los botones llevan a `/contratar`, que redirige a `/contacto` (falla segura).

## Apagado y rollback
- **Apagado inmediato de cobros:** `enabled:false` en `payments.json` (≤ 5 s). Los retornos de pagos ya iniciados no confirman mientras esté apagado: conciliar con Transbank.
- **Rollback de imagen (con autorización):** `rollback` → `verify` → `status`. Requiere que la línea base de Compose coincida (tras `accept-compose` seguirá siendo la nueva). El volumen y la base **no se borran** con `up`/`rollback`. Nunca `down -v` ni `docker system prune`.
- **Volver a Compose sin volumen** (solo si el ADMIN lo decide): restaurar la línea base anterior y la política; la imagen vieja no usa `/data`.
- **Respaldo diario** de `bydlight.db` (cron del ADMIN, `ACTIVACION-WEBPAY.md` §5). `payments.json` no se incluye sin cifrar.
- **Estado del rollback en el servidor:** lógica verificada en simulación (133 pruebas); el estado real se confirma con `status` y `list-releases` antes de la Fase A.
