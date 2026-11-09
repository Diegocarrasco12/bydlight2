#!/usr/bin/env bash
# Bydlight2 - Etapa B - APLICA las migraciones 4 y 5 a la base real, de forma explicita y controlada.
#
# Ejecutar en el servidor Ubuntu como root, DESPUES de `bd-run up <SHA>` (Etapa B ya desplegada y sana) y ANTES de instalar la clave de
# Brevo y de cualquier prueba de pagos:
#   sudo bash 07-aplicar-migraciones.sh <SHA_40_HEX_DE_LA_ETAPA_B>
#
# Por que existe: las migraciones se aplican la PRIMERA VEZ que algo abre la base con el codigo que las contiene, no al arrancar el
# contenedor. Con los pagos y el correo apagados nadie la abre, asi que sin este paso la base seguiria en v3 y el momento de la migracion
# seria impredecible (la primera peticion que abra la base). Aqui ocurre en un momento conocido, con respaldo y ensayo previos.
#
# Exige (si falta algo, NO migra):
#   - la Etapa B desplegada y sana (imagen y bd-run status con el SHA objetivo);
#   - el respaldo previo (etapa-b-*.ref) con esquema v3 o v4 y su archivo verificado por SHA-256;
#   - el marcador del ensayo OK de 06-ensayo-migracion.sh para ESE respaldo y ESE SHA;
#   - que el checkout publico siga cerrado (access != public) y las devoluciones apagadas.
# Hace: `orders-admin.mjs check` con la imagen nueva (aplica las migraciones pendientes, cada una en su transaccion, y comprueba
#   integrity_check y foreign_key_check). NO crea ordenes, no cambia la configuracion, no toca otros contenedores.
# Si algo falla, no restaure la base a ciegas: el codigo anterior ignora las migraciones 4 y 5, de modo que `bd-run rollback` basta.
# Imprime "MIGRACIONES APLICADAS OK" solo si todo paso.

set -euo pipefail
umask 077
export LC_ALL=C

readonly PROJECT="bydlight-prod"
readonly CONTAINER="bydlight-prod-web-1"
readonly VOL="bydlight-prod_bydlight_data"
readonly BACKUP_DIR="/srv/bydlight-prod/backups"
readonly APP_DIR="/srv/bydlight-prod/app"
TARGET_SHA="${1:-}"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "ERROR: indique el SHA de 40 caracteres: sudo bash $0 <SHA>" >&2; exit 1; }
readonly TARGET_SHA
readonly TARGET12="${TARGET_SHA:0:12}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
say() { printf '%s\n' "$*"; }
trap 'rc=$?; [ "$rc" = 0 ] || printf "\nLA APLICACION DE MIGRACIONES FALLO (codigo %s). No restaure la base a ciegas: envie esta salida.\n" "$rc" >&2' EXIT

[ "$(id -u)" = "0" ] || die "ejecute como root: sudo bash $0 <SHA>"
for c in docker bd-run sha256sum grep sed ls head; do command -v "$c" >/dev/null 2>&1 || die "falta el comando: $c"; done

# ---------------------------------------------------------------------------------------------- 1. Etapa B desplegada y sana
ST="$(bd-run status)"
printf '%s\n' "$ST" | grep -Fxq "desplegado: ${TARGET_SHA}" || die "no esta desplegado ${TARGET12}: ejecute antes 'bd-run up ${TARGET_SHA}'"
printf '%s\n' "$ST" | grep -Fxq "salud: OK"                 || die "la salud del proyecto no es OK"
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER")" = "$PROJECT" ] || die "el contenedor no pertenece al proyecto $PROJECT"
IMG="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
[ "$IMG" = "bydlight-web:${TARGET12}" ] || die "la imagen en ejecucion es $IMG (se esperaba bydlight-web:${TARGET12})"
docker inspect -f '{{range .Mounts}}{{.Name}}|{{.Destination}}|{{.RW}}{{"\n"}}{{end}}' "$CONTAINER" | grep -Fxq "${VOL}|/data|true" || die "el volumen $VOL no esta montado en /data"
say "== 1. Etapa B desplegada y sana (${IMG})"

# ---------------------------------------------------------------------------------------------- 2. respaldo y ensayo previos
REF="$(ls -t "$BACKUP_DIR"/etapa-b-*.ref 2>/dev/null | head -1 || true)"
[ -n "$REF" ] && [ -f "$REF" ] || die "no hay respaldo previo (etapa-b-*.ref): no se migra sin respaldo"
grep -Fxq "target_sha=${TARGET_SHA}" "$REF" || die "el respaldo mas reciente no corresponde al SHA ${TARGET12}"
BK_DB="$(sed -n 's/^db_backup=//p' "$REF" | head -1)"
BK_SHA="$(sed -n 's/^db_backup_sha256=//p' "$REF" | head -1)"
BK_SCHEMA="$(sed -n 's/^integrity_check=ok schema_v=\([0-9]*\) .*/\1/p' "$REF" | head -1)"
[[ "$BK_DB" == "$BACKUP_DIR"/bydlight-pre-etapa-b-*.db ]] && [ -f "$BK_DB" ] && [ ! -L "$BK_DB" ] || die "el archivo del respaldo previo no existe"
[ "$(sha256sum "$BK_DB" | cut -d' ' -f1)" = "$BK_SHA" ] || die "el SHA-256 del respaldo no coincide: no se migra"
case "$BK_SCHEMA" in 3|4) ;; *) die "el respaldo tiene esquema v${BK_SCHEMA:-?} (se aceptan v3 y v4)";; esac
MARK="${BACKUP_DIR}/ensayo-ok-${TARGET12}-${BK_SHA:0:12}.txt"
[ -f "$MARK" ] || die "falta el marcador del ensayo (${MARK##*/}): ejecute 06-ensayo-migracion.sh ANTES de 'up'"
grep -Fxq "target_sha=${TARGET_SHA}" "$MARK" && grep -Fxq "db_backup_sha256=${BK_SHA}" "$MARK" || die "el marcador del ensayo no corresponde a este SHA y respaldo"
say "== 2. Respaldo verificado (v${BK_SCHEMA}) y ensayo previo OK"

