#!/usr/bin/env bash
# Bydlight2 - Etapa B - ENSAYO de las migraciones 4 y 5 sobre una COPIA del respaldo (no toca produccion).
#
# Ejecutar en el servidor Ubuntu como root, DESPUES de `bd-run build <SHA>` y ANTES de `bd-run up <SHA>`:
#   sudo bash 06-ensayo-migracion.sh <SHA_40_HEX_DE_LA_ETAPA_B>
#
# Que hace:
#   - exige que siga desplegada la Etapa A, que el clon del servidor este en el SHA objetivo y que exista la imagen ya construida;
#   - toma el respaldo mas reciente del Paso 4 (etapa-b-*.ref -> db_backup), verifica su SHA-256 y su esquema (v3 o v4);
#   - en un contenedor EFIMERO de la imagen NUEVA (sin red, sistema de archivos de solo lectura, sin capacidades), copia ese respaldo
#     a un tmpfs, aplica ahi las migraciones pendientes con el mismo algoritmo y los mismos checksums que usa la aplicacion y comprueba:
#       * integrity_check y foreign_key_check;  * esquema final = ultima migracion del codigo nuevo;
#       * que TODAS las filas previas (ordenes, cotizaciones, pagos, eventos, devoluciones, migraciones ya aplicadas) quedaron identicas;
#       * que las ordenes previas son 'persona' sin datos tributarios y que las tablas nuevas estan vacias;
#       * que el INSERT del codigo ANTERIOR (sin columnas nuevas) sigue funcionando (el rollback de codigo es seguro);
#       * que repetir las migraciones no cambia nada (idempotencia);
#   - escribe un marcador de ensayo OK (archivo nuevo en el directorio de respaldos) que exige 07-aplicar-migraciones.sh.
# Que NO hace: no escribe en el volumen de datos de produccion, no migra la base real, no hace fetch/build/up, no toca otros contenedores.
# El respaldo es de root con modo 600: el contenedor del ensayo corre como root (uid 0) pero SIN capacidades, SIN red y con el
# sistema de archivos en solo lectura, y monta el respaldo en solo lectura.
# Imprime "ENSAYO DE MIGRACION OK" solo si TODAS las comprobaciones pasaron.

set -euo pipefail
umask 077
export LC_ALL=C

readonly PROJECT="bydlight-prod"
readonly CONTAINER="bydlight-prod-web-1"
readonly BACKUP_DIR="/srv/bydlight-prod/backups"
readonly CLONE_MIG="/srv/bydlight-prod/app/src/lib/payments/migrations.mjs"
readonly PREV_SHA="13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7"
TARGET_SHA="${1:-}"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "ERROR: indique el SHA de 40 caracteres: sudo bash $0 <SHA>" >&2; exit 1; }
readonly TARGET_SHA
readonly TARGET12="${TARGET_SHA:0:12}"
readonly NEW_IMG="bydlight-web:${TARGET12}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
say() { printf '%s\n' "$*"; }
trap 'rc=$?; [ "$rc" = 0 ] || printf "\nENSAYO DE MIGRACION FALLO (codigo %s). No se modifico produccion.\n" "$rc" >&2' EXIT

[ "$(id -u)" = "0" ] || die "ejecute como root: sudo bash $0 <SHA>"
for c in docker bd-run sha256sum grep sed ls head stat; do command -v "$c" >/dev/null 2>&1 || die "falta el comando: $c"; done

