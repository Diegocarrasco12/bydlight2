# Webpay Plus en producción: informe de cierre del desarrollo, plan de despliegue y prueba real de $50 (2026-11-06)

Estado: **desarrollo y pruebas locales terminados; nada desplegado, nada activado, ningún cobro real.** `payments.json` de producción (`enabled:false`, `adminRefunds:false`, credenciales y secreto instalados) no se toca desde aquí. **Procedimiento operativo para copiar y pegar en Ubuntu: `DESPLIEGUE-WEBPAY-UBUNTU.md`** (este documento es la explicación y la evidencia). Reemplaza para este flujo a `WEBPAY-PROCEDIMIENTO-ACTIVACION.md` (fases B–D) y se complementa con `DESPLIEGUE-MANUAL-UBUNTU.md` (respaldo/rollback) y `PAGOS-SQLITE.md`.

> **Actualización 2026-11-10 (decisión del titular):** la prueba real de $50 ya se realizó (no se repite); la publicidad de Webpay Plus y las páginas legales actuales **se mantienen publicadas**; las gestiones legales y tributarias ya se hicieron. Este informe es histórico (2026-11-06). Estado vigente y pasos que faltan: `docs/PENDIENTES.md` y `docs/ESTADO_ACTUAL.md`.

## 1. Qué cambió (resumen)
| Tema | Antes | Ahora |
|---|---|---|
| Acceso al checkout | `enabled:true` abría `/contratar`, `POST /api/solicitudes` y `POST /api/pagos/iniciar` a **cualquiera** | Tres modos explícitos: `closed` / **`pilot`** (por defecto con `enabled:true` en producción) / `public`. En `pilot` solo entra quien use el **enlace firmado de un solo uso** del administrador |
| Anuncio público de Webpay | dependía de `paymentsEnabled()` (que al compilar la imagen siempre da falso) | depende solo del código publicado (`ONLINE_CHECKOUT_UI` y `LEGAL_PAGES_PUBLISHED`); en piloto no se anuncia nada |
| Logotipos | ninguno publicado | **Webpay Plus y Transbank oficiales**, sin modificar, en checkout, orden, pantalla de redirección, comprobante (pantalla e impresión) y pie de página; ninguna marca de tarjeta |
| Cliente administrativo | secreto por variable o archivo | + `--config-file` (lee el secreto del archivo privado del servidor sin mostrarlo), entrada oculta, `pilot-link`, `approve-test` |
| Interruptores del servidor | edición manual de `payments.json` | `scripts/payments-config-set.mjs` (solo `enabled` y `access`; no toca ni imprime credenciales) |

## 2. Cambios de seguridad
1. **Modo piloto** (`src/lib/payments/config.ts` `checkoutMode()`, `pilot.ts`, `access.ts`, `api/acceso-piloto`). El enlace es `v1.<vence>.<horas>.<HMAC>` derivado del secreto administrativo ya existente (no hay secretos nuevos): vale ≤ 10 min, **un solo uso** (huella en `admin_nonces`), emite una cookie `bd_piloto` **HttpOnly, Secure, SameSite=Lax** de 1–8 h (HMAC con otro dominio de firma; una cookie no sirve de enlace ni al revés). Rotar `adminSecret` invalida todo al instante. Cualquier fallo responde 404 igual (no revela nada).
2. **Qué exige la cookie:** `/contratar` (sin cookie → `/contacto`, igual que apagado), `POST /api/solicitudes` (503 genérico) y `POST /api/pagos/iniciar` (sin cookie no se llama a Transbank). Se verifica **antes** de abrir la base de datos: un tercero no puede ni crear el archivo.
3. **Se conservan:** validación de origen (CSRF), límites por IP, campo trampa, aceptación de términos con versión validada y registrada en el servidor, monto siempre desde la cotización guardada, `commit` único, idempotencia de retornos, firma HMAC administrativa con ventana de 60 s y nonce, devoluciones apagadas (`adminRefunds:false`).
4. **`public` no se puede abrir por error:** requiere `access:"public"` en `payments.json` **y** `ONLINE_CHECKOUT_UI=true` **y** `LEGAL_PAGES_PUBLISHED=true` en el código desplegado; si falta uno, se degrada a `pilot`. `LEGAL_PAGES_PUBLISHED=true` además falla el build si queda un `[PENDIENTE]`.
5. Las órdenes de la prueba quedan rotuladas (`ACCESO_PILOTO` en la trazabilidad) y la página muestra «Prueba productiva controlada · el cobro es real».
6. Sin puertas traseras: no hay ruta administrativa sin autenticación; `pilot-link` solo funciona con el secreto y no llama al servidor.

