#!/usr/bin/env python3
"""Fusiona de forma ADITIVA y reversible la configuracion minima de Claude Code para usar bd-deploy.

Lo ejecuta el USUARIO (no Claude): modifica ~/.claude/settings.json y copia el cliente a ~/.claude/tools/bd-deploy.
Por defecto solo MUESTRA lo que haria. Con --apply: copia de seguridad de settings.json, copia del cliente y fusion.

  python apply_claude_config.py                 # plan (no cambia nada)
  python apply_claude_config.py --apply         # aplica
  python apply_claude_config.py --rollback      # restaura la ultima copia de seguridad de settings.json

Garantias: no toca autoMode, model, theme ni ninguna otra clave; no quita reglas existentes (incluidas las de oe-deploy);
solo agrega reglas exactas de bd-deploy, las negaciones de ssh/scp/sftp/cloudflared y su hook. Sin bypassPermissions.
"""
import argparse
import glob
import json
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_settings  # noqa: E402

CLAUDE = os.path.join(os.path.expanduser("~"), ".claude")
SETTINGS = os.path.join(CLAUDE, "settings.json")
TOOLS = os.path.join(CLAUDE, "tools", "bd-deploy")
FILES = ("bd-deploy.ps1", "bd-deploy-guard.py")


def load():
    if not os.path.exists(SETTINGS):
        return {}
    with open(SETTINGS, encoding="utf-8-sig") as fh:
        return json.load(fh)


def merge(cur, frag):
    out = json.loads(json.dumps(cur))
    perms = out.setdefault("permissions", {})
    for k in ("allow", "ask", "deny"):
        have = perms.setdefault(k, [])
        for r in frag["permissions"].get(k, []):
            if r not in have:
                have.append(r)
    hooks = out.setdefault("hooks", {}).setdefault("PreToolUse", [])
    for h in frag["hooks"]["PreToolUse"]:
        if h not in hooks:
            hooks.append(h)
    env = out.setdefault("env", {})
    for k, v in frag["env"].items():
        env.setdefault(k, v)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    a = ap.parse_args()

    if a.rollback:
        baks = sorted(glob.glob(SETTINGS + ".bak-bd-*"))
        if not baks:
            sys.exit("no hay copias de seguridad .bak-bd-*")
        shutil.copy2(baks[-1], SETTINGS)
        print("settings.json restaurado desde", baks[-1])
        return

    for f in FILES:
        if not os.path.isfile(os.path.join(HERE, f)):
            sys.exit(f"falta {f} junto a este script")
    tools = TOOLS.replace("\\", "/")
    frag = gen_settings.build(tools, "python")
    cur = load()
    new = merge(cur, frag)
    added = {k: len(new["permissions"][k]) - len(cur.get("permissions", {}).get(k, [])) for k in ("allow", "ask", "deny")}
    print(f"reglas a agregar -> allow: {added['allow']}  ask: {added['ask']}  deny: {added['deny']}")
    print(f"hook PreToolUse: {'ya presente' if new['hooks']['PreToolUse'] == cur.get('hooks', {}).get('PreToolUse') else 'se agrega'}")
    print(f"claves de primer nivel que NO se tocan: {sorted(k for k in cur if k not in ('permissions', 'hooks', 'env'))}")
    print(f"cliente: {', '.join(FILES)} -> {TOOLS}")
    if not a.apply:
        print("\n(plan) agregue --apply para aplicar. Rollback: --rollback")
        return

    os.makedirs(TOOLS, exist_ok=True)
    for f in FILES:
        shutil.copy2(os.path.join(HERE, f), os.path.join(TOOLS, f))
    if os.path.exists(SETTINGS):
        bak = f"{SETTINGS}.bak-bd-{time.strftime('%Y%m%d-%H%M%S')}"
        shutil.copy2(SETTINGS, bak)
        print("copia de seguridad:", bak)
    tmp = SETTINGS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(new, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, SETTINGS)
    print("settings.json actualizado. Reinicie Claude Code y revise /permissions.")


if __name__ == "__main__":
    main()
