#!/usr/bin/env bash
# Actualizacion MINIMA del ejecutor ya instalado: admite UNICAMENTE el volumen de datos `bydlight_data` -> /data.
# La ejecuta el ADMINISTRADOR en el servidor, como root. Por defecto solo MUESTRA el plan (no cambia nada).
#
#   sudo bash update-volume.sh --src /ruta/a/deploy/executor                      # plan (solo lectura)
#   sudo bash update-volume.sh --src /ruta/a/deploy/executor --apply              # aplica (transaccional)
#   sudo bash update-volume.sh --rollback /root/bd-deploy-backup-AAAAMMDD-HHMMSS  # restaura lo respaldado
#
# Que cambia (y NADA mas):  /usr/local/lib/bd-deploy/bd_lib.py  y  /etc/bd-deploy/policy.json (+ project.data_volume).
# Que NO toca: los wrappers (gate/run/approve), bd_ops.py, sudoers, sshd, la clave de deploy, el estado ni la auditoria;
# tampoco Docker (solo lectura: docker ps/volume ls/network ls), contenedores, redes, volumenes ni la aplicacion.
# No despliega nada y no usa Docker Compose. La aprobacion administrativa `accept-compose` sigue siendo obligatoria.
# --apply es una TRANSACCION: si cualquier comprobacion falla, restaura los dos archivos y lo verifica.
set -Eeuo pipefail
umask 022
export PYTHONDONTWRITEBYTECODE=1

LIBDIR=/usr/local/lib/bd-deploy
LIB="$LIBDIR/bd_lib.py"
OPS="$LIBDIR/bd_ops.py"
POLICY=/etc/bd-deploy/policy.json
SUDOERS=/etc/sudoers.d/bd-deploy
RUNPATH=/usr/local/sbin/bd-run
# Huellas SHA-256 conocidas (calculadas del contenido en Git). La instalada debe ser EXACTAMENTE la de 2026-10-26.
OLD_LIB_SHA=315858b8fe3207b0a4d3df9c9507c4f3fa891e1fcb3c9eb61df12f7e0365067a
NEW_LIB_SHA=a0590daddbb95c43b49b77ba3d7b2aa867f3bb99531a2c8b6d24b34d6394cc8e
OPS_SHA=301f4d590108bdad2822571ec9537a546e985d6c75c215c6364b339445f999e5
# policy.json instalada (huella confirmada por el administrador el 2026-11-06; es especifica del servidor, no esta en Git).
POLICY_SHA=0a852437ca9c25d2a81090a43a9a4fd473d0fdec1d82ee900b2123ac6cb7b606

SRC=""; APPLY=0; ROLLBACK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --src) SRC="${2:?}"; shift ;;
    --apply) APPLY=1 ;;
    --plan) APPLY=0 ;;
    --rollback) ROLLBACK="${2:?}"; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "ejecute como root (sudo)"
PY=$(command -v python3 || true); [ -n "$PY" ] || die "falta python3"
sha() { sha256sum -- "$1" | cut -d' ' -f1; }

snapshot() { # $1 = directorio de salida: estado de TODOS los contenedores, volumenes y redes (solo lectura)
  mkdir -p -- "$1"
  docker ps -a --no-trunc --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' | sort > "$1/containers.txt"
  docker volume ls -q | sort > "$1/volumes.txt"
  docker network ls --format '{{.ID}}|{{.Name}}' | sort > "$1/networks.txt"
}
stable() { # contenedores sin la columna Status (el tiempo "Up 3 hours" cambia solo)
  awk -F'|' '{print $1"|"$2"|"$3"|"$5}' "$1/containers.txt"
}
surface() { # superficie de sudo que genera una libreria dada (debe ser identica antes y despues)
  "$PY" -I -c 'import sys; sys.path.insert(0, sys.argv[1]); import bd_lib; print("\n".join(sorted(bd_lib.sudoers_commands(sys.argv[2]))))' "$1" "$RUNPATH"
}

