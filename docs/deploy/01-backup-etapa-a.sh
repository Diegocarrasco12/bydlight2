#!/usr/bin/env bash
# Bydlight2 - Etapa A - Paso 1: respaldo previo (base SQLite consistente + configuracion persistente).
#
# Ejecutar en el servidor Ubuntu como root:   sudo bash 01-backup-etapa-a.sh
#
# Que hace (todo de solo lectura sobre produccion, salvo crear archivos NUEVOS en el directorio de respaldos):
#   - confirma proyecto, contenedor, volumen, imagen y SHA desplegado esperados;
#   - autoprueba node:sqlite en la imagen real (con un archivo temporal en tmpfs, sin tocar el volumen);
#   - copia la base con VACUUM INTO desde una conexion de SOLO LECTURA (consistente aunque la app escriba en modo WAL);
#   - ejecuta PRAGMA integrity_check sobre la copia y lee la version del esquema (debe seguir en 3);
#   - guarda la copia FUERA del volumen Docker, con modo 600 y dueno root, sin sobrescribir nada;
#   - respalda payments.json (y mail.json si existe) sin imprimir su contenido;
#   - comprueba que el checkout publico siga cerrado.
# Que NO hace: migraciones, orders-admin.mjs, payments-config-set.mjs, fetch, build, up, cambios en otros contenedores,
#   borrado de respaldos anteriores, escritura en el volumen (salvo un archivo temporal que borra al terminar).
# Imprime "RESPALDO ETAPA A OK" solo si TODAS las comprobaciones terminaron bien.

set -euo pipefail
umask 077
export LC_ALL=C

# ----------------------------------------------------------------------------------------------- constantes
readonly PROJECT="bydlight-prod"
readonly CONTAINER="bydlight-prod-web-1"
readonly VOL="bydlight-prod_bydlight_data"
readonly BACKUP_DIR="/srv/bydlight-prod/backups"
readonly PREV_SHA="5e4599f66e810a2e14dec4a3ce5988e3fdfefb9e"     # version que debe estar desplegada ahora
readonly TARGET_SHA="13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7"   # release de la Etapa A (solo se registra)
readonly EXPECTED_SCHEMA=3                                         # el esquema actual; la migracion 4 aun NO debe existir
readonly PUBLIC_URL="https://bydlightsolutions.com"

TS="$(date +%Y%m%d-%H%M%S)-$$"                                     # fecha y hora, mas el PID: unico por ejecucion
readonly TS
readonly DB_TMP_NAME=".bk-${TS}.db"
readonly DEST_DB="${BACKUP_DIR}/bydlight-pre-etapa-a-${TS}.db"
readonly DEST_REF="${BACKUP_DIR}/etapa-a-${TS}.ref"

# Archivos temporales creados POR ESTA EJECUCION (unicos que el script puede borrar si algo falla).
CLEAN_FILES=()
SUCCESS=0

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cleanup() {
  local rc=$?
  if [ "$SUCCESS" != 1 ]; then
    local f
    for f in "${CLEAN_FILES[@]:-}"; do
      [ -n "$f" ] && rm -f -- "$f" 2>/dev/null || true
    done
    printf '\nRESPALDO ETAPA A FALLO (codigo %s). No se borro ningun respaldo anterior ni se modifico produccion.\n' "$rc" >&2
  fi
}
trap cleanup EXIT

# ----------------------------------------------------------------------------------------------- 0. requisitos
[ "$(id -u)" = "0" ] || die "ejecute como root: sudo bash $0"
for c in docker bd-run curl sha256sum install mktemp df stat mv date grep sed cut; do
  command -v "$c" >/dev/null 2>&1 || die "falta el comando: $c"
done
[ -d "$BACKUP_DIR" ] || die "no existe el directorio de respaldos: $BACKUP_DIR"
[ -w "$BACKUP_DIR" ] || die "el directorio de respaldos no es escribible: $BACKUP_DIR"
say "== 0. Requisitos OK (fecha/hora de esta ejecucion: $TS)"

# ----------------------------------------------------------------------------------------------- 1. SHA desplegado
ST="$(bd-run status)"
printf '%s\n' "$ST" | grep -Fxq "desplegado: ${PREV_SHA}" || die "el SHA desplegado no es ${PREV_SHA}; no se continua"
printf '%s\n' "$ST" | grep -Fxq "clon en: ${PREV_SHA}"    || die "el clon del servidor no esta en ${PREV_SHA} (ya se hizo fetch?); este paso va ANTES del fetch"
printf '%s\n' "$ST" | grep -Fxq "salud: OK"                || die "la salud del proyecto no es OK"
say "== 1. Desplegado y clon = ${PREV_SHA:0:12}, salud OK"

