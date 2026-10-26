"""Regla sudoers de bddeploy: emula el emparejamiento de sudo (ruta exacta + argumentos unidos con espacios y comparados con
fnmatch) y demuestra que acepta EXACTAMENTE la gramatica de parse_request, ni una peticion mas."""
import fnmatch
import random
import re
import unittest

import common
import bd_lib as L

BD_RUN = "/usr/local/sbin/bd-run"
SHA = "0123456789abcdef" * 2 + "01234567"
JOB = "0123456789abcdef"


def sudo_allows(rules, argv):
    """argv[0] = ruta del comando. sudo: la ruta se compara exacta (no hay comodines en ella) y los argumentos se unen con
    espacios y se comparan con fnmatch sobre la cadena completa."""
    path, args = argv[0], " ".join(argv[1:])
    for rule in rules:
        rpath, _, rargs = rule.partition(" ")
        if rpath == path and fnmatch.fnmatchcase(args, rargs):
            return True
    return False


def parse_ok(raw):
    try:
        L.parse_request(raw)
        return True
    except L.RequestError:
        return False


class Reglas(unittest.TestCase):
    def setUp(self):
        self.rules = L.sudoers_commands(BD_RUN)

    def test_todas_las_reglas_son_de_bd_run_y_sin_asterisco(self):
        for r in self.rules:
            self.assertTrue(r.startswith(BD_RUN + " "), r)
            self.assertNotIn("*", r)
            self.assertNotIn("?", r)
        self.assertNotIn(BD_RUN, self.rules)       # nunca `bd-run` a secas (aceptaria cualquier argumento)

    def test_no_hay_reglas_para_init_clone_ni_run_job(self):
        txt = "\n".join(self.rules)
        self.assertNotIn("init-clone", txt)
        self.assertNotIn("--run-job", txt)
        self.assertNotIn("bd-approve", txt)

    def test_cada_peticion_valida_esta_permitida(self):
        for raw in ["status", "preflight", "verify", "compose-diff", "list-releases", "rollback", f"job-status {JOB}",
                    "logs 1", "logs 20", "logs 200", f"fetch {SHA}", f"build {SHA}", f"up {SHA}", f"accept-compose {SHA}"]:
            with self.subTest(raw=raw):
                self.assertTrue(parse_ok(raw))
                self.assertTrue(sudo_allows(self.rules, [BD_RUN] + raw.split(" ")), raw)

    def test_peticiones_hostiles_no_pasan_sudo(self):
        for argv in [
            [BD_RUN],                                          # sin operacion
            [BD_RUN, "init-clone"], [BD_RUN, "init-clone", SHA],
            [BD_RUN, "--run-job", JOB], [BD_RUN, "--run-job"],
            [BD_RUN, "status", "extra"], [BD_RUN, "status", "--help"], [BD_RUN, "rollback", SHA],
            [BD_RUN, "build"], [BD_RUN, "build", SHA[:39]], [BD_RUN, "build", SHA + "0"], [BD_RUN, "build", SHA.upper()],
            [BD_RUN, "build", SHA[:-1] + "g"], [BD_RUN, "build", "../" + SHA[:37]], [BD_RUN, "build", SHA, "extra"],
            [BD_RUN, "up", "HEAD"], [BD_RUN, "fetch", "main"], [BD_RUN, "accept-compose", "x" * 40],
            [BD_RUN, "logs"], [BD_RUN, "logs", "0001"], [BD_RUN, "logs", "-1"], [BD_RUN, "logs", "1 2"], [BD_RUN, "logs", "1a"],
            [BD_RUN, "job-status", JOB[:15]], [BD_RUN, "job-status", JOB + "0"],
            [BD_RUN, "status;id"], [BD_RUN, "status\nid"], [BD_RUN, "status", ";id"], [BD_RUN, "status", "$(id)"],
            [BD_RUN, "build", SHA + "\n"], [BD_RUN, "build", SHA + " "],
            ["/usr/local/sbin/bd-run2", "status"], ["/usr/local/sbin/bd-run/", "status"], ["/tmp/bd-run", "status"],
            ["/usr/local/sbin/../sbin/bd-run", "status"], ["bd-run", "status"],
            ["/usr/local/sbin/oe-run", "status"], ["/usr/bin/docker", "ps"], ["/bin/sh", "-c", "id"],
        ]:
            with self.subTest(argv=argv):
                self.assertFalse(sudo_allows(self.rules, argv), argv)

    def test_equivalencia_aleatoria_regla_y_gramatica(self):
        """sudo acepta una peticion <=> parse_request la acepta (aparte del limite de 200 lineas, que la regla de
        3 digitos admite pero bd-run rechaza: sudo es mas laxo y bd-run re-valida, nunca al reves)."""
        rnd = random.Random(20261026)
        alphabet = "abcdef0123456789 -;$\n\t\"'`*?[]/.xyzABC"
        samples = ["status", f"build {SHA}", "logs 7", f"job-status {JOB}", "rollback"]
        for _ in range(4000):
            base = rnd.choice(samples)
            s = list(base)
            for _ in range(rnd.randint(1, 3)):
                op = rnd.choice("ins del sub".split())
                i = rnd.randrange(len(s) + 1)
                ch = rnd.choice(alphabet)
                if op == "ins":
                    s.insert(i, ch)
                elif op == "del" and s:
                    del s[min(i, len(s) - 1)]
                elif s:
                    s[min(i, len(s) - 1)] = ch
            raw = "".join(s)
            argv = [BD_RUN] + raw.split(" ")
            if sudo_allows(self.rules, argv):
                # lo que sudo deja pasar tiene que ser una peticion de la gramatica (salvo el rango de `logs`)
                m = re.fullmatch(r"logs [0-9]{1,3}", raw)
                self.assertTrue(parse_ok(raw) or m, repr(raw))

    def test_sudo_laxo_en_logs_lo_para_bd_run(self):
        self.assertTrue(sudo_allows(self.rules, [BD_RUN, "logs", "999"]))
        self.assertFalse(parse_ok("logs 999"))
        self.assertFalse(parse_ok("logs 0"))