## 3. Evidencia de pruebas (ejecutadas el 2026-11-06 en este equipo)
| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | sin errores |
| `npm run lint` | sin errores ni avisos |
| `npm test` (SQLite real + doble del SDK) | **61 de 61 OK**: flujo aprobado, rechazado, cancelado, expirado, pendiente/interrumpido, retorno duplicado, `commit` único, monto manipulado, doble pago, concurrencia, conciliación, devoluciones (apagadas por defecto), firma administrativa, persistencia tras reinicio, migraciones con checksum, términos, **modo piloto (P1–P9)** |
| `npm run build` | correcto |
| `npm run verify:prod` (artefacto de producción, pagos apagados) | 36/36 |
| `npm run verify:pilot` (artefacto de producción, modo piloto con comercio ficticio) | 32/32: terceros no entran, cookie falsificada, enlace de un solo uso, orden, aprobación firmada con el cliente oficial, secreto equivocado 401, devoluciones desactivadas, logos, términos obligatorios, sin cobro sin cookie, retorno falso inocuo |
| `node scripts/sdk-integration-check.mjs` | **SDK oficial contra el ambiente de integración de Transbank:** `create` OK, `status` INITIALIZED con orden y monto correctos, `commit` sin pago del cliente rechazado por Transbank. Sin dinero |
| Responsive (Chromium real, 1440/1024/768/390/320 px, 6 rutas) | 0 desbordes horizontales |
| Respaldo/restauración (`orders-admin.mjs check/backup`) | integridad ok, migración v3, respaldo verificado |

Límites honestos: el formulario de Webpay lo aloja Transbank y no se probó aquí; el cobro real solo se demuestra con la compra de $50 (sección 6). El flujo en vivo del servidor Ubuntu no se ejecutó.

## 4. Plan de despliegue con `bd-run` (lo ejecuta el titular; compose y Dockerfile no cambian)
`<SHA>` = commit completo que se informe tras el push autorizado. No se cambia Docker Compose, así que `compose-diff` debe mostrar **sin cambios** y **no** hace falta `accept-compose`; si muestra cambios, detenerse.
```
sudo bd-run status                    # confirma 530b95c y healthy
sudo bd-run fetch <SHA>
sudo bd-run preflight
sudo bd-run compose-diff              # debe indicar sin diferencias de Compose
sudo bd-run build <SHA>
sudo bd-run job-status <ID_DEL_TRABAJO>   # hasta que termine OK
sudo bd-run up <SHA>
sudo bd-run verify
sudo bd-run status
```
Con `enabled:false` el sitio queda **igual de cerrado que hoy**: `/contratar` → `/contacto`, `/api/solicitudes` 503, `/api/acceso-piloto` 404, páginas legales 404. Las diferencias visibles son solo los logotipos oficiales (que aparecen únicamente con el checkout/anuncio activos) y el nuevo modo de acceso.

**Rollback:** `sudo bd-run rollback` (requiere su autorización; vuelve a la imagen anterior; el volumen y la base no se tocan) → `sudo bd-run verify` → `sudo bd-run status`. Apagado inmediato de cobros sin redeploy: `enabled=false` (sección 5, paso 6; rige en ≤ 5 s).

## 5. Comando auxiliar en el servidor (solo Bydlight2, contenedores efímeros)
Definir una vez (no contiene secretos): 
```
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
RUN="docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/s:ro -e BYDLIGHT_URL=https://bydlightsolutions.com bydlight-web:$TAG"
```
1. **Ver el estado sin secretos:** `$RUN node /s/payments-config-set.mjs /data/config/payments.json --show` (debe decir `enabled:false`, `adminRefunds:false`, `credencialesTransbank:true`, `secretoAdministrativo:true`).
2. **Respaldo de la base** (la base se crea al recibir la primera solicitud del piloto; haga el respaldo **después** de la prueba y antes de cualquier cambio posterior). Estructura de montajes verificada localmente:
   ```
   docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true      -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/w/scripts:ro      -v /srv/bydlight-prod/app/src/lib/payments/migrations.mjs:/w/src/lib/payments/migrations.mjs:ro      -e PAYMENTS_DB=/data/bydlight.db bydlight-web:$TAG      sh -c 'mkdir -p /data/backups && node /w/scripts/orders-admin.mjs backup /data/backups/prueba-$(date +%F).db'
   ```
   Verifica integridad y no sobrescribe. Restauración y política de retención: `PAGOS-SQLITE.md` (detener `web`, `restore … --yes`, `check`, iniciar). Los respaldos contienen datos personales: acceso restringido.