restore_from() { # $1 = directorio de respaldo
  local b="$1"
  [ -f "$b/bd_lib.py" ] && [ -f "$b/policy.json" ] || die "respaldo incompleto en $b"
  install -m 0644 -o root -g root "$b/bd_lib.py" "$LIB.restore" && mv -f "$LIB.restore" "$LIB"
  install -m 0644 -o root -g root "$b/policy.json" "$POLICY.restore" && mv -f "$POLICY.restore" "$POLICY"
  [ "$(sha "$LIB")" = "$(cat "$b/bd_lib.sha256")" ] || die "la restauracion de bd_lib.py no coincide con el respaldo"
  cmp -s "$b/policy.json" "$POLICY" || die "la restauracion de policy.json no coincide con el respaldo"
}

# ---------------------------------------------------------------- rollback manual
if [ -n "$ROLLBACK" ]; then
  say "== rollback del ejecutor desde $ROLLBACK =="
  restore_from "$ROLLBACK"
  say "  restaurados bd_lib.py y policy.json (sha $(sha "$LIB" | cut -c1-12))"
  snapshot /run/bd-update-after-rollback
  if [ -f "$ROLLBACK/before/containers.txt" ]; then
    if diff <(stable "$ROLLBACK/before") <(stable /run/bd-update-after-rollback) >/dev/null; then say "  contenedores: sin cambios respecto de antes de la actualizacion"
    else say "  AVISO: los contenedores difieren de la fotografia previa (revise: pueden ser cambios ajenos a esta actualizacion)"; fi
  fi
  say "OK. Para comprobar: sudo bd-run status"
  exit 0
fi

# ---------------------------------------------------------------- comprobaciones previas (plan y apply)
[ -n "$SRC" ] || die "indique --src <directorio deploy/executor del commit aprobado>"
[ -f "$SRC/bd_lib.py" ] || die "no existe $SRC/bd_lib.py"
say "== comprobaciones previas (solo lectura) =="
[ "$(sha "$SRC/bd_lib.py")" = "$NEW_LIB_SHA" ] || die "el bd_lib.py de --src NO es la version aprobada (esperado ${NEW_LIB_SHA:0:12}, hay $(sha "$SRC/bd_lib.py" | cut -c1-12)). Traiga el archivo del commit aprobado."
say "  OK  bd_lib.py nuevo = version aprobada (${NEW_LIB_SHA:0:12})"
[ -f "$LIB" ] && [ -f "$OPS" ] && [ -f "$POLICY" ] || die "falta alguno de los archivos instalados"
CUR=$(sha "$LIB")
if [ "$CUR" = "$NEW_LIB_SHA" ]; then die "la libreria ya esta actualizada; nada que hacer"; fi
[ "$CUR" = "$OLD_LIB_SHA" ] || die "bd_lib.py instalado (${CUR:0:12}) NO es el de la instalacion del 26-oct (${OLD_LIB_SHA:0:12}): hay cambios locales o es otra version. DETENGASE y envie la huella (no el contenido)."
say "  OK  bd_lib.py instalado = version del 2026-10-26 (${OLD_LIB_SHA:0:12})"
[ "$(sha "$OPS")" = "$OPS_SHA" ] || die "bd_ops.py instalado no coincide con la version conocida: no se continua"
say "  OK  bd_ops.py instalado = version conocida (no se modifica)"
CURPOL=$(sha "$POLICY")
[ "$CURPOL" = "$POLICY_SHA" ] || die "policy.json instalada (${CURPOL:0:12}) no coincide con la huella confirmada (${POLICY_SHA:0:12}): no se continua"
say "  OK  policy.json instalada = huella confirmada (${POLICY_SHA:0:12})"
[ "$(stat -c '%U:%G %a' "$LIB")" = "root:root 644" ] && [ "$(stat -c '%U:%G %a' "$POLICY")" = "root:root 644" ] || die "propietario/permisos inesperados en bd_lib.py o policy.json"
say "  OK  propietarios y permisos: root:root 644"
"$PY" -I -c '
import json,sys
p=json.load(open(sys.argv[1]))
pr=p["project"]
assert pr["project"]=="bydlight-prod" and pr["service"]=="web" and pr["port"]==8200, "la politica no es la de bydlight-prod"
dv=pr.get("data_volume")
assert dv in (None, {"name":"bydlight_data","target":"/data"}), "data_volume ya existe y es distinto"
' "$POLICY" || die "la politica instalada no es la esperada"
say "  OK  la politica instalada es la de bydlight-prod (servicio web, puerto 8200)"
BEFORE_SURFACE=$(surface "$LIBDIR")
say "  OK  superficie sudo actual: $(printf '%s\n' "$BEFORE_SURFACE" | wc -l) comandos (debe quedar identica)"
NCONT=$(docker ps -a -q | wc -l)
say "  OK  Docker responde: $NCONT contenedores existentes (se compararan antes/despues)"

