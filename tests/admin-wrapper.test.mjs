// 00-admin.sh (ejecutor de las herramientas administrativas) con docker SIMULADO: reproduce el fallo real de permisos (clon privado de root +
// contenedor uid 1000 sin capacidades => "Cannot find module") y comprueba que la copia legible, de solo lectura y verificada lo resuelve sin
// relajar permisos ni usar root. No toca ningun servidor. npm test
import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, chmodSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const dir = mkdtempSync(join(tmpdir(), "bd-adm-"))
const hasBash = !spawnSync("bash", ["-c", "true"]).error
const posix = (p) => p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)
const KEY = "xkeysib-" + "f0e1d2c3".repeat(6) + "-PRUEBA"
const SCRIPTS = ["admin-remote", "mail-config-set", "payments-config-set", "orders-admin", "setup-payments-config"]

// docker falso: registra los argumentos, resuelve los montajes a directorios locales, traduce /data/..., y EMULA el permiso: si el origen de un
// montaje esta dentro del clon privado de root y el contenedor no es root, node no puede leer y informa "Cannot find module".
const STUB_DOCKER = `#!/usr/bin/env bash
case "$*" in
  *compose.project*) echo bydlight-prod ;;
  *Config.Image*) echo "\${FAKE_IMAGE:-bydlight-web:b28448196fb8}" ;;
  run*)
    printf '%s\\n' "$*" >> "$DOCKER_LOG"
    declare -A MAP; ENVS=(); args=("$@"); i=0; CUSER=0
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
      case "$v" in /data/*) v="$TEST_DATA/\${v#/data/}";; esac
      export "$k=$v"
    done
    script="$1"; shift 1
    for d in "\${!MAP[@]}"; do case "$script" in "$d"/*) script="\${MAP[$d]}\${script#$d}"; break;; esac; done
    if [ "$CUSER" != "0" ] && [ -n "\${ROOT_PRIVATE_DIR:-}" ]; then case "$script" in "$ROOT_PRIVATE_DIR"/*) echo "Error: Cannot find module '$script'" >&2; exit 1 ;; esac; fi
    [ -f "$script" ] || { echo "Error: Cannot find module '$script'" >&2; exit 1; }
    out=(); for a in "$@"; do case "$a" in /data/*) a="$TEST_DATA/\${a#/data/}";; esac; out+=("$a"); done
    exec node "$script" "\${out[@]}" ;;
esac
`

function sandbox(name, { image } = {}) {
  const base = join(dir, name)
  const data = join(base, "data"), app = join(base, "app"), bin = join(base, "bin")
  for (const d of [join(data, "config"), join(app, "src/lib/payments"), join(app, "scripts"), bin]) mkdirSync(d, { recursive: true })
  for (const n of SCRIPTS) copyFileSync(join(root, "scripts", `${n}.mjs`), join(app, "scripts", `${n}.mjs`))
  copyFileSync(join(root, "src/lib/payments/migrations.mjs"), join(app, "src/lib/payments/migrations.mjs"))
  writeFileSync(join(data, "config/payments.json"), JSON.stringify({ enabled: false, access: "pilot", adminRefunds: false, commerceCode: "597000000000", apiKey: "K".repeat(40), adminSecret: "s".repeat(40) }))
  writeFileSync(join(bin, "docker"), STUB_DOCKER); chmodSync(join(bin, "docker"), 0o755)
  const log = join(base, "docker.log")
  writeFileSync(log, "")
  const adapt = (text) => text.replace(/readonly APP_DIR=.*/, `readonly APP_DIR="${posix(app)}"`)
  const run = (script, args, { uid0 = true, text } = {}) => {
    const file = join(base, "00-admin.sh")
    writeFileSync(file, adapt(text ?? readFileSync(join(root, "docs/deploy/00-admin.sh"), "utf8")))
    const idDef = uid0 ? "id() { echo 0; }; export -f id;" : "id() { echo 1000; }; export -f id;"
    const env = `export PATH="${posix(bin)}:$PATH" TEST_DATA="${posix(data)}" ROOT_PRIVATE_DIR="${posix(app)}" DOCKER_LOG="${posix(log)}" ${image ? `FAKE_IMAGE='${image}'` : ""};`
    return spawnSync("bash", ["-c", `${idDef} ${env} bash "${posix(file)}" ${script} ${args}`], { encoding: "utf8", input: "" })
  }
  const stageDirs = () => readFileSync(log, "utf8").split("\n").map((l) => /-v (\S+)\/scripts:\/s:ro/.exec(l)?.[1]).filter(Boolean)
  return { data, app, run, log, stageDirs }
}

