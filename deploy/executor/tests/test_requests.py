"""Gramatica cerrada de peticiones: bddeploy no puede ejecutar comandos arbitrarios ni operar fuera de bydlight2."""
import re
import unittest

import common  # noqa: F401  (configura sys.path)
import bd_lib as L

SHA = "a" * 40


class Validas(unittest.TestCase):
    def test_operaciones_validas(self):
        for raw, op, args in [
            ("status", "status", ()), ("preflight", "preflight", ()), ("verify", "verify", ()),
            ("compose-diff", "compose-diff", ()), ("list-releases", "list-releases", ()),
            ("rollback", "rollback", ()), ("logs 50", "logs", ("50",)), (f"fetch {SHA}", "fetch", (SHA,)),
            (f"build {SHA}", "build", (SHA,)), (f"up {SHA}", "up", (SHA,)), (f"accept-compose {SHA}", "accept-compose", (SHA,)),
            ("job-status " + "0123456789abcdef", "job-status", ("0123456789abcdef",)),
        ]:
            r = L.parse_request(raw)
            self.assertEqual((r.op, r.args), (op, args), raw)

    def test_niveles(self):
        self.assertEqual(L.parse_request("status").tier, 0)
        self.assertEqual(L.parse_request(f"up {SHA}").tier, 1)
        self.assertEqual(L.parse_request(f"accept-compose {SHA}").tier, 2)


class Rechazadas(unittest.TestCase):
    INYECCIONES = [
        "bash", "sh -c id", "status; id", "status && id", "status | cat", "status `id`", "status $(id)", "status > /tmp/x",
        "status\nid", "status\r", "STATUS", "Status", "status  ", " status", "status ", "", "   ",
        "cat /etc/passwd", "docker ps", "docker compose down -v", "sudo -n id", "ssh localhost", "../status",
        "status ../../etc", "logs web 10", "logs 0", "logs 201", "logs -1", "logs 10 20", "logs 1e3",
        f"fetch {SHA[:39]}", f"fetch {SHA}0", f"fetch {SHA.upper()}", "fetch HEAD", "fetch main", f"fetch {SHA} extra",
        f"build backend {SHA}", f"up web {SHA}", "up", "build", "fetch", f"rollback {SHA}", f"status {SHA}",
        "job-status ../x", "job-status 123", "job-status zzzzzzzzzzzzzzzz",
        "x" * 200, "status " + "a" * 200,
    ]

    def test_inyecciones_y_formas_invalidas(self):
        for raw in self.INYECCIONES:
            with self.subTest(raw=raw):
                with self.assertRaises(L.RequestError):
                    L.parse_request(raw)

    def test_no_se_puede_operar_otros_proyectos_ni_entornos(self):
        # Gramatica de oe-deploy (<entorno> <operacion>) y operaciones propias de Only Energy/Medusa.
        for raw in ["prod status", "staging status", "prod up backend", "backup", "catalog-load apply", "db-migrate " + SHA,
                    "search-migrate-safe", "rollback-images 20261014-115623", "build backend " + SHA, "logs postgres 10",
                    "accept-compose-extra " + SHA, "down", "prune", "restart", "exec web sh", "run web sh", "cp a b"]:
            with self.subTest(raw=raw):
                with self.assertRaises(L.RequestError):
                    L.parse_request(raw)

    def test_operaciones_de_administrador_no_pasan_por_la_gramatica(self):
        for op in L.ADMIN_OPS:
            self.assertNotIn(op, L.OPS)
            with self.assertRaises(L.RequestError):
                L.parse_request(op)

    def test_ninguna_operacion_acepta_texto_libre(self):
        for op, spec in L.OPS.items():
            for kind in spec["args"]:
                self.assertIn(kind, ("sha", "job", "lines"))

    def test_todo_argumento_valido_cumple_el_alfabeto_cerrado(self):
        for op, spec in L.OPS.items():
            self.assertRegex(op, r"^[a-z-]+$")
        self.assertTrue(re.match(L.REQUEST_RE.pattern, "status"))


if __name__ == "__main__":
    unittest.main()
