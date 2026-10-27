# Activación de Webpay Plus en producción — plan y estado

Estado a 2026-10-27. **Nada de esto está aplicado en el servidor.** Los pagos siguen apagados en producción.

## 0. Estado de publicación: Webpay invisible y apagado
- **Servidor**: sin `payments.json` ni `PAYMENTS_ENABLED`, `paymentsEnabled()` es `false` en producción. `/api/solicitudes` responde 503; `/api/pagos/*` no ejecutan operaciones; `/api/admin` responde 404; **no se abre ni se crea ninguna base ni archivo**.
- **Interfaz**: `ONLINE_CHECKOUT_UI = false` (`src/lib/plans.ts`): «Solicitar este plan» lleva a `/contacto?plan=<id>` (mensaje prellenado) y WhatsApp. `/contratar` redirige a `/contacto`; `/orden` y `/orden/<id>` responden 404 sin consultar datos. Ningún texto público menciona Webpay/Transbank.
- **Orden para activar después** (cada paso con tu autorización): (1) afiliación y validación con Transbank (sección 2); (2) aplicar volumen `/data` + `accept-compose` (sección 5); (3) crear `/data/config/payments.json` con `enabled:false`, código de comercio, llave y `adminSecret`; (4) ejecutar las validaciones de Transbank y la compra real de $50 (poniendo `enabled:true` solo durante la prueba); (5) cambiar `ONLINE_CHECKOUT_UI` a `true`, publicar con `fetch → build → up → verify` para mostrar los botones; (6) `enabled:true` definitivo. El interruptor `enabled:false` apaga los pagos en ≤ 5 s sin redeploy.

## 1. Qué hace cada parte

| Quién | Qué |
|---|---|
| **Titular del comercio (Diego)** | Afiliación en Transbank (datos tributarios y bancarios, firma digital del contrato), formulario de validación técnica, recibir y guardar la llave secreta, compra real de $50, aprobar cambios de Compose, DNS/Cloudflare, crear el archivo de secretos en el servidor |
| **Claude Code (local)** | Código, pruebas, evidencias de integración, documentación, preparar los parches de infraestructura |
| **Claude Code vía `bd-deploy`** (solo con autorización explícita) | `fetch`, `build`, `up`, `verify` |

## 2. Procedimiento oficial de Transbank (fuente: transbankdevelopers.cl, "Pasar a producción")
1. **Requisitos**: sitio activo, **HTTPS** en todos los endpoints, componentes actualizados.
2. **Afiliación**: formulario en `publico.transbank.cl`, firmado digitalmente. Transbank envía el **código de comercio** al correo registrado (o se obtiene con un ejecutivo comercial).
3. **Validación técnica** (Webpay Plus): formulario online de validación + evidencias de los casos de prueba hechos en integración (aprobadas y rechazadas) + **logo de la tienda GIF/PNG de 130×59 px**. Soporte revisa que los casos coincidan con sus registros y notifica conformidad u observaciones.
4. **Credenciales de producción**: aprobada la validación, Transbank envía por correo la **llave secreta (Api Key Secret)**. Producción = código de comercio + llave secreta; host `https://webpay3g.transbank.cl` (el SDK lo usa solo con `Environment.Production`).
5. **Puesta en producción**: configurar producción y hacer **una compra real de $50** para verificar. Con eso termina oficialmente.

**No verificado (la documentación pública no lo muestra; confirmar con Transbank / ejecutivo):** documentos exactos que pide el formulario (si basta persona natural con inicio de actividades o se exige sociedad), costo de afiliación, **comisiones por venta** (se informan en el simulador de tarifas de transbank.cl / en la oferta comercial), plazos de respuesta, y el orden exacto afiliación ↔ validación (la propia documentación no es consistente). Los abonos publicados son: débito 24 h hábiles, crédito 48 h hábiles, con comisión descontada automáticamente.

## 3. Lo que ya está hecho en el código
- SDK oficial `transbank-sdk` 6.1.1 (última versión publicada), fijado exacto.
- Flujo conforme a la documentación: `create` → redirección con `token_ws` → `commit` **una sola vez** desde el backend → `status` ante fallo/recuperación; manejo de los 4 retornos (normal, anulado `TBK_TOKEN`, tiempo excedido `TBK_ORDEN_COMPRA`, inválido `token_ws`+`TBK_TOKEN`); aprobado solo si `status=AUTHORIZED` y `response_code=0` y coinciden `buy_order`, `session_id` y monto.
- `buy_order` único (`BL<id>-NN`, 17 caracteres), `session_id` = orden; monto siempre desde la cotización guardada.
- SQLite con restricciones (un único pago autorizado por orden/tipo), migraciones con checksum, respaldo/restauración.
- **Administración**: ya no solo por script en el equipo. API `POST /api/admin` con **firma HMAC-SHA256** (ventana de 60 s, nonce de un solo uso guardado en SQLite, comparación en tiempo constante, límite por IP). Sin secreto configurado devuelve 404. Cliente: `scripts/admin-remote.mjs`. El cliente final **no tiene ninguna ruta** que apruebe o cambie cotizaciones.
- Órdenes: código de 12 caracteres aleatorios (≈59 bits), límite de 40 consultas/10 min por IP, correo enmascarado, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: same-origin`.
- Recuperación: cada visita a una orden con pago "en curso" > 2 min consulta a Transbank; acción administrativa `reconcile` consulta todos.
- Interruptor de emergencia: `enabled:false` en el archivo de configuración apaga los pagos en ≤ 5 s sin redeploy.
- 17 pruebas automáticas (`npm test`, Node 22.23.4) y verificación manual contra el sandbox real (aprobado, rechazado, cancelado).

## 4. Configuración segura de producción (sin `environment` en Compose)
Todo vive en el **volumen de datos**, fuera de Git y de la imagen:
```
/data/bydlight.db                 base SQLite (0600)
/data/config/payments.json        configuración y secretos (0600, dueño uid 1000)
```
`payments.json` (lo crea el titular en el servidor; **nunca** se versiona):
```json
{
  "enabled": false,
  "env": "production",
  "commerceCode": "<código de comercio entregado por Transbank>",
  "apiKey": "<llave secreta entregada tras la validación>",
  "publicBaseUrl": "https://bydlightsolutions.com",
  "adminSecret": "<64 caracteres hex aleatorios>"
}
```
- Mantener `"enabled": false` hasta terminar la validación; pasar a `true` solo para la compra de $50 y la operación real.
- Generar el secreto administrativo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. El mismo valor va en tu equipo (`BYDLIGHT_ADMIN_SECRET`).
- Alternativa más estándar (requiere cambio de política del ejecutor): `env_file:` apuntando a un archivo fuera del repo.

## 5. Cambios mínimos de infraestructura (NO aplicados; requieren política + `accept-compose`)
**Dockerfile** (etapa `runner`, antes de `USER node`): crear el punto de montaje con dueño `node` para que el volumen nuevo herede permisos.
```diff
 COPY --from=build --chown=node:node /app/.next/static ./.next/static
