#!/usr/bin/env bash
# Bydlight2 - Etapa B - verificacion de SOLO LECTURA de la migracion 5 sobre los datos reales.
#
# Ejecutar en el servidor Ubuntu como root:   sudo bash 04-verificar-migracion-5.sh
#
# Comprueba, sin escribir nada (conexion SQLite de solo lectura; sin migrar, sin orders-admin, sin payments-config-set):
#   - integrity_check y foreign_key_check de la base;
#   - version de esquema 5 con las 5 migraciones registradas y sus checksums;
#   - columnas nuevas de orders (cust_type, cust_tax_id, cust_giro, cust_address) , la tabla mail_outbox y la tabla tax_documents (vacia hasta que se registre el primer documento);
#   - que TODA orden anterior a la migracion quedo como 'persona' sin datos tributarios inventados;
#   - que no se perdio ninguna orden ni pago respecto del respaldo previo (ordenes, pagos autorizados y monto no bajan);
#   - estado de la cola de correos (pendientes/fallidos) y de la configuracion de pagos (sin mostrar secretos).
# No imprime datos personales: solo conteos, versiones y nombres de columnas. Termina con "MIGRACION 5 VERIFICADA OK" solo si todo paso.

set -euo pipefail
umask 077
export LC_ALL=C

readonly CONTAINER="bydlight-prod-web-1"
readonly PROJECT="bydlight-prod"
readonly VOL="bydlight-prod_bydlight_data"
readonly BACKUP_DIR="/srv/bydlight-prod/backups"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
trap 'rc=$?; [ "$rc" = 0 ] || printf "\nVERIFICACION DE MIGRACION 5 FALLO (codigo %s). No se modifico nada.\n" "$rc" >&2' EXIT