say ""
say "== plan =="
say "  1) respaldar bd_lib.py, policy.json, huella de sudoers y fotografia de contenedores/volumenes/redes"
say "  2) instalar bd_lib.py aprobado (reemplazo atomico, root:root 644)"
say "  3) anadir a policy.json: project.data_volume = {name: bydlight_data, target: /data} (el resto igual)"
say "  4) validar: politica con la libreria nueva, superficie sudo identica, autoprueba positiva y negativa del validador"
say "  5) comparar fotografia de contenedores (debe ser identica); si algo falla: rollback automatico"
if [ "$APPLY" -ne 1 ]; then say ""; say "(plan: no se cambio nada. Repita con --apply)"; exit 0; fi

# ---------------------------------------------------------------- aplicar
TS=$(date +%Y%m%d-%H%M%S)
BK=/root/bd-deploy-backup-$TS
install -d -m 0700 -o root -g root "$BK"
cp -p "$LIB" "$BK/bd_lib.py"; cp -p "$POLICY" "$BK/policy.json"
sha "$LIB" > "$BK/bd_lib.sha256"; sha "$POLICY" > "$BK/policy.sha256"
[ -f "$SUDOERS" ] && sha "$SUDOERS" > "$BK/sudoers.sha256" || true
snapshot "$BK/before"
say ""; say "respaldo en $BK (modo 700)"

fail_and_rollback() {
  say "FALLO: $1 -> restaurando"
  restore_from "$BK" && say "  restaurado el estado anterior (verificado)" || say "  ATENCION: la restauracion automatica fallo; use: sudo bash update-volume.sh --rollback $BK"
  exit 1
}

install -m 0644 -o root -g root "$SRC/bd_lib.py" "$LIB.new" && mv -f "$LIB.new" "$LIB" || fail_and_rollback "no se pudo instalar bd_lib.py"
[ "$(sha "$LIB")" = "$NEW_LIB_SHA" ] || fail_and_rollback "la huella instalada no coincide"

"$PY" -I -c '
import json,sys
src,dst=sys.argv[1],sys.argv[2]
p=json.load(open(src))
p["project"]["data_volume"]={"name":"bydlight_data","target":"/data"}
json.dump(p,open(dst,"w"),indent=2,ensure_ascii=False); open(dst,"a").write("\n")
' "$POLICY" "$POLICY.new" || fail_and_rollback "no se pudo preparar la politica nueva"
chmod 0644 "$POLICY.new"; chown root:root "$POLICY.new"
"$PY" -I -c 'import sys; sys.path.insert(0, sys.argv[1]); import bd_lib; bd_lib.load_policy(sys.argv[2])' "$LIBDIR" "$POLICY.new" || { rm -f "$POLICY.new"; fail_and_rollback "la politica nueva no valida"; }
mv -f "$POLICY.new" "$POLICY"

AFTER_SURFACE=$(surface "$LIBDIR")
[ "$BEFORE_SURFACE" = "$AFTER_SURFACE" ] || fail_and_rollback "la superficie sudo cambio"
say "  OK  superficie sudo identica"

