# Etapa A: traspaso operativo para desplegar en Ubuntu (pagos públicos cerrados)

> **Corrección 2026-11-10 (permisos):** los comandos de este documento que montan `/srv/bydlight-prod/app/scripts` con `docker run -v` NO funcionan: el clon es privado de root y el contenedor corre como uid 1000 (`Cannot find module`). Documento histórico (Etapa A ya ejecutada). Para cualquier comando administrativo use `sudo bash $HOME/00-admin.sh [--tty] node /s/<script>.mjs ...` (`docs/deploy/00-admin.sh`).

Preparado el 2026-11-09. **Nada de esto se ha ejecutado en producción.** Claude no tiene acceso al servidor (Kaspersky bloquea el cliente remoto; no se intentó eludirlo). Lo ejecuta el titular en la sesión SSH del servidor, con `sudo bd-run` como único mecanismo de despliegue.

## 1. Release y resultado en GitHub
| Dato | Valor |
|---|---|
| SHA a desplegar | `13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7` |
| Código del release | `41b4c0bac3237e408cad1e80140b6f4f3b26947a` (el `13aaf17` solo agrega documentación) |
| `main` antes | `5e4599f66e810a2e14dec4a3ce5988e3fdfefb9e` (ancestro del release) |
| `main` ahora | `13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7` |
| Cómo | `git push origin 13aaf17…:refs/heads/main` (fast-forward, sin force, sin commits nuevos); `git ls-remote origin` confirma `refs/heads/main` = SHA autorizado |
| Contenido que pasó a `main` | 6 commits, 70 archivos, sin cambios en `Dockerfile`, `docker-compose.prod.yml`, `package.json`, `package-lock.json`, `next.config.ts`, `.dockerignore` ni `deploy/` → **no hay `accept-compose`** |
| Revisión de secretos | Sin archivos `.env`/claves/bases/`payments.json`/`mail.json`; sin patrones de claves ni tokens en el diff |
| Cambios locales sin commit | `CLAUDE.md`, `tests/hooks.mjs` (solo saltos de línea) y carpetas sin versionar: **no** están en `main` |

Este documento queda en un commit local de solo documentación, **sin push** (el SHA a desplegar no cambia).

## 2. Verificación local (2026-11-09, sobre `13aaf17`)
`npm test` **99/99** · `tsc --noEmit` limpio · `eslint src scripts tests` limpio · `npm run build` correcto · `verify:prod` **36/36** · `verify:pilot` **32/32**. No se ejecutó ninguna transacción real. No existe `docs/despliegue-automatizado.md` en el repositorio; se usó el código del ejecutor (`deploy/executor/bd_ops.py`) como fuente de los comportamientos.

Auditoría del código:
- **Pagos cerrados por código:** `ONLINE_CHECKOUT_UI=false` (`src/lib/plans.ts`) y `LEGAL_PAGES_PUBLISHED=false` (`src/lib/legal.ts`). Aunque `payments.json` dijera `access=public`, `checkoutMode()` degrada a `pilot`. Las páginas legales dan 404 y `/contratar` redirige a `/contacto`.
- **Dinero:** monto = total con IVA; anticipo = `round(total × %)`; Transbank recibe exactamente el anticipo guardado; índice único `attempts_one_authorized` impide doble pago; la lógica de iniciar/confirmar/estados no cambió en este release (pruebas R1–R18, D, S).
- **Correos:** cola `mail_outbox` con `dedupe_key UNIQUE`, reintentos y cuerpo vaciado tras enviar; credenciales solo en `/data/config/mail.json` (0600) o variables. **Implementado y probado con transporte falso; NO configurado en el servidor** (no hay `mail.json`). Con eso ausente, `instrumentation.ts` no hace nada y no abre la base.
- **Configuración persistente:** `payments.json` y `mail.json` viven en el volumen `/data/config`; el despliegue solo reemplaza la imagen (`up -d --no-deps --no-build`), no toca el volumen.
- **Datos corporativos:** consistentes (`src/lib/company.ts`). Lo legal sigue siendo redacción técnica; **no** está aprobado por contador ni abogado (Etapa B).