3. **Abrir el piloto:** `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=pilot`. Rige en ≤ 5 s; solo entra quien tenga el enlace firmado.
4. **Emitir su enlace (el secreto se lee del archivo, no se muestra):** `$RUN node /s/admin-remote.mjs pilot-link --config-file /data/config/payments.json --minutes 10 --hours 2`. Abra el enlace **en su navegador** (un solo uso, 10 min). No lo comparta.
5. **Aprobar la cotización de prueba (cliente oficial, firma HMAC):** `$RUN node /s/admin-remote.mjs approve-test <ID_ORDEN> --config-file /data/config/payments.json` (cotización $100, anticipo 50 % = $50, saldo $50, vigencia 1 día, nota «PRUEBA PRODUCTIVA»).
6. **Cerrar:** `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false` (emergencia o fin de la prueba).
En el paso 4/5, `$RUN` ya apunta a `https://bydlightsolutions.com` (el contenedor sale por la red por defecto; no se usa red del host).

## 6. Compra real de $50 (solo con su autorización expresa; usted la completa en Webpay)
Orden: despliegue (sección 4, con `enabled:false`) → verificación → **su autorización** → pasos 1, 3, 4 de la sección 5.
1. En su navegador, con el enlace: `/contratar` muestra «Prueba productiva controlada». Elija un plan, complete datos propios, marque la casilla y envíe. Anote el código de orden (12 caracteres).
2. Paso 5 de la sección 5 (`approve-test`). Recargue `/orden/<ID>`: «Resumen previo al pago» **$50**, Webpay Plus + Transbank.
3. Marque términos y pulse «Pagar anticipo de $50» → Webpay → pague con su tarjeta real.
4. Al volver: «Pago aprobado», comprobante con autorización, últimos 4 dígitos y fecha. Confirme que figure en el panel de Transbank.
5. Opcional: saldo de $50: `$RUN node /s/admin-remote.mjs release-balance <ID> --config-file …`, recargue la orden y pague el saldo.
6. Cierre: paso 6 de la sección 5 (`enabled=false`) hasta decidir el lanzamiento. Revise la trazabilidad: `$RUN node /s/admin-remote.mjs show <ID> --config-file …` (debe listar `SOLICITUD_CREADA`, `ACCESO_PILOTO`, `TERMINOS_ACEPTADOS`, `COTIZACION_APROBADA`, `PAGO_INICIADO`, `PAGO_AUTORIZADO`).
7. Si algo falla: no reintente a ciegas; `… admin-remote.mjs reconcile` consulta a Transbank los pagos en curso; luego contacte a Transbank (600 638 6380, soporteweb@transbank.cl). La devolución de la prueba solo es posible con `adminRefunds:true` (no se activa aquí; `WEBPAY-CERTIFICACION.md`).
**La certificación productiva no se da por completada hasta realizar y verificar esta compra.**

## 7. Activación pública (después de la prueba; requiere aprobación)
Orden: (a) datos legales entregados y textos aprobados (`LEGAL-DATOS-PENDIENTES.md`); (b) `TERMS_VERSION` actualizada; (c) confirmar con el área comercial de Transbank qué marcas de tarjeta están habilitadas (y recién entonces agregarlas a `PAYMENT_LOGOS.cards`); (d) cambio de código: `LEGAL_PAGES_PUBLISHED=true`, `ONLINE_CHECKOUT_UI=true` + pruebas + build + `verify:prod` ajustado; (e) despliegue con `bd-run`; (f) `payments-config-set.mjs … enabled=true access=public`. Revertir: `access=pilot` o `enabled=false` (sin redeploy).

## 8. Estado de los pendientes
| Pendiente | Clasificación |
|---|---|
| Integración de pagos extremo a extremo, modo piloto, logotipos Webpay Plus y Transbank, cliente administrativo seguro, pruebas y documentación | **Resuelto** |
| Push de los commits preparados y despliegue con `bd-run` | **Pendiente de autorización** |
| `enabled:true` + piloto y compra real de $50 | **Pendiente de autorización** (la hace el titular) |
| Confirmación de marcas de tarjeta habilitadas (Visa, Mastercard, Amex, Redcompra) con el área comercial de Transbank | **Pendiente de información externa** (no bloquea el piloto; las marcas no se anuncian) |
| Datos legales (RUT, domicilio, IVA, plazos, devoluciones, privacidad, ley aplicable) | **Pendiente de información externa** · **bloqueante para el checkout público**, no para el piloto |
| Titularidad: comercio Transbank a nombre de persona natural vs. textos de la SpA | **Pendiente de información externa** · bloqueante para el checkout público |
| Compra real de $50 verificada | **Bloqueante para considerar completa la certificación productiva** |
