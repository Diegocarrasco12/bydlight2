#!/usr/bin/env bash
# Instalador TRANSACCIONAL y reversible del ejecutor de despliegue restringido de bydlight2 (bd-deploy).
# Lo ejecuta el ADMINISTRADOR a mano, en el servidor, como root. Por defecto solo MUESTRA el plan (no cambia nada).
#
#   sudo bash install.sh --policy /ruta/policy.json --admin-user <USUARIO_ADMIN> --pubkey-file /ruta/bddeploy.pub          # plan
#   sudo bash install.sh --policy ... --admin-user ... --pubkey-file ... --apply                                         # aplica
#   sudo bash install.sh --verify                                                                                        # autoprueba
#
# Que crea (y NADA mas): los wrappers bd-gate/bd-run/bd-approve, la politica, una clave de deploy de solo lectura, el
# estado y la auditoria, una regla sudoers con UNA linea por operacion permitida (sin `bd-run` a secas ni comodines `*`),
# y un bloque sshd limitado al usuario `bddeploy` (que el administrador ya creo: sin sudo, sin grupo docker, nologin).
# NO toca Docker, contenedores, redes, volumenes, cloudflared, nginx, firewall, oe-deploy ni archivos de otros proyectos.
# --apply es una TRANSACCION: si algo falla (incluida la autoprueba final o una diferencia en la configuracion efectiva
# de sshd de otros usuarios) se revierte todo y se verifica que no quedo nada. Deshacer lo ya instalado: uninstall.sh.
set -Eeuo pipefail
umask 022

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-txn.sh
. "$SRC/lib-txn.sh"

APPLY=0; VERIFY=0; POLICY=""; ADMIN_USER=""; PUBKEY=""; KNOWN_HOSTS_FROM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --plan) APPLY=0 ;;
    --verify) VERIFY=1 ;;
    --policy) POLICY="${2:?}"; shift ;;
    --admin-user) ADMIN_USER="${2:?}"; shift ;;
    --pubkey-file) PUBKEY="${2:?}"; shift ;;
    --known-hosts-from) KNOWN_HOSTS_FROM="${2:?}"; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

BDUSER=bddeploy
BDHOME=/var/lib/bd-deploy-home
LIBDIR=/usr/local/lib/bd-deploy
SBIN=/usr/local/sbin
ETC=/etc/bd-deploy
STATE=/var/lib/bd-deploy
LOGDIR=/var/log/bd-deploy
SUDOERS=/etc/sudoers.d/bd-deploy
SSHD_DROPIN=/etc/ssh/sshd_config.d/50-bd-deploy.conf
AUTHKEYS=$BDHOME/.ssh/authorized_keys
INSTALL_LOCK=/run/lock/bd-deploy-install.lock
PY=$(command -v python3 || command -v python || true)
SSHD_RELOADED=0
SNAP_DIR=""

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
step() { say "  - $1"; }
is_root() { [ "$(id -u)" -eq 0 ]; }
policy_get() { "$PY" -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d[sys.argv[2]][sys.argv[3]])' "${POLICY_FILE:-$ETC/policy.json}" "$1" "$2"; }
as_bd() { runuser -u "$BDUSER" -- "$@"; }
octal_and() { printf '%d' "$(( 8#$1 & 8#$2 ))"; }   # mode & mascara (ambos en octal)

# ------------------------------------------------------------------------------------------------------------------
# Comprobaciones de rutas, propietarios y permisos
# ------------------------------------------------------------------------------------------------------------------
PF_FAIL=0
pf_ok()   { say "  OK     $*"; }
pf_fail() {
  if is_root; then say "  FALLA  $*"; PF_FAIL=$((PF_FAIL + 1)); else say "  AVISO  (sin root: no cuenta; en el servidor se evalua) $*"; fi
}
pf_skip() { say "  OMITE  $*"; }

# perm_is <ruta> <propietario:grupo|propietario> <modo>   (0 = coincide, 1 = difiere, 2 = no existe)
perm_is() {
  local fmt='%U:%G %a' want="$2" got
  case "$want" in *:*) ;; *) fmt='%U %a' ;; esac
  got=$(stat -c "$fmt" -- "$1" 2>/dev/null) || return 2
  [ "$got" = "$want $3" ]
}

