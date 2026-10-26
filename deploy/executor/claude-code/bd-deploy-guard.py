#!/usr/bin/env python3
"""Hook PreToolUse de Claude Code (Bash / PowerShell): capa ADICIONAL que niega cualquier comando que intente llegar al
servidor de bydlight2 por un camino que no sea el cliente restringido bd-deploy.ps1.

Lee el JSON del evento por stdin (tool_name, tool_input.command). Si el comando menciona SSH/SCP/cloudflared/~/.ssh o el
cliente, SOLO se deja pasar una invocacion exacta de:
    powershell -NoProfile -File <RUTA>\\bd-deploy.ps1 -Op <operacion> [-OpArgs a]
Salida: exit 2 + motivo en stderr = bloquear. Exit 0 sin salida = no opinar (las reglas de permisos deciden).
Es independiente del hook de oe-deploy: no opina sobre oe-deploy.ps1 y viceversa. No sustituye a los permisos ni al
aislamiento del servidor: es defensa en profundidad (las reglas por texto no son una frontera de seguridad).
"""
import json
import os
import re
import sys

# Espejo de bd_lib.OPS (una prueba comprueba que coincidan).
ALLOWED_OPS = ("status", "preflight", "verify", "compose-diff", "list-releases", "job-status", "logs", "fetch", "build",
               "up", "rollback", "accept-compose")
SENSITIVE = re.compile(
    r"(?<![\w-])(ssh|scp|sftp|ssh-add|ssh-keygen|ssh-agent|plink|putty|cloudflared|rsync|nc|ncat|socat)(\.exe)?(?![\w-])"
    r"|\.ssh|id_ed25519_bddeploy|bd-deploy|bd-gate|bd-run|\bdocker\b.*\b(-H|--host|context)\b", re.I)
EXACT = re.compile(
    r"^(?:powershell(?:\.exe)?|pwsh(?:\.exe)?)\s+-NoProfile\s+-File\s+\"?[A-Za-z]:[\\/][^\"\s;&|`$<>]*bd-deploy\.ps1\"?\s+"
    r"-Op\s+(?:" + "|".join(re.escape(o) for o in ALLOWED_OPS) + r")"
    r"(?:\s+-OpArgs\s+[a-z0-9][a-z0-9-]{0,63})?\s*$", re.I)


def _extra_sensitive():
    """Palabras sensibles PERSONALES (p. ej. el hostname SSH real): archivo local no versionado junto al hook."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra-sensitive.txt")
    try:
        words = [w.strip() for w in open(path, encoding="utf-8") if w.strip() and not w.startswith("#")]
    except OSError:
        return None
    return re.compile("|".join(re.escape(w) for w in words), re.I) if words else None


def decide(command):
    """Devuelve (bloquear: bool, motivo: str)."""
    if not isinstance(command, str):
        return False, ""
    extra = _extra_sensitive()
    if not SENSITIVE.search(command) and not (extra and extra.search(command)):
        return False, ""
    if "\n" in command or "\r" in command:
        return True, "comando multilinea con acceso al servidor"
    if EXACT.match(command.strip()):
        return False, ""
    return True, ("acceso al servidor solo mediante: powershell -NoProfile -File <ruta>\\bd-deploy.ps1 "
                  "-Op <operacion> [-OpArgs a]")


def main():
    try:
        event = json.load(sys.stdin)
    except Exception:  # noqa: BLE001
        return 0
    if event.get("tool_name") not in ("Bash", "PowerShell"):
        return 0
    block, why = decide((event.get("tool_input") or {}).get("command"))
    if block:
        sys.stderr.write("bd-deploy-guard: bloqueado (" + why + ")\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
