// 08-backup-release-final.sh con docker, bd-run y curl SIMULADOS (no toca ningun servidor): respaldo consistente de una base SQLite real v5,
// rechazos seguros (esquema distinto, SHA desplegado distinto, adminRefunds, mail.json ausente) y garantia de no modificar el origen
// ni dejar archivos parciales. npm test
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { DatabaseSync } from "node:sqlite"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const hasBash = !spawnSync("bash", ["-c", "command -v cygpath >/dev/null || [ \"$(uname)\" = Linux ]"]).error
const posix = (p) => p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)
const PREV = "b28448196fb89f9814621a709475029ae086dd21"
const TARGET = "a".repeat(40)
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex")

const STUB_DOCKER = `#!/usr/bin/env bash
w() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
case "$1" in
  inspect)
    case "$*" in
      *compose.project*) echo bydlight-prod ;;
      *State.Running*) echo true ;;
      *Health.Status*) echo healthy ;;
      *Config.Image*) echo "bydlight-web:\${FAKE_IMG_TAG:-b28448196fb8}" ;;
      *Mounts*) echo "bydlight-prod_bydlight_data|/data|true" ;;
    esac ;;
  volume) echo "$FAKE_VOL" ;;
  run)
    shift
    ENVS=()
    while [ $# -gt 0 ]; do
      case "$1" in
        -e) ENVS+=("$2"); shift 2 ;;
        -v|--user|--tmpfs|--network|--pids-limit|--memory|--security-opt|--cap-drop) shift 2 ;;
        -*) shift ;;
        *) break ;;
      esac
    done
    shift                       # imagen
    [ "$1" = node ] && [ "$2" = -e ] || exit 9
    JS="$3"
    for kv in "\${ENVS[@]}"; do
      k="\${kv%%=*}"; v="\${kv#*=}"
      case "$v" in /data*) v="$(w "$FAKE_VOL")\${v#/data}" ;; /tmp) v="$(w "$(mktemp -d -p "$FAKE_TMP")")" ;; esac   # tmpfs nuevo en cada docker run, como el real
      export "$k=$v"
    done
    node -e "$JS" ;;
  *) echo "docker falso: no soportado: $*" >&2; exit 9 ;;
esac
`

function makeEnv({ schema = 5, deployed = PREV, mail = true, refunds = false, enabled = true, access = "public" } = {}) {
  const d = mkdtempSync(join(tmpdir(), "bd-bkf-"))
  const vol = join(d, "vol"), bk = join(d, "backups"), bin = join(d, "bin"), tmp = join(d, "tmp")
  for (const x of [vol, join(vol, "config"), bk, bin, tmp]) mkdirSync(x, { recursive: true })
  const db = new DatabaseSync(join(vol, "bydlight.db"))
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY); CREATE TABLE orders (id TEXT); CREATE TABLE attempts (id TEXT, status TEXT, amount INTEGER)")
  for (let v = 1; v <= schema; v++) db.prepare("INSERT INTO schema_migrations VALUES (?)").run(v)
  db.prepare("INSERT INTO orders VALUES ('ABCDEFGHJKMN')").run()
  db.prepare("INSERT INTO attempts VALUES ('a1','AUTORIZADO',50)").run()
  db.close()
  writeFileSync(join(vol, "config", "payments.json"), JSON.stringify({ enabled, access, adminRefunds: refunds, commerceCode: "SECRETO-NO-IMPRIMIR", apiKey: "CLAVE-NO-IMPRIMIR" }))
  if (mail) writeFileSync(join(vol, "config", "mail.json"), JSON.stringify({ enabled: true, apiKey: "xkeysib-NO-IMPRIMIR" }))
  const put = (name, body) => { writeFileSync(join(bin, name), body); chmodSync(join(bin, name), 0o755) }
  put("docker", STUB_DOCKER)
  put("id", "#!/usr/bin/env bash\necho 0\n")
  put("curl", "#!/usr/bin/env bash\necho 200\n")
  put("bd-run", `#!/usr/bin/env bash\n[ "$1" = status ] || { echo "bd-run falso: solo status" >&2; exit 9; }\nprintf 'desplegado: ${deployed}\\nclon en: ${deployed}\\nsalud: OK\\n'\n`)
  // Copia del script bajo prueba con rutas locales; sin -o root (no hay root) y sin exigir Node 22 exacto (el equipo de pruebas puede tener otro).
  const script = readFileSync(join(root, "docs/deploy/08-backup-release-final.sh"), "utf8")
    .replace('readonly BACKUP_DIR="/srv/bydlight-prod/backups"', `readonly BACKUP_DIR="${posix(bk)}"`)
    .replace(/ -o root -g root/g, "")
    .replace("autoprueba node=22\\.", "autoprueba node=[0-9]+\\.")
  writeFileSync(join(d, "08.sh"), script)
  return { d, vol, bk, bin, tmp, script: join(d, "08.sh") }
}