test("AW1. payments-config-set --show funciona como uid 1000 con el clon privado de root, sin montar el clon ni usar root", { skip: !hasBash }, () => {
  const sb = sandbox("show")
  const r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.doesNotMatch(r.stdout + r.stderr, /Cannot find module/)
  const j = JSON.parse(r.stdout)
  assert.deepEqual({ enabled: j.enabled, access: j.access, adminRefunds: j.adminRefunds, cred: j.credencialesTransbank, secreto: j.secretoAdministrativo }, { enabled: false, access: "pilot", adminRefunds: false, cred: true, secreto: true })
  assert.doesNotMatch(r.stdout, /KKKK|ssss/) // el resumen no imprime credenciales
  const cmd = readFileSync(sb.log, "utf8")
  assert.match(cmd, /--user 1000:1000/); assert.match(cmd, /--cap-drop ALL/); assert.match(cmd, /--read-only/); assert.match(cmd, /no-new-privileges:true/)
  assert.doesNotMatch(cmd, /--user (0|root)/); assert.doesNotMatch(cmd, /--privileged/)
  assert.ok(!cmd.includes(sb.app.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)), "el clon no se monta en el contenedor")
  assert.match(cmd, /-v \S+\/scripts:\/s:ro/); assert.match(cmd, /-v bydlight-prod_bydlight_data:\/data/)
  assert.match(r.stderr, /preparado scripts\/payments-config-set\.mjs sha256=[0-9a-f]{16}/)
})

test("AW2. payments-config-set cambia enabled/access en el volumen (persistente) y solo esas claves", { skip: !hasBash }, () => {
  const sb = sandbox("cambia")
  let r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=pilot")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const cfg = JSON.parse(readFileSync(join(sb.data, "config/payments.json"), "utf8"))
  assert.deepEqual({ enabled: cfg.enabled, access: cfg.access, adminRefunds: cfg.adminRefunds, apiKey: cfg.apiKey }, { enabled: true, access: "pilot", adminRefunds: false, apiKey: "K".repeat(40) })
  r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json adminRefunds=true")
  assert.notEqual(r.status, 0)
  assert.equal(JSON.parse(readFileSync(join(sb.data, "config/payments.json"), "utf8")).adminRefunds, false)
})

test("AW3. mail-config-set: --show no imprime la clave; --init sin terminal no pide ni acepta la clave por argumentos y no escribe nada", { skip: !hasBash }, () => {
  const sb = sandbox("mail")
  writeFileSync(join(sb.data, "config/mail.json"), JSON.stringify({ provider: "brevo", apiKey: KEY, enabled: false }))
  let r = sb.run("", "node /s/mail-config-set.mjs /data/config/mail.json --show")
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(JSON.parse(r.stdout).claveApiBrevo, true)
  assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY))
  r = sb.run("--tty", "node /s/mail-config-set.mjs /data/config/mail.json --init")
  assert.notEqual(r.status, 0) // sin terminal real (aqui stdin no es TTY): se niega en vez de aceptar la clave por otra via
  assert.match(r.stderr, /Falta la clave/)
  assert.equal(JSON.parse(readFileSync(join(sb.data, "config/mail.json"), "utf8")).apiKey, KEY)
  assert.ok(!readFileSync(sb.log, "utf8").includes(KEY))
  r = sb.run("", "node /s/mail-config-set.mjs /data/config/mail.json enabled=true")
  assert.equal(r.status, 0); assert.equal(JSON.parse(readFileSync(join(sb.data, "config/mail.json"), "utf8")).enabled, true)
})

test("AW4. admin-remote y orders-admin (que importa ../src/lib/payments/migrations.mjs) cargan como uid 1000", { skip: !hasBash }, () => {
  const sb = sandbox("otros")
  let r = sb.run("", "node /s/admin-remote.mjs")
  assert.doesNotMatch(r.stdout + r.stderr, /Cannot find module/)
  assert.match(r.stdout + r.stderr, /Falta el secreto administrativo/) // el script carga y llega a su propia validacion
  r = sb.run("", "node /w/scripts/orders-admin.mjs check")
  assert.doesNotMatch(r.stdout + r.stderr, /Cannot find module/)
  assert.ok(!/ERR_MODULE_NOT_FOUND/.test(r.stderr), r.stderr)
})

