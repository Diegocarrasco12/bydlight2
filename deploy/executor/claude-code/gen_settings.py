#!/usr/bin/env python3
"""Genera el FRAGMENTO de configuracion de Claude Code que autoriza SOLO el cliente restringido bd-deploy.ps1.

NO modifica ningun archivo: imprime JSON para que el usuario lo revise (o lo aplique con apply_claude_config.py).
Politica generada:
  * allow: una regla EXACTA por operacion de lectura (nivel 0), sin comodines amplios.
  * ask: toda operacion que modifica (fetch, build, up, rollback) y las de nivel 2 (accept-compose): cada despliegue a
    produccion exige confirmacion en el chat, ademas de la aprobacion humana en el servidor para nivel 2.
  * deny: ssh/scp/sftp/cloudflared directos, ~/.ssh y la edicion del cliente, del hook y de settings.json.
No usa bypassPermissions ni PowerShell(*) / Bash(*).
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import bd_lib as L  # noqa: E402

ARG_SHAPES = " -OpArgs *"


def build(tools_dir, guard_python="python"):
    tools = tools_dir.replace("\\", "/").rstrip("/")
    script = f"{tools}/bd-deploy.ps1"
    allow, ask = [], []
    for op, spec in L.OPS.items():
        base = f"powershell -NoProfile -File {script} -Op {op}"
        rule = base + ARG_SHAPES if spec["args"] else base
        (allow if spec["tier"] == 0 else ask).extend((f"PowerShell({rule})", f"Bash({rule})"))
    deny = [
        f"Edit({tools}/**)", f"Write({tools}/**)",
        "Edit(~/.claude/settings.json)", "Write(~/.claude/settings.json)",
        "PowerShell(ssh *)", "PowerShell(ssh.exe *)", "PowerShell(scp *)", "PowerShell(sftp *)",
        "PowerShell(cloudflared *)", "PowerShell(& ssh *)",
        "Bash(ssh *)", "Bash(scp *)", "Bash(sftp *)", "Bash(cloudflared *)", "Bash(/usr/bin/ssh *)",
    ]
    return {
        "permissions": {"allow": allow, "ask": ask, "deny": deny},
        "hooks": {"PreToolUse": [{
            "matcher": "Bash|PowerShell",
            "hooks": [{"type": "command", "command": f"{guard_python} \"{tools}/bd-deploy-guard.py\"", "onFailure": "block"}],
        }]},
        "env": {"CLAUDE_CODE_USE_POWERSHELL_TOOL": "1"},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tools-dir", required=True, help="carpeta donde se instalara bd-deploy.ps1 y bd-deploy-guard.py")
    ap.add_argument("--python", default="python", help="interprete para el hook")
    a = ap.parse_args()
    json.dump(build(a.tools_dir, a.python), sys.stdout, indent=2, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
