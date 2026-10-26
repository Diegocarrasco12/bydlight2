"""bd-gate / bd-run / bd-approve: la cuenta bddeploy solo llega a `sudo -n bd-run <op> [arg]` con peticiones de la gramatica
cerrada; nada de shell, nada de operaciones de administrador, nada de aprobaciones."""
import importlib.machinery
import importlib.util
import os
import sys
import types
import unittest

import common
import bd_lib as L


sys.modules.setdefault("syslog", types.SimpleNamespace(openlog=lambda *a: None, syslog=lambda *a: None,
                                                       LOG_AUTH=0, LOG_WARNING=0))  # syslog solo existe en Linux


def load_script(name):
    path = os.path.join(common.EXEC_DIR, name)
    loader = importlib.machinery.SourceFileLoader(name.replace("-", "_"), path)
    spec = importlib.util.spec_from_loader(loader.name, loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


GATE = load_script("bd-gate")
RUN = load_script("bd-run")
APPROVE = load_script("bd-approve")
POLICY = common.load_policy()
SHA = "a" * 40


def argv_for(raw):
    return GATE.build_argv(raw, policy_loader=lambda: POLICY)


class Gate(unittest.TestCase):
    def test_peticion_valida_produce_exactamente_sudo_bd_run(self):
        self.assertEqual(argv_for("status"), ["/usr/bin/sudo", "-n", "--", "/usr/local/sbin/bd-run", "status"])
        self.assertEqual(argv_for(f"build {SHA}"), ["/usr/bin/sudo", "-n", "--", "/usr/local/sbin/bd-run", "build", SHA])

    def test_el_gate_solo_ejecuta_sudo_con_bd_run(self):
        for raw in ["status", "preflight", f"fetch {SHA}", f"up {SHA}", "rollback", "logs 10", f"accept-compose {SHA}"]:
            argv = argv_for(raw)
            self.assertEqual(argv[:5], ["/usr/bin/sudo", "-n", "--", "/usr/local/sbin/bd-run", raw.split()[0]])

    def test_rechaza_todo_lo_demas(self):
        for raw in ["bash", "sh", "status; id", "$(id)", "docker ps", "init-clone", "prod status", "staging up", "sudo id",
                    "/usr/local/sbin/bd-run status", "bd-approve accept-compose " + SHA, "--run-job 0123456789abcdef",
                    "status\nid", "", None]:
            with self.subTest(raw=raw):
                with self.assertRaises(L.RequestError):
                    argv_for(raw)

    def test_politica_ilegible_rechaza(self):
        def broken():
            raise OSError("sin acceso")
        with self.assertRaises(OSError):
            GATE.build_argv("status", policy_loader=broken)

    def test_rutas_del_gate_son_fijas_y_de_bydlight(self):
        self.assertEqual(GATE.POLICY, "/etc/bd-deploy/policy.json")
        self.assertEqual(GATE.BD_RUN, "/usr/local/sbin/bd-run")
        src = open(os.path.join(common.EXEC_DIR, "bd-gate"), encoding="utf-8").read()
        self.assertNotIn("oe-", src)
        self.assertNotIn("/etc/oe", src)
        self.assertIn("sys.path.insert(0, \"/usr/local/lib/bd-deploy\")", src)


class RunYApprove(unittest.TestCase):
    def test_rutas_propias_sin_mezcla_con_oe_deploy(self):
        self.assertEqual(RUN.POLICY, "/etc/bd-deploy/policy.json")
        self.assertEqual(APPROVE.POLICY, "/etc/bd-deploy/policy.json")
        self.assertEqual(os.path.join("/var/lib/bd-deploy", "x"), os.path.join(POLICY["common"]["state_dir"], "x"))
        for fn in ("bd-run", "bd-approve", "bd_ops.py", "bd_lib.py", "install.sh", "uninstall.sh", "policy.example.json"):
            src = open(os.path.join(common.EXEC_DIR, fn), encoding="utf-8").read()
            for bad in ("/etc/oe-deploy/", "/var/lib/oe-deploy", "/var/log/oe-deploy", "oe-run", "oe-gate", "oedeploy ",
                        "onlyenergy", "helios"):
                if fn == "install.sh" and bad != "onlyenergy" and bad != "helios":
                    continue  # install.sh solo NOMBRA rutas/ejecutores ajenos en las autopruebas de denegacion
                self.assertNotIn(bad, src, f"{fn}: {bad}")

    def test_bd_run_exige_root_y_valida_de_nuevo(self):
        src = open(os.path.join(common.EXEC_DIR, "bd-run"), encoding="utf-8").read()
        self.assertIn("os.geteuid() != 0", src)
        self.assertIn("L.parse_request", src)
        self.assertIn("os.environ.clear()", src)

    def test_init_clone_solo_para_administrador(self):
        src = open(os.path.join(common.EXEC_DIR, "bd-run"), encoding="utf-8").read()
        self.assertIn("L.ADMIN_OPS", src)
        self.assertIn('policy["common"]["service_user"]', src)
        self.assertEqual(L.ADMIN_OPS, ("init-clone",))
        self.assertNotIn("init-clone", L.OPS)

    def test_run_job_exige_token(self):
        src = open(os.path.join(common.EXEC_DIR, "bd-run"), encoding="utf-8").read()
        self.assertIn('job["token"] != os.environ.get("BD_JOB_TOKEN")', src)

    def test_bd_approve_rechaza_a_la_cuenta_de_servicio(self):
        src = open(os.path.join(common.EXEC_DIR, "bd-approve"), encoding="utf-8").read()
        self.assertIn('who == policy["common"]["service_user"]', src)
        self.assertIn("os.geteuid() != 0", src)


class Aprobaciones(unittest.TestCase):
    def test_rutas_de_aprobacion_estan_acotadas(self):
        p = L.approval_path(POLICY, "accept-compose", SHA)
        self.assertTrue(p.replace("\\", "/").startswith("/var/lib/bd-deploy/approvals/"))
        for bad_action, bad_arg in [("../x", SHA), ("accept-compose", "../../etc/passwd"), ("accept compose", SHA),
                                    ("accept-compose", SHA[:39])]:
            with self.assertRaises(ValueError):
                L.approval_path(POLICY, bad_action, bad_arg)

    def test_vigencia_acotada(self):
        for minutes in (0, 121, -5):
            with self.assertRaises(ValueError):
                L.write_approval(POLICY, "accept-compose", SHA, minutes, "admin")


if __name__ == "__main__":
    unittest.main()