# ----------------------------------------------------------------------------------------------- 2. proyecto, contenedor, volumen
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER")" = "$PROJECT" ] \
  || die "el contenedor $CONTAINER no pertenece al proyecto $PROJECT"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" = "true" ]     || die "el contenedor no esta en ejecucion"
[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" = "healthy" ] || die "el contenedor no esta healthy"
IMG="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
[[ "$IMG" =~ ^bydlight-web:[0-9a-f]{12}$ ]] || die "imagen inesperada: $IMG"
[ "${IMG#bydlight-web:}" = "${PREV_SHA:0:12}" ] || die "la imagen en ejecucion ($IMG) no corresponde a ${PREV_SHA:0:12}"
docker inspect -f '{{range .Mounts}}{{.Name}}|{{.Destination}}|{{.RW}}{{"\n"}}{{end}}' "$CONTAINER" \
  | grep -Fxq "${VOL}|/data|true" || die "el contenedor no monta el volumen $VOL en /data"
MP="$(docker volume inspect -f '{{.Mountpoint}}' "$VOL")"
[ -n "$MP" ] && [ -d "$MP" ] || die "no se pudo resolver el punto de montaje del volumen $VOL"
[ -s "$MP/bydlight.db" ]               || die "no existe $MP/bydlight.db (o esta vacia): no hay nada que respaldar"
[ -f "$MP/config/payments.json" ]      || die "no existe config/payments.json en el volumen"
# Variables de entorno que podrian abrir los pagos: solo se muestran estas dos, nunca el resto del entorno.
ENVP="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" | grep -E '^(PAYMENTS_ENABLED|PAYMENTS_ACCESS)=' || true)"
if printf '%s\n' "$ENVP" | grep -Fxq 'PAYMENTS_ACCESS=public'; then
  die "el contenedor define PAYMENTS_ACCESS=public: el checkout publico podria estar abierto"
fi
say "== 2. Proyecto/contenedor/volumen/imagen correctos (imagen $IMG, volumen $VOL -> /data)"

# Espacio libre en el destino: 3 veces el tamano de la base (+WAL) mas 64 MB.
DBBYTES=$(( $(stat -c %s "$MP/bydlight.db") + $( [ -f "$MP/bydlight.db-wal" ] && stat -c %s "$MP/bydlight.db-wal" || echo 0 ) ))
NEEDKB=$(( DBBYTES * 3 / 1024 + 65536 ))
FREEKB="$(df -Pk "$BACKUP_DIR" | awk 'NR==2{print $4}')"
[ "$FREEKB" -ge "$NEEDKB" ] || die "espacio insuficiente en $BACKUP_DIR (libre ${FREEKB} KB, requerido ${NEEDKB} KB)"
FREEVKB="$(df -Pk "$MP" | awk 'NR==2{print $4}')"
[ "$FREEVKB" -ge "$NEEDKB" ] || die "espacio insuficiente en el volumen para el archivo temporal (libre ${FREEVKB} KB)"

# Argumentos comunes de los contenedores efimeros (sin red, sin capacidades, sistema de archivos de solo lectura).
DR=(docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true
    --network none --pids-limit 64 --memory 256m --tmpfs /tmp:rw,size=16m,mode=1777)

# ----------------------------------------------------------------------------------------------- 3. autoprueba de node:sqlite
JS_SELFTEST=""
read -r -d '' JS_SELFTEST <<'EOF' || true
const { DatabaseSync } = require("node:sqlite")
const dir = process.env.ST_DIR
const src = dir + "/selftest.db"
const out = dir + "/selftest-copy.db"
const w = new DatabaseSync(src)
w.exec("PRAGMA journal_mode = WAL")
w.exec("CREATE TABLE t (a INTEGER)")
w.exec("INSERT INTO t VALUES (1), (2)")
const r = new DatabaseSync(src, { readOnly: true })
r.exec("VACUUM INTO '" + out + "'")
r.close()
w.close()
const c = new DatabaseSync(out, { readOnly: true })
const ic = c.prepare("PRAGMA integrity_check").get().integrity_check
const n = c.prepare("SELECT COUNT(*) AS n FROM t").get().n
c.close()
console.log("autoprueba node=" + process.versions.node + " sqlite=" + process.versions.sqlite + " integrity_check=" + ic + " filas=" + n)
if (ic !== "ok" || n !== 2) process.exit(2)
EOF
ST_OUT="$("${DR[@]}" -e ST_DIR=/tmp "$IMG" node -e "$JS_SELFTEST")"
printf '%s\n' "$ST_OUT"
printf '%s\n' "$ST_OUT" | grep -Eq '^autoprueba node=22\.[0-9.]+ sqlite=[0-9.]+ integrity_check=ok filas=2$' \
  || die "la autoprueba de node:sqlite fallo en la imagen $IMG"