# ---------------------------------------------------------------------------------------------- 3. el checkout publico sigue cerrado
DR=(docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 64 --memory 256m)
JS_CFG=""
read -r -d '' JS_CFG <<'EOF' || true
const fs = require("fs")
let c
try { c = JSON.parse(fs.readFileSync("/data/config/payments.json", "utf8")) } catch { console.error("no se pudo leer payments.json"); process.exit(3) }
const s = (v) => (typeof v === "boolean" || /^[a-z]{1,12}$/.test(String(v)) ? String(v) : "?")
console.log("enabled=" + s(c.enabled) + " access=" + s(c.access) + " adminRefunds=" + s(c.adminRefunds))
EOF
CFG="$("${DR[@]}" --network none -v "$VOL":/data:ro "$IMG" node -e "$JS_CFG")"
[[ "$CFG" =~ ^enabled=([a-z?]+)\ access=([a-z?]+)\ adminRefunds=([a-z?]+)$ ]] || die "salida inesperada de la configuracion de pagos"
[ "${BASH_REMATCH[3]}" != "true" ] || die "adminRefunds esta activado"
if [ "${BASH_REMATCH[1]}" = "true" ] && [ "${BASH_REMATCH[2]}" = "public" ]; then die "los pagos estan abiertos al publico (access=public)"; fi
say "== 3. Pagos no publicos: ${CFG}"

# ---------------------------------------------------------------------------------------------- 4. aplicar (orders-admin check con la imagen nueva)
# La imagen standalone NO incluye scripts/ (.dockerignore lo excluye), asi que se montan desde el clon del servidor. El contenedor corre como
# 1000:1000 (duenio de la base en /data) y SIN capacidades, y el clon del servidor es privado de root (umask 077): montarlo directamente
# deja a node sin permiso de lectura y falla con "Cannot find module '/w/scripts/orders-admin.mjs'" (EACCES se informa como modulo no
# encontrado). Por eso se copian SOLO los dos archivos necesarios a un directorio temporal legible (755/644), de solo lectura dentro del
# contenedor, y se deja constancia de su SHA-256. No se relajan los permisos del clon ni se ejecuta el contenedor como root.
[ -f "$APP_DIR/scripts/orders-admin.mjs" ] && [ -f "$APP_DIR/src/lib/payments/migrations.mjs" ] || die "faltan scripts/orders-admin.mjs o migrations.mjs en el clon del servidor"
[ ! -L "$APP_DIR/scripts/orders-admin.mjs" ] && [ ! -L "$APP_DIR/src/lib/payments/migrations.mjs" ] || die "los archivos del clon no pueden ser enlaces simbolicos"
STAGE="$(mktemp -d /tmp/bd-migrar-XXXXXX)"
cleanup() { if [ -n "${STAGE:-}" ] && [ -d "$STAGE" ]; then rm -rf -- "$STAGE"; fi; return 0; }
trap 'rc=$?; cleanup; [ "$rc" = 0 ] || printf "\nLA APLICACION DE MIGRACIONES FALLO (codigo %s). No restaure la base a ciegas: envie esta salida.\n" "$rc" >&2' EXIT
mkdir -p "$STAGE/scripts" "$STAGE/src/lib/payments"
install -m 0644 "$APP_DIR/scripts/orders-admin.mjs" "$STAGE/scripts/orders-admin.mjs"
install -m 0644 "$APP_DIR/src/lib/payments/migrations.mjs" "$STAGE/src/lib/payments/migrations.mjs"
chmod 0755 "$STAGE" "$STAGE/scripts" "$STAGE/src" "$STAGE/src/lib" "$STAGE/src/lib/payments"
for f in scripts/orders-admin.mjs src/lib/payments/migrations.mjs; do
  [ "$(sha256sum "$APP_DIR/$f" | cut -d' ' -f1)" = "$(sha256sum "$STAGE/$f" | cut -d' ' -f1)" ] || die "la copia de $f no coincide con el clon"
  say "   $f sha256=$(sha256sum "$STAGE/$f" | cut -c1-16)"
done
OUT="$("${DR[@]}" --network none -v "$VOL":/data -v "$STAGE":/w:ro \
  -e PAYMENTS_DB=/data/bydlight.db "$IMG" node /w/scripts/orders-admin.mjs check)" \
  || { printf '%s\n' "${OUT:-}"; die "orders-admin check fallo (ver arriba)"; }
printf '%s\n' "$OUT"
LATEST="$(printf '%s\n' "$OUT" | sed -n 's/.*migracion: v\([0-9]*\).*/\1/p' | head -1)"
printf '%s\n' "$OUT" | grep -Fq "integridad: ok | claves foraneas: ok" || die "orders-admin check no informa integridad ok"
[ "$LATEST" = "5" ] || die "la migracion final es v${LATEST:-?} (se esperaba v5)"
cleanup
trap - EXIT
say ""
say "MIGRACIONES APLICADAS OK (esquema v5). Siguiente: 04-verificar-migracion-5.sh"