class Texto(unittest.TestCase):
    def setUp(self):
        self.txt = L.sudoers_text("bddeploy", BD_RUN)

    def test_solo_un_usuario_y_un_destino_root_sin_all(self):
        lines = [l for l in self.txt.splitlines() if l and not l.startswith("#")]
        grants = [l for l in lines if "ALL=" in l]
        self.assertEqual(grants, ["bddeploy ALL=(root) NOPASSWD: BD_DEPLOY_OPS"])
        self.assertNotRegex(self.txt, r"NOPASSWD:\s*ALL")
        self.assertNotIn("SETENV", self.txt)
        self.assertIn("!setenv", self.txt)

    def test_las_reglas_del_texto_son_las_de_la_gramatica(self):
        body = self.txt.split("BD_DEPLOY_OPS = ", 1)[1].split("\nbddeploy ALL", 1)[0]
        got = [c.strip().rstrip(",").rstrip(chr(92)).strip().rstrip(",") for c in body.splitlines() if c.strip()]
        self.assertEqual([g for g in got if g], L.sudoers_commands(BD_RUN))

    def test_entradas_invalidas_se_rechazan(self):
        for user in ("", "Bad User", "root;", "bddeploy\nALL", "a"):
            with self.assertRaises(ValueError):
                L.sudoers_text(user, BD_RUN)
        for path in ("relativa/bd-run", "/usr/local/sbin/bd run", "/x\nALL", "/x;y"):
            with self.assertRaises(ValueError):
                L.sudoers_text("bddeploy", path)

    def test_solo_ruta_de_bydlight(self):
        self.assertNotRegex(self.txt, r"oe-|onlyenergy|helios|projectmanager|faret")
        self.assertEqual(set(re.findall(r"/\S*bd-run", self.txt)), {BD_RUN})


if __name__ == "__main__":
    unittest.main()
