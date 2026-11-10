#!/usr/bin/env bash
# Bydlight2 - ejecutor de las herramientas administrativas de la imagen en ejecucion (reemplaza la variable $RUN de las guias).
#
# Por que existe (1): la variable RUN="docker run --rm --user ... --cap-drop ALL --security-opt ..." es una linea larga que al copiarla y
# pegarla se parte o se une mal. Este script construye el mismo comando sin pegar nada.
#
# Por que existe (2), y por que PREPARA una copia de los scripts: la imagen standalone NO incluye scripts/ (.dockerignore lo excluye) y el
# clon del servidor (/srv/bydlight-prod/app) es privado de root (700, archivos 600). El contenedor corre como uid 1000 SIN capacidades,
# asi que montar el clon directamente (-v .../app/scripts:/s:ro) deja a node sin permiso de lectura y falla con
# "Cannot find module '/s/mail-config-set.mjs'" (EACCES se informa como modulo no encontrado). Solucion permanente, sin tocar permisos:
#   1. como root se copian SOLO los scripts administrativos permitidos (lista cerrada) y migrations.mjs a un directorio temporal nuevo
#      (755/644), se compara el SHA-256 de cada copia con el del clon y se muestran las huellas (stderr);
#   2. ese directorio se monta de SOLO LECTURA en el contenedor (uid 1000, sin capacidades, sistema de archivos de solo lectura);
#   3. al terminar (o ante un error o Ctrl+C) el directorio temporal se borra.
# El clon conserva sus permisos (no se usa chmod sobre el), el contenedor nunca es root y el volumen /data persiste y es la unica escritura.
#
# Uso (como root):
#   RUN="sudo bash $HOME/00-admin.sh"            # para comandos sin entrada interactiva
#   RUNTTY="sudo bash $HOME/00-admin.sh --tty"   # para pedir secretos con entrada oculta (mail-config-set.mjs --init)
#   $RUN node /s/admin-remote.mjs list --config-file /data/config/payments.json
#   $RUNTTY node /s/mail-config-set.mjs /data/config/mail.json --init
#   sudo bash 00-admin.sh --print node /s/admin-remote.mjs list        # solo MUESTRA el comando docker, no prepara ni ejecuta nada
# Scripts permitidos (ruta /s/<nombre>.mjs o /w/scripts/<nombre>.mjs): admin-remote, mail-config-set, payments-config-set, orders-admin,
# setup-payments-config. Cualquier otro comando (node -e, sh, rutas fuera de la lista) se rechaza.
#
# Que hace: toma la imagen del contenedor bydlight-prod-web-1 (debe ser bydlight-web:<12 hex> y del proyecto bydlight-prod) y ejecuta
# el comando indicado en un contenedor EFIMERO de esa imagen. No usa el contenedor de la aplicacion ni toca otros contenedores.
# Rollback de este script: no cambia nada persistente (solo el directorio temporal); basta volver a la version anterior del archivo.

set -euo pipefail
export LC_ALL=C
readonly PROJECT="bydlight-prod"
readonly CONTAINER="bydlight-prod-web-1"
readonly VOL="bydlight-prod_bydlight_data"
readonly APP_DIR="/srv/bydlight-prod/app"
readonly PUBLIC_URL="https://bydlightsolutions.com"
readonly ALLOWED="admin-remote mail-config-set payments-config-set orders-admin setup-payments-config"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

TTY=0; PRINT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tty) TTY=1; shift ;;
    --print) PRINT=1; shift ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[ $# -gt 1 ] || die "uso: sudo bash $0 [--tty] [--print] node /s/<script>.mjs [argumentos]"
[ "$(id -u)" = "0" ] || die "ejecute como root (sudo)"
[ "$1" = "node" ] || die "el comando debe empezar por 'node /s/<script>.mjs' (u '/w/scripts/<script>.mjs')"
if [[ "$2" =~ ^/(s|w/scripts)/([a-z-]+)\.mjs$ ]]; then NAME="${BASH_REMATCH[2]}"; else die "script no permitido: $2 (solo /s/<script>.mjs o /w/scripts/<script>.mjs)"; fi
case " $ALLOWED " in *" $NAME "*) ;; *) die "script no permitido: $NAME (permitidos: $ALLOWED)" ;; esac

[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER")" = "$PROJECT" ] || die "el contenedor no pertenece al proyecto $PROJECT"
IMG="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
[[ "$IMG" =~ ^bydlight-web:[0-9a-f]{12}$ ]] || die "imagen inesperada: $IMG"

STAGE=""
cleanup() { if [ -n "${STAGE:-}" ] && [ -d "$STAGE" ]; then rm -rf -- "$STAGE"; fi; return 0; }
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

if [ "$PRINT" = 1 ]; then
  SRC='<directorio-temporal-con-copias>'
else
  for n in $ALLOWED; do
    f="$APP_DIR/scripts/$n.mjs"
    [ -e "$f" ] || continue
    { [ -f "$f" ] && [ ! -L "$f" ]; } || die "$f debe ser un archivo regular (no un enlace)"
  done
  M="$APP_DIR/src/lib/payments/migrations.mjs"
  { [ -f "$M" ] && [ ! -L "$M" ]; } || die "falta $M en el clon del servidor"
  [ -f "$APP_DIR/scripts/$NAME.mjs" ] || die "falta scripts/$NAME.mjs en el clon del servidor (SHA desplegado sin ese script)"
  STAGE="$(mktemp -d /tmp/bd-admin-XXXXXX)"
  mkdir -p "$STAGE/scripts" "$STAGE/src/lib/payments"
  chmod 0755 "$STAGE" "$STAGE/scripts" "$STAGE/src" "$STAGE/src/lib" "$STAGE/src/lib/payments"
  copy_checked() {
    install -m 0644 "$APP_DIR/$1" "$STAGE/$1"
    [ "$(sha256sum "$APP_DIR/$1" | cut -d' ' -f1)" = "$(sha256sum "$STAGE/$1" | cut -d' ' -f1)" ] || die "la copia de $1 no coincide con el clon"
    printf '   preparado %s sha256=%s\n' "$1" "$(sha256sum "$STAGE/$1" | cut -c1-16)" >&2
  }
  for n in $ALLOWED; do [ -f "$APP_DIR/scripts/$n.mjs" ] && copy_checked "scripts/$n.mjs"; done
  copy_checked "src/lib/payments/migrations.mjs"
  SRC="$STAGE"
fi

CMD=(docker run --rm)
[ "$TTY" = 1 ] && CMD+=(-it)
CMD+=(--user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true
      -v "$VOL":/data
      -v "$SRC/scripts":/s:ro
      -v "$SRC":/w:ro
      -e BYDLIGHT_URL="$PUBLIC_URL" -e PAYMENTS_DB=/data/bydlight.db
      "$IMG" "$@")

if [ "$PRINT" = 1 ]; then printf '%q ' "${CMD[@]}"; printf '\n'; exit 0; fi
rc=0
"${CMD[@]}" || rc=$?
exit "$rc"