# ---------------------------------------------------------------------------------------------- 1. estado esperado del servidor
ST="$(bd-run status)"
printf '%s\n' "$ST" | grep -Fxq "desplegado: ${PREV_SHA}" || die "no esta desplegada la Etapa A (${PREV_SHA:0:12}); este ensayo va antes de 'up'"
printf '%s\n' "$ST" | grep -Fxq "clon en: ${TARGET_SHA}"  || die "el clon del servidor no esta en ${TARGET12}: ejecute antes 'bd-run fetch ${TARGET_SHA}'"
printf '%s\n' "$ST" | grep -Fxq "salud: OK"               || die "la salud del proyecto no es OK"
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER")" = "$PROJECT" ] || die "el contenedor no pertenece al proyecto $PROJECT"
docker image inspect "$NEW_IMG" >/dev/null 2>&1 || die "no existe la imagen $NEW_IMG: ejecute antes 'bd-run build ${TARGET_SHA}' y espere su fin (job-status)"
[ -f "$CLONE_MIG" ] || die "no existe $CLONE_MIG en el clon del servidor"
MIG_SHA="$(sha256sum "$CLONE_MIG" | cut -d' ' -f1)"
say "== 1. Etapa A desplegada, clon e imagen en ${TARGET12}; migrations.mjs sha256=${MIG_SHA}"

# ---------------------------------------------------------------------------------------------- 2. respaldo previo (Paso 4)
REF="$(ls -t "$BACKUP_DIR"/etapa-b-*.ref 2>/dev/null | head -1 || true)"
[ -n "$REF" ] && [ -f "$REF" ] || die "no se encontro el registro del respaldo (etapa-b-*.ref): ejecute antes 03-backup-etapa-b.sh"
grep -Fxq "target_sha=${TARGET_SHA}" "$REF" || die "el respaldo mas reciente no fue hecho para el SHA ${TARGET12}"
BK_DB="$(sed -n 's/^db_backup=//p' "$REF" | head -1)"
BK_SHA="$(sed -n 's/^db_backup_sha256=//p' "$REF" | head -1)"
BK_SCHEMA="$(sed -n 's/^integrity_check=ok schema_v=\([0-9]*\) .*/\1/p' "$REF" | head -1)"
[[ "$BK_DB" == "$BACKUP_DIR"/bydlight-pre-etapa-b-*.db ]] || die "ruta de respaldo inesperada en el registro"
[ -f "$BK_DB" ] && [ ! -L "$BK_DB" ] || die "el archivo de respaldo no existe o es un enlace"
[ "$(sha256sum "$BK_DB" | cut -d' ' -f1)" = "$BK_SHA" ] || die "el SHA-256 del respaldo no coincide con el registro"
case "$BK_SCHEMA" in 3|4) ;; *) die "el respaldo tiene esquema v${BK_SCHEMA:-?} (se aceptan v3 y v4)";; esac
say "== 2. Respaldo verificado (sha256 coincide, esquema v${BK_SCHEMA}): $(basename "$BK_DB")"