# Autoprueba del validador instalado (Compose minimo renderizado). Positivo: el volumen permitido. Negativos: bind, otro destino,
# volumen externo, segundo montaje, y la politica SIN data_volume sigue rechazando todo volumen.
"$PY" -I - "$LIBDIR" "$POLICY" <<'PYEOF' || fail_and_rollback "la autoprueba del validador fallo"
import copy, json, sys
sys.path.insert(0, sys.argv[1])
import bd_lib as L
pol = L.load_policy(sys.argv[2])
pr = pol["project"]
web = {"build": {"context": pr["app_dir"], "dockerfile": "Dockerfile"}, "image": f"{pr['image_repo']}:baseline", "restart": "unless-stopped",
       "user": "1000:1000", "init": True, "read_only": True, "tmpfs": ["/tmp"], "cap_drop": ["ALL"], "security_opt": ["no-new-privileges:true"],
       "mem_limit": "536870912", "cpus": 1.0, "pids_limit": 256,
       "ports": [{"mode": "ingress", "host_ip": "127.0.0.1", "target": pr["container_port"], "published": str(pr["port"]), "protocol": "tcp"}],
       "networks": {"app": None}, "logging": {"driver": "json-file", "options": {"max-size": "10m", "max-file": "3"}}}
base = {"name": pr["project"], "services": {pr["service"]: web}, "networks": {"app": {"name": f"{pr['project']}_app"}}}
good = copy.deepcopy(base)
good["services"][pr["service"]]["volumes"] = [{"type": "volume", "source": "bydlight_data", "target": "/data", "volume": {}}]
good["volumes"] = {"bydlight_data": {"name": f"{pr['project']}_bydlight_data"}}
sin_vol = L.validate_compose(base, pol)
con_vol = L.validate_compose(good, pol)
# Nota: si `sin_vol` o `con_vol` listan algo, es una diferencia del Compose minimo de la autoprueba con el real; se informa y se aborta.
assert con_vol == [], f"el volumen permitido se rechazo: {con_vol}"
assert sin_vol == [], f"el Compose sin volumenes se rechazo: {sin_vol}"
def neg(nombre, mut):
    r = copy.deepcopy(good); mut(r)
    assert L.validate_compose(r, pol), f"NO se rechazo: {nombre}"
W = lambda r: r["services"][pr["service"]]
neg("bind", lambda r: W(r).update(volumes=[{"type": "bind", "source": "/", "target": "/data"}]))
neg("otro destino", lambda r: W(r).update(volumes=[{"type": "volume", "source": "bydlight_data", "target": "/etc", "volume": {}}]))
neg("segundo montaje", lambda r: W(r).update(volumes=W(r)["volumes"] + [{"type": "volume", "source": "bydlight_data", "target": "/mnt", "volume": {}}]))
neg("externo", lambda r: r["volumes"].update(bydlight_data={"name": "otro", "external": True}))
neg("driver_opts", lambda r: r["volumes"].update(bydlight_data={"name": f"{pr['project']}_bydlight_data", "driver_opts": {"type": "none", "o": "bind", "device": "/"}}))
neg("volumen extra", lambda r: r["volumes"].update(x={"name": f"{pr['project']}_x"}))
neg("privileged", lambda r: W(r).update(privileged=True))
neg("usuario root", lambda r: W(r).update(user="root"))
sp = copy.deepcopy(pol); del sp["project"]["data_volume"]
assert L.validate_compose(good, sp), "sin data_volume en la politica debia rechazar el volumen"
print("autoprueba del validador: OK (1 positiva, 1 sin volumen, 9 negativas)")
PYEOF

snapshot "$BK/after"
if ! diff <(stable "$BK/before") <(stable "$BK/after") >/dev/null; then fail_and_rollback "la fotografia de contenedores cambio durante la actualizacion"; fi
diff "$BK/before/volumes.txt" "$BK/after/volumes.txt" >/dev/null || fail_and_rollback "la lista de volumenes cambio"
diff "$BK/before/networks.txt" "$BK/after/networks.txt" >/dev/null || fail_and_rollback "la lista de redes cambio"
say "  OK  contenedores ($NCONT), volumenes y redes: identicos antes y despues"
[ -f "$SUDOERS" ] && [ "$(sha "$SUDOERS")" = "$(cat "$BK/sudoers.sha256")" ] && say "  OK  sudoers sin cambios" || true
say ""
say "ACTUALIZADO. Respaldo para rollback: $BK"
say "Siguiente (sin desplegar aun): sudo bd-run preflight   -> ya no debe rechazar 'volumes'; luego compose-diff; la aprobacion accept-compose sigue siendo manual."
say "Rollback: sudo bash update-volume.sh --rollback $BK"