+RUN mkdir -p /data/config && chown -R node:node /data
 USER node
```
**docker-compose.prod.yml**: un volumen nombrado dedicado (conserva `read_only: true`, `cap_drop: ALL`, límites).
```diff
     read_only: true
+    volumes:
+      - bydlight_data:/data
 ...
 networks:
   app: {}
+volumes:
+  bydlight_data: {}
```
Efectos: el volumen real se llama `bydlight-prod_bydlight_data` (prefijo del proyecto; no toca otros proyectos). La política actual del ejecutor prohíbe volúmenes ("sin volúmenes"): hay que cambiarla **solo para este montaje** (destino `/data`, nombre `bydlight_data`, sin bind mounts) y luego `accept-compose` (humano). Regenerar `deploy/executor/tests/fixtures/prod.json`.

**Reversión**: `rollback` del ejecutor a la imagen anterior; el volumen y sus datos quedan intactos (no se borra con `up`/`rollback`; nunca usar `down -v`). Para volver al compose anterior basta restaurar la línea base aceptada.

**Respaldos (los opera el titular en el host, no la app):** cron diario como root o usuario con acceso al volumen:
```
sqlite3 /var/lib/docker/volumes/bydlight-prod_bydlight_data/_data/bydlight.db \
  "VACUUM INTO '/srv/bydlight/backups/bydlight-$(date +\%F).db'"
find /srv/bydlight/backups -name 'bydlight-*.db' -mtime +30 -delete
```
Más una copia fuera del servidor (cifrada). Restauración: detener `up` del servicio, `node scripts/orders-admin.mjs restore <archivo> --yes` con `PAYMENTS_DB` apuntando al volumen, `check`, volver a levantar. **No** incluir `payments.json` en esos respaldos sin cifrar.

## 6. Dominio público (hallazgos pasivos, 2026-10-27)
- `bydlightsolutions.com` está en Cloudflare (NS `*.ns.cloudflare.com`, IPs de Cloudflare). Responde 200 con `text/html` a **cualquier** ruta inexistente (respaldo SPA), `last-modified` del 2026-05-02, sin cabeceras de Next ni de seguridad, `robots.txt` administrado por Cloudflare, título antiguo. Es un **sitio estático distinto**, no el contenedor `bydlight-prod` (que responde en `127.0.0.1:8200` del servidor y sin túnel público: `DEPLOY.md`, "pendiente: ingress del túnel y DNS").
- No se pudo distinguir Cloudflare Pages / Workers / otro hosting sin acceso al panel.
- **Para que el nuevo sitio sea el público** (decisión y acción del titular, no ejecutadas): (1) en Zero Trust crear/confirmar el ingress `bydlight-tunnel → http://localhost:8200`; (2) en DNS, apuntar el registro del dominio (y `www`) al túnel (CNAME `<UUID>.cfargotunnel.com`, proxied) **reemplazando** el destino actual; (3) conservar intacto el proyecto estático anterior para poder volver cambiando el registro DNS (TTL bajo antes del cambio). Hacerlo **después** de `up` + `verify` de la publicación B, y probar antes con un subdominio de prueba (p. ej. `nuevo.bydlightsolutions.com`) apuntando al túnel.

## 7. Matriz de pruebas
| Caso | Estado |
|---|---|
| Aprobado | Automática + sandbox real con SQLite ✔ |
| Rechazado | Automática + sandbox real con SQLite ✔ |
| Cancelado | Automática + retorno `TBK_TOKEN` simulado ✔ (botón "Anular" real probado antes de SQLite) |
| Retorno duplicado | Automática ✔ (un solo `commit`) |
| Monto/orden manipulado | Automática ✔ |
| Orden inexistente / ID inválido | Automática ✔ |
| Acceso no autorizado (admin/cotización) | Automática ✔ (firma, replay, cuerpo alterado) |
| Reinicio de SQLite | Automática ✔ + contenedor real con volumen ✔ |
| Pago interrumpido | Automática ✔ (status AUTHORIZED / expira) |
| Expiración | Automática ✔ (retorno por tiempo; > 15 min). **Pendiente:** esperar el plazo real de Webpay (10 min integración / 4 min producción) en vivo |
| Producción real con `webpay3g` | **Pendiente** (requiere credenciales; compra de $50) |