# ---------------------------------------------------------------------------------------------- 3. ensayo en contenedor efimero
JS_REHEARSAL=""
read -r -d '' JS_REHEARSAL <<'EOF' || true
const fs = require("fs")
const crypto = require("crypto")
const { pathToFileURL } = require("url")
const { DatabaseSync } = require("node:sqlite")
const IN = process.env.IN_DB, MIG = process.env.MIG_FILE, WORK = process.env.WORK_DB
const fails = []
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex")
const log = (m) => console.log(m)
;(async () => {
  const { MIGRATIONS } = await import(pathToFileURL(MIG).href)
  if (!MIGRATIONS || !MIGRATIONS.length) throw new Error("el archivo de migraciones no exporta MIGRATIONS")
  const last = Math.max(...MIGRATIONS.map((m) => m.version))
  MIGRATIONS.forEach((m, i) => { if (m.version !== i + 1) fails.push("las migraciones no son contiguas desde 1") })
  if (fs.existsSync(WORK)) throw new Error("el archivo de trabajo ya existe")
  fs.copyFileSync(IN, WORK)
  const db = new DatabaseSync(WORK)
  db.exec("PRAGMA foreign_keys = ON")
  db.exec("PRAGMA busy_timeout = 5000")
  const tableNames = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name)
  const snapshot = () => {
    const out = {}
    for (const t of tableNames()) {
      const cols = db.prepare("PRAGMA table_info(" + t + ")").all().map((c) => c.name)
      out[t] = { cols, count: db.prepare("SELECT COUNT(*) AS n FROM " + t).get().n }
    }
    return out
  }
  const hashOf = (t, cols) => sha(JSON.stringify(db.prepare("SELECT " + cols.join(", ") + " FROM " + t + " ORDER BY rowid").all()))
  const hasMig = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get().n
  if (!hasMig) throw new Error("la copia no tiene schema_migrations")
  const vPre = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v
  const pre = snapshot()
  const preHash = {}
  for (const t of Object.keys(pre)) preHash[t] = hashOf(t, pre[t].cols)
  log("antes: esquema v" + vPre + "; tablas=" + Object.keys(pre).join(",") + "; ordenes=" + pre.orders.count + "; intentos=" + pre.attempts.count)
  const icPre = db.prepare("PRAGMA integrity_check").get().integrity_check
  if (icPre !== "ok") fails.push("integrity_check previo")

  const apply = () => {
    const applied = new Map(db.prepare("SELECT version, checksum FROM schema_migrations").all().map((r) => [r.version, r.checksum]))
    let n = 0
    for (const m of MIGRATIONS) {
      const s = sha(m.sql)
      if (applied.has(m.version)) {
        if (applied.get(m.version) !== s) throw new Error("la migracion " + m.version + " fue modificada despues de aplicarse (checksum distinto)")
        continue
      }
      db.exec("BEGIN IMMEDIATE")
      try {
        db.exec(m.sql)
        db.prepare("INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)").run(m.version, m.name, s, new Date().toISOString())
        db.exec("COMMIT")
        n++
        log("aplicada migracion " + m.version + " (" + m.name + ")")
      } catch (e) { db.exec("ROLLBACK"); throw e }
    }
    return n
  }
  const first = apply()
  const vPost = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v
  const nmig = db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get().n
  log("despues: esquema v" + vPost + "; migraciones registradas=" + nmig + "; aplicadas en el ensayo=" + first)
  if (vPost !== last || nmig !== last) fails.push("el esquema final no es v" + last)

  // Los datos previos deben quedar identicos (mismas columnas previas, mismo contenido, mismo conteo).
  const post = snapshot()
  for (const t of Object.keys(pre)) {
    if (!post[t]) { fails.push("desaparecio la tabla " + t); continue }
    if (post[t].count !== pre[t].count && t !== "schema_migrations") fails.push("cambio el conteo de " + t)
    if (t === "schema_migrations") continue
    if (hashOf(t, pre[t].cols) !== preHash[t]) fails.push("cambio el contenido de " + t)
  }
  const prevMig = db.prepare("SELECT version, name, checksum, applied_at FROM schema_migrations WHERE version <= ? ORDER BY version").all(vPre)
  if (sha(JSON.stringify(prevMig)) !== preHash.schema_migrations && vPre > 0) fails.push("cambiaron las migraciones ya registradas")
  const created = Object.keys(post).filter((t) => !pre[t])
  log("tablas nuevas: " + (created.length ? created.join(",") : "(ninguna)"))
  for (const t of created) if (post[t].count !== 0) fails.push("la tabla nueva " + t + " no esta vacia")
  if (last >= 4) {
    const cols = post.orders.cols
    for (const c of ["cust_type", "cust_tax_id", "cust_giro", "cust_address"]) if (!cols.includes(c)) fails.push("falta orders." + c)
    const bad = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE cust_type <> 'persona' OR cust_tax_id IS NOT NULL OR cust_giro IS NOT NULL OR cust_address IS NOT NULL").get().n
    log("ordenes previas no 'persona' o con datos tributarios inventados: " + bad)
    if (bad !== 0) fails.push("ordenes previas alteradas")
    if (!post.mail_outbox) fails.push("falta mail_outbox")
  }
  if (last >= 5) {
    if (!post.tax_documents) fails.push("falta tax_documents")
    else {
      const idx = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name IN ('tax_documents_folio','tax_documents_one_per_payment')").get().n
      if (idx !== 2) fails.push("faltan indices de tax_documents")
    }
  }
  const ic = db.prepare("PRAGMA integrity_check").get().integrity_check
  const fk = db.prepare("PRAGMA foreign_key_check").all().length
  log("integrity_check=" + ic + " foreign_key_violaciones=" + fk)
  if (ic !== "ok") fails.push("integrity_check")
  if (fk !== 0) fails.push("foreign_key_check")

  // Compatibilidad hacia atras: el INSERT del codigo ANTERIOR (sin columnas nuevas) debe seguir funcionando; se deshace.
  db.exec("BEGIN IMMEDIATE")
  try {
    db.prepare("INSERT INTO orders (id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run("ZZZZZZZZZZZ2", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z", "SOLICITADA", "x", "x", "x", "x@example.invalid", null, null, "x")
    const t = db.prepare("SELECT cust_type FROM orders WHERE id = ?").get("ZZZZZZZZZZZ2")
    if (!t || t.cust_type !== "persona") fails.push("el INSERT anterior no queda como persona")
    log("compatibilidad con el codigo anterior: INSERT sin columnas nuevas OK (deshecho)")
  } catch (e) { fails.push("el INSERT del codigo anterior fallo: " + e.message) }
  finally { db.exec("ROLLBACK") }

  // Idempotencia: repetir no cambia nada.
  const second = apply()
  log("segunda pasada: migraciones aplicadas=" + second + " (debe ser 0)")
  if (second !== 0) fails.push("las migraciones no son idempotentes")
  db.close()
  if (fails.length) { log("FALLAS: " + fails.join("; ")); process.exit(2) }
  log("ENSAYO SOBRE COPIA: todas las comprobaciones pasaron")
})().catch((e) => { console.error("ERROR: " + e.message); process.exit(3) })
EOF
DR=(docker run --rm --user 0:0 --read-only --cap-drop ALL --security-opt no-new-privileges:true
    --network none --pids-limit 64 --memory 256m --tmpfs /tmp:rw,size=64m,mode=1777)
