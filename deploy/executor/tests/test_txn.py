"""Motor de transaccion/reversion del instalador (lib-txn.sh) ejecutado DE VERDAD con bash sobre un arbol temporal:
una instalacion que falla a la mitad debe dejar el sistema exactamente como estaba."""
import os
import shutil
import subprocess
import tempfile
import unittest

import common

LIB = os.path.join(common.EXEC_DIR, "lib-txn.sh").replace("\\", "/")
BASH = shutil.which("bash")


@unittest.skipUnless(BASH, "requiere bash")
class Txn(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def sh(self, script):
        """Ejecuta `script` con lib-txn.sh cargada; $T es el arbol temporal (ruta POSIX)."""
        prelude = (f'set -Eeuo pipefail\nT=$(cd "$BD_T" && pwd)\n. "{LIB}"\nexport TXN_TMPBASE="$T"\n'
                   'TXN_ALLOW=("$T/sbin" "$T/etc/bd" "$T/var/bd" "$T/sudoers.d/bd" "$T/home/.ssh/authorized_keys")\n')
        env = dict(os.environ, BD_T=self.tmp.name)
        return subprocess.run([BASH, "-c", prelude + script], capture_output=True, text=True, env=env)

    def tree(self):
        out = []
        for root, dirs, files in os.walk(self.tmp.name):
            rel = os.path.relpath(root, self.tmp.name)
            if rel.split(os.sep)[0].startswith("bd-install."):
                continue
            for n in dirs + files:
                out.append(os.path.normpath(os.path.join(rel, n)))
        return sorted(out)

    def contents(self, rel):
        with open(os.path.join(self.tmp.name, rel), encoding="utf-8") as fh:
            return fh.read()

    # ---------------------------------------------------------------------------------------------------------
    def test_rollback_deja_el_sistema_como_estaba(self):
        r = self.sh('''
mkdir -p "$T/home/.ssh" "$T/etc"
echo original > "$T/home/.ssh/authorized_keys"
echo ajeno > "$T/etc/otro-proyecto.conf"
txn_begin
txn_new "$T/etc/bd";   mkdir -p "$T/etc/bd/keys"; echo k > "$T/etc/bd/keys/prod"
txn_new "$T/var/bd";   mkdir -p "$T/var/bd/jobs";  echo s > "$T/var/bd/state.json"
mkdir -p "$T/sbin"; txn_new "$T/sbin/bd-run"; echo x > "$T/sbin/bd-run"
txn_modify "$T/home/.ssh/authorized_keys"; echo "restrict,command=... clave" > "$T/home/.ssh/authorized_keys"
txn_rollback
''')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("reversion verificada", r.stderr)
        self.assertEqual(self.contents("home/.ssh/authorized_keys").strip(), "original")
        self.assertEqual(self.contents("etc/otro-proyecto.conf").strip(), "ajeno")
        for gone in ("etc/bd", "var/bd", "sbin/bd-run"):
            self.assertFalse(os.path.exists(os.path.join(self.tmp.name, gone)), gone)
        # lo que ya existia (y no era nuestro) sigue ahi: sbin/ no se borro porque no se registro
        self.assertTrue(os.path.isdir(os.path.join(self.tmp.name, "sbin")))

    def test_instalacion_que_falla_a_la_mitad_se_revierte_sola(self):
        for parent in ("etc", "var", "sbin"):      # padres del sistema: existen antes de instalar
            os.makedirs(os.path.join(self.tmp.name, parent))
        os.makedirs(os.path.join(self.tmp.name, "home", ".ssh"))
        with open(os.path.join(self.tmp.name, "home", ".ssh", "authorized_keys"), "w") as fh:
            fh.write("")
        before = self.tree()
        r = self.sh('''
on_exit() { rc=$?; trap - EXIT; if [ "$TXN_ACTIVE" -eq 1 ]; then [ "$rc" -ne 0 ] || rc=1; txn_rollback >&2 || echo "INCOMPLETA" >&2; fi; exit "$rc"; }
trap on_exit EXIT
txn_begin
txn_new "$T/var/bd"; mkdir -p "$T/var/bd/approvals"
txn_new "$T/etc/bd"; mkdir -p "$T/etc/bd/keys"; echo clave > "$T/etc/bd/keys/prod_deploy"
mkdir -p "$T/sbin"; txn_new "$T/sbin/bd-gate"; echo gate > "$T/sbin/bd-gate"
txn_modify "$T/home/.ssh/authorized_keys"; echo nueva > "$T/home/.ssh/authorized_keys"
false   # <- fallo a mitad de la instalacion (errexit)
echo "no debe llegar aqui"
''')
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("no debe llegar", r.stdout)
        self.assertIn("reversion verificada", r.stderr)
        self.assertNotIn("INCOMPLETA", r.stderr)
        after = self.tree()
        self.assertEqual(after, before)
        self.assertEqual(self.contents("home/.ssh/authorized_keys"), "")

    def test_die_y_senales_tambien_revierten(self):
        for trigger in ('exit 7', 'kill -TERM $$; sleep 1', 'kill -INT $$; sleep 1', 'kill -HUP $$; sleep 1'):
            with self.subTest(trigger=trigger):
                r = self.sh(f'''
on_exit() {{ rc=$?; trap - EXIT; if [ "$TXN_ACTIVE" -eq 1 ]; then [ "$rc" -ne 0 ] || rc=1; txn_rollback >&2; fi; exit "$rc"; }}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
txn_begin
txn_new "$T/etc/bd"; mkdir -p "$T/etc/bd"; echo x > "$T/etc/bd/f"
{trigger}
txn_commit
''')
                self.assertNotEqual(r.returncode, 0, r.stderr)
                self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "etc", "bd")), f"{trigger}: quedo etc/bd")

    def test_commit_conserva_todo(self):
        r = self.sh('''
txn_begin
txn_new "$T/etc/bd"; mkdir -p "$T/etc/bd"; echo x > "$T/etc/bd/f"
txn_commit
[ "$TXN_ACTIVE" -eq 0 ]
''')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(os.path.exists(os.path.join(self.tmp.name, "etc", "bd", "f")))
        # las copias temporales de la transaccion se descartan
        self.assertFalse([n for n in os.listdir(self.tmp.name) if n.startswith("bd-install.")])

    def test_txn_new_no_pisa_lo_existente(self):
        os.makedirs(os.path.join(self.tmp.name, "etc", "bd"))
        r = self.sh('txn_begin\ntxn_new "$T/etc/bd"\n')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ya existe", r.stderr)
        self.assertTrue(os.path.isdir(os.path.join(self.tmp.name, "etc", "bd")))

    def test_rutas_fuera_de_la_lista_o_con_dotdot_se_rechazan(self):
        for path in ('"$T/etc/otro"', '"$T/etc/bd/../otro"', '"$T/etc/bdx"', '"relativa/x"', '"/etc/passwd"',
                     '"$T/etc/bd//x"', '""'):
            with self.subTest(path=path):
                r = self.sh(f'txn_begin\ntxn_new {path}\n')
                self.assertNotEqual(r.returncode, 0)
                r = self.sh(f'txn_begin\ntxn_modify {path}\n')
                self.assertNotEqual(r.returncode, 0)

    def test_la_reversion_se_niega_a_borrar_fuera_de_la_lista_permitida(self):
        outside = os.path.join(self.tmp.name, "afuera")
        os.makedirs(outside)
        with open(os.path.join(outside, "importante.txt"), "w") as fh:
            fh.write("no borrar")
        r = self.sh('''
txn_begin
TXN_ENTRIES+=("new|$T/afuera|")          # una entrada corrupta/maliciosa
txn_new "$T/etc/bd"; mkdir -p "$T/etc/bd"
txn_rollback
''')
        self.assertNotEqual(r.returncode, 0)          # la reversion se declara incompleta
        self.assertIn("ruta no permitida", r.stderr)
        self.assertTrue(os.path.exists(os.path.join(outside, "importante.txt")))
        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "etc", "bd")))   # lo legitimo si se revirtio

    def test_rollback_detecta_que_algo_no_se_pudo_deshacer(self):
        r = self.sh('''
txn_begin
txn_new "$T/etc/bd"; mkdir -p "$T/etc/bd"
rm() { :; }       # simula que el borrado falla silenciosamente
txn_rollback
''')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("reversion INCOMPLETA", r.stderr)

    def test_manifiesto(self):
        os.makedirs(os.path.join(self.tmp.name, "home", ".ssh"))
        with open(os.path.join(self.tmp.name, "home", ".ssh", "authorized_keys"), "w") as fh:
            fh.write("")
        r = self.sh('txn_begin\ntxn_new "$T/etc/bd"\ntxn_modify "$T/home/.ssh/authorized_keys"\ntxn_manifest\n')
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = r.stdout.strip().splitlines()
        self.assertTrue(lines[0].startswith("new ") and lines[0].endswith("/etc/bd"))
        self.assertTrue(lines[1].startswith("modified ") and lines[1].endswith("authorized_keys"))


if __name__ == "__main__":
    unittest.main()