say "== 3. Autoprueba de node:sqlite (VACUUM INTO + integrity_check) OK en la imagen real"

# ----------------------------------------------------------------------------------------------- 4. copia consistente
JS_SNAP=""
read -r -d '' JS_SNAP <<'EOF' || true
const fs = require("fs")
const { DatabaseSync } = require("node:sqlite")
const src = process.env.DB
const out = process.env.OUT
if (!fs.existsSync(src)) { console.error("la base no existe"); process.exit(3) }
if (fs.existsSync(out)) { console.error("el archivo temporal ya existe"); process.exit(4) }
// Apertura de SOLO LECTURA: no escribe en la base, no migra, no cambia journal_mode. VACUUM INTO produce una copia consistente.
const db = new DatabaseSync(src, { readOnly: true })
db.exec("PRAGMA busy_timeout = 5000")
db.exec("VACUUM INTO '" + out + "'")
db.close()
const t = new DatabaseSync(out, { readOnly: true })
const ic = t.prepare("PRAGMA integrity_check").get().integrity_check
const v = t.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v
const o = t.prepare("SELECT COUNT(*) AS n FROM orders").get().n
const a = t.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS s FROM attempts WHERE status = ?").get("AUTORIZADO")
t.close()
console.log("integrity_check=" + ic + " schema_v=" + v + " ordenes=" + o + " pagos_autorizados=" + a.n + " monto_autorizado=" + a.s)
if (ic !== "ok") process.exit(2)
EOF
[[ "$DB_TMP_NAME" =~ ^\.bk-[0-9]{8}-[0-9]{6}-[0-9]+\.db$ ]] || die "nombre temporal invalido: $DB_TMP_NAME"
CLEAN_FILES+=("$MP/$DB_TMP_NAME")
SNAP="$("${DR[@]}" -v "$VOL":/data -e DB=/data/bydlight.db -e "OUT=/data/$DB_TMP_NAME" "$IMG" node -e "$JS_SNAP")"
printf '%s\n' "$SNAP"
[[ "$SNAP" =~ ^integrity_check=ok\ schema_v=([0-9]+)\ ordenes=([0-9]+)\ pagos_autorizados=([0-9]+)\ monto_autorizado=([0-9]+)$ ]] \
  || die "salida inesperada del respaldo o integrity_check distinto de ok"
SCHEMA_V="${BASH_REMATCH[1]}"
[ "$SCHEMA_V" = "$EXPECTED_SCHEMA" ] || die "la base esta en la version de esquema $SCHEMA_V (se esperaba $EXPECTED_SCHEMA): alguien abrio la base con codigo nuevo; avise antes de seguir"
[ -s "$MP/$DB_TMP_NAME" ] || die "la copia temporal no existe o esta vacia"
say "== 4. Copia consistente creada; integrity_check=ok; esquema v$SCHEMA_V (migracion 4 aun NO aplicada)"

# ----------------------------------------------------------------------------------------------- 5. guardar fuera del volumen (sin sobrescribir)
safe_copy() {  # safe_copy ORIGEN DESTINO_FINAL : copia 600 root, verifica sha256 y publica con mv -n (jamas sobrescribe)
  local src="$1" dst="$2" part="${2}.partial"
  [ ! -e "$dst" ]  || die "el destino ya existe y no se sobrescribe: $dst"
  [ ! -e "$part" ] || die "existe un parcial previo inesperado: $part"
  CLEAN_FILES+=("$part")
  install -m 600 -o root -g root "$src" "$part"
  [ "$(sha256sum "$src" | cut -d' ' -f1)" = "$(sha256sum "$part" | cut -d' ' -f1)" ] || die "la copia de $(basename "$dst") no coincide con el origen"
  mv -n -T "$part" "$dst"
  [ -f "$dst" ] && [ ! -e "$part" ] || die "no se pudo publicar $dst"
}
safe_copy "$MP/$DB_TMP_NAME" "$DEST_DB"
DB_SHA="$(sha256sum "$DEST_DB" | cut -d' ' -f1)"
rm -f -- "$MP/$DB_TMP_NAME"
say "== 5. Respaldo de la base guardado fuera del volumen: $DEST_DB (modo 600, root)"

