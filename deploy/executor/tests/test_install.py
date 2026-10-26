"""Instalador: modos --plan/--apply/--verify, transaccion/reversion, sudoers explicito, compatibilidad sshd, y que lo que
instala sea lo minimo (sin tocar nada de otros proyectos)."""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import common

INSTALL = os.path.join(common.EXEC_DIR, "install.sh")
UNINSTALL = os.path.join(common.EXEC_DIR, "uninstall.sh")
SRC = open(INSTALL, encoding="utf-8").read()
APPLY_PART = SRC.split("# ---------------------------- aplicar (transaccion)")[1]
VERIFY_PART = SRC.split("verify() {")[1].split("\nif [ \"$VERIFY\" -eq 1 ]")[0]
BASH = shutil.which("bash")


class Estatico(unittest.TestCase):
    def test_modos_plan_apply_verify(self):
        for flag in ("--plan)", "--apply)", "--verify)"):
            self.assertIn(flag, SRC)
        self.assertIn("APPLY=0", SRC)   # por defecto solo plan
        self.assertIn("Nada se ha cambiado", SRC)

    def test_sudoers_se_genera_desde_la_gramatica_sin_bd_run_a_secas(self):
        self.assertIn("bd_lib.sudoers_text", SRC)
        self.assertIn("visudo -cf", SRC)
        self.assertIn("visudo -c >/dev/null", SRC)
        self.assertNotIn("NOPASSWD: ALL", SRC)
        self.assertNotIn('NOPASSWD: $SBIN/bd-run\n', SRC)   # la antigua regla de un solo comando sin argumentos
        self.assertNotRegex(APPLY_PART, r"NOPASSWD:\s*\S*bd-run\s*$")

    def test_no_otorga_privilegios_a_bddeploy(self):
        for bad in ("usermod", "gpasswd", "adduser", "useradd", "groupadd", "chsh", " -aG", " -G docker", "chmod 666",
                    "chmod 777", "chown -R", "setfacl"):
            self.assertNotIn(bad, SRC, bad)
        for need in ("grupo privilegiado", "/usr/sbin/nologin", "contrasena bloqueada", "StrictModes"):
            self.assertIn(need, SRC)

    def test_no_toca_infraestructura_ajena(self):
        for bad in ("docker run", "docker compose", "docker rm", "docker stop", "docker network", "docker volume",
                    "docker system", "systemctl restart", "systemctl stop", "systemctl enable", "ufw ", "iptables",
                    "nginx", "/etc/ssh/sshd_config ", "sshd_config\n"):
            self.assertNotIn(bad, APPLY_PART, bad)
        # solo recarga sshd, solo escribe su propio drop-in y nunca escribe en rutas de oe-deploy
        self.assertIn("systemctl reload ssh", APPLY_PART)
        for line in APPLY_PART.splitlines():
            if re.search(r"(install|cp|mv|rm|chmod|chown|cat >|tee)\b", line):
                self.assertNotRegex(line, r"oe-deploy|oedeploy|/srv/(onlyenergy|helios)", line)

    def test_sshd_bloque_acotado(self):
        block = APPLY_PART.split("Match User $BDUSER")[1].split("EOT")[0]
        for need in ("ForceCommand $SBIN/bd-gate", "PermitTTY no", "AllowTcpForwarding no", "AllowAgentForwarding no",
                     "PasswordAuthentication no", "AuthenticationMethods publickey", "X11Forwarding no", "PermitTunnel no"):
            self.assertIn(need, block)
        self.assertIn('restrict,command="%s/bd-gate",from="127.0.0.1,::1"', APPLY_PART)

    def test_compatibilidad_sshd_con_otros_usuarios(self):
        # la configuracion efectiva de sshd de TODOS los demas usuarios (admin, oedeploy, uid>=900, inexistente) se
        # compara antes y despues; si difiere, die -> reversion
        for need in ("snap_sshd", "diff -r \"$SNAP_DIR/before\" \"$SNAP_DIR/after\"", "oedeploy", "203.0.113.9",
                     "zz-usuario-inexistente", "IDENTICA antes y despues", "sshd -t"):
            self.assertIn(need, SRC)
        self.assertLess(APPLY_PART.index('snap_sshd "$SNAP_DIR/before"'), APPLY_PART.index("txn_new \"$STATE\""))  # antes de cambiar
        reload_main = APPLY_PART.index("systemctl reload ssh", APPLY_PART.index('txn_new "$SSHD_DROPIN"'))
        self.assertLess(APPLY_PART.index('snap_sshd "$SNAP_DIR/after"'), reload_main)  # comparar ANTES de recargar
        self.assertIn("Match User $BDUSER", APPLY_PART)
        # preflight: includes necesarios y restricciones de usuarios
        for need in ("sshd_config.d", "AllowUsers", "includedir", "PubkeyAuthentication"):
            self.assertIn(need, SRC)

    def test_el_bloque_sshd_es_lo_ultimo_que_se_activa(self):
        order = [APPLY_PART.index(x) for x in ('txn_new "$SUDOERS"', "txn_modify \"$AUTHKEYS\"", 'txn_new "$SSHD_DROPIN"',
                                               "SSHD_RELOADED=1", "verify || die", "txn_commit")]
        self.assertEqual(order, sorted(order))

    def test_verify_cubre_aislamiento_con_controles_positivos(self):
        for need in ("control positivo", "NO esta en grupos privilegiados", "no puede usar el socket de Docker",
                     "la superficie de sudo", "EXACTAMENTE la gramatica de bd_lib", "sudo rechaza bd-run init-clone",
                     "sudo rechaza bd-run --run-job", "sudo rechaza bd-approve", "sudo rechaza bd-run sin argumentos",
                     "bd-gate rechaza comando arbitrario", "bd-gate rechaza una shell", "bd-gate rechaza init-clone",
                     "ForceCommand efectivo", "el bloque NO aplica al usuario", "no puede acceder a las claves de deploy",
                     "no puede acceder al directorio del proyecto", "audit_perms"):
            self.assertIn(need, VERIFY_PART)
        self.assertIn('chk "permisos $path = $own $mode"', SRC)

    def test_autopruebas_sin_combinaciones_ambiguas(self):
        # Antes: `! cmd1 && ! cmd2` y `! cmd | grep -q .` pasaban si la ruta no existia o si runuser fallaba.
        self.assertNotRegex(VERIFY_PART, r'chk bash -c "!')
        self.assertNotRegex(VERIFY_PART, r"\|\s*grep -q \.")
        # cada negativo usa una funcion con resultado explicito; las rutas inexistentes se OMITEN (rc 2), no pasan
        self.assertIn("[ -e \"$1\" ] || return 2", SRC)
        self.assertIn('[ "$rc" -eq 126 ]', SRC)                     # bd-gate: exit 126 concreto + mensaje propio
        self.assertIn("bd-gate: rechazado", SRC)
        self.assertIn("not allowed|password is required", SRC)       # sudo: rechazo POR SUDO, no un error cualquiera
        self.assertIn("if \"$@\" >/dev/null 2>&1; then rc=0; else rc=$?; fi", SRC)  # sin depender de errexit
        # condiciones preexistentes de otros proyectos: aviso, no abortan
        self.assertIn("chkw()", SRC)

    def test_permisos_propietarios_auditados(self):
        for row in ("$LIBDIR root:root 755", "$SBIN/bd-run root:root 700", "$ETC/keys root:root 700",
                    "$ETC/keys/prod_deploy root:root 600", "$STATE root:root 750", "$STATE/approvals root:root 700",
                    "$SUDOERS root:root 440", "$SSHD_DROPIN root:root 644", "$BDHOME/.ssh $BDUSER 700", "$AUTHKEYS $BDUSER 600"):
            self.assertIn(row, SRC)

    def test_politica_definitiva_sin_placeholders_y_rutas_fijas(self):
        self.assertIn("placeholders", SRC)
        for need in ('common.${pair%%:*} debe ser', "project.deploy_key debe ser", "service_user debe ser bddeploy"):
            self.assertIn(need, SRC)

    def test_uninstall_conserva_estado_y_proyecto(self):
        u = open(UNINSTALL, encoding="utf-8").read()
        self.assertIn("se CONSERVAN /var/lib/bd-deploy", u)
        self.assertNotIn("docker", u)
        self.assertNotIn("userdel", u)
        self.assertNotIn("oe-deploy", u)

    def test_sintaxis_bash(self):
        if not BASH:
            self.skipTest("sin bash")
        for f in (INSTALL, UNINSTALL, os.path.join(common.EXEC_DIR, "lib-txn.sh")):
            r = subprocess.run([BASH, "-n", f], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)