function run(e, sha40 = TARGET, extraEnv = {}) {
  return spawnSync("bash", [posix(e.script), ...(sha40 === null ? [] : [sha40])], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${posix(e.bin)}:${process.env.PATH}`, FAKE_VOL: posix(e.vol), FAKE_TMP: posix(e.tmp), ...extraEnv },
  })
}
const files = (e) => readdirSync(e.bk).sort()

test("BK1. respaldo correcto: base consistente v5 fuera del volumen, integridad ok, origen intacto, sin secretos en la salida", { skip: !hasBash }, () => {
  const e = makeEnv()
  const antes = readFileSync(join(e.vol, "config", "payments.json"), "utf8")
  const r = run(e)
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /RESPALDO RELEASE FINAL OK/)
  assert.match(r.stdout, /integrity_check=ok schema_v=5 ordenes=1 pagos_autorizados=1 monto_autorizado=50/)
  assert.match(r.stdout, /enabled=true access=public adminRefunds=false/)
  const f = files(e)
  assert.equal(f.filter((x) => /^bydlight-pre-release-final-.*\.db$/.test(x)).length, 1)
  assert.equal(f.filter((x) => /^payments\.json\.pre-release-final-/.test(x)).length, 1)
  assert.equal(f.filter((x) => /^mail\.json\.pre-release-final-/.test(x)).length, 1)
  assert.equal(f.filter((x) => /^release-final-.*\.ref$/.test(x)).length, 1)
  assert.ok(!f.some((x) => x.endsWith(".partial")), "sin parciales")
  // la copia de la base es una base SQLite valida e independiente
  const copy = new DatabaseSync(join(e.bk, f.find((x) => x.endsWith(".db"))), { readOnly: true })
  assert.equal(copy.prepare("PRAGMA integrity_check").get().integrity_check, "ok")
  assert.equal(copy.prepare("SELECT MAX(version) AS v FROM schema_migrations").get().v, 5)
  copy.close()
  // el origen no se modifico, no quedo el temporal en el volumen y la salida no contiene secretos
  assert.ok(!readdirSync(e.vol).some((x) => x.startsWith(".bk-")), "temporal borrado del volumen")
  assert.equal(readFileSync(join(e.vol, "config", "payments.json"), "utf8"), antes, "payments.json no se modifica")
  assert.doesNotMatch(r.stdout + r.stderr, /SECRETO-NO-IMPRIMIR|CLAVE-NO-IMPRIMIR|xkeysib/)
  const ref = readFileSync(join(e.bk, f.find((x) => x.endsWith(".ref"))), "utf8")
  assert.match(ref, new RegExp(`prev_sha=${PREV}`))
  assert.match(ref, new RegExp(`target_sha=${TARGET}`))
  assert.ok(ref.includes("db_backup_sha256=" + sha(join(e.bk, f.find((x) => x.endsWith(".db"))))), "el .ref registra la huella real del respaldo")
})

test("BK2. rechaza con seguridad: esquema distinto de v5, SHA desplegado distinto, mail.json ausente, adminRefunds=true, imagen ajena", { skip: !hasBash }, () => {
  const casos = [
    [{ schema: 4 }, /version de esquema 4/],
    [{ schema: 3 }, /version de esquema 3/],
    [{ deployed: "c".repeat(40) }, /el SHA desplegado no es/],
    [{ mail: false }, /mail\.json/],
    [{ refunds: true }, /adminRefunds esta activado/],
  ]
  for (const [opts, re] of casos) {
    const e = makeEnv(opts)
    const r = run(e)
    assert.notEqual(r.status, 0, JSON.stringify(opts))
    assert.match(r.stderr, re, JSON.stringify(opts))
    assert.match(r.stderr, /RESPALDO RELEASE FINAL FALLO/)
    assert.doesNotMatch(r.stdout, /RESPALDO RELEASE FINAL OK/)
    assert.ok(!files(e).some((x) => x.endsWith(".partial")), "sin parciales: " + JSON.stringify(opts))
    assert.ok(!readdirSync(e.vol).some((x) => x.startsWith(".bk-")), "sin temporal en el volumen: " + JSON.stringify(opts))
  }
  const e = makeEnv()
  const r = run(e, TARGET, { FAKE_IMG_TAG: "000000000000" })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /no corresponde a b28448196fb8/)
})

test("BK3. argumentos: exige SHA de 40 hex y rechaza el SHA ya desplegado; no se ejecuta sin root", { skip: !hasBash }, () => {
  const e = makeEnv()
  for (const bad of [null, "abc", "Z".repeat(40), PREV]) {
    const r = run(e, bad)
    assert.notEqual(r.status, 0, String(bad))
    assert.doesNotMatch(r.stdout, /OK/)
  }
  writeFileSync(join(e.bin, "id"), "#!/usr/bin/env bash\necho 1000\n")
  const r = run(e)
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /ejecute como root/)
  assert.deepEqual(files(e), [])
})

test("BK4. nunca sobrescribe ni borra respaldos anteriores y las ejecuciones sucesivas generan archivos nuevos", { skip: !hasBash }, () => {
  const e = makeEnv()
  writeFileSync(join(e.bk, "bydlight-pre-etapa-b-ANTERIOR.db"), "respaldo anterior")
  const r1 = run(e)
  assert.equal(r1.status, 0, r1.stderr)
  const r2 = run(e)
  assert.equal(r2.status, 0, r2.stderr)
  const f = files(e)
  assert.ok(f.includes("bydlight-pre-etapa-b-ANTERIOR.db"))
  assert.equal(readFileSync(join(e.bk, "bydlight-pre-etapa-b-ANTERIOR.db"), "utf8"), "respaldo anterior")
  assert.equal(f.filter((x) => /^bydlight-pre-release-final-.*\.db$/.test(x)).length, 2)
})

test("BK5. analisis estatico: solo lee produccion; ninguna operacion de despliegue, migracion ni borrado fuera de sus temporales", () => {
  const full = readFileSync(join(root, "docs/deploy/08-backup-release-final.sh"), "utf8")
  const s = full.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n") // sin comentarios
  assert.match(s, /readonly ACCEPTED_SCHEMAS="5"/)
  assert.match(s, /readonly PREV_SHA="b28448196fb89f9814621a709475029ae086dd21"/)
  assert.match(s, /\{ readOnly: true \}/)
  assert.match(s, /VACUUM INTO/)
  assert.match(s, /mv -n -T/)
  assert.match(s, /install -m 600 -o root -g root/)
  assert.doesNotMatch(s, /bd-run (up|build|fetch|rollback|accept)/)
  assert.doesNotMatch(s, /docker (compose|stop|restart|rm|volume rm|system)/)
  assert.doesNotMatch(s, /orders-admin|payments-config-set|mail-config-set|migrate|DROP |DELETE FROM/)
  const rms = s.split("\n").filter((l) => /(^|[\s;(])rm\s/.test(l) && !/docker run/.test(l) && !l.includes("--rm") && !l.trim().startsWith("#"))
  for (const l of rms) assert.match(l, /rm -f -- ("\$MP\/\$DB_TMP_NAME"|"\$f")/, l)
  assert.doesNotMatch(s, /\$\{?(TS|DEST_\w+)\}?[^\n]*\bmv -f\b/)
})