# ----------------------------------------------------------------------------------------------- 6. configuracion persistente (sin mostrar contenido)
DEST_PAY="${BACKUP_DIR}/payments.json.pre-etapa-a-${TS}"
DEST_MAIL="${BACKUP_DIR}/mail.json.pre-etapa-a-${TS}"
safe_copy "$MP/config/payments.json" "$DEST_PAY"
PAY_SHA16="$(sha256sum "$DEST_PAY" | cut -c1-16)"
say "== 6. Configuracion respaldada: payments.json (huella ${PAY_SHA16}); el contenido no se muestra"
if [ -f "$MP/config/mail.json" ]; then
  safe_copy "$MP/config/mail.json" "$DEST_MAIL"
  say "   mail.json respaldado"
else
  say "   mail.json no existe (esperado: el correo aun no esta configurado)"
fi

# ----------------------------------------------------------------------------------------------- 7. el checkout publico sigue cerrado
JS_CFG=""
read -r -d '' JS_CFG <<'EOF' || true
const fs = require("fs")
let c
try { c = JSON.parse(fs.readFileSync(process.env.F, "utf8")) } catch { console.error("no se pudo leer o interpretar payments.json"); process.exit(3) }
// Solo se imprimen indicadores no sensibles; nunca claves, secretos ni codigos de comercio.
const s = (v) => (typeof v === "boolean" || /^[a-z]{1,12}$/.test(String(v)) ? String(v) : "?")
console.log("enabled=" + s(c.enabled) + " access=" + s(c.access) + " adminRefunds=" + s(c.adminRefunds))
EOF
CFG="$("${DR[@]}" -v "$VOL":/data:ro -e F=/data/config/payments.json "$IMG" node -e "$JS_CFG")"
printf '   configuracion de pagos: %s\n' "$CFG"
[[ "$CFG" =~ ^enabled=([a-z?]+)\ access=([a-z?]+)\ adminRefunds=([a-z?]+)$ ]] || die "salida inesperada de la lectura de configuracion"
C_ENABLED="${BASH_REMATCH[1]}"; C_ACCESS="${BASH_REMATCH[2]}"; C_REFUNDS="${BASH_REMATCH[3]}"
[ "$C_REFUNDS" != "true" ] || die "adminRefunds esta activado: las devoluciones no deben estar activas"
if [ "$C_ENABLED" = "true" ] && [ "$C_ACCESS" = "public" ]; then die "los pagos estan habilitados con access=public"; fi
if [ "$C_ENABLED" = "true" ]; then
  say "   AVISO: enabled=true con access=$C_ACCESS (modo no publico). Confirme que es lo esperado antes del despliegue."
fi
CODES="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code} %{redirect_url}' "${PUBLIC_URL}/contratar")" || die "no se pudo consultar ${PUBLIC_URL}/contratar"
[[ "$CODES" =~ ^30[1278]\ .*/contacto ]] || die "/contratar no redirige a /contacto (obtuvo: $CODES): el checkout podria estar abierto"
T404="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "${PUBLIC_URL}/terminos")" || die "no se pudo consultar ${PUBLIC_URL}/terminos"
[ "$T404" = "404" ] || die "/terminos responde $T404 (se esperaba 404 con las paginas legales ocultas)"
say "== 7. Checkout publico cerrado: /contratar -> /contacto, /terminos 404, sin PAYMENTS_ACCESS=public, adminRefunds != true"

# ----------------------------------------------------------------------------------------------- 8. registro (sin datos personales)
REF_TMP="${DEST_REF}.partial"
[ ! -e "$DEST_REF" ] && [ ! -e "$REF_TMP" ] || die "el registro ya existe: $DEST_REF"
CLEAN_FILES+=("$REF_TMP")
{
  echo "ts=${TS}"
  echo "prev_sha=${PREV_SHA}"
  echo "target_sha=${TARGET_SHA}"
  echo "imagen=${IMG}"
  echo "${SNAP}"
  echo "payments_json_sha16=${PAY_SHA16}"
  echo "db_backup=${DEST_DB}"
  echo "db_backup_sha256=${DB_SHA}"
  echo "config=${CFG}"
} > "$REF_TMP"
chmod 600 "$REF_TMP"
mv -n -T "$REF_TMP" "$DEST_REF"
[ -f "$DEST_REF" ] || die "no se pudo escribir el registro"

# ----------------------------------------------------------------------------------------------- 9. cierre
say ""
say "Archivos creados en $BACKUP_DIR (solo nombres y tamanos):"
for f in "$DEST_DB" "$DEST_PAY" "$DEST_MAIL" "$DEST_REF"; do
  [ -f "$f" ] && printf '  %s  (%s bytes)\n' "$(basename "$f")" "$(stat -c %s "$f")"
done
say ""
say "Datos para comparar despues del despliegue: $SNAP"
say "Huella de payments.json (primeros 16 hex): $PAY_SHA16"
SUCCESS=1
say ""
say "RESPALDO ETAPA A OK"
