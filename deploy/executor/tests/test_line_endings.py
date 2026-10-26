"""Los scripts que corren en Linux deben tener finales de linea LF (git en Windows convierte a CRLF si no se fuerza)."""
import json
import os
import re
import unittest

import common

ROOT = os.path.abspath(os.path.join(common.EXEC_DIR, "..", ".."))
SCRIPTS = ["bd-gate", "bd-run", "bd-approve", "install.sh", "uninstall.sh", "lib-txn.sh", "bd_lib.py", "bd_ops.py",
           "policy.example.json"]


def read(name):
    with open(os.path.join(common.EXEC_DIR, name), "rb") as fh:
        return fh.read()


class Lf(unittest.TestCase):
    def test_sin_crlf(self):
        for name in SCRIPTS:
            self.assertNotIn(b"\r\n", read(name), name)

    def test_shebang(self):
        for name in ("bd-gate", "bd-run", "bd-approve"):
            self.assertTrue(read(name).startswith(b"#!/usr/bin/python3 -I\n"), name)
        for name in ("install.sh", "uninstall.sh"):
            self.assertTrue(read(name).startswith(b"#!/usr/bin/env bash\n"), name)

    def test_gitattributes_fuerza_lf(self):
        with open(os.path.join(ROOT, ".gitattributes"), encoding="utf-8") as fh:
            txt = fh.read()
        self.assertIn("deploy/** text eol=lf", txt)
        self.assertIn("Dockerfile text eol=lf", txt)


class Politica(unittest.TestCase):
    def test_el_ejemplo_solo_tiene_el_placeholder_del_usuario_de_github(self):
        txt = read("policy.example.json").decode("utf-8")
        self.assertEqual(sorted(set(re.findall(r"<[A-Z_]+>", txt))), ["<GITHUB_USER>"])
        self.assertEqual(json.loads(txt)["common"]["git_branch"], "main")


if __name__ == "__main__":
    unittest.main()