## 3. Migración 4 y por qué el respaldo va primero
- La migración 4 (`ALTER TABLE orders ADD COLUMN cust_*` con valores por defecto + tabla `mail_outbox`) **solo agrega**. Se aplica sola la **primera vez que algo abre la base con el código nuevo** (`openDb`/`migrate`, o `orders-admin.mjs`). El arranque del contenedor, por sí solo, no abre la base.
- **Trampa:** `orders-admin.mjs backup` abre la base con `migrate()` antes de copiar. Con los scripts nuevos migraría antes de respaldar. Por eso el respaldo de abajo usa un `node:sqlite` mínimo (**sin migraciones**): `VACUUM INTO` (copia consistente en WAL) + `PRAGMA integrity_check`. Se probó localmente contra una base en versión 3 (resultado `integrity_check=ok schema_v=3`).
- **Rollback de código y migración:** el código anterior solo recorre sus migraciones 1–3 (checksums sin cambios) e ignora la versión 4; las columnas nuevas tienen `DEFAULT`, así que sus `INSERT` siguen funcionando. **Volver a la imagen anterior es seguro con la base ya migrada** y no requiere restaurar datos.
- **Restaurar el respaldo** solo se justifica ante corrupción comprobada. Restaurar una copia antigua descarta las transacciones posteriores: si ya hubo órdenes o pagos nuevos, **no restaurar sin decisión explícita** y sin exportar antes lo nuevo.

## 4. Estado conocido de producción
Última comprobación directa (sesión anterior): desplegado `5e4599f66e810a2e14dec4a3ce5988e3fdfefb9e`, contenedor `bydlight-prod-web-1` sano, preflight aprobado, política CUMPLE, línea base de Compose aceptada, 18 contenedores ajenos registrados, pagos públicos cerrados. El informe que menciona `530b95c` es anterior. **Respaldos ya existentes (6 nov, no sustituyen al nuevo):** `/srv/bydlight-prod/backups/pre-etapa-a-20261106-153510.tar.gz` y `/srv/bydlight-prod/backups/bydlight-pre-etapa-a-20261106.db` (integridad ok). El Paso 0 comprueba que nada cambió.

## 5. Procedimiento (copiar y pegar; un bloque a la vez)
Cada bloque corre en un subshell `( set -euo pipefail … )`: si falla, **se detiene sin cerrar su sesión SSH** y el mensaje final «BLOQUE X OK» no aparece. Si no ve ese mensaje: **deténgase** y envíeme la salida.

### Paso 0: variables y preflight mínimo (no cambia nada)
```
export SHA=13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7
export PREV=5e4599f66e810a2e14dec4a3ce5988e3fdfefb9e
export VOL=bydlight-prod_bydlight_data
export B=/srv/bydlight-prod/backups
(
set -euo pipefail
T=$(mktemp)
sudo bd-run status | tee "$T"
grep -q "desplegado: $PREV" "$T"
grep -q "salud: OK" "$T"
grep -q "linea base de compose: aceptada" "$T"
sudo bd-run preflight
sudo bd-run compose-diff | tee "$T"
grep -q "politica: CUMPLE" "$T"
grep -q "linea base: igual" "$T"
rm -f "$T"
echo "BLOQUE 0 OK"
)
```
**Éxito:** `desplegado: 5e4599f66e81…`, `salud: OK`, `preflight OK`, `politica: CUMPLE`, `linea base: igual`, y «BLOQUE 0 OK». **Detenerse** si el desplegado es otro, la salud no es OK o Compose difiere (no ejecute `accept-compose`).

Si abre una sesión nueva más adelante, vuelva a pegar solo las cuatro líneas `export`.