preflight_env() {
  local APP_PARENT; APP_PARENT=$(dirname "$APP_DIR")
  say "== comprobaciones previas de rutas, propietarios y permisos (solo lectura) =="
  if ! is_root; then pf_skip "algunas comprobaciones requieren root y se omiten (ejecute con sudo para el plan completo)"; fi

  # --- usuario de servicio ---
  if id "$BDUSER" >/dev/null 2>&1; then
    local uid shell home
    uid=$(id -u "$BDUSER"); shell=$(getent passwd "$BDUSER" | cut -d: -f7); home=$(getent passwd "$BDUSER" | cut -d: -f6)
    if [ "$uid" -ge 100 ]; then pf_ok "$BDUSER existe (uid $uid)"; else pf_fail "uid de $BDUSER ($uid) no es de cuenta de servicio"; fi
    if [ "$shell" = "/usr/sbin/nologin" ]; then pf_ok "shell nologin"; else pf_fail "la shell de $BDUSER es '$shell' (debe ser /usr/sbin/nologin)"; fi
    if id -nG "$BDUSER" | tr ' ' '\n' | grep -qxE 'docker|sudo|adm|root|lxd|disk|shadow'; then pf_fail "$BDUSER pertenece a un grupo privilegiado ($(id -nG "$BDUSER"))"; else pf_ok "sin grupos privilegiados ($(id -nG "$BDUSER"))"; fi
    if is_root; then
      if passwd -S "$BDUSER" 2>/dev/null | awk '{print $2}' | grep -qE '^(L|LK)$'; then pf_ok "contrasena bloqueada"; else pf_fail "la contrasena de $BDUSER NO esta bloqueada"; fi
      if sudo -n -l -U "$BDUSER" 2>/dev/null | grep -qE 'NOPASSWD|\(ALL'; then pf_fail "$BDUSER ya tiene reglas sudo previas"; else pf_ok "sin reglas sudo previas"; fi
    fi
    if [ "$home" = "$BDHOME" ]; then pf_ok "home = $BDHOME"; else pf_fail "el home de $BDUSER es '$home' (debe ser $BDHOME)"; fi
    if [ -d "$BDHOME" ] && [ "$(stat -c %U -- "$BDHOME")" = "$BDUSER" ] && [ "$(octal_and "$(stat -c %a -- "$BDHOME")" 022)" -eq 0 ]; then
      pf_ok "$BDHOME pertenece a $BDUSER y no es escribible por grupo/otros (sshd StrictModes)"
    else pf_fail "$BDHOME debe ser de $BDUSER y sin escritura para grupo/otros"; fi
    if [ -d "$BDHOME/.ssh" ] && [ "$(stat -c %U -- "$BDHOME/.ssh")" = "$BDUSER" ] && [ "$(octal_and "$(stat -c %a -- "$BDHOME/.ssh")" 077)" -eq 0 ]; then
      pf_ok "$BDHOME/.ssh pertenece a $BDUSER con modo $(stat -c %a -- "$BDHOME/.ssh")"
    else pf_fail "$BDHOME/.ssh debe existir, ser de $BDUSER y modo 700"; fi
    if [ -s "$AUTHKEYS" ]; then pf_fail "$AUTHKEYS ya tiene contenido: no se sobrescribe (revise a mano)"; else pf_ok "$AUTHKEYS vacio o ausente (la clave aun no esta autorizada)"; fi
  else
    if is_root; then pf_fail "el usuario $BDUSER no existe (debe crearlo el administrador antes)"; else pf_skip "usuario $BDUSER (requiere el servidor)"; fi
  fi

  # --- destinos libres: no debe haber restos de otra instalacion ---
  local p busy=0
  for p in "$LIBDIR" "$ETC" "$STATE" "$LOGDIR" "$SUDOERS" "$SSHD_DROPIN" "$SBIN/bd-gate" "$SBIN/bd-run" "$SBIN/bd-approve"; do
    if [ -e "$p" ] || [ -L "$p" ]; then pf_fail "ya existe $p (restos de otra instalacion: use uninstall.sh)"; busy=1; fi
  done
  [ "$busy" -eq 0 ] && pf_ok "no existen restos de bd-deploy (wrappers, politica, estado, sudoers, bloque sshd)"
  if [ -e "$APP_PARENT" ]; then
    if [ -d "$APP_PARENT" ] && [ "$(stat -c %U:%G -- "$APP_PARENT")" = "root:root" ] && [ -z "$(ls -A -- "$APP_PARENT" 2>/dev/null)" ]; then pf_ok "$APP_PARENT existe, es de root y esta vacio"
    else pf_fail "$APP_PARENT ya existe y no esta vacio o no es root:root"; fi
  else
    if [ -d /srv ]; then pf_ok "$APP_PARENT no existe (se creara root:root 755)"; else pf_fail "/srv no existe"; fi
  fi

  # --- sudo / sshd: que los includes necesarios existan ---
  if [ -d /etc/sudoers.d ]; then pf_ok "/etc/sudoers.d existe"; else pf_fail "/etc/sudoers.d no existe"; fi
  if is_root; then
    if grep -qE '^[#@]includedir[[:space:]]+/etc/sudoers\.d' /etc/sudoers 2>/dev/null; then pf_ok "/etc/sudoers incluye /etc/sudoers.d"; else pf_fail "/etc/sudoers no incluye /etc/sudoers.d (la regla no tendria efecto)"; fi
    if grep -qiE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/\*\.conf' /etc/ssh/sshd_config 2>/dev/null; then pf_ok "sshd_config incluye /etc/ssh/sshd_config.d/*.conf"; else pf_fail "sshd_config NO incluye sshd_config.d/*.conf (el bloque Match no tendria efecto)"; fi
    if sshd -t 2>/dev/null; then pf_ok "sshd -t valida la configuracion actual"; else pf_fail "sshd -t falla con la configuracion actual"; fi
    local eff; eff=$(sshd -T -C "user=$BDUSER,host=localhost,addr=127.0.0.1" 2>/dev/null || true)
    if printf '%s\n' "$eff" | grep -qiE '^(allowusers|allowgroups|denyusers|denygroups) '; then
      pf_fail "sshd tiene Allow/DenyUsers/Groups: revise que $BDUSER pueda entrar ($(printf '%s\n' "$eff" | grep -iE '^(allowusers|allowgroups|denyusers|denygroups) ' | tr '\n' ';'))"
    else pf_ok "sshd no restringe usuarios con AllowUsers/AllowGroups/DenyUsers/DenyGroups"; fi
    printf '%s\n' "$eff" | grep -qi '^pubkeyauthentication yes' && pf_ok "PubkeyAuthentication yes" || pf_fail "PubkeyAuthentication no esta activo"
    if id oedeploy >/dev/null 2>&1; then pf_ok "oedeploy existe: sus reglas sshd/sudoers NO se tocan (se compara su configuracion efectiva antes y despues)"; fi
  fi

  # --- docker, puerto, disco ---
  if command -v docker >/dev/null 2>&1; then
    local v; v=$(docker compose version --short 2>/dev/null || true)
    if [ -n "$v" ] && [ "$(printf '%s\n2.20\n' "${v#v}" | sort -V | head -1)" = "2.20" ]; then pf_ok "docker compose $v (>= 2.20)"; else pf_fail "docker compose '$v' no cumple >= 2.20"; fi
    if is_root; then docker info >/dev/null 2>&1 && pf_ok "el daemon de Docker responde" || pf_fail "el daemon de Docker no responde"; fi
  else pf_fail "docker no esta instalado"; fi
  if command -v ss >/dev/null 2>&1; then
    if [ -z "$(ss -ltnH "( sport = :$PORT )" 2>/dev/null)" ]; then pf_ok "el puerto $PORT esta libre"; else pf_fail "el puerto $PORT ya esta en uso"; fi
  fi
  if command -v df >/dev/null 2>&1 && [ -d /srv ]; then
    local free; free=$(df -Pk /srv 2>/dev/null | awk 'NR==2 {print int($4/1048576)}' || true)
    if [ -n "$free" ] && [ "$free" -ge 10 ]; then pf_ok "${free} GB libres en /srv"; elif [ -n "$free" ]; then pf_fail "solo ${free} GB libres en /srv (minimo 10)"; fi
  fi
  say "  resumen de comprobaciones previas: $PF_FAIL falla(s)"
}

# ------------------------------------------------------------------------------------------------------------------
# Compatibilidad sshd: la configuracion EFECTIVA de todos los demas usuarios no debe cambiar
# ------------------------------------------------------------------------------------------------------------------
snap_sshd() { # $1 = directorio de salida
  local u addr users
  mkdir -p -- "$1"
  users=$( { getent passwd | awk -F: '$3>=900 && $3<65000 {print $1}'; echo "$ADMIN_USER"; echo oedeploy; echo zz-usuario-inexistente; } | sort -u | grep -vx "$BDUSER" || true )
  for u in $users; do
    for addr in 127.0.0.1 203.0.113.9; do
      sshd -T -C "user=$u,host=localhost,addr=$addr" > "$1/$u.$addr" 2>/dev/null || true
    done
  done
}

# ------------------------------------------------------------------------------------------------------------------
# Autoprueba de aislamiento. Cada comprobacion es UNA funcion con resultado explicito (0 pasa, 2 omitida, otro falla);
# los negativos exigen el motivo concreto (p. ej. exit 126 de bd-gate) y hay controles positivos para que una falla
# del propio arnes (runuser que no funciona, ruta inexistente) no se confunda con "denegado".
# ------------------------------------------------------------------------------------------------------------------
V_OK=0; V_BAD=0; V_SKIP=0; V_WARN=0
chk() { # chk "descripcion" funcion [args...]
  local desc="$1" rc; shift
  if "$@" >/dev/null 2>&1; then rc=0; else rc=$?; fi
  case "$rc" in
    0) say "  PASA   $desc"; V_OK=$((V_OK + 1)) ;;
    2) say "  OMITE  $desc (la ruta no existe)"; V_SKIP=$((V_SKIP + 1)) ;;
    *) say "  FALLA  $desc"; V_BAD=$((V_BAD + 1)) ;;
  esac
}
# Como chk, pero un resultado negativo es solo un AVISO: se usa para condiciones PREEXISTENTES de otros proyectos del
# servidor (p. ej. un directorio legible por todos) que bd-deploy no creo ni debe corregir; no deben abortar la instalacion.
chkw() {
  local desc="$1" rc; shift
  if "$@" >/dev/null 2>&1; then rc=0; else rc=$?; fi
  case "$rc" in
    0) say "  PASA   $desc"; V_OK=$((V_OK + 1)) ;;
    2) say "  OMITE  $desc (la ruta no existe)"; V_SKIP=$((V_SKIP + 1)) ;;
    *) say "  AVISO  $desc  <- condicion PREEXISTENTE ajena a bd-deploy (revisela; no bloquea la instalacion)"; V_WARN=$((V_WARN + 1)) ;;
  esac
}
p_true() { "$@"; }
p_not_in_groups() { local g; for g in "$@"; do if id -nG "$BDUSER" | tr ' ' '\n' | grep -qx "$g"; then return 1; fi; done; return 0; }
p_no_access() { # la cuenta de servicio no puede leer, escribir ni atravesar la ruta (si no existe: omitida)
  [ -e "$1" ] || return 2
  if as_bd test -r "$1" || as_bd test -w "$1" || as_bd test -x "$1"; then return 1; fi
  return 0
}
p_no_write() { [ -e "$1" ] || return 2; if as_bd test -w "$1"; then return 1; fi; return 0; }
p_can_read() { as_bd test -r "$1"; }
p_cmd_fails() { if as_bd "$@" >/dev/null 2>&1; then return 1; fi; return 0; }
p_sudo_denied() { # sudo -n <args> debe ser rechazado POR SUDO (no por otro error)
  local out rc
  out=$(as_bd env LC_ALL=C sudo -n "$@" 2>&1); rc=$?
  [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -qiE 'not allowed|password is required|may not run|sorry'
}
p_gate_rejects() { # bd-gate debe rechazar con exit 126 y su mensaje
  local out rc
  out=$(as_bd env SSH_ORIGINAL_COMMAND="$1" "$SBIN/bd-gate" 2>&1); rc=$?
  [ "$rc" -eq 126 ] && printf '%s' "$out" | grep -q 'bd-gate: rechazado'
}
p_gate_rejects_nocmd() {
  local out rc
  out=$(as_bd env -u SSH_ORIGINAL_COMMAND "$SBIN/bd-gate" 2>&1); rc=$?
  [ "$rc" -eq 126 ] && printf '%s' "$out" | grep -q 'bd-gate: rechazado'
}
p_gate_accepts() { as_bd env SSH_ORIGINAL_COMMAND="$1" "$SBIN/bd-gate"; }
p_sudo_surface() { # la superficie de sudo de bddeploy es EXACTAMENTE la generada por bd_lib (nada mas)
  as_bd sudo -n -l 2>/dev/null | "$PY" -I -c '
import re, sys
sys.path.insert(0, sys.argv[1])
import bd_lib
txt = sys.stdin.read()
rules = [l for l in txt.splitlines() if re.match(r"^\s*\(", l)]
if len(rules) != 1 or "(root) NOPASSWD:" not in rules[0].replace("(root : root)", "(root)"):
    sys.exit("reglas inesperadas: %r" % rules)
m = re.search(r"NOPASSWD:\s*(.*)", " ".join(txt.split()))
got = {c.strip() for c in re.split(r",\s*", m.group(1)) if c.strip()}
want = set(bd_lib.sudoers_commands(sys.argv[2]))
sys.exit(0 if got == want else "difiere: sobran %r faltan %r" % (sorted(got - want)[:3], sorted(want - got)[:3]))
' "$LIBDIR" "$SBIN/bd-run"
}
p_forcecommand_for() { sshd -T -C "user=$1,host=localhost,addr=127.0.0.1" 2>/dev/null | grep -qi "^forcecommand $SBIN/bd-gate"; }
p_forcecommand_not_for() { if p_forcecommand_for "$1"; then return 1; fi; return 0; }
p_perm() { perm_is "$1" "$2" "$3"; }

audit_perms() {
  local row path own mode
  # ruta  propietario[:grupo]  modo
  while read -r path own mode; do
    [ -n "$path" ] || continue
    chk "permisos $path = $own $mode" p_perm "$path" "$own" "$mode"
  done <<EOT
$LIBDIR root:root 755
$LIBDIR/bd_lib.py root:root 644
$LIBDIR/bd_ops.py root:root 644
$SBIN/bd-gate root:root 755
$SBIN/bd-run root:root 700
$SBIN/bd-approve root:root 700
$ETC root:root 755
$ETC/policy.json root:root 644
$ETC/keys root:root 700
$ETC/keys/prod_deploy root:root 600
$ETC/keys/prod_deploy.pub root:root 644
$ETC/known_hosts root:root 644
$STATE root:root 750
$STATE/approvals root:root 700
$STATE/jobs root:root 700
$LOGDIR root:root 750
$SUDOERS root:root 440
$SSHD_DROPIN root:root 644
$BDHOME/.ssh $BDUSER 700
$AUTHKEYS $BDUSER 600
EOT
}

verify() {
  V_OK=0; V_BAD=0; V_SKIP=0; V_WARN=0
  local APP OURS u
  APP=$(POLICY_FILE=$ETC/policy.json policy_get project app_dir); OURS=$(dirname "$APP")
  say "== autoprueba de aislamiento de $BDUSER =="
  chk "control positivo: runuser ejecuta comandos como $BDUSER" p_true as_bd true
  chk "control positivo: $BDUSER lee la politica y la libreria (bd-gate las necesita)" p_can_read "$ETC/policy.json"
  chk "$BDUSER NO esta en grupos privilegiados (docker, sudo, adm, root, lxd, disk, shadow)" p_not_in_groups docker sudo adm root lxd disk shadow
  chk "$BDUSER no puede usar el socket de Docker (docker ps falla)" p_cmd_fails docker ps
  chk "$BDUSER no puede leer el socket /var/run/docker.sock" p_no_access /var/run/docker.sock
  chk "$BDUSER no puede acceder al directorio del proyecto ($APP)" p_no_access "$APP"
  chk "$BDUSER no puede acceder a las claves de deploy ($ETC/keys)" p_no_access "$ETC/keys"
  chk "$BDUSER no puede acceder al estado ni a las aprobaciones ($STATE)" p_no_access "$STATE"
  chk "$BDUSER no puede acceder a la auditoria ($LOGDIR)" p_no_access "$LOGDIR"
  chk "$BDUSER no puede escribir en $ETC/policy.json" p_no_write "$ETC/policy.json"
  chk "$BDUSER no puede escribir en $SBIN/bd-run ni en $SBIN/bd-gate" p_no_write "$SBIN/bd-run"
  chk "$BDUSER no puede escribir en la libreria $LIBDIR" p_no_write "$LIBDIR/bd_lib.py"
  chk "$BDUSER no puede escribir en $SUDOERS" p_no_write "$SUDOERS"
  for u in /srv/*/secrets /backups/* /etc/oe-deploy/keys /var/lib/oe-deploy /var/log/oe-deploy /etc/cloudflared; do
    case "$u" in "$OURS"/*) continue ;; esac
    chkw "$BDUSER no puede acceder a $u (secretos/estado de otros proyectos)" p_no_access "$u"
  done
  chk "la superficie de sudo de $BDUSER es EXACTAMENTE la gramatica de bd_lib (sin comodines, sin otras reglas)" p_sudo_surface
  chk "sudo rechaza un comando cualquiera (/usr/bin/id)" p_sudo_denied /usr/bin/id
  chk "sudo rechaza bd-run sin argumentos" p_sudo_denied "$SBIN/bd-run"
  chk "sudo rechaza bd-run init-clone (reservada al administrador)" p_sudo_denied "$SBIN/bd-run" init-clone
  chk "sudo rechaza bd-run --run-job (solo lo lanza bd-run)" p_sudo_denied "$SBIN/bd-run" --run-job 0123456789abcdef
  chk "sudo rechaza bd-run con argumentos extra (status x)" p_sudo_denied "$SBIN/bd-run" status x
  chk "sudo rechaza bd-run con un SHA corto (fetch abc)" p_sudo_denied "$SBIN/bd-run" fetch abc
  chk "sudo rechaza bd-run con un SHA en mayusculas" p_sudo_denied "$SBIN/bd-run" fetch AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  chk "sudo rechaza bd-approve" p_sudo_denied "$SBIN/bd-approve" accept-compose aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  chk "sudo rechaza otro ejecutor (oe-run)" p_sudo_denied /usr/local/sbin/oe-run prod status
  chk "sudo rechaza una shell (/bin/bash)" p_sudo_denied /bin/bash
  chk "bd-gate rechaza comando arbitrario (exit 126)" p_gate_rejects 'status; id'
  chk "bd-gate rechaza una shell" p_gate_rejects 'bash'
  chk "bd-gate rechaza sustitucion de comandos" p_gate_rejects 'status $(id)'
  chk "bd-gate rechaza operaciones de otros ejecutores (prod status)" p_gate_rejects 'prod status'
  chk "bd-gate rechaza init-clone (reservada al administrador)" p_gate_rejects 'init-clone'
  chk "bd-gate rechaza --run-job" p_gate_rejects '--run-job 0123456789abcdef'
  chk "bd-gate rechaza sesion sin comando" p_gate_rejects_nocmd
  chk "bd-gate acepta una lectura valida (control positivo: status)" p_gate_accepts status
  chk "sshd valida la configuracion" sshd -t
  chk "sshd: ForceCommand efectivo para $BDUSER = bd-gate" p_forcecommand_for "$BDUSER"
  for u in $(getent passwd | awk -F: '$3>=900 && $3<65000 && $1!="'"$BDUSER"'" {print $1}') "$ADMIN_USER" oedeploy zz-usuario-inexistente; do
    [ -n "$u" ] && chk "sshd: el bloque NO aplica al usuario $u" p_forcecommand_not_for "$u"
  done
  audit_perms
  say "resultado: $V_OK pasan, $V_BAD fallan, $V_WARN avisos (condiciones ajenas), $V_SKIP omitidas"
  [ "$V_BAD" -eq 0 ]
}

if [ "$VERIFY" -eq 1 ]; then
  is_root || die "ejecute como root"
  [ -n "$PY" ] || die "falta python3"
  ADMIN_USER="${ADMIN_USER:-root}"
  verify; exit $?
fi

[ -n "$PY" ] || die "falta python3"
[ -n "$POLICY" ] && [ -n "$ADMIN_USER" ] && [ -n "$PUBKEY" ] || die "faltan --policy, --admin-user y --pubkey-file (ver --help)"
POLICY_FILE=$POLICY

if [ "$APPLY" -eq 1 ]; then
  say "== INSTALANDO (modo --apply, transaccional) =="
  is_root || die "ejecute como root (sudo)"
  for c in docker git sshd visudo runuser ssh-keygen install systemctl flock stat; do command -v "$c" >/dev/null || die "falta el comando: $c"; done
  "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' || die "se requiere python3 >= 3.10"
  id "$ADMIN_USER" >/dev/null 2>&1 || die "el usuario administrador '$ADMIN_USER' no existe"
  [ "$ADMIN_USER" != "$BDUSER" ] || die "el administrador no puede ser $BDUSER"
else
  say "== PLAN (no se cambia nada; agregue --apply para ejecutar) =="
fi

[ -f "$POLICY" ] || die "no existe $POLICY"
[ -f "$PUBKEY" ] || die "no existe $PUBKEY"
[ "$(grep -c . "$PUBKEY")" -eq 1 ] && grep -qE '^ssh-ed25519 [A-Za-z0-9+/=]+( [^ ]*)?$' "$PUBKEY" || die "la clave publica debe ser UNA linea 'ssh-ed25519 ...' sin opciones"
# La politica DEFINITIVA no puede tener placeholders (el validador de bd_lib tambien lo rechaza).
if grep -q -e 'REPLACE_ME' -e '<[A-Z_]*>' "$POLICY"; then die "la politica aun contiene placeholders (<...> / REPLACE_ME)"; fi
PYTHONDONTWRITEBYTECODE=1 "$PY" -I -c '
import sys, json
sys.path.insert(0, sys.argv[1])
import bd_lib
p = bd_lib.validate_policy(json.load(open(sys.argv[2])))
assert p["common"]["service_user"] == "bddeploy", "service_user debe ser bddeploy"
print("  politica valida (remoto %s, rama %s)" % (p["common"]["git_remote_url"], p["common"]["git_branch"]))
' "$SRC" "$POLICY" || die "politica invalida"
# El instalador instala las rutas FIJAS de arriba: la politica debe usar las mismas (no puede apuntar a otro lado).
for pair in "state_dir:$STATE" "log_dir:$LOGDIR" "known_hosts:$ETC/known_hosts"; do
  [ "$(policy_get common "${pair%%:*}")" = "${pair#*:}" ] || die "common.${pair%%:*} debe ser ${pair#*:}"
done
[ "$(policy_get project deploy_key)" = "$ETC/keys/prod_deploy" ] || die "project.deploy_key debe ser $ETC/keys/prod_deploy"

APP_DIR=$(policy_get project app_dir)
PROJECT=$(policy_get project project)
PORT=$(policy_get project port)
BRANCH=$(policy_get common git_branch)
REMOTE=$(policy_get common git_remote_url)

preflight_env

say
say "1) usuario de servicio (ya creado; solo se verifica): $BDUSER, sin sudo general, sin grupo docker, shell nologin"
say "2) wrappers (propiedad de root, no escribibles por $BDUSER)"
step "$LIBDIR/{bd_lib.py,bd_ops.py} 0644 ; $SBIN/bd-gate 0755 ; $SBIN/bd-run 0700 ; $SBIN/bd-approve 0700"
say "3) politica y clave de deploy (solo lectura en GitHub)"
step "$ETC/policy.json 0644 (proyecto Docker: $PROJECT ; app: $APP_DIR ; 127.0.0.1:$PORT ; remoto $REMOTE rama $BRANCH)"
step "$ETC/keys/prod_deploy (ed25519, 0600, root) ; $ETC/known_hosts"
say "4) estado y auditoria"
step "$STATE (0750; approvals/ y jobs/ 0700) ; $LOGDIR (0750)"
say "5) directorio del proyecto (vacio; el clon lo crea 'sudo bd-run init-clone')"
step "$(dirname "$APP_DIR") (root:root 0755)"
say "6) sudoers: UNA regla explicita por forma de peticion (generada por bd_lib.sudoers_text; sin comodines '*')"
step "$SUDOERS : $BDUSER ALL=(root) NOPASSWD: $(PYTHONDONTWRITEBYTECODE=1 "$PY" -I -c 'import sys; sys.path.insert(0, sys.argv[1]); import bd_lib; print(len(bd_lib.sudoers_commands("/usr/local/sbin/bd-run")))' "$SRC") comandos exactos (validado con visudo -cf)"
say "7) SSH: clave dedicada con comando forzado"
step "$AUTHKEYS : restrict,command=\"$SBIN/bd-gate\",from=\"127.0.0.1,::1\" <clave>"
step "$SSHD_DROPIN : Match User $BDUSER -> ForceCommand (no afecta a otros usuarios; se compara la configuracion efectiva de sshd de TODOS los demas usuarios, incluido oedeploy, antes y despues)"
say "8) autoprueba de aislamiento (install.sh --verify, se ejecuta sola al final; si falla se revierte todo)"
say "Garantias: no se modifica oe-deploy, projectmanager, Docker, el tunel, cloudflared, el firewall ni otros usuarios."

if [ "$APPLY" -ne 1 ]; then
  say
  if [ "$PF_FAIL" -gt 0 ]; then say "El --apply se NEGARIA: hay $PF_FAIL comprobacion(es) previa(s) fallida(s) (arriba)."; exit 1; fi
  say "Nada se ha cambiado. Revise el plan y vuelva a ejecutar con --apply."
  exit 0
fi
[ "$PF_FAIL" -eq 0 ] || die "hay $PF_FAIL comprobacion(es) previa(s) fallida(s): no se instala nada"

# ---------------------------- aplicar (transaccion) ----------------------------
exec 9>"$INSTALL_LOCK"
flock -n 9 || die "otra instalacion de bd-deploy esta en curso"

TXN_ALLOW=("$LIBDIR" "$SBIN/bd-gate" "$SBIN/bd-run" "$SBIN/bd-approve" "$ETC" "$STATE" "$LOGDIR" "$SUDOERS" "$SSHD_DROPIN" "$AUTHKEYS" "$(dirname "$APP_DIR")")

on_exit() {
  local rc=$?
  trap - EXIT
  if [ "$TXN_ACTIVE" -eq 1 ]; then
    [ "$rc" -ne 0 ] || rc=1
    say >&2
    say "FALLO (codigo $rc): REVIRTIENDO la instalacion..." >&2
    txn_rollback >&2 || { say "ATENCION: la reversion no fue completa; revise a mano las rutas indicadas arriba (uninstall.sh --apply)." >&2; }
    if [ "$SSHD_RELOADED" -eq 1 ] && sshd -t 2>/dev/null; then systemctl reload ssh 2>/dev/null || true; fi
    [ -n "$SNAP_DIR" ] && rm -rf -- "$SNAP_DIR"
    say "La instalacion NO quedo aplicada." >&2
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
trap 'echo "FALLO en la linea $LINENO" >&2' ERR

txn_begin

# Instantanea de la configuracion efectiva de sshd de los demas usuarios ANTES de cambiar nada.
SNAP_DIR=$(mktemp -d /var/tmp/bd-sshd-snap.XXXXXX)
snap_sshd "$SNAP_DIR/before"

txn_new "$STATE";  install -d -m 0750 -o root -g root "$STATE"
txn_new "$LOGDIR"; install -d -m 0750 -o root -g root "$LOGDIR"
txn_new "$STATE/approvals"; install -d -m 0700 -o root -g root "$STATE/approvals"
txn_new "$STATE/jobs";      install -d -m 0700 -o root -g root "$STATE/jobs"

txn_new "$LIBDIR"; install -d -m 0755 -o root -g root "$LIBDIR"
install -m 0644 -o root -g root "$SRC/bd_lib.py" "$LIBDIR/bd_lib.py"
install -m 0644 -o root -g root "$SRC/bd_ops.py" "$LIBDIR/bd_ops.py"
txn_new "$SBIN/bd-gate";    install -m 0755 -o root -g root "$SRC/bd-gate" "$SBIN/bd-gate"
txn_new "$SBIN/bd-run";     install -m 0700 -o root -g root "$SRC/bd-run" "$SBIN/bd-run"
txn_new "$SBIN/bd-approve"; install -m 0700 -o root -g root "$SRC/bd-approve" "$SBIN/bd-approve"

txn_new "$ETC"; install -d -m 0755 -o root -g root "$ETC"
install -m 0644 -o root -g root "$POLICY" "$ETC/policy.json"
install -d -m 0700 -o root -g root "$ETC/keys"
ssh-keygen -q -t ed25519 -N "" -C "bd-deploy-prod" -f "$ETC/keys/prod_deploy"
chown root:root "$ETC/keys/prod_deploy" "$ETC/keys/prod_deploy.pub"; chmod 600 "$ETC/keys/prod_deploy"; chmod 644 "$ETC/keys/prod_deploy.pub"
if [ -n "$KNOWN_HOSTS_FROM" ] && [ -f "$KNOWN_HOSTS_FROM" ]; then
  if [ "$(grep -c . "$KNOWN_HOSTS_FROM")" -le 10 ]; then cp "$KNOWN_HOSTS_FROM" "$ETC/known_hosts"
  else grep -E '^(\[?github\.com|github\.com)' "$KNOWN_HOSTS_FROM" > "$ETC/known_hosts" || true; fi
  say "known_hosts copiado: $(grep -c . "$ETC/known_hosts") linea(s) (revise que sean las huellas verificadas de github.com)"
fi
[ -s "$ETC/known_hosts" ] || { : > "$ETC/known_hosts"; say "AVISO: $ETC/known_hosts vacio; agregue las huellas VERIFICADAS de github.com antes de usar 'fetch'."; }
chown root:root "$ETC/known_hosts"; chmod 644 "$ETC/known_hosts"

if [ ! -e "$(dirname "$APP_DIR")" ]; then txn_new "$(dirname "$APP_DIR")"; install -d -m 0755 -o root -g root "$(dirname "$APP_DIR")"; fi

# sudoers: se genera, se valida con visudo ANTES de instalarlo y se valida el conjunto despues.
TMPS=$(mktemp)
PYTHONDONTWRITEBYTECODE=1 "$PY" -I -c 'import sys; sys.path.insert(0, sys.argv[1]); import bd_lib; sys.stdout.write(bd_lib.sudoers_text(sys.argv[2], sys.argv[3]))' \
  "$SRC" "$BDUSER" "$SBIN/bd-run" > "$TMPS"
visudo -cf "$TMPS" >/dev/null || { rm -f "$TMPS"; die "sudoers invalido"; }
txn_new "$SUDOERS"; install -m 0440 -o root -g root "$TMPS" "$SUDOERS"; rm -f "$TMPS"
visudo -c >/dev/null || die "visudo -c rechaza la configuracion de sudo resultante"

# clave SSH dedicada con comando forzado
txn_modify "$AUTHKEYS"
printf 'restrict,command="%s/bd-gate",from="127.0.0.1,::1" %s\n' "$SBIN" "$(cut -d' ' -f1-3 "$PUBKEY")" > "$AUTHKEYS"
chown "$BDUSER:$(id -gn "$BDUSER")" "$AUTHKEYS"; chmod 600 "$AUTHKEYS"

# bloque sshd (lo ULTIMO: es lo que habilita el acceso)
txn_new "$SSHD_DROPIN"
cat > "$SSHD_DROPIN" <<EOT
# bd-deploy: limita la cuenta $BDUSER al ejecutor. No afecta a otros usuarios.
Match User $BDUSER
    ForceCommand $SBIN/bd-gate
    PermitTTY no
    X11Forwarding no
    AllowTcpForwarding no
    AllowAgentForwarding no
    PermitTunnel no
    GatewayPorts no
    PermitUserRC no
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    AuthenticationMethods publickey
    MaxSessions 2
EOT
chmod 644 "$SSHD_DROPIN"
sshd -t || die "sshd -t fallo con el bloque nuevo"
p_forcecommand_for "$BDUSER" || die "el bloque sshd no aplica a $BDUSER"
snap_sshd "$SNAP_DIR/after"
if ! diff -r "$SNAP_DIR/before" "$SNAP_DIR/after" >"$SNAP_DIR/diff.txt" 2>&1; then
  say "La configuracion efectiva de sshd de OTROS usuarios cambiaria:"; head -20 "$SNAP_DIR/diff.txt"
  die "el bloque sshd afectaria a otros usuarios (incluido el administrador u oedeploy)"
fi
say "  configuracion efectiva de sshd de $(ls "$SNAP_DIR/before" | wc -l) combinaciones usuario/direccion: IDENTICA antes y despues"
SSHD_RELOADED=1
systemctl reload ssh 2>/dev/null || say "  (ssh.service no esta activo: con ssh.socket el bloque aplica a conexiones nuevas)"

say
say "== instalacion aplicada; ejecutando la autoprueba (si falla, se revierte todo) =="
txn_manifest > "$STATE/install-manifest"; chmod 600 "$STATE/install-manifest"
verify || die "la autoprueba de aislamiento fallo"

txn_commit
rm -rf -- "$SNAP_DIR"; SNAP_DIR=""
trap - EXIT
say
say "== instalacion terminada y verificada =="
say "Clave publica de deploy (agreguela como Deploy key de SOLO LECTURA en el repositorio de GitHub de bydlight2):"
say "  $(cat "$ETC/keys/prod_deploy.pub")"
say "Siguiente: complete $ETC/known_hosts con la huella verificada de github.com, agregue la deploy key y ejecute 'sudo $SBIN/bd-run init-clone'."
