# Despliegue de Webpay (modo piloto) en Ubuntu: procedimiento para copiar y pegar

Lo ejecuta el titular. **El despliegue usa exclusivamente `bd-run`.** Los comandos `docker run --rm` de las secciones 4–6 son utilidades efímeras de configuración y administración (no despliegan nada, no tocan otros contenedores ni redes) y usan solo el volumen `bydlight-prod_bydlight_data` y la carpeta de scripts del repositorio. Nunca: `docker system prune`, `down -v`, borrar volúmenes, tocar otros contenedores, Cloudflare ni DNS.

Estado de partida: producción en `530b95c645fff70b3a2385fbc1ca4c41fe09d423`, `healthy`, `payments.json` con `enabled:false` y `adminRefunds:false`. Docker Compose y Dockerfile **no cambian** en este despliegue: no hace falta `accept-compose`. Detalle y justificación: `PLAN-ACTIVACION-WEBPAY-PRODUCCION.md`.

## 1. Despliegue (con cobros apagados)
```
SHA=<SHA_DE_40_CARACTERES_DEL_INFORME>
sudo bd-run status                      # debe mostrar 530b95c y healthy; anote la versión (es su rollback)
sudo bd-run list-releases
sudo bd-run fetch $SHA
git -C /srv/bydlight-prod/app rev-parse HEAD     # debe imprimir exactamente $SHA
sudo bd-run preflight
sudo bd-run compose-diff                # debe decir que NO hay cambios de Compose; si muestra cambios: DETENERSE
sudo bd-run build $SHA                  # anote el id del trabajo que devuelve
sudo bd-run job-status <ID_DEL_TRABAJO> # repetir hasta que termine OK (el build tarda unos minutos)
sudo bd-run up $SHA
sudo bd-run verify
sudo bd-run status                      # healthy y versión = ${SHA:0:12}
```
Si `preflight` o `compose-diff` rechazan algo, o `build` falla: **no ejecute `up`**; envíe la salida.

## 2. Verificación posterior (producción sigue cerrada)
```
for p in / /contratar /terminos /vista-previa "/api/acceso-piloto?t=x" /api/pagos/retorno/ABCDEFGHJKMN; do
  printf '%-34s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://bydlightsolutions.com$p"; done
curl -s -o /dev/null -w 'POST solicitudes: %{http_code}\n' -X POST -H 'Origin: https://bydlightsolutions.com' -H 'Content-Type: application/json' -d '{}' https://bydlightsolutions.com/api/solicitudes
```
Esperado: `/` 200 · `/contratar` 307 (a `/contacto`) · `/terminos` 404 · `/vista-previa` 404 · `/api/acceso-piloto` 404 · retorno 303 · POST solicitudes **503**. Luego defina las utilidades (una sola vez por sesión) y compruebe la configuración sin ver secretos:
```
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
RUN="sudo bash $HOME/00-admin.sh"   # ver docs/deploy/00-admin.sh: prepara una copia legible de los scripts (el clon es privado de root)
$RUN node /s/payments-config-set.mjs /data/config/payments.json --show
```
Debe decir `enabled: false`, `adminRefunds: false`, `credencialesTransbank: true`, `secretoAdministrativo: true`. **Aquí termina el despliegue.** No siga sin querer hacer la prueba.

## 3. Apagar los cobros en cualquier momento (rige en ≤ 5 s, sin redeploy)
```
$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false
```

## 4. Activar SOLO el modo piloto (únicamente cuando vaya a hacer la compra de $50)
```
$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=pilot
curl -s -o /dev/null -w 'sin enlace /contratar: %{http_code}\n' https://bydlightsolutions.com/contratar     # 307: cerrado para terceros
curl -s -o /dev/null -w 'POST solicitudes sin cookie: %{http_code}\n' -X POST -H 'Origin: https://bydlightsolutions.com' -H 'Content-Type: application/json' -d '{}' https://bydlightsolutions.com/api/solicitudes   # 503
$RUN node /s/admin-remote.mjs pilot-link --config-file /data/config/payments.json --minutes 10 --hours 2
```
El último comando imprime **su enlace de un solo uso** (vale 10 minutos; el secreto se lee del archivo del servidor y nunca se muestra). Ábralo **en su navegador**: aparece `/contratar` con el aviso «Prueba productiva controlada». No comparta el enlace.

## 5. Cotización de $100 con anticipo de $50
1. En el navegador del enlace: elija un plan, complete datos propios, marque la casilla de términos y envíe. Anote el **código de orden** (12 caracteres).
2. En Ubuntu:
```
ID=<CODIGO_DE_ORDEN>
$RUN node /s/admin-remote.mjs approve-test $ID --config-file /data/config/payments.json
```
Debe responder `HTTP 200` con `amount: 100, deposit: 50, balance: 50` (vigencia 1 día, nota «PRUEBA PRODUCTIVA»). Recargue `https://bydlightsolutions.com/orden/$ID`: «Resumen previo al pago», **$50**, logos de Webpay Plus y Transbank.

## 6. La compra real de $50 y su comprobación (la hace usted)
1. En `/orden/<ID>` marque la casilla de términos y pulse **«Pagar anticipo de $50»**. Webpay Plus (alojado por Transbank) abre: pague con su tarjeta real.
2. Al volver debe mostrar **«Pago aprobado»** con comprobante (autorización, últimos 4 dígitos, fecha). Confirme el movimiento en su panel de Transbank y en el estado de cuenta.
3. Trazabilidad (sin tokens ni tarjeta completa):
```
$RUN node /s/admin-remote.mjs show $ID --config-file /data/config/payments.json
```
Debe mostrar etapa `ANTICIPO_PAGADO`, intento `AUTORIZADO` de 50 y los eventos `SOLICITUD_CREADA`, `ACCESO_PILOTO`, `TERMINOS_ACEPTADOS`, `COTIZACION_APROBADA`, `PAGO_INICIADO`, `PAGO_AUTORIZADO`.
4. Opcional, saldo de $50: `$RUN node /s/admin-remote.mjs release-balance $ID --config-file /data/config/payments.json`, recargue la orden y pague el saldo.
5. Si algo queda «en curso» o no vuelve: **no reintente a ciegas**; `$RUN node /s/admin-remote.mjs reconcile --config-file /data/config/payments.json` consulta a Transbank (también ocurre al abrir la orden). Si persiste: Transbank 600 638 6380 · soporteweb@transbank.cl.
6. **Cierre (siempre):** `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false`.
7. Respaldo de la base tras la prueba (contiene datos personales: acceso restringido):
```
$RUN node /w/scripts/orders-admin.mjs backup /data/backups/prueba-$(date +%F).db
```
Las devoluciones siguen apagadas (`adminRefunds:false`); no se activan en este procedimiento.

## 7. Rollback
Si cualquier verificación de las secciones 1–2 falla (o por decisión suya):
```
sudo bd-run rollback          # vuelve a la imagen anterior (530b95c); el volumen y la base NO se tocan
sudo bd-run verify
sudo bd-run status
```
Antes o después, apague cobros con la sección 3. Nunca `down -v` ni borrar el volumen.

## 8. No incluido (decisiones y datos suyos)
Checkout público (requiere textos legales publicados y los dos indicadores de código en `true`), marcas de tarjeta (confirmación del área comercial de Transbank) y datos legales: `LEGAL-DATOS-PENDIENTES.md`, `WEBPAY-LOGOS-FUENTES.md`.
