// Flujo de shell 06 -> 07 con el ejecutor y docker SIMULADOS (rutas reemplazadas por un directorio temporal; node:sqlite real).
// Prueba la logica de los scripts de despliegue sin tocar ningun servidor. npm test
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { spawnSync } from "node:child_process"
import { DatabaseSync } from "node:sqlite"
import { createHash } from "node:crypto"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const dir = mkdtempSync(join(tmpdir(), "bd-flu-"))
const { MIGRATIONS } = await import("../src/lib/payments/migrations.mjs")
const sum = (s) => createHash("sha256").update(s).digest("hex")
const TARGET = "b28448196fb89f9814621a709475029ae086dd21"
const PREV = "13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7"
const hasBash = !spawnSync("bash", ["-c", "true"]).error
const posix = (p) => p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)

function makeV3(file) {
  const db = new DatabaseSync(file)
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON")
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)")
  for (const m of MIGRATIONS.filter((x) => x.version <= 3)) {
    db.exec(m.sql)
    db.prepare("INSERT INTO schema_migrations VALUES (?,?,?,?)").run(m.version, m.name, sum(m.sql), "2026-11-06T10:00:00.000Z")
  }
  const T = "2026-11-06T12:00:00.000Z"
  db.prepare("INSERT INTO orders (id, created_at, updated_at, stage, plan_id, plan_name, cust_name, cust_email, cust_phone, cust_company, message) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("ABCDEFGHJKMN", T, T, "ANTICIPO_PAGADO", "profesional", "Plan Profesional", "Cliente Ficticio", "ficticio@example.com", null, null, "mensaje de prueba")
  db.prepare("INSERT INTO quotes VALUES (?,?,?,?,?,?,?,?)").run("ABCDEFGHJKMN", 100, 50, 50, 50, T, "2026-11-20T00:00:00.000Z", null)
  db.prepare("INSERT INTO attempts (id, order_id, kind, buy_order, amount, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)").run("a1", "ABCDEFGHJKMN", "anticipo", "BDTEST0001", 50, "AUTORIZADO", T, T)
  db.prepare("INSERT INTO events (order_id, at, type, detail) VALUES (?,?,?,?)").run("ABCDEFGHJKMN", T, "PAGO_AUTORIZADO", "BDTEST0001")
  db.close()
}

const STUB_DOCKER = `#!/usr/bin/env bash
case "$*" in
  *"image inspect"*) exit 0 ;;
  *compose.project*) echo bydlight-prod ;;
  *Health.Status*) echo healthy ;;
  *Config.Image*) echo "bydlight-web:b28448196fb8" ;;
  *"range .Mounts"*) echo "bydlight-prod_bydlight_data|/data|true" ;;
  run*)
    declare -A MAP; ENVS=(); args=("$@"); i=0
    while [ $i -lt \${#args[@]} ]; do
      a="\${args[$i]}"
      case "$a" in
        -v) v="\${args[$((i+1))]}"; src="\${v%%:*}"; rest="\${v#*:}"; dst="\${rest%%:*}"
            [ "$src" = bydlight-prod_bydlight_data ] && src="$TEST_DATA"; MAP["$dst"]="$src"; i=$((i+2)) ;;
        -e) ENVS+=("\${args[$((i+1))]}"); i=$((i+2)) ;;
        --user) CUSER="\${args[$((i+1))]%%:*}"; i=$((i+2)) ;;
        node) shift $((i+1)); break ;;
        *) i=$((i+1)) ;;
      esac
    done
    for kv in "\${ENVS[@]}"; do
      k="\${kv%%=*}"; v="\${kv#*=}"
      [ -n "\${MAP[$v]:-}" ] && v="\${MAP[$v]}"
      case "$v" in /tmp/*) v="$TEST_TMP/\${v#/tmp/}";; /data/*) v="$TEST_DATA/\${v#/data/}";; esac
      export "$k=$v"
    done
    if [ "$1" = "-e" ]; then W="$(cygpath -m "$TEST_DATA" 2>/dev/null || echo "$TEST_DATA")"; js="$2"; js="\${js//\\/data\\//$W/}"; exec node -e "$js"; fi
    script="$1"; for d in "\${!MAP[@]}"; do case "$script" in "$d"*) script="\${MAP[$d]}\${script#$d}";; esac; done
    # El clon del servidor es privado de root (umask 077): un contenedor sin root ni capacidades no puede leerlo y node informa "Cannot find module".
    if [ "\${CUSER:-0}" != "0" ] && [ -n "\${ROOT_PRIVATE_DIR:-}" ]; then case "$script" in "$ROOT_PRIVATE_DIR"/*) echo "Error: Cannot find module '$1'" >&2; exit 1 ;; esac; fi
    shift 1; exec node "$script" "$@" ;;
esac
`
const STUB_EXECUTOR = `#!/usr/bin/env bash
printf 'desplegado: %s\\nclon en: %s\\nsalud: OK\\n' "$FAKE_DEPLOYED" "$FAKE_CLONE"
`

