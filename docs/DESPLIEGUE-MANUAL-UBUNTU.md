# Despliegue manual de Bydlight2 en el servidor Ubuntu (2026-11-06)

Modalidad: **Claude desarrolla y verifica en local; el titular ejecuta personalmente todo lo del servidor.** Solo se toca el proyecto Docker `bydlight-prod` (Bydlight2). Nunca otros contenedores, Cloudflare ni DNS. Nunca `docker system prune`, `down -v`, `git reset --hard` ni `git clean`.

Datos: directorio `/srv/bydlight-prod/app` · proyecto Compose `bydlight-prod` · servicio `web` · imagen `bydlight-web:<tag>` · volumen `bydlight-prod_bydlight_data` (montado en `/data`) · puerto `127.0.0.1:8200` · versión desplegada confirmada: `df19553c28e0` · rollback = esa misma versión.

> `SHA` = commit completo de 40 caracteres que Claude informa tras el push. `TAG` = 12 primeros caracteres. Ajuste la ruta del repo si difiere.
> Si el ejecutor `bd-deploy` está instalado, el procedimiento con `fetch/preflight/compose-diff/build/up` de `WEBPAY-PROCEDIMIENTO-ACTIVACION.md` sigue siendo válido; aquí está el equivalente manual.

## 1. Comprobar el estado actual
```
cd /srv/bydlight-prod/app
git rev-parse HEAD
docker compose -p bydlight-prod -f docker-compose.prod.yml ps
docker image ls bydlight-web --format '{{.Tag}} {{.CreatedAt}}'
curl -sI http://127.0.0.1:8200/ | head -1
```
Anote SHA y tag actuales (deben corresponder a `df19553c28e0`).

## 2. Respaldo (antes de cualquier cambio)
```
mkdir -p ~/bydlight-backups && chmod 700 ~/bydlight-backups
cp docker-compose.prod.yml ~/bydlight-backups/compose-$(date +%F).yml
docker image tag bydlight-web:<TAG_ACTUAL> bydlight-web:rollback-$(date +%F)
docker volume ls | grep bydlight-prod_bydlight_data || echo "volumen aun no existe (normal antes del primer up con el cambio)"
```
Si el volumen ya existe y hay base, respáldela con `scripts/orders-admin.mjs backup <archivo>` (ver `PAGOS-SQLITE.md`). Los respaldos contienen datos personales: acceso restringido.

## 3. Obtener la versión aprobada
```
git fetch origin
git log --oneline HEAD..origin/main        # revise qué entra
git checkout --detach <SHA>                # exactamente el SHA informado
git rev-parse HEAD                         # debe coincidir
```

## 4. Diferencias de Docker Compose
```
git diff df19553c28e0 <SHA> -- docker-compose.prod.yml Dockerfile
```
Cambio esperado la primera vez: un volumen `bydlight_data` en `/data` y `mkdir /data/config` en el Dockerfile. **Cualquier otro cambio: deténgase y consulte.**

## 5. Aprobar el volumen persistente
Si usa el ejecutor: el administrador copia `bd_lib.py` nuevo a `/usr/local/lib/bd-deploy/`, añade `"data_volume": {"name": "bydlight_data", "target": "/data"}` a `/etc/bd-deploy/policy.json` y ejecuta `sudo bd-approve accept-compose <SHA> 30` (ligado al SHA; nunca automático). Con Compose manual, la aprobación es su revisión del paso 4.

## 6. Construir y desplegar solo Bydlight2
```
BD_TAG=<TAG> docker compose -p bydlight-prod -f docker-compose.prod.yml build web
BD_TAG=<TAG> docker compose -p bydlight-prod -f docker-compose.prod.yml up -d web
docker compose -p bydlight-prod -f docker-compose.prod.yml ps
```
El **primer** `up` debe usar la imagen nueva (así el volumen hereda dueño `node`, uid 1000). Se conserva `read_only`, `cap_drop ALL`, `no-new-privileges`, límites de memoria/CPU.