### Paso 1: respaldo nuevo (consistente, fuera del volumen, sin migrar)
```
(
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
IMG=bydlight-web:$TAG
MP=$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")
sudo test -d "$B"
docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -v "$VOL":/data -e DB=/data/bydlight.db -e OUT=/data/.bk-$TS.db "$IMG" node -e '
const {DatabaseSync}=require("node:sqlite");
const db=new DatabaseSync(process.env.DB);
db.exec("PRAGMA busy_timeout=5000");
db.prepare("VACUUM INTO ?").run(process.env.OUT);
db.close();
const t=new DatabaseSync(process.env.OUT,{readOnly:true});
const ic=t.prepare("PRAGMA integrity_check").get().integrity_check;
const v=t.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v;
const o=t.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
const a=t.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS s FROM attempts WHERE status = ?").get("AUTORIZADO");
console.log("integrity_check="+ic+" schema_v="+v+" ordenes="+o+" pagos_autorizados="+a.n+" monto_autorizado="+a.s);
if(ic!=="ok")process.exit(2)' | tee /tmp/etapa-a-snap-pre.txt
sudo test ! -e "$B/bydlight-pre-etapa-a-$TS.db"
sudo install -m 600 -o root -g root "$MP/.bk-$TS.db" "$B/bydlight-pre-etapa-a-$TS.db"
[ "$(sudo sha256sum "$MP/.bk-$TS.db" | cut -d' ' -f1)" = "$(sudo sha256sum "$B/bydlight-pre-etapa-a-$TS.db" | cut -d' ' -f1)" ]
sudo rm -f "$MP/.bk-$TS.db"
for f in payments.json mail.json; do
  if sudo test -f "$MP/config/$f"; then sudo install -m 600 -o root -g root "$MP/config/$f" "$B/$f.pre-etapa-a-$TS"; echo "config respaldada: $f"; fi
done
PH=$(sudo sha256sum "$MP/config/payments.json" | cut -c1-16)
{ echo "ts=$TS"; echo "prev_sha=$PREV"; echo "payments_json_sha16=$PH"; cat /tmp/etapa-a-snap-pre.txt; } | sudo tee "$B/etapa-a-$TS.ref" >/dev/null
sudo bash "$HOME/00-admin.sh" node /s/payments-config-set.mjs /data/config/payments.json --show
echo "BLOQUE 1 OK (respaldo: $B/bydlight-pre-etapa-a-$TS.db)"
)
```
**Éxito:** `integrity_check=ok schema_v=3 ordenes=… pagos_autorizados=… monto_autorizado=…` (anote esa línea), «config respaldada: payments.json», el resumen de configuración **sin secretos** y «BLOQUE 1 OK». Los respaldos nuevos no sobrescriben los del 6 de nov. **Detenerse** si `integrity_check` no es `ok` o falla cualquier comando. No lo repita en bucle: envíeme la salida. Anote también `enabled`/`access` que muestra `--show` (debe seguir igual al final).

Nota: el respaldo contiene datos personales; queda en modo 600 de root. No lo copie a otro lugar sin necesidad. Si el `schema_v` ya fuera 4, algo abrió la base con el código nuevo: avíseme antes de seguir.

### Paso 2: fetch (primera vez que el SHA es visible, ahora pertenece a `main`)
```
(
set -euo pipefail
T=$(mktemp)
sudo bd-run fetch "$SHA" | tee "$T"
! grep -q "ATENCION" "$T"
sudo bd-run status | tee "$T"
grep -q "clon en: $SHA" "$T"
rm -f "$T"
echo "BLOQUE 2 OK"
)
```
**Éxito:** `clon actualizado 5e4599f66e81 -> 13aaf1750… (70 archivos…)`, sin la palabra `ATENCION` (que avisaría de cambios en Dockerfile/Compose/lockfile/next.config; no los hay) y `clon en: 13aaf175…`. **Detenerse** ante «el commit no pertenece a origin/main», «cambios locales» o cualquier ATENCION.

### Paso 3: preflight, Compose y build
```
(
set -euo pipefail
sudo bd-run preflight
T=$(mktemp)
sudo bd-run compose-diff | tee "$T"
grep -q "politica: CUMPLE" "$T"
grep -q "linea base: igual" "$T"
sudo bd-run build "$SHA" | tee "$T"
JOB=$(sed -n 's/.*job-status //p' "$T")
[ -n "$JOB" ]
echo "trabajo: $JOB"
for i in $(seq 1 90); do
  O=$(sudo bd-run job-status "$JOB" || true)
  echo "$(date +%T) $(echo "$O" | head -1)"
  case "$O" in
    *"estado: done"*) rm -f "$T"; echo "BLOQUE 3 OK"; exit 0 ;;
    *"estado: failed"*) echo "$O"; exit 1 ;;
  esac
  sleep 20
done
echo "build sin terminar tras 30 min: revise con sudo bd-run job-status $JOB"; exit 1
)
```
**Éxito:** `preflight OK`, `politica: CUMPLE`, `linea base: igual`, líneas `estado: running` que pasan a `estado: done` (el build tarda unos minutos) y «BLOQUE 3 OK». Mientras corre, el sitio actual sigue en línea. **Detenerse** si aparece `failed` (se imprime el final del log; envíemelo), o `VIOLA`/`DIFIERE` en Compose. No ejecute `up`.