test("AW5. el directorio temporal con las copias se crea legible (755/644), es de solo lectura en el contenedor y se borra al terminar, tambien si el comando falla", { skip: !hasBash }, () => {
  const sb = sandbox("limpieza")
  assert.equal(sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show").status, 0)
  assert.match(readFileSync(sb.log, "utf8"), /-v \S+:\/w:ro/)
  for (const s of sb.stageDirs()) assert.ok(!existsSync(s), `queda ${s}`)
  const r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json adminRefunds=true")
  assert.notEqual(r.status, 0)
  for (const s of sb.stageDirs()) assert.ok(!existsSync(s), `queda ${s} tras un fallo`)
  const mk = readFileSync(join(root, "docs/deploy/00-admin.sh"), "utf8")
  assert.match(mk, /chmod 0755 "\$STAGE"/); assert.match(mk, /install -m 0644/); assert.match(mk, /trap cleanup EXIT/)
})

test("AW6. rechaza comandos fuera de la lista cerrada, no-root, imagen o contenedor inesperados; --print no prepara nada", { skip: !hasBash }, () => {
  const sb = sandbox("rechazos")
  const bad = ["node -e 'process.exit(0)'", "node /s/../etc/passwd.mjs x", "node /s/otro.mjs", "node /tmp/x.mjs", "sh /s/admin-remote.mjs", "node /w/scripts/../x.mjs", "node /s/admin-remote.js"]
  for (const c of bad) { const r = sb.run("", c); assert.notEqual(r.status, 0, c); assert.equal(readFileSync(sb.log, "utf8"), "", `no debe ejecutar docker: ${c}`) }
  let r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show", { uid0: false })
  assert.notEqual(r.status, 0); assert.match(r.stderr, /ejecute como root/)
  const sb2 = sandbox("imagen", { image: "bydlight-web:latest" })
  r = sb2.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show")
  assert.notEqual(r.status, 0); assert.match(r.stderr, /imagen inesperada/)
  const sb3 = sandbox("imprimir")
  r = sb3.run("--print", "node /s/admin-remote.mjs list")
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /--user 1000:1000/); assert.doesNotMatch(r.stderr, /preparado/)
  assert.equal(readFileSync(sb3.log, "utf8"), "")
})

test("AW7. un script ausente del clon, un enlace simbolico o un migrations.mjs ausente se rechazan antes de ejecutar", { skip: !hasBash }, () => {
  const sb = sandbox("faltantes")
  writeFileSync(join(sb.app, "scripts", "mail-config-set.mjs"), "")
  spawnSync("bash", ["-c", `rm -f "${posix(join(sb.app, "src/lib/payments/migrations.mjs"))}"`])
  const r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show")
  assert.notEqual(r.status, 0); assert.match(r.stderr, /falta .*migrations\.mjs/)
  assert.equal(readFileSync(sb.log, "utf8"), "")
  assert.deepEqual(readdirSync(tmpdir()).filter((n) => n.startsWith("bd-admin-")), [])
})

test("AW8. Regresion: la version anterior (monta el clon privado de root) reproduce Cannot find module; la actual no", { skip: !hasBash || spawnSync("git", ["cat-file", "-e", "776df68:docs/deploy/00-admin.sh"], { cwd: root }).status !== 0 }, () => {
  const viejo = spawnSync("git", ["show", "776df68:docs/deploy/00-admin.sh"], { cwd: root, encoding: "utf8" }).stdout
  const sb = sandbox("viejo")
  const r = sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show", { text: viejo })
  assert.notEqual(r.status, 0)
  assert.match(r.stdout + r.stderr, /Cannot find module/)
  assert.equal(sb.run("", "node /s/payments-config-set.mjs /data/config/payments.json --show").status, 0)
})

test("AW9. las guias operativas ya no montan el clon directamente (-v .../app/scripts:/s o /w/scripts)", () => {
  for (const f of ["BYDLIGHT-ETAPA-B-ACTIVACION.md", "BREVO-CLAVE-API-PASOS.md", "DESPLIEGUE-WEBPAY-UBUNTU.md", "BYDLIGHT-ETAPA-A-HANDOFF-TI.md", "ETAPA-C-OPERACION-COMERCIAL.md"]) {
    const t = readFileSync(join(root, "docs", f), "utf8")
    const vivo = t.split("\n").filter((l) => !/historico|obsoleto|NO use|no use/i.test(l))
    assert.ok(!vivo.some((l) => /-v\s+\S*\/srv\/bydlight-prod\/app\/scripts:\/(s|w\/scripts)/.test(l)), `${f} aun monta el clon directamente`)
  }
})