class Transaccional(unittest.TestCase):
    """Estructura de la transaccion en install.sh (el motor se prueba de verdad en test_txn.py)."""

    def test_toda_creacion_esta_registrada_antes(self):
        # (destino, ancestro registrado con txn_new/txn_modify, marca de la primera operacion que lo crea)
        casos = [("$STATE", "$STATE", 'install -d -m 0750 -o root -g root "$STATE"'),
                 ("$LOGDIR", "$LOGDIR", 'install -d -m 0750 -o root -g root "$LOGDIR"'),
                 ("$STATE/approvals", "$STATE/approvals", '"$STATE/approvals"; '),
                 ("$STATE/jobs", "$STATE/jobs", 'install -d -m 0700 -o root -g root "$STATE/jobs"'),
                 ("$LIBDIR/bd_lib.py", "$LIBDIR", '"$LIBDIR/bd_lib.py"'),
                 ("$SBIN/bd-gate", "$SBIN/bd-gate", '"$SRC/bd-gate" "$SBIN/bd-gate"'),
                 ("$SBIN/bd-run", "$SBIN/bd-run", '"$SRC/bd-run" "$SBIN/bd-run"'),
                 ("$SBIN/bd-approve", "$SBIN/bd-approve", '"$SRC/bd-approve" "$SBIN/bd-approve"'),
                 ("$ETC/policy.json", "$ETC", '"$ETC/policy.json"'),
                 ("$ETC/keys", "$ETC", 'install -d -m 0700 -o root -g root "$ETC/keys"'),
                 ("$ETC/known_hosts", "$ETC", '"$ETC/known_hosts"'),
                 ("$SUDOERS", "$SUDOERS", 'install -m 0440 -o root -g root "$TMPS" "$SUDOERS"'),
                 ("$AUTHKEYS", "$AUTHKEYS", '> "$AUTHKEYS"'),
                 ("$SSHD_DROPIN", "$SSHD_DROPIN", 'cat > "$SSHD_DROPIN"'),
                 ("$STATE/install-manifest", "$STATE", '> "$STATE/install-manifest"')]
        for dest, anc, marca in casos:
            with self.subTest(dest=dest):
                creacion = APPLY_PART.find(marca)
                self.assertGreaterEqual(creacion, 0, marca)
                registros = [m.start() for m in re.finditer(r'txn_(?:new|modify) "' + re.escape(anc) + '"', APPLY_PART)]
                self.assertTrue(registros, f"{anc} nunca se registra")
                self.assertLess(min(registros), creacion, f"{dest} se crea antes de registrarse en la transaccion")

    def test_trampas_y_reversion(self):
        for need in ("trap on_exit EXIT", "trap 'exit 130' INT", "trap 'exit 143' TERM", "trap 'exit 129' HUP", "txn_rollback",
                     "txn_begin", "txn_commit", "TXN_ALLOW=(", "REVIRTIENDO", "La instalacion NO quedo aplicada",
                     "flock -n 9"):
            self.assertIn(need, SRC)
        # una autoprueba fallida o un die revierten: verify || die  (die -> exit 1 -> EXIT trap)
        self.assertIn('verify || die "la autoprueba de aislamiento fallo"', SRC)
        # la reversion vuelve a recargar sshd si ya lo habia recargado
        self.assertIn("SSHD_RELOADED", SRC)

    def test_rutas_permitidas_de_la_reversion_son_solo_las_del_proyecto(self):
        allow = re.search(r"TXN_ALLOW=\((.*?)\)\n", SRC, re.S).group(1)
        for ok in ("$LIBDIR", "$SBIN/bd-gate", "$SBIN/bd-run", "$SBIN/bd-approve", "$ETC", "$STATE", "$LOGDIR", "$SUDOERS",
                   "$SSHD_DROPIN", "$AUTHKEYS"):
            self.assertIn(ok, allow)
        self.assertNotIn('"/etc/ssh"', allow)
        self.assertNotIn('"/usr/local/sbin"', allow)
        self.assertNotIn('"/etc"', allow)
        self.assertNotIn('"/var/lib"', allow)