function sandbox(name) {
  const base = join(dir, name)
  const bk = join(base, "backups"), data = join(base, "data"), app = join(base, "app"), bin = join(base, "bin")
  for (const d of [join(data, "config"), bk, join(app, "src/lib/payments"), join(app, "scripts"), bin]) mkdirSync(d, { recursive: true })
  copyFileSync(join(root, "src/lib/payments/migrations.mjs"), join(app, "src/lib/payments/migrations.mjs"))
  copyFileSync(join(root, "scripts/orders-admin.mjs"), join(app, "scripts/orders-admin.mjs"))
  const bkdb = join(bk, "bydlight-pre-etapa-b-20261110-100000-1.db")
  makeV3(bkdb)
  const bsha = sum(readFileSync(bkdb))
  writeFileSync(join(bk, "etapa-b-20261110-100000-1.ref"), [
    "ts=20261110-100000-1", `prev_sha=${PREV}`, `target_sha=${TARGET}`, "imagen=bydlight-web:13aaf1750",
    "integrity_check=ok schema_v=3 ordenes=1 pagos_autorizados=1 monto_autorizado=50", `db_backup=${posix(bkdb)}`, `db_backup_sha256=${bsha}`,
  ].join("\n") + "\n")
  makeV3(join(data, "bydlight.db"))
  writeFileSync(join(data, "config/payments.json"), JSON.stringify({ enabled: true, access: "pilot", adminRefunds: false }))
  writeFileSync(join(bin, "docker"), STUB_DOCKER); chmodSync(join(bin, "docker"), 0o755)
  writeFileSync(join(bin, "bd-run"), STUB_EXECUTOR); chmodSync(join(bin, "bd-run"), 0o755)
  const adapt = (f) => {
    const s = readFileSync(join(root, "docs/deploy", f), "utf8")
      .replace(/readonly BACKUP_DIR=.*/, `readonly BACKUP_DIR="${posix(bk)}"`)
      .replace(/readonly CLONE_MIG=.*/, `readonly CLONE_MIG="${posix(app)}/src/lib/payments/migrations.mjs"`)
      .replace(/readonly APP_DIR=.*/, `readonly APP_DIR="${posix(app)}"`)
    const out = join(base, f); writeFileSync(out, s); return posix(out)
  }
  const exec = (f, { deployed = PREV, clone = TARGET } = {}) =>
    spawnSync("bash", ["-c", `id() { echo 0; }; export -f id; export PATH="${posix(bin)}:$PATH" TEST_DATA="${posix(data)}" TEST_TMP="${posix(base)}" ROOT_PRIVATE_DIR="${posix(app)}" FAKE_DEPLOYED=${deployed} FAKE_CLONE=${clone}; bash "${adapt(f)}" ${TARGET}`], { encoding: "utf8" })
  const version = () => { const d = new DatabaseSync(join(data, "bydlight.db"), { readOnly: true }); const v = d.prepare("SELECT MAX(version) v FROM schema_migrations").get().v; d.close(); return v }
  return { exec, bk, data, bkdb, bsha, version }
}