## 7. Credenciales (solo usted, entrada oculta; nunca en chat ni en Git)
Antes: confirmar con Transbank que `Tbk-Api-Key-Id` equivale al código de comercio productivo que usa el código.
```
docker run --rm -it --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/s:ro \
  bydlight-web:<TAG> node /s/setup-payments-config.mjs /data/config/payments.json
```
Pide código de comercio y API Key por entrada oculta, genera `adminSecret`, escribe `enabled:false`, `env:production`, permisos 0600, dueño uid 1000; si algo falla no escribe nada. Verificar sin mostrar secretos:
```
docker run --rm --user 1000:1000 -v bydlight-prod_bydlight_data:/data bydlight-web:<TAG> ls -l /data/config/payments.json
```
Debe decir `-rw------- node node`.

## 8. Verificaciones posteriores al despliegue (cobros aún apagados)
```
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/                      # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/contratar             # 307 -> /contacto
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/terminos              # 404 (legales ocultos)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8200/vista-previa          # 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8200/api/solicitudes   # 403/503, no crea órdenes
docker logs --tail 50 bydlight-prod-web-1
docker inspect -f '{{.Config.User}} {{.HostConfig.ReadonlyRootfs}}' bydlight-prod-web-1   # 1000:1000 true
```
Luego pruebe `https://bydlightsolutions.com/` desde el navegador.

## 9. Compra real de prueba de $50 (usted presente, su tarjeta)
Cotización de $100 con anticipo 50 % = cobro exacto de $50 (sin cambiar código).
1. En `payments.json` ponga `"enabled": true` (efecto ≤ 5 s). Edite con el mismo contenedor efímero o `docker run … sh`, nunca imprimiendo el archivo.
2. Abra `https://bydlightsolutions.com/contratar` (URL directa), acepte la casilla de términos y envíe la solicitud con datos suyos; anote el código de orden.
3. Apruebe: `BYDLIGHT_URL=https://bydlightsolutions.com node scripts/admin-remote.mjs approve <ID> --amount 100 --deposit-percent 50 --secret-file <archivo>` (el secreto sale del servidor, no del chat).
4. En `/orden/<ID>` pague el anticipo. Verifique: pantalla de comprobante, estado `ANTICIPO_PAGADO`, código de autorización, evento `TERMINOS_ACEPTADOS` (`node scripts/orders-admin.mjs show <ID>`), y que aparezca en el panel de Transbank.
5. Vuelva a `"enabled": false` hasta tener los legales publicados.
6. Si falla: no reintente a ciegas; revise logs y llame a Transbank (600 638 6380).

## 10. Cobros comerciales (solo con todo aprobado)
Requisitos: datos legales entregados y textos aprobados (`LEGAL-DATOS-PENDIENTES.md`), `TERMS_VERSION` actualizada, marcas autorizadas (si se usan logos), compra de $50 verificada. Entonces Claude prepara el cambio (`ONLINE_CHECKOUT_UI`, `LEGAL_PAGES_PUBLISHED`), prueba y publica en Git; usted repite los pasos 1–8 con el nuevo SHA y pone `"enabled": true`.

## Respaldo programado y recuperación de transacciones
- Cron diario del host: `VACUUM INTO` a `/srv/bydlight/backups/bydlight-AAAA-MM-DD.db`, retención 30 días, copia fuera del servidor y cifrada (ver `ACTIVACION-WEBPAY.md` §Respaldos).
- Recuperación: detener `web`, `node scripts/orders-admin.mjs restore <archivo> --yes` sobre el volumen, `check`, iniciar. El volumen no se borra con `up` ni `rollback`.

## Apagado inmediato de cobros y rollback
- Cobros: `"enabled": false` en `payments.json` (≤ 5 s). Los retornos de pagos ya iniciados no confirman mientras esté apagado: concilie con Transbank.
- Rollback de imagen a `df19553c28e0`:
```
git checkout --detach df19553c28e0 && BD_TAG=df19553c28e0 docker compose -p bydlight-prod -f docker-compose.prod.yml up -d web
```
  (la imagen anterior sigue etiquetada; el volumen y la base se conservan). Verifique con el paso 8.