@unittest.skipUnless(BASH and (shutil.which("python3") or shutil.which("python")), "requiere bash y python")
class ModoPlan(unittest.TestCase):
    """Ejecuta install.sh en modo plan (no necesita root ni cambia nada)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        d = self.tmp.name
        pol = open(os.path.join(common.EXEC_DIR, "policy.example.json"), encoding="utf-8").read()
        self.policy = os.path.join(d, "policy.json")
        with open(self.policy, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(pol.replace("<GITHUB_USER>", "usuario-prueba"))
        # En Windows `python3` de Git Bash puede ser el alias de la Store: se antepone un shim al interprete real.
        shim_dir = os.path.join(d, "shim")
        os.makedirs(shim_dir)
        shim = os.path.join(shim_dir, "python3")
        with open(shim, "w", newline="\n") as fh:
            fh.write('#!/bin/sh\nexec "%s" "$@"\n' % sys.executable.replace("\\", "/"))
        os.chmod(shim, 0o755)
        self.env = dict(os.environ, PATH=shim_dir.replace("\\", "/") + os.pathsep + os.environ["PATH"])
        self.pub = os.path.join(d, "k.pub")
        with open(self.pub, "w", newline="\n") as fh:
            fh.write("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPRUEBAPRUEBAPRUEBAPRUEBAPRUEBAPRUEBAPRUEBA1 bd-deploy-claude\n")

    def plan(self, *extra, policy=None):
        pol = policy or self.policy
        return subprocess.run([BASH, INSTALL, "--policy", pol.replace("\\", "/"), "--admin-user", "dev",
                               "--pubkey-file", self.pub.replace("\\", "/"), *extra], capture_output=True, text=True,
                              env=self.env)

    def test_plan_no_cambia_nada_y_lista_los_pasos(self):
        r = self.plan()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("PLAN (no se cambia nada", r.stdout)
        self.assertIn("Nada se ha cambiado", r.stdout)
        self.assertIn("bydlight-prod", r.stdout)
        self.assertIn("rama main", r.stdout)
        self.assertIn("/etc/sudoers.d/bd-deploy", r.stdout)
        self.assertIn("comandos exactos", r.stdout)
        self.assertIn("comprobaciones previas de rutas, propietarios y permisos", r.stdout)
        self.assertIn("no se modifica oe-deploy", r.stdout)

    def test_plan_explicito(self):
        r = self.plan("--plan")
        self.assertEqual(r.returncode, 0)
        self.assertIn("Nada se ha cambiado", r.stdout)

    def test_rechaza_politica_con_placeholders(self):
        bad = os.path.join(self.tmp.name, "bad.json")
        with open(bad, "w", newline="\n") as fh:
            fh.write(open(os.path.join(common.EXEC_DIR, "policy.example.json"), encoding="utf-8").read())
        r = self.plan(policy=bad)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("placeholders", r.stderr)

    def test_rechaza_politica_peligrosa_o_con_rutas_distintas(self):
        for old, new in [('"port": 8200', '"port": 80'), ('"/var/lib/bd-deploy"', '"/var/lib/otro"'),
                         ('"/etc/bd-deploy/keys/prod_deploy"', '"/root/.ssh/id_ed25519"'),
                         ('"git_branch": "main"', '"git_branch": "../main"'),
                         ('"service_user": "bddeploy"', '"service_user": "otrouser"')]:
            with self.subTest(new=new):
                bad = os.path.join(self.tmp.name, "bad.json")
                txt = open(self.policy, encoding="utf-8").read().replace(old, new)
                self.assertNotEqual(txt, open(self.policy, encoding="utf-8").read())
                with open(bad, "w", newline="\n") as fh:
                    fh.write(txt)
                self.assertNotEqual(self.plan(policy=bad).returncode, 0)

    def test_rechaza_clave_con_opciones(self):
        with open(self.pub, "w", newline="\n") as fh:
            fh.write('command="sh" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPRUEBA x\n')
        self.assertNotEqual(self.plan().returncode, 0)

    def test_apply_exige_root(self):
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            self.skipTest("corre como root")
        r = self.plan("--apply")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("root", r.stderr)

    def test_verify_exige_root(self):
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            self.skipTest("corre como root")
        r = subprocess.run([BASH, INSTALL, "--verify"], capture_output=True, text=True, env=self.env)
        self.assertNotEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