### Paso 4: publicar (`up`)
```
(
set -euo pipefail
T=$(mktemp)
sudo bd-run up "$SHA" | tee "$T"
grep -q "desplegado" "$T"
sudo bd-run verify | tee "$T"
! grep -q "AVISO" "$T"
sudo bd-run status
rm -f "$T"
echo "BLOQUE 4 OK"
)
```
**Éxito:** `desplegado <tag>; salud y HTTP OK`, `verify OK (salud y HTTP)` **sin líneas AVISO** (un AVISO significaría que un contenedor ajeno cambió o desapareció) y en `status`: `desplegado: 13aaf17507d5…`, `anterior: 5e4599f66e81…`, `salud: OK`. Hay un corte breve (solo el servicio web de Bydlight, `up -d --no-deps`). **Detenerse** si `up` dice «no sano»: el ejecutor ya intenta volver solo a la versión anterior («REVERTIDO al release anterior»); no repita `up`, envíeme la salida y vaya al Paso 7 si el sitio no responde.

### Paso 5: verificación pública y de datos
```
(
set -u
f=0
chk(){ l=$1; e=$2; shift 2; g=$(curl -s -o /dev/null -w '%{http_code}' "$@"); if echo "$g" | grep -Eq "^($e)$"; then s=OK; else s=FALLA; f=1; fi; printf '%-30s esperado %-8s obtuvo %s  %s\n' "$l" "$e" "$g" "$s"; }
U=https://bydlightsolutions.com
chk "/" 200 "$U/"
chk "/contratar (cerrado)" "30[1278]" "$U/contratar"
chk "/terminos (oculto)" 404 "$U/terminos"
chk "/privacidad (oculto)" 404 "$U/privacidad"
chk "/orden/XXXXXXXXXXXX" 404 "$U/orden/ABCDEFGHJKMN"
chk "/vista-previa (oculto)" 404 "$U/vista-previa"
chk "retorno Webpay inerte" "30[1238]" "$U/api/pagos/retorno/ABCDEFGHJKMN"
chk "POST solicitudes cerrado" 503 -X POST -H "Origin: $U" -H 'Content-Type: application/json' -d '{}' "$U/api/solicitudes"
[ $f = 0 ] && echo "BLOQUE 5a OK" || echo "BLOQUE 5a: HAY FALLAS"
)
```
**Éxito:** todas las líneas `OK` y «BLOQUE 5a OK». **Detenerse** ante cualquier `FALLA`, especialmente si `/terminos`, `/orden/…` o `/contratar` quedaran abiertos (pagos públicos visibles): cierre con la sección 6 y avíseme. (Esto es una verificación pública de solo lectura; el `POST` es con cuerpo vacío y no crea nada.)

Ahora la base y la configuración. Este paso **aplica la migración 4 de forma controlada** (ya hay respaldo):
```
(
set -euo pipefail
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
IMG=bydlight-web:$TAG
echo "imagen en ejecución: $IMG"
sudo bash "$HOME/00-admin.sh" node /w/scripts/orders-admin.mjs check
sudo bash "$HOME/00-admin.sh" node /s/payments-config-set.mjs /data/config/payments.json --show
MP=$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")
REF=$(sudo sh -c "ls -t $B/etapa-a-*.ref | head -1")
echo "antes:   $(sudo grep payments_json_sha16 "$REF")"
echo "después: payments_json_sha16=$(sudo sha256sum "$MP/config/payments.json" | cut -c1-16)"
sudo grep -E 'integrity_check' "$REF"
echo "BLOQUE 5b: compare a mano las dos líneas payments_json_sha16 y los enteros de la última línea"
)
```
**Éxito:** `orders-admin check` dice `integridad: ok | claves foraneas: ok | migracion: v4`; `--show` muestra `enabled`/`access`/`adminRefunds` **iguales a los de antes** (por defecto `enabled: false`, `adminRefunds: false`), `credencialesTransbank: true`, `secretoAdministrativo: true`; la huella `payments_json_sha16` es **idéntica** antes y después (el despliegue no tocó la configuración). **Detenerse** si la huella cambió, `adminRefunds` no es `false`, o `check` no dice `v4`/`ok`.

Los contenedores ajenos ya los vigiló `verify` en el Paso 4 (sin AVISO). No hace falta revisar usuarios, claves ni permisos.