test("MF1. 06 -> 07 con el ejecutor simulado: el ensayo deja marcador, 07 migra la base real a v5 y conserva el pago de 50", { skip: !hasBash }, () => {
  const sb = sandbox("flujo")
  const r6 = sb.exec("06-ensayo-migracion.sh")
  assert.equal(r6.status, 0, r6.stdout + r6.stderr)
  assert.match(r6.stdout, /ENSAYO DE MIGRACION OK/)
  assert.ok(existsSync(join(sb.bk, `ensayo-ok-${TARGET.slice(0, 12)}-${sb.bsha.slice(0, 12)}.txt`)))
  assert.equal(sb.version(), 3) // el ensayo no toco la base viva
  const early = sb.exec("07-aplicar-migraciones.sh", { deployed: PREV })
  assert.notEqual(early.status, 0)
  assert.match(early.stderr, /no esta desplegado/)
  assert.equal(sb.version(), 3)
  const r7 = sb.exec("07-aplicar-migraciones.sh", { deployed: TARGET })
  assert.equal(r7.status, 0, r7.stdout + r7.stderr)
  assert.match(r7.stdout, /migracion: v5/)
  assert.match(r7.stdout, /MIGRACIONES APLICADAS OK/)
  assert.equal(sb.version(), 5)
  const d = new DatabaseSync(join(sb.data, "bydlight.db"), { readOnly: true })
  assert.deepEqual({ ...d.prepare("SELECT COUNT(*) n, SUM(amount) s FROM attempts WHERE status = 'AUTORIZADO'").get() }, { n: 1, s: 50 })
  d.close()
})

test("MF2. 07 no migra sin ensayo, con pagos abiertos al publico ni con el clon equivocado; 06 rechaza un respaldo alterado", { skip: !hasBash }, () => {
  let sb = sandbox("sinensayo")
  let r = sb.exec("07-aplicar-migraciones.sh", { deployed: TARGET })
  assert.notEqual(r.status, 0); assert.match(r.stderr, /falta el marcador del ensayo/); assert.equal(sb.version(), 3)

  sb = sandbox("alterado")
  const f = readFileSync(sb.bkdb); f[f.length - 1] ^= 1; writeFileSync(sb.bkdb, f)
  r = sb.exec("06-ensayo-migracion.sh")
  assert.notEqual(r.status, 0); assert.match(r.stderr, /SHA-256 del respaldo no coincide/)

  sb = sandbox("publico")
  assert.equal(sb.exec("06-ensayo-migracion.sh").status, 0)
  writeFileSync(join(sb.data, "config/payments.json"), JSON.stringify({ enabled: true, access: "public", adminRefunds: false }))
  r = sb.exec("07-aplicar-migraciones.sh", { deployed: TARGET })
  assert.notEqual(r.status, 0); assert.match(r.stderr, /abiertos al publico/); assert.equal(sb.version(), 3)

  sb = sandbox("clon")
  r = sb.exec("06-ensayo-migracion.sh", { clone: PREV })
  assert.notEqual(r.status, 0); assert.match(r.stderr, /el clon del servidor no esta en/)
})

