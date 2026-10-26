"""Cliente restringido y configuracion de Claude Code: solo bd-deploy.ps1, lecturas en allow, todo lo que modifica en ask."""
import json
import os
import re
import unittest

import common
import apply_claude_config as AC
import bd_lib as L
import gen_settings as GS
import importlib.util

spec = importlib.util.spec_from_file_location("bd_guard", os.path.join(common.EXEC_DIR, "claude-code", "bd-deploy-guard.py"))
GUARD = importlib.util.module_from_spec(spec)
spec.loader.exec_module(GUARD)

TOOLS = "C:/Users/x/.claude/tools/bd-deploy"
PS1 = os.path.join(common.EXEC_DIR, "claude-code", "bd-deploy.ps1")
SHA = "a" * 40
EXACT = r"powershell -NoProfile -File C:\Users\x\.claude\tools\bd-deploy\bd-deploy.ps1"


class Cliente(unittest.TestCase):
    def setUp(self):
        self.src = open(PS1, encoding="utf-8").read()

    def test_espejo_de_operaciones_y_aridad(self):
        ops = re.search(r"ValidateSet\((.*?)\)\]", self.src, re.S).group(1)
        self.assertEqual(set(re.findall(r"'([a-z-]+)'", ops)), set(L.OPS))
        arity = dict(re.findall(r"'([a-z-]+)' = (\d)", self.src.split("$Arity = @{")[1].split("}")[0]))
        for op, spec in L.OPS.items():
            self.assertEqual(int(arity[op]), len(spec["args"]), op)

    def test_conexion_con_argumentos_fijos(self):
        for need in ("-F $cfg", "BatchMode=yes", "IdentitiesOnly=yes", "ForwardAgent=no", "RequestTTY=no",
                     "ClearAllForwardings=yes", "bd-deploy $request", "bd-deploy.config"):
            self.assertIn(need, self.src)
        self.assertNotIn("oe-deploy", self.src)
        self.assertNotIn("Invoke-Expression", self.src)
        self.assertNotIn("iex ", self.src)

    def test_la_peticion_usa_la_gramatica_del_servidor(self):
        body = r"[a-z0-9-]+( [a-z0-9-]+){0,2}"
        self.assertIn(r"\A" + body + r"\z", self.src)                   # el cliente (PowerShell, -cnotmatch)
        self.assertEqual(L.REQUEST_RE.pattern, r"\A" + body + r"\Z")    # el servidor (ancla estricta, fullmatch)

    def test_ssh_config_example_sin_datos_reales(self):
        txt = open(os.path.join(common.EXEC_DIR, "claude-code", "ssh-config.example"), encoding="utf-8").read()
        self.assertIn("User bddeploy", txt)
        self.assertIn("id_ed25519_bddeploy", txt)
        self.assertIn("<SSH_HOSTNAME>", txt)
        self.assertNotRegex(txt.replace("127.0.0.1", ""), r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")
        self.assertIn("ForwardAgent no", txt)


class Reglas(unittest.TestCase):
    def setUp(self):
        self.cfg = GS.build(TOOLS)
        self.perm = self.cfg["permissions"]

    def test_solo_lecturas_en_allow(self):
        allow_ops = {m.group(1) for r in self.perm["allow"] for m in [re.search(r"-Op ([a-z-]+)", r)]}
        self.assertEqual(allow_ops, {op for op, s in L.OPS.items() if s["tier"] == 0})

    def test_todo_lo_que_modifica_pregunta(self):
        ask_ops = {m.group(1) for r in self.perm["ask"] for m in [re.search(r"-Op ([a-z-]+)", r)]}
        self.assertEqual(ask_ops, {op for op, s in L.OPS.items() if s["tier"] >= 1})
        self.assertTrue({"fetch", "build", "up", "rollback", "accept-compose"} <= ask_ops)

    def test_sin_comodines_amplios_ni_bypass(self):
        txt = json.dumps(self.cfg)
        self.assertNotIn("bypassPermissions", txt)
        for rule in self.perm["allow"] + self.perm["ask"]:
            self.assertRegex(rule, r"^(PowerShell|Bash)\(powershell -NoProfile -File C:/Users/x/\.claude/tools/bd-deploy/bd-deploy\.ps1 -Op [a-z-]+( -OpArgs \*)?\)$")

    def test_deny_de_acceso_directo(self):
        deny = " ".join(self.perm["deny"])
        for need in ("ssh", "scp", "sftp", "cloudflared", "settings.json", "bd-deploy/**"):
            self.assertIn(need, deny)

    def test_hook_bloquea_ante_fallo(self):
        hook = self.cfg["hooks"]["PreToolUse"][0]
        self.assertEqual(hook["matcher"], "Bash|PowerShell")
        self.assertEqual(hook["hooks"][0]["onFailure"], "block")
        self.assertIn("bd-deploy-guard.py", hook["hooks"][0]["command"])

    def test_el_hook_espeja_las_operaciones(self):
        self.assertEqual(set(GUARD.ALLOWED_OPS), set(L.OPS))


class Hook(unittest.TestCase):
    def test_deja_pasar_la_invocacion_exacta(self):
        for op in ("status", "preflight", "verify", "rollback"):
            self.assertEqual(GUARD.decide(f"{EXACT} -Op {op}"), (False, ""), op)
        self.assertEqual(GUARD.decide(f"{EXACT} -Op build -OpArgs {SHA}"), (False, ""))

    def test_bloquea_lo_demas_sobre_el_servidor(self):
        for cmd in ["ssh bddeploy@host status", "ssh.exe -F x bd-deploy status", "scp a b:c", "cloudflared access ssh --hostname h",
                    "cat ~/.ssh/id_ed25519_bddeploy", "type C:\\Users\\x\\.ssh\\config", "rsync -a . h:/",
                    f"{EXACT} -Op status; whoami", f"{EXACT} -Op status | cat", f"{EXACT} -Op bash",
                    f"{EXACT} -Op build -OpArgs {SHA} extra", f"{EXACT} -Op status\nwhoami", "powershell bd-deploy.ps1 -Op status",
                    "bd-gate status", "sudo bd-run status", "powershell -File C:\\x\\otro.ps1 -Op status ssh"]:
            with self.subTest(cmd=cmd):
                self.assertTrue(GUARD.decide(cmd)[0], cmd)

    def test_no_opina_sobre_comandos_normales_ni_sobre_oe_deploy(self):
        for cmd in ["git status", "npm run build", "python -B -m unittest", "ls",
                    r"powershell -NoProfile -File C:\x\oe-deploy.ps1 -Target staging -Op status"]:
            self.assertEqual(GUARD.decide(cmd), (False, ""), cmd)


class Aplicar(unittest.TestCase):
    CUR = {"model": "x", "theme": "dark", "autoMode": {"environment": ["algo"]},
           "permissions": {"allow": ["Bash(git status)"], "deny": ["Read(.env)"]},
           "hooks": {"PreToolUse": [{"matcher": "Bash|PowerShell", "hooks": [{"type": "command", "command": "oe-guard"}]}]},
           "env": {"A": "1"}}

    def test_fusion_aditiva_sin_tocar_nada_existente(self):
        new = AC.merge(self.CUR, GS.build(TOOLS))
        self.assertEqual(new["model"], "x")
        self.assertEqual(new["autoMode"], self.CUR["autoMode"])
        self.assertIn("Bash(git status)", new["permissions"]["allow"])
        self.assertIn("Read(.env)", new["permissions"]["deny"])
        self.assertEqual(new["hooks"]["PreToolUse"][0], self.CUR["hooks"]["PreToolUse"][0])  # hook de oe-deploy intacto
        self.assertEqual(len(new["hooks"]["PreToolUse"]), 2)
        self.assertEqual(new["env"]["A"], "1")

    def test_idempotente(self):
        once = AC.merge(self.CUR, GS.build(TOOLS))
        self.assertEqual(AC.merge(once, GS.build(TOOLS)), once)

    def test_no_quita_ni_afloja_reglas_existentes(self):
        new = AC.merge(self.CUR, GS.build(TOOLS))
        for k in ("allow", "deny"):
            for r in self.CUR["permissions"][k]:
                self.assertIn(r, new["permissions"][k])


if __name__ == "__main__":
    unittest.main()
