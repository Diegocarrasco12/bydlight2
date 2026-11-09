#!/usr/bin/env bash
# Bydlight2 - caducidad de respaldos (politica de privacidad: los respaldos contienen datos personales y no se conservan indefinidamente).
#
# SIMULACION por defecto: lista lo que se borraria y no borra nada. Solo con --ejecutar elimina.
#   sudo bash 05-caducidad-respaldos.sh [--dias N] [--ejecutar]
#
# Reglas de seguridad (propuesta pendiente de aprobacion del titular; no se ejecuta en el despliegue):
#   - actua SOLO dentro de /srv/bydlight-prod/backups y SOLO sobre archivos regulares con nombre exacto:
#       bydlight-pre-etapa-{a,b}-AAAAMMDD-HHMMSS-PID.db, etapa-{a,b}-*.ref, payments.json.pre-etapa-*, mail.json.pre-etapa-*
#   - plazo por defecto 90 dias (minimo 30); nunca borra los 2 respaldos .db mas recientes, aunque esten vencidos;
#   - no sigue enlaces simbolicos, no usa comodines fuera del directorio, no toca el volumen Docker ni otros proyectos;
#   - borrado con shred -u cuando existe (si no, rm), y deja el recuento en pantalla (sin contenido de los archivos).
# Una solicitud de supresion de un titular se cumple en la base con privacy-erase (cuando no hay obligacion legal de conservar) y en los
# respaldos por caducidad (no se reescriben respaldos); ese es el plazo maximo que informa la politica de privacidad.

set -euo pipefail
umask 077
export LC_ALL=C
readonly BACKUP_DIR="/srv/bydlight-prod/backups"
DAYS=90
EXEC=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dias) DAYS="${2:-}"; shift 2 ;;
    --ejecutar) EXEC=1; shift ;;
    *) echo "ERROR: argumento desconocido: $1" >&2; exit 1 ;;
  esac
done
[[ "$DAYS" =~ ^[0-9]+$ ]] && [ "$DAYS" -ge 30 ] || { echo "ERROR: --dias debe ser un entero >= 30" >&2; exit 1; }
[ -d "$BACKUP_DIR" ] && [ ! -L "$BACKUP_DIR" ] || { echo "ERROR: no existe $BACKUP_DIR (o es un enlace)" >&2; exit 1; }

NAME_RE='^(bydlight-pre-etapa-[ab]-[0-9]{8}-[0-9]{6}-[0-9]+\.db|etapa-[ab]-[0-9]{8}-[0-9]{6}-[0-9]+\.ref|payments\.json\.pre-etapa-[ab]-[0-9]{8}-[0-9]{6}-[0-9]+|mail\.json\.pre-etapa-[ab]-[0-9]{8}-[0-9]{6}-[0-9]+)$'
mapfile -t DBS < <(cd "$BACKUP_DIR" && find . -maxdepth 1 -type f -name 'bydlight-pre-etapa-*.db' -printf '%T@ %f\n' | sort -rn | awk '{print $2}')
KEEP=("${DBS[@]:0:2}")   # los 2 respaldos .db mas recientes nunca se borran
now=$(date +%s); total=0; vencidos=0; borrados=0
echo "Directorio: $BACKUP_DIR | caducidad: $DAYS dias | modo: $([ $EXEC = 1 ] && echo EJECUCION || echo SIMULACION)"
while IFS= read -r -d '' f; do
  b="$(basename "$f")"
  [[ "$b" =~ $NAME_RE ]] || continue
  total=$((total+1))
  m=$(stat -c %Y -- "$f")
  age=$(( (now - m) / 86400 ))
  [ "$age" -gt "$DAYS" ] || continue
  skip=0; for k in "${KEEP[@]:-}"; do [ "$b" = "$k" ] && skip=1; done
  [ "$skip" = 0 ] || { echo "conservado (entre los 2 mas recientes): $b (${age} dias)"; continue; }
  vencidos=$((vencidos+1))
  if [ "$EXEC" = 1 ]; then
    if command -v shred >/dev/null 2>&1; then shred -u -- "$f"; else rm -f -- "$f"; fi
    borrados=$((borrados+1)); echo "eliminado: $b (${age} dias)"
  else
    echo "vencido (se eliminaria con --ejecutar): $b (${age} dias)"
  fi
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -print0)
echo "Archivos con nombre de respaldo: $total | vencidos: $vencidos | eliminados: $borrados"
[ "$EXEC" = 1 ] && echo "CADUCIDAD DE RESPALDOS EJECUTADA" || echo "SIMULACION TERMINADA (no se borro nada)"
