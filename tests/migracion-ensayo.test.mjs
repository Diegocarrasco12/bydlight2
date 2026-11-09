// Ensayo de migracion sobre una COPIA de la base v3 de produccion (docs/deploy/06-ensayo-migracion.sh): se extrae el JavaScript real del
// script y se ejecuta localmente con node:sqlite; tambien se prueba la aceptacion de esquema del respaldo (03) y el diagnostico de por que
// la Etapa A quedo en v3 (las migraciones se aplican al ABRIR la base, no al arrancar). npm test
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { DatabaseSync } from "node:sqlite"
import { createHash } from "node:crypto"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const read = (f) => readFileSync(join(root, f), "utf8")
const dir = mkdtempSync(join(tmpdir(), "bd-ens-"))
const { MIGRATIONS } = await import("../src/lib/payments/migrations.mjs")
const sum = (s) => createHash("sha256").update(s).digest("hex")

// JS del ensayo, tal como esta en el script (entre el heredoc y su cierre).
const sh = read("docs/deploy/06-ensayo-migracion.sh")
const JS = /read -r -d '' JS_REHEARSAL <<'EOF' \|\| true\n([\s\S]*?)\nEOF\n/.exec(sh)[1]

/** Base de produccion simulada: esquema v3 (solo migraciones 1-3) con 1 orden, 1 cotizacion y 1 pago autorizado de 50, DATOS FICTICIOS. */
function makeV3(file, { corruptChecksum = false } = {}) {
  const db = new DatabaseSync(file)
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON")
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)")
  for (const m of MIGRATIONS.filter((x) => x.version <= 3)) {
    db.exec(m.sql)
    db.prepare("INSERT INTO schema_migrations VALUES (?,?,?,?)").run(m.version, m.name, corruptChecksum && m.version === 1 ? "00" : sum(m.sql), "2026-11-06T10:00:00.000Z")
  }
  const T = "2026-11-06T12:00:00.000Z"
  db.prepare("INSERT INTO orders (id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("ABCDEFGHJKMN", T, T, "ANTICIPO_PAGADO", "profesional", "Plan Profesional", "Cliente Ficticio", "ficticio@example.com", null, null, "mensaje de prueba")
  db.prepare("INSERT INTO quotes VALUES (?,?,?,?,?,?,?,?)").run("ABCDEFGHJKMN", 100, 50, 50, 50, T, "2026-11-20T00:00:00.000Z", null)
  db.prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)").run("a1", "ABCDEFGHJKMN", "anticipo", "BDTEST0001", 50, "AUTORIZADO", T, T)
  db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?,?,?,?)").run("ABCDEFGHJKMN", T, "PAGO_AUTORIZADO", "BDTEST0001")
  db.close()
}

function run(inDb, migFile = join(root, "src/lib/payments/migrations.mjs")) {
  const work = join(dir, `work-${Math.random().toString(16).slice(2)}.db`)
  const r = spawnSync(process.execPath, ["-e", JS], { env: { ...process.env, IN_DB: inDb, MIG_FILE: migFile, WORK_DB: work }, encoding: "utf8" })
  return { ...r, work, out: (r.stdout ?? "") + (r.stderr ?? "") }
}

test("ME1. ensayo: la base v3 con datos reales de forma (1 orden, 1 pago de 50) migra a v5 sin alterar nada y es idempotente", () => {
  const f = join(dir, "v3.db")
  makeV3(f)
  const r = run(f)
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /antes: esquema v3;[^\n]*ordenes=1; intentos=1/)
  assert.match(r.out, /aplicada migracion 4/)
  assert.match(r.out, /aplicada migracion 5/)
  assert.match(r.out, /despues: esquema v5; migraciones registradas=5; aplicadas en el ensayo=2/)
  assert.match(r.out, /integrity_check=ok foreign_key_violaciones=0/)
  assert.match(r.out, /compatibilidad con el codigo anterior: INSERT sin columnas nuevas OK/)
  assert.match(r.out, /segunda pasada: migraciones aplicadas=0/)
  assert.match(r.out, /ENSAYO SOBRE COPIA: todas las comprobaciones pasaron/)
  // el original (respaldo) no se modifica: sigue en v3
  const o = new DatabaseSync(f, { readOnly: true })
  assert.equal(o.prepare("SELECT MAX(version) v FROM schema_migrations").get().v, 3)
  o.close()
  // la copia migrada conserva el pago autorizado
  const w = new DatabaseSync(r.work, { readOnly: true })
  assert.deepEqual({ ...w.prepare("SELECT COUNT(*) n, SUM(amount) s FROM attempts WHERE status = 'AUTORIZADO'").get() }, { n: 1, s: 50 })
  assert.equal(w.prepare("SELECT cust_type FROM orders").get().cust_type, "persona")
  w.close()
})

test("ME2. ensayo: si la base ya esta en v4 solo aplica la 5; si ya esta en v5 no cambia nada", () => {
  const f = join(dir, "v3b.db")
  makeV3(f)
  const db = new DatabaseSync(f)
  const m4 = MIGRATIONS.find((m) => m.version === 4)
  db.exec(m4.sql)
  db.prepare("INSERT INTO schema_migrations VALUES (?,?,?,?)").run(4, m4.name, sum(m4.sql), "2026-11-07T00:00:00.000Z")
  db.close()
  const r = run(f)
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /antes: esquema v4;/)
  assert.match(r.out, /aplicadas en el ensayo=1/)
  const r2 = run(r.work)
  assert.equal(r2.status, 0, r2.out)
  assert.match(r2.out, /antes: esquema v5;/)
  assert.match(r2.out, /aplicadas en el ensayo=0/)
})