### Paso 6: resultado esperado de la Etapa A
`desplegado` = `13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7`, `anterior` = `5e4599f66e81…`, sitio público sin pagos ni legales visibles, base en v4 con los datos intactos, correo **sin configurar** y `adminRefunds=false`. **Aquí termina la Etapa A.** No active `enabled=true` ni ninguna prueba de compra (eso es Etapa B o la prueba piloto de `DESPLIEGUE-WEBPAY-UBUNTU.md` §4–6, que requiere su decisión aparte).

### Paso 7: rollback (solo si algo falla; la decisión es suya)
```
sudo bd-run rollback
sudo bd-run verify
sudo bd-run status
```
Vuelve a la imagen anterior (`5e4599f66e81…`, la que figura como `anterior`). **No toca el volumen ni la base.** Éxito: `rollback a <tag> OK`, `verify OK` y `desplegado: 5e4599f66e81…`.
- **Un rollback de código basta** en cualquier falla de la aplicación, aunque la migración 4 ya esté aplicada (ver §3: el código anterior la ignora). Es el caso normal.
- **Se necesitaría recuperar datos** solo si la base está corrupta (`integrity_check` distinto de `ok`) o una migración fallara a medias. En ese caso **no** restaure por su cuenta: envíeme la salida; hay que detener el servicio web, decidir si existen transacciones posteriores al respaldo y conservarlas antes de restaurar. El procedimiento `orders-admin.mjs restore … --yes` **reemplaza** la base y descarta lo posterior: es destructivo y no se automatiza aquí.
- Sin redeploy, para cortar cobros en cualquier momento: `payments-config-set.mjs /data/config/payments.json enabled=false` (`DESPLIEGUE-WEBPAY-UBUNTU.md` §3).

## 6. Si algo sale mal: qué devolverme
La salida completa del bloque que falló (sin editarla; no contiene secretos), más `sudo bd-run status`. Si falló el build: `sudo bd-run job-status <ID>`. Si falló `up`: además `sudo bd-run logs 80`. No pegue contenido de `payments.json`, de `mail.json` ni de la base.

## 7. Condiciones de detención (resumen)
`desplegado` distinto de `5e4599f`; salud ≠ OK; Compose ≠ «CUMPLE/igual» (nunca `accept-compose`); `integrity_check` ≠ `ok`; `schema_v` ya en 4 antes del respaldo; `fetch` con ATENCION o error; build `failed`; `verify` con AVISO; cualquier ruta de pago/legal abierta al público; huella de `payments.json` distinta. Prohibido: `docker system prune`, `down -v`, borrar volúmenes, tocar otros contenedores/proxy/Cloudflare/DNS, reiniciar Docker o el servidor.

## 8. Riesgos conocidos
1. **Respaldo en caliente:** `VACUUM INTO` es consistente en WAL, pero una orden creada entre el respaldo y el `up` no estará en la copia (con pagos cerrados, el riesgo es mínimo).
2. **Migración 4 con datos reales:** solo prueba con bases de test (R8 y una base v3 local); por eso el respaldo previo y `check` posterior son obligatorios.
3. **Corte breve** del servicio web durante `up`.
4. **Ruta del volumen:** los pasos 1 y 5b usan `docker volume inspect` + `sudo`; si `$B` o el `Mountpoint` no existen, el bloque falla cerrado (no cambia nada).
5. **Advertencia de tracing de Turbopack en el build** (modo standalone incluye `demos/`): no afecta el funcionamiento; no se comprobó si preexistía.
6. **Correo y EmailJS no verificados en producción.**
7. El script de respaldo se probó en Windows/Node 24 y el servidor usa Node 22.23.4 (`node:sqlite`, `readOnly` disponible desde 22.12).

## 9. Pendientes exclusivos de la Etapa B (no autorizados)
Respuesta del contador/SII (modelo de emisión, voucher como boleta, factura a empresas, anticipo); aprobación de cláusulas, retracto y matriz de conservación (idealmente con abogado); configurar y probar el correo (`mail.json`, OAuth Gmail, `mail-test`); confirmar el destinatario de EmailJS; verificar el boletín 18.623-07 (Ley 21.719, vigente el 01-12-2026 salvo postergación); definir anticipo por defecto y vigencia; programar `monitor`; cambiar `LEGAL_PAGES_PUBLISHED`/`ONLINE_CHECKOUT_UI`, `TERMS_VERSION` definitiva y `access=public`, con sus pruebas y un nuevo despliegue; compra mínima con aprobación y vigilancia 48 h. Marcas de tarjeta habilitadas: confirmación comercial de Transbank.