[ "$(id -u)" = "0" ] || die "ejecute como root: sudo bash $0"
for c in docker; do command -v "$c" >/dev/null 2>&1 || die "falta el comando: $c"; done
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER")" = "$PROJECT" ] || die "el contenedor no pertenece al proyecto $PROJECT"
[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" = "healthy" ] || die "el contenedor no esta healthy"
IMG="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
[[ "$IMG" =~ ^bydlight-web:[0-9a-f]{12}$ ]] || die "imagen inesperada: $IMG"
docker inspect -f '{{range .Mounts}}{{.Name}}|{{.Destination}}|{{.RW}}{{"\n"}}{{end}}' "$CONTAINER" | grep -Fxq "${VOL}|/data|true" || die "el volumen $VOL no esta montado en /data"

# Instantanea previa (respaldo del Paso 4, 03-backup-etapa-b.sh): linea "integrity_check=ok schema_v=4 ordenes=N pagos_autorizados=N monto_autorizado=N".
PRE=""
if REF="$(ls -t "$BACKUP_DIR"/etapa-b-*.ref 2>/dev/null | head -1)" && [ -n "$REF" ]; then
  PRE="$(grep -E '^integrity_check=ok schema_v=[0-9]+ ordenes=[0-9]+ pagos_autorizados=[0-9]+ monto_autorizado=[0-9]+$' "$REF" | head -1 || true)"
fi
[ -n "$PRE" ] || die "no se encontro la instantanea previa en $BACKUP_DIR/etapa-b-*.ref (se necesita para comparar)"
printf 'Instantanea previa: %s\n' "$PRE"

JS=""
read -r -d '' JS <<'EOF' || true
const fs = require("fs")
const { DatabaseSync } = require("node:sqlite")
if (!fs.existsSync("/data/bydlight.db")) { console.error("la base no existe"); process.exit(3) }
const db = new DatabaseSync("/data/bydlight.db", { readOnly: true })   // solo lectura: no migra ni escribe
db.exec("PRAGMA busy_timeout = 5000")
const one = (sql, ...p) => db.prepare(sql).get(...p)
const fails = []
const ic = one("PRAGMA integrity_check").integrity_check
const fk = db.prepare("PRAGMA foreign_key_check").all().length
const v = one("SELECT MAX(version) AS v FROM schema_migrations").v
const nmig = one("SELECT COUNT(*) AS n FROM schema_migrations").n
console.log("integrity_check=" + ic + " foreign_key_violaciones=" + fk + " schema_v=" + v + " migraciones_registradas=" + nmig)
if (ic !== "ok") fails.push("integrity_check")
if (fk !== 0) fails.push("foreign_key_check")
if (v !== 5 || nmig !== 5) fails.push("la version de esquema no es 5 con 5 migraciones")
const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name)
const need = ["cust_type", "cust_tax_id", "cust_giro", "cust_address"]
const missing = need.filter((c) => !cols.includes(c))
console.log("columnas nuevas en orders: " + (missing.length ? "FALTAN " + missing.join(",") : need.join(",") + " presentes"))
if (missing.length) fails.push("faltan columnas")
const mo = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mail_outbox'").all().length
console.log("tabla mail_outbox: " + (mo ? "presente" : "AUSENTE"))
if (!mo) fails.push("falta mail_outbox")
const td = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tax_documents'").all().length
console.log("tabla tax_documents: " + (td ? "presente" : "AUSENTE"))
if (!td) fails.push("falta tax_documents")
else {
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('tax_documents_folio','tax_documents_one_per_payment')").all().length
  console.log("indices anti duplicados de documentos: " + idx + " de 2")
  if (idx !== 2) fails.push("faltan indices de tax_documents")
  console.log("documentos tributarios registrados: " + db.prepare("SELECT COUNT(*) AS n FROM tax_documents").get().n)
}
if (!missing.length) {
  const dist = db.prepare("SELECT cust_type AS t, COUNT(*) AS n FROM orders GROUP BY cust_type").all()
  console.log("ordenes por tipo de cliente: " + dist.map((d) => d.t + "=" + d.n).join(" "))
  const bad = one("SELECT COUNT(*) AS n FROM orders WHERE cust_type = 'persona' AND (cust_tax_id IS NOT NULL OR cust_giro IS NOT NULL OR cust_address IS NOT NULL)").n
  console.log("ordenes 'persona' con datos tributarios: " + bad)
  if (bad !== 0) fails.push("ordenes persona con datos de empresa")
}
if (mo) {
  const q = db.prepare("SELECT status AS s, COUNT(*) AS n FROM mail_outbox GROUP BY status").all()
  console.log("cola de correos: " + (q.length ? q.map((x) => x.s + "=" + x.n).join(" ") : "vacia"))
  if (q.some((x) => x.s === "FALLIDO")) fails.push("hay correos FALLIDOS")
}
const o = one("SELECT COUNT(*) AS n FROM orders").n
const a = one("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS s FROM attempts WHERE status = ?", "AUTORIZADO")
const open = one("SELECT COUNT(*) AS n FROM attempts WHERE status IN (?, ?)", "INICIADO", "PENDIENTE").n
console.log("ahora: ordenes=" + o + " pagos_autorizados=" + a.n + " monto_autorizado=" + a.s + " intentos_en_curso=" + open)
const m = /ordenes=(\d+) pagos_autorizados=(\d+) monto_autorizado=(\d+)/.exec(process.env.PRE)
if (o < +m[1]) fails.push("hay MENOS ordenes que en el respaldo previo")
if (a.n < +m[2]) fails.push("hay MENOS pagos autorizados que en el respaldo previo")
if (a.s < +m[3]) fails.push("el monto autorizado es MENOR que en el respaldo previo")
console.log("variacion desde el respaldo: ordenes +" + (o - +m[1]) + ", pagos autorizados +" + (a.n - +m[2]) + ", monto +" + (a.s - +m[3]))
if (open > 0) console.log("AVISO: hay intentos en curso; revisar con reconcile/monitor antes de abrir al publico")
db.close()
if (fails.length) { console.log("FALLAS: " + fails.join("; ")); process.exit(2) }
EOF
DR=(docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true --network none --pids-limit 64 --memory 256m --tmpfs /tmp:rw,size=16m,mode=1777)
OUT="$("${DR[@]}" -v "$VOL":/data -e "PRE=$PRE" "$IMG" node -e "$JS")" || { printf '%s\n' "$OUT"; die "la verificacion de la base encontro fallas (ver arriba)"; }
printf '%s\n' "$OUT"

JS_CFG=""
read -r -d '' JS_CFG <<'EOF' || true
const fs = require("fs")
let c
try { c = JSON.parse(fs.readFileSync("/data/config/payments.json", "utf8")) } catch { console.error("no se pudo leer payments.json"); process.exit(3) }
const s = (x) => (typeof x === "boolean" || /^[a-z]{1,12}$/.test(String(x)) ? String(x) : "?")
console.log("pagos: enabled=" + s(c.enabled) + " access=" + s(c.access) + " adminRefunds=" + s(c.adminRefunds) + " env=" + s(c.env))
let m = "no existe"
try { const j = JSON.parse(fs.readFileSync("/data/config/mail.json", "utf8")); m = "existe; enabled=" + s(j.enabled) + "; clave_api_brevo=" + !!j.apiKey } catch {}
console.log("correo (mail.json): " + m)
EOF
"${DR[@]}" -v "$VOL":/data:ro "$IMG" node -e "$JS_CFG"
trap - EXIT
printf '\nMIGRACION 5 VERIFICADA OK\n'
