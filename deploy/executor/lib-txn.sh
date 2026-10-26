#!/usr/bin/env bash
# Libreria de TRANSACCION del instalador de bd-deploy (se "source"-a desde install.sh; no se ejecuta sola).
#
# Contrato: ANTES de crear o modificar una ruta se registra (txn_new / txn_modify). Si la instalacion falla en cualquier
# punto (error, die, Ctrl-C, SIGTERM, autoprueba fallida), txn_rollback deshace TODO en orden inverso:
#   - rutas nuevas  -> se borran (solo las que ESTA instalacion creo; txn_new falla si la ruta ya existia),
#   - rutas modificadas -> se restauran desde una copia hecha antes de tocarlas.
# Solo se opera sobre rutas dentro de la lista TXN_ALLOW (prefijos) y nunca con '..': aunque un bug pidiera borrar
# otra cosa, la reversion se niega. Despues de revertir se VERIFICA que no quede nada.

TXN_DIR=""
TXN_N=0
TXN_ACTIVE=0
TXN_ENTRIES=()
TXN_ALLOW=()

txn_msg() { printf '%s\n' "$*" >&2; }

txn_begin() {
  TXN_DIR=$(mktemp -d "${TXN_TMPBASE:-/var/tmp}/bd-install.XXXXXX") || return 1
  chmod 700 "$TXN_DIR"
  TXN_N=0
  TXN_ENTRIES=()
  TXN_ACTIVE=1
}

# 0 si la ruta esta dentro de un prefijo permitido y es "limpia".
txn_allowed() {
  local p="$1" a
  case "$p" in ""|*..*|*//*|*$'\n'*) return 1 ;; /*) ;; *) return 1 ;; esac
  for a in "${TXN_ALLOW[@]}"; do
    case "$p" in "$a"|"$a"/*) return 0 ;; esac
  done
  return 1
}

# Ruta que esta instalacion va a CREAR: debe estar permitida y no existir. Se registra antes de crearla.
txn_new() {
  txn_allowed "$1" || { txn_msg "txn: ruta fuera de la lista permitida: $1"; return 1; }
  if [ -e "$1" ] || [ -L "$1" ]; then txn_msg "txn: ya existe (no se pisa): $1"; return 1; fi
  TXN_ENTRIES+=("new|$1|")
}

# Ruta preexistente que se va a MODIFICAR: se copia antes (si no existe, equivale a txn_new).
txn_modify() {
  txn_allowed "$1" || { txn_msg "txn: ruta fuera de la lista permitida: $1"; return 1; }
  if [ -e "$1" ] || [ -L "$1" ]; then
    TXN_N=$((TXN_N + 1))
    cp -a -- "$1" "$TXN_DIR/b$TXN_N" || return 1
    TXN_ENTRIES+=("restore|$1|$TXN_DIR/b$TXN_N")
  else
    TXN_ENTRIES+=("new|$1|")
  fi
}

# Revierte todo en orden inverso. Devuelve 0 solo si, ademas, la verificacion posterior confirma que no quedo nada.
txn_rollback() {
  trap '' INT TERM HUP
  local i entry kind path bak bad=0
  for ((i = ${#TXN_ENTRIES[@]} - 1; i >= 0; i--)); do
    entry="${TXN_ENTRIES[i]}"
    kind="${entry%%|*}"; entry="${entry#*|}"
    path="${entry%%|*}"; bak="${entry#*|}"
    if ! txn_allowed "$path"; then txn_msg "  reversion: se omite una ruta no permitida: $path"; bad=1; continue; fi
    case "$kind" in
      new)
        rm -rf -- "$path" 2>/dev/null || true
        ;;
      restore)
        rm -rf -- "$path" 2>/dev/null || true
        cp -a -- "$bak" "$path" 2>/dev/null || { txn_msg "  reversion: no se pudo restaurar $path"; bad=1; }
        ;;
    esac
  done
  # verificacion: nada de lo nuevo sigue ahi; lo restaurado coincide con la copia
  for entry in "${TXN_ENTRIES[@]}"; do
    kind="${entry%%|*}"; entry="${entry#*|}"
    path="${entry%%|*}"; bak="${entry#*|}"
    case "$kind" in
      new) if [ -e "$path" ] || [ -L "$path" ]; then txn_msg "  reversion INCOMPLETA: sigue existiendo $path"; bad=1; fi ;;
      restore) if ! diff -r -- "$bak" "$path" >/dev/null 2>&1; then txn_msg "  reversion INCOMPLETA: $path no coincide con el original"; bad=1; fi ;;
    esac
  done
  [ -n "$TXN_DIR" ] && rm -rf -- "$TXN_DIR"
  TXN_ACTIVE=0
  TXN_ENTRIES=()
  if [ "$bad" -eq 0 ]; then txn_msg "  reversion verificada: no quedo ningun cambio de esta instalacion"; fi
  return "$bad"
}

# Confirma la transaccion (descarta las copias).
txn_commit() {
  [ -n "$TXN_DIR" ] && rm -rf -- "$TXN_DIR"
  TXN_ACTIVE=0
}

# Lista (una por linea) de las rutas nuevas registradas: sirve de manifiesto de lo instalado.
txn_manifest() {
  local entry kind path
  for entry in "${TXN_ENTRIES[@]}"; do
    kind="${entry%%|*}"; entry="${entry#*|}"; path="${entry%%|*}"
    [ "$kind" = "new" ] && printf 'new %s\n' "$path"
    [ "$kind" = "restore" ] && printf 'modified %s\n' "$path"
  done
  return 0
}