OUT="$("${DR[@]}" -v "$BK_DB":/in/backup.db:ro -v "$CLONE_MIG":/w/migrations.mjs:ro \
  -e IN_DB=/in/backup.db -e MIG_FILE=/w/migrations.mjs -e WORK_DB=/tmp/ensayo.db "$NEW_IMG" node -e "$JS_REHEARSAL")" \
  || { printf '%s\n' "${OUT:-}"; die "el ensayo de migracion fallo (ver arriba)"; }
printf '%s\n' "$OUT"
printf '%s\n' "$OUT" | grep -Fxq "ENSAYO SOBRE COPIA: todas las comprobaciones pasaron" || die "salida inesperada del ensayo"

# ---------------------------------------------------------------------------------------------- 4. marcador (archivo nuevo, jamas sobrescribe)
MARK="${BACKUP_DIR}/ensayo-ok-${TARGET12}-${BK_SHA:0:12}.txt"
if [ -e "$MARK" ]; then say "   (marcador ya existente: $(basename "$MARK"))"; else
  { echo "target_sha=${TARGET_SHA}"; echo "db_backup_sha256=${BK_SHA}"; echo "migrations_mjs_sha256=${MIG_SHA}"; echo "ts=$(date +%Y%m%d-%H%M%S)"; } > "${MARK}.partial"
  chmod 600 "${MARK}.partial"; mv -n -T "${MARK}.partial" "$MARK"
fi
[ -f "$MARK" ] || die "no se pudo escribir el marcador"
trap - EXIT
say ""
say "ENSAYO DE MIGRACION OK (sobre una copia; produccion no se toco). Marcador: $(basename "$MARK")"
