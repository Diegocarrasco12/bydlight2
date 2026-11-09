#!/usr/bin/env bash
# Bydlight2 - ejecutor de las herramientas administrativas de la imagen en ejecucion (reemplaza la variable $RUN de las guias).
#
# Por que existe: la variable RUN="docker run --rm --user ... --cap-drop ALL --security-opt ..." es una linea larga que al copiarla y
# pegarla se parte o se une mal (por ejemplo, dos opciones pegadas sin espacio). Este script construye el mismo comando sin pegar nada.
#
# Uso (como root):
#   RUN="sudo bash $HOME/00-admin.sh"            # para comandos sin entrada interactiva
#   RUNTTY="sudo bash $HOME/00-admin.sh --tty"   # para pedir secretos con entrada oculta (mail-config-set.mjs --init)
#   $RUN node /s/admin-remote.mjs list --config-file /data/config/payments.json
#   $RUNTTY node /s/mail-config-set.mjs /data/config/mail.json --init
#   sudo bash 00-admin.sh --print node /s/admin-remote.mjs list        # solo MUESTRA el comando docker, no lo ejecuta
#
# Que hace: toma la imagen del contenedor bydlight-prod-web-1 (debe ser bydlight-web:<12 hex> y del proyecto bydlight-prod) y ejecuta
# el comando indicado en un contenedor EFIMERO de esa imagen, como uid 1000, sin capacidades, con el sistema de archivos en solo lectura,
# con el volumen de datos en /data y los scripts del clon (solo lectura) en /s. No usa el contenedor de la aplicacion ni toca otros.
# Para orders-admin.mjs tambien monta /w/scripts y el migrations.mjs del clon, como en la guia de la Etapa A.

set -euo pipefail
export LC_ALL=C
readonly PROJECT="bydlight-prod"
readonly CONTAINER="bydlight-prod-web-1"
readonly VOL="bydlight-prod_bydlight_data"
readonly APP_DIR="/srv/bydlight-prod/app"
readonly PUBLIC_URL="https://bydlightsolutions.com"

TTY=0; PRINT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tty) TTY=1; shift ;;
    --print) PRINT=1; shift ;;
    --) shift; break ;;
    *) break ;;
  esac
done
[ $# -gt 0 ] || { echo "uso: sudo bash $0 [--tty] [--print] node /s/<script>.mjs [argumentos]" >&2; exit 1; }
[ "$(id -u)" = "0" ] || { echo "ERROR: ejecute como root (sudo)" >&2; exit 1; }
[ "$1" = "node" ] || { echo "ERROR: el comando debe empezar por 'node /s/<script>.mjs' (u '/w/scripts/<script>.mjs')" >&2; exit 1; }

[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$CONTAINER")" = "$PROJECT" ] || { echo "ERROR: el contenedor no pertenece al proyecto $PROJECT" >&2; exit 1; }
IMG="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"
[[ "$IMG" =~ ^bydlight-web:[0-9a-f]{12}$ ]] || { echo "ERROR: imagen inesperada: $IMG" >&2; exit 1; }

CMD=(docker run --rm)
[ "$TTY" = 1 ] && CMD+=(-it)
CMD+=(--user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true
      -v "$VOL":/data
      -v "$APP_DIR/scripts":/s:ro
      -v "$APP_DIR/scripts":/w/scripts:ro
      -v "$APP_DIR/src/lib/payments/migrations.mjs":/w/src/lib/payments/migrations.mjs:ro
      -e BYDLIGHT_URL="$PUBLIC_URL" -e PAYMENTS_DB=/data/bydlight.db
      "$IMG" "$@")

if [ "$PRINT" = 1 ]; then printf '%q ' "${CMD[@]}"; printf '\n'; exit 0; fi
exec "${CMD[@]}"