test("ME3. ensayo: una migracion ya aplicada con otro checksum, o un esquema corrupto, hace FALLAR el ensayo", () => {
  const f = join(dir, "bad.db")
  makeV3(f, { corruptChecksum: true })
  const r = run(f)
  assert.notEqual(r.status, 0)
  assert.match(r.out, /fue modificada despues de aplicarse/)
  // migraciones no contiguas (p. ej. una version faltante) tambien se detectan
  const mig = join(dir, "mig-gap.mjs")
  writeFileSync(mig, readFileSync(join(root, "src/lib/payments/migrations.mjs"), "utf8").replace("version: 4,", "version: 7,"))
  const f2 = join(dir, "v3c.db")
  makeV3(f2)
  const r2 = run(f2, mig)
  assert.notEqual(r2.status, 0)
  assert.match(r2.out, /no son contiguas|FALLAS/)
})

test("ME4. el respaldo (03) acepta esquema v3 o v4 y rechaza v5 o desconocido, sin cambiar EXPECTED_SCHEMA a ciegas", () => {
  const s3 = read("docs/deploy/03-backup-etapa-b.sh")
  assert.doesNotMatch(s3, /EXPECTED_SCHEMA/)
  assert.match(s3, /ACCEPTED_SCHEMAS="3 4"/)
  const fn = /schema_accepted\(\) \{[^\n]*\}/.exec(s3)[0]
  const bash = spawnSync("bash", ["-c", `ACCEPTED_SCHEMAS="3 4"; ${fn}; for v in 3 4 5 2 "" 34 abc; do schema_accepted "$v" && echo "$v:si" || echo "$v:no"; done`], { encoding: "utf8" })
  if (bash.error) return // sin bash en este equipo
  assert.equal(bash.stdout.trim().split("\n").join(" "), "3:si 4:si 5:no 2:no :no 34:no abc:no")
})

test("ME5. diagnostico: las migraciones se aplican al ABRIR la base (no al arrancar), y con los pagos apagados nada la abre", () => {
  const db = read("src/lib/payments/db.ts")
  assert.match(db, /export function openDb[\s\S]*migrate\(conn\)/)
  // el arranque del servidor solo toca la base si el correo esta habilitado (instrumentation)
  const ins = read("src/instrumentation.ts")
  assert.match(ins, /if \(activeTransport\(\)\) startMailTimer\(\)/)
  // con los pagos apagados, leer una orden no abre la base
  assert.match(read("src/lib/payments/store.ts"), /if \(!paymentsEnabled\(\) \|\| !isValidOrderId\(id\)\) return null/)
  // las migraciones 1-3 no cambiaron desde 13aaf17 (solo se agrego la 5): el codigo nuevo no choca con checksums previos
  assert.deepEqual(MIGRATIONS.map((m) => m.version), [1, 2, 3, 4, 5])
})

test("ME6. los scripts de despliegue tienen sintaxis valida y no contienen los errores de transcripcion reportados", () => {
  for (const f of ["01-backup-etapa-a.sh", "02-verificar-migracion-4.sh", "03-backup-etapa-b.sh", "04-verificar-migracion-5.sh", "05-caducidad-respaldos.sh", "06-ensayo-migracion.sh", "07-aplicar-migraciones.sh", "00-admin.sh"]) {
    const txt = read(`docs/deploy/${f}`)
    assert.doesNotMatch(txt, /AS n(FROM|WHERE)/, f)
    assert.doesNotMatch(txt, /ALL--security/, f)
    const r = spawnSync("bash", ["-n", join(root, "docs/deploy", f)], { encoding: "utf8" })
    if (r.error) continue
    assert.equal(r.status, 0, `${f}: ${r.stderr}`)
  }
})

test("ME7. 00-admin.sh arma el docker run completo (solo lectura, sin capacidades, volumen /data, scripts en /s) y rechaza lo ajeno", () => {
  const script = join(root, "docs/deploy/00-admin.sh")
  const stub = `
    id() { echo 0; }
    docker() {
      case "$*" in
        *compose.project*) echo bydlight-prod ;;
        *Config.Image*) echo "\${FAKE_IMG:-bydlight-web:b28448196fb8}" ;;
        *) echo "docker $*" ;;
      esac
    }
    export -f id docker
  `
  const ok = spawnSync("bash", ["-c", `${stub} bash "${script}" --print node /s/admin-remote.mjs list --config-file /data/config/payments.json`], { encoding: "utf8" })
  if (ok.error) return
  assert.equal(ok.status, 0, ok.stderr)
  for (const frag of ["docker run --rm", "--user 1000:1000", "--read-only", "--cap-drop ALL", "--security-opt no-new-privileges:true", "bydlight-prod_bydlight_data:/data", "/s:ro", "bydlight-web:b28448196fb8 node /s/admin-remote.mjs list"])
    assert.ok(ok.stdout.includes(frag), frag + " :: " + ok.stdout)
  assert.ok(!/cap-drop ALL--/.test(ok.stdout))
  const tty = spawnSync("bash", ["-c", `${stub} bash "${script}" --tty --print node /s/mail-config-set.mjs x --init`], { encoding: "utf8" })
  assert.match(tty.stdout, /docker run --rm -it /)
  const badImg = spawnSync("bash", ["-c", `FAKE_IMG=otra:latest; export FAKE_IMG; ${stub} bash "${script}" --print node /s/x.mjs`], { encoding: "utf8" })
  assert.notEqual(badImg.status, 0)
  const notNode = spawnSync("bash", ["-c", `${stub} bash "${script}" --print sh -c id`], { encoding: "utf8" })
  assert.notEqual(notNode.status, 0)
})