test("MF3. 04 (verificador final) falla sobre la base v3 y pasa tras 07: compara contra el respaldo previo sin perder ordenes ni pagos", { skip: !hasBash }, () => {
  const sb = sandbox("verifica")
  const before = sb.exec("04-verificar-migracion-5.sh", { deployed: TARGET })
  assert.notEqual(before.status, 0, "04 no debe aprobar una base sin migrar")
  assert.match(before.stdout + before.stderr, /esquema no es 5|FALLAS/)
  assert.equal(sb.exec("06-ensayo-migracion.sh").status, 0)
  const r7 = sb.exec("07-aplicar-migraciones.sh", { deployed: TARGET })
  assert.equal(r7.status, 0, r7.stdout + r7.stderr)
  const after = sb.exec("04-verificar-migracion-5.sh", { deployed: TARGET })
  assert.equal(after.status, 0, after.stdout + after.stderr)
  assert.match(after.stdout, /schema_v=5 migraciones_registradas=5/)
  assert.match(after.stdout, /variacion desde el respaldo: ordenes \+0, pagos autorizados \+0, monto \+0/)
  assert.match(after.stdout, /MIGRACION 5 VERIFICADA OK/)
})

test("MF4. Regresion MODULE_NOT_FOUND: 07 no monta el clon privado de root en el contenedor 1000:1000; usa una copia legible con el mismo SHA-256 y la limpia", { skip: !hasBash }, () => {
  const sb = sandbox("modulo")
  assert.equal(sb.exec("06-ensayo-migracion.sh").status, 0)
  const text = readFileSync(join(root, "docs/deploy/07-aplicar-migraciones.sh"), "utf8")
  assert.doesNotMatch(text, /-v\s+"\$APP_DIR[^"]*"\s*:/, "07 no debe montar el clon directamente")
  assert.match(text, /--user 1000:1000/, "el contenedor sigue sin root")
  assert.match(text, /--cap-drop ALL/)
  assert.match(text, /--read-only/)
  const r7 = sb.exec("07-aplicar-migraciones.sh", { deployed: TARGET })
  assert.equal(r7.status, 0, r7.stdout + r7.stderr)
  assert.doesNotMatch(r7.stdout + r7.stderr, /Cannot find module/)
  assert.match(r7.stdout, /orders-admin\.mjs sha256=[0-9a-f]{16}/)
  assert.match(r7.stdout, /MIGRACIONES APLICADAS OK/)
  assert.equal(sb.version(), 5)
})

test("MF5. El simulador reproduce el fallo real: montar el clon privado de root con --user 1000:1000 da Cannot find module", { skip: !hasBash }, () => {
  const sb = sandbox("repro")
  assert.equal(sb.exec("06-ensayo-migracion.sh").status, 0)
  const viejo = readFileSync(join(root, "docs/deploy/07-aplicar-migraciones.sh"), "utf8")
  const a = viejo.indexOf("STAGE=\"$(mktemp"), b = viejo.indexOf("  || { printf")
  const conMontajeDirecto = viejo.slice(0, a) + `OUT="$("\${DR[@]}" --network none -v "$VOL":/data -v "$APP_DIR/scripts":/w/scripts:ro -v "$APP_DIR/src/lib/payments/migrations.mjs":/w/src/lib/payments/migrations.mjs:ro -e PAYMENTS_DB=/data/bydlight.db "$IMG" node /w/scripts/orders-admin.mjs check)" \
` + viejo.slice(b)
  const dst = join(dirname(sb.bkdb), "..", "07-viejo.sh")
  writeFileSync(dst, conMontajeDirecto
    .replace(/readonly BACKUP_DIR=.*/, `readonly BACKUP_DIR="${posix(sb.bk)}"`).replace(/readonly APP_DIR=.*/, `readonly APP_DIR="${posix(join(sb.bk, "..", "app"))}"`))
  const r = spawnSync("bash", ["-c", `id() { echo 0; }; export -f id; export PATH="${posix(join(sb.bk, "..", "bin"))}:$PATH" TEST_DATA="${posix(sb.data)}" TEST_TMP="${posix(join(sb.bk, ".."))}" ROOT_PRIVATE_DIR="${posix(join(sb.bk, "..", "app"))}" FAKE_DEPLOYED=${TARGET} FAKE_CLONE=${TARGET}; bash "${posix(dst)}" ${TARGET}`], { encoding: "utf8" })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /Cannot find module '\/w\/scripts\/orders-admin\.mjs'/)
  assert.equal(sb.version(), 3)
})
