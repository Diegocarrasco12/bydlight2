"""Operaciones del ejecutor contra un Docker/Git simulado: flujo completo, rollback y, sobre todo, que los UNICOS comandos
ejecutables sean los del proyecto bydlight (jamas otros contenedores, volumenes, redes ni otros proyectos)."""
import json
import os
import re
import tempfile
import unittest

import common
from common import SHA_A, SHA_B, SHA_C, DOCKER, GIT, accept_baseline, make_exec, req
import bd_lib as L
import bd_ops as O

PROJECT = "bydlight-prod"
DOCKER_SUBCOMMANDS_OK = {"compose", "image", "ps", "version"}
COMPOSE_SUBCOMMANDS_OK = {"config", "build", "up", "ps", "logs"}
GIT_SUBCOMMANDS_OK = {"rev-parse", "status", "fetch", "cat-file", "merge-base", "merge", "diff", "clone", "ls-tree"}
PROHIBIDO = re.compile(r"onlyenergy|helios|projectmanager|oe-deploy|/srv/server|nginx-proxy|jornada|kreyol", re.I)


def subcmd_compose(argv):
    rest = argv[argv.index("--env-file") + 2:]
    while rest and rest[0] == "-f":
        rest = rest[2:]
    return rest[0]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ex = make_exec(self.tmp.name)
        self.sys = self.ex.system

    def run_op(self, text):
        return self.ex.execute(req(text))

    def deploy(self, sha):
        """fetch + build (simulado en linea) + up de un commit."""
        self.assertEqual(self.run_op(f"fetch {sha}").rc, 0)
        b = self.run_op(f"build {sha}")
        self.assertEqual(b.rc, 0, b.err)
        job_id, token = self.ex.spawned[-1]
        self.run_job(job_id)
        return self.run_op(f"up {sha}")

    def run_job(self, job_id):
        res = self.ex.run_build_job(job_id)
        self.assertEqual(res.rc, 0, res.err)


class Invariantes(Base):
    """Auditoria de TODOS los comandos ejecutados durante un ciclo completo."""

    def test_solo_se_ejecutan_comandos_acotados_al_proyecto(self):
        self.assertEqual(accept_baseline(self.ex).rc, 0)
        self.assertEqual(self.run_op("preflight").rc, 0)
        self.assertEqual(self.deploy(SHA_B).rc, 0)
        self.assertEqual(self.deploy(SHA_C).rc, 0)
        for t in ("status", "verify", "compose-diff", "list-releases", "logs 20", "rollback"):
            self.run_op(t)
        self.assertGreater(len(self.sys.calls), 20)
        for argv, env in self.sys.calls:
            texto = " ".join(argv)
            self.assertIn(argv[0], (DOCKER, GIT), texto)
            self.assertNotRegex(texto, PROHIBIDO)
            for bad in ("--privileged", " exec ", " run ", " cp ", "prune", " down", " volume", " network", " system ",
                        " rm -f", " kill", " stop", " restart", "--volumes", " -v "):
                self.assertNotIn(bad, " " + texto + " ", texto)
            if argv[0] == DOCKER:
                self.assertIn(argv[1], DOCKER_SUBCOMMANDS_OK, texto)
                if argv[1] == "compose":
                    self.assertEqual(argv[2:4], ["-p", PROJECT], texto)                 # siempre el proyecto bydlight
                    self.assertEqual(argv[argv.index("--env-file") + 1], "/dev/null")  # nunca un .env del repo
                    self.assertIn(subcmd_compose(argv), COMPOSE_SUBCOMMANDS_OK, texto)
                    self.assertIn("-f", argv)
                if argv[1] == "image":
                    self.assertIn(argv[2], ("inspect", "rm"))
                    self.assertRegex(argv[3], r"^bydlight-web:[0-9a-f]{12}$|^bydlight-web:baseline$|^bydlight-web:.+$")
                    self.assertTrue(argv[3].startswith("bydlight-web:"), texto)        # solo imagenes del proyecto
            else:
                self.assertIn("core.hooksPath=/dev/null", argv)                          # git sin hooks
                sub = argv[argv.index("-C") + 2] if "-C" in argv else argv[argv.index("clone")]
                self.assertIn(sub, GIT_SUBCOMMANDS_OK, texto)

    def test_compose_usa_solo_el_archivo_del_proyecto_dentro_de_app_dir(self):
        self.run_op("compose-diff")
        for argv, _ in self.sys.calls:
            if argv[:2] == [DOCKER, "compose"]:
                files = [argv[i + 1] for i, a in enumerate(argv) if a == "-f"]
                self.assertEqual(files, ["/srv/bydlight-prod/app/docker-compose.prod.yml"])
                self.assertEqual(argv[argv.index("--project-directory") + 1], "/srv/bydlight-prod/app")

    def test_logs_solo_del_servicio_del_proyecto(self):
        r = self.run_op("logs 20")
        self.assertEqual(r.rc, 0)
        argv = self.sys.calls[-1][0]
        self.assertEqual(argv[-1], "web")
        self.assertNotIn("hunter2", r.out)

    def test_el_fuente_no_usa_shell_ni_eval(self):
        for fn in ("bd_ops.py", "bd_lib.py", "bd-gate", "bd-run", "bd-approve"):
            src = open(os.path.join(common.EXEC_DIR, fn), encoding="utf-8").read()
            for bad in ("shell=True", "os.system", "os.popen", "eval(", "exec(", "pickle", "yaml.load"):
                self.assertNotIn(bad, src, f"{fn}: {bad}")


class Fetch(Base):
    def test_fast_forward_ok(self):
        r = self.run_op(f"fetch {SHA_B}")
        self.assertEqual(r.rc, 0, r.err)
        self.assertEqual(self.sys.head, SHA_B)
        self.assertIn("2 " if False else "1 archivos", r.out)

    def test_rechaza_commit_fuera_de_origin(self):
        r = self.run_op("fetch " + "d" * 40)
        self.assertNotEqual(r.rc, 0)
        self.assertIn("no pertenece", r.err)
        self.assertEqual(self.sys.head, SHA_A)

    def test_rechaza_retroceder(self):
        self.sys.head = SHA_C
        r = self.run_op(f"fetch {SHA_B}")
        self.assertNotEqual(r.rc, 0)
        self.assertIn("fast-forward", r.err)

    def test_rechaza_clon_con_cambios_locales(self):
        self.sys.dirty = True
        r = self.run_op(f"fetch {SHA_B}")
        self.assertNotEqual(r.rc, 0)
        self.assertEqual(self.sys.head, SHA_A)

    def test_fetch_usa_clave_de_solo_lectura_y_remote_de_la_politica(self):
        self.run_op(f"fetch {SHA_B}")
        argv, env = next(c for c in self.sys.calls if "fetch" in c[0])
        self.assertIn("git@github.com:usuario-prueba/bydlight2.git", argv)
        self.assertIn("/etc/bd-deploy/keys/prod_deploy", env["GIT_SSH_COMMAND"])
        self.assertIn("IdentitiesOnly=yes", env["GIT_SSH_COMMAND"])
        self.assertIn("StrictHostKeyChecking=yes", env["GIT_SSH_COMMAND"])
        self.assertIn("ForwardAgent=no", env["GIT_SSH_COMMAND"])
        self.assertEqual(env["GIT_TERMINAL_PROMPT"], "0")

    def test_error_de_red(self):
        self.sys.fetch_fail = True
        r = self.run_op(f"fetch {SHA_B}")
        self.assertNotEqual(r.rc, 0)
        self.assertIn("git fetch fallo", r.err)

    def test_avisa_cambios_de_infraestructura(self):
        orig = self.sys.run

        def run(argv, **kw):
            if argv[0] == GIT and "diff" in argv:
                return O.Result(0, "Dockerfile\nsrc/x.tsx\n")
            return orig(argv, **kw)
        self.sys.run = run
        r = self.run_op(f"fetch {SHA_B}")
        self.assertIn("Dockerfile", r.out)


class AceptarCompose(Base):
    def test_sin_aprobacion_se_rechaza(self):
        r = self.run_op(f"accept-compose {SHA_A}")
        self.assertEqual(r.rc, 77)
        self.assertIn("aprobacion", r.err)
        self.assertIsNone(self.ex.c.state.load()["compose_baseline"])

    def test_con_aprobacion_se_acepta_una_vez(self):
        self.assertEqual(accept_baseline(self.ex).rc, 0)
        self.assertIsNotNone(self.ex.c.state.load()["compose_baseline"])
        self.assertEqual(self.run_op(f"accept-compose {SHA_A}").rc, 77)  # un solo uso

    def test_aprobacion_vencida(self):
        L.write_approval(self.ex.p, "accept-compose", SHA_A, 1, "admin", now=0)
        self.assertEqual(self.run_op(f"accept-compose {SHA_A}").rc, 77)

    def test_aprobacion_ligada_al_commit(self):
        L.write_approval(self.ex.p, "accept-compose", SHA_B, 10, "admin", now=self.ex.c.now())
        self.assertEqual(self.run_op(f"accept-compose {SHA_A}").rc, 77)

    def test_no_acepta_un_compose_que_viola_la_politica(self):
        self.sys.config["services"]["web"]["privileged"] = True
        L.write_approval(self.ex.p, "accept-compose", SHA_A, 10, "admin", now=self.ex.c.now())
        r = self.run_op(f"accept-compose {SHA_A}")
        self.assertNotEqual(r.rc, 0)
        self.assertIn("privileged", r.err)
        self.assertIsNone(self.ex.c.state.load()["compose_baseline"])


class Build(Base):
    def test_sin_linea_base_no_se_construye(self):
        r = self.run_op(f"build {SHA_A}")
        self.assertNotEqual(r.rc, 0)
        self.assertIn("linea base", r.err)
        self.assertEqual(self.ex.spawned, [])

    def test_exige_que_el_clon_este_en_el_commit(self):
        accept_baseline(self.ex)
        r = self.run_op(f"build {SHA_B}")
        self.assertIn("fetch", r.err)

    def test_compose_modificado_tras_la_linea_base_bloquea(self):
        accept_baseline(self.ex)
        self.sys.config["services"]["web"]["mem_limit"] = "9999999999"
        r = self.run_op(f"build {SHA_A}")
        self.assertNotEqual(r.rc, 0)
        self.assertIn("difiere", r.err)
        diff = self.run_op("compose-diff")
        self.assertIn("mem_limit", diff.out)

    def test_memoria_insuficiente(self):
        accept_baseline(self.ex)
        ex = make_exec(self.tmp.name, self.sys, meminfo=lambda: "MemAvailable: 100000 kB\n")
        ex.c.state.save(self.ex.c.state.load())
        r = ex.execute(req(f"build {SHA_A}"))
        self.assertIn("memoria", r.err)

    def test_build_en_segundo_plano_con_token(self):
        accept_baseline(self.ex)
        r = self.run_op(f"build {SHA_A}")
        self.assertEqual(r.rc, 0)
        job_id, token = self.ex.spawned[-1]
        self.assertRegex(job_id, r"^[0-9a-f]{16}$")
        self.assertGreaterEqual(len(token), 32)
        self.run_job(job_id)
        st = self.ex.c.state.load()
        self.assertEqual([b["tag"] for b in st["built"]], [SHA_A[:12]])
        status = self.run_op(f"job-status {job_id}")
        self.assertIn("done", status.out)
        self.assertNotIn(token, status.out)
        # el token se borra al terminar: el trabajo no puede relanzarse
        self.assertEqual(json.load(open(os.path.join(self.ex.c.state.dir, "jobs", job_id + ".json")))["token"], "")

    def test_build_fallido(self):
        accept_baseline(self.ex)
        self.sys.build_fail = True
        self.run_op(f"build {SHA_A}")
        job_id, _ = self.ex.spawned[-1]
        self.assertEqual(self.ex.run_build_job(job_id).rc, 1)
        self.assertEqual(self.ex.c.state.load()["built"], [])
        self.assertEqual(self.run_op(f"job-status {job_id}").rc, 1)


class Despliegue(Base):
    def setUp(self):
        super().setUp()
        accept_baseline(self.ex)

    def test_up_sin_imagen_construida(self):
        r = self.run_op(f"up {SHA_A}")
        self.assertNotEqual(r.rc, 0)
        self.assertIn("build", r.err)

    def test_despliegue_completo(self):
        r = self.deploy(SHA_A)
        self.assertEqual(r.rc, 0, r.err)
        st = self.ex.c.state.load()
        self.assertEqual(st["deployed"]["sha"], SHA_A)
        self.assertEqual(self.run_op("verify").rc, 0)
        self.assertIn(SHA_A, self.run_op("status").out)

    def test_up_usa_no_build_y_no_pull(self):
        self.deploy(SHA_A)
        argv, env = next(c for c in self.sys.calls if "up" in c[0] and DOCKER in c[0])
        self.assertIn("--no-build", argv)
        self.assertIn("--no-deps", argv)
        self.assertIn("--wait", argv)
        self.assertEqual(argv[argv.index("--pull") + 1], "never")
        self.assertEqual(env["BD_TAG"], SHA_A[:12])

    def test_segundo_despliegue_guarda_el_anterior(self):
        self.deploy(SHA_A)
        self.deploy(SHA_B)
        st = self.ex.c.state.load()
        self.assertEqual((st["deployed"]["sha"], st["previous"]["sha"]), (SHA_B, SHA_A))

    def test_rollback_automatico_si_el_nuevo_no_sana(self):
        self.deploy(SHA_A)
        self.sys.fail_up_tags.add(SHA_B[:12])
        r = self.deploy(SHA_B)
        self.assertNotEqual(r.rc, 0)
        self.assertIn("REVERTIDO", r.err)
        self.assertEqual(self.sys.running_tag, SHA_A[:12])
        self.assertEqual(self.sys.health, "healthy")
        st = self.ex.c.state.load()
        self.assertEqual(st["deployed"]["sha"], SHA_A)       # el estado no avanza si el release no sano
        self.assertEqual(self.run_op("verify").rc, 0)

    def test_http_fallido_tambien_revierte(self):
        self.deploy(SHA_A)
        calls = {"n": 0}

        def http(url):
            calls["n"] += 1
            return 500 if SHA_B[:12] in (self.sys.running_tag or "") else 200
        self.ex.c.http_get = http
        r = self.deploy(SHA_B)
        self.assertIn("REVERTIDO", r.err)
        self.assertEqual(self.sys.running_tag, SHA_A[:12])

    def test_primer_despliegue_fallido_informa(self):
        self.sys.fail_up_tags.add(SHA_A[:12])
        r = self.deploy(SHA_A)
        self.assertIn("sin release anterior", r.err)
        self.assertIsNone(self.ex.c.state.load()["deployed"])

    def test_rollback_manual(self):
        self.deploy(SHA_A)
        self.deploy(SHA_B)
        r = self.run_op("rollback")
        self.assertEqual(r.rc, 0, r.err)
        self.assertEqual(self.sys.running_tag, SHA_A[:12])
        self.assertEqual(self.ex.c.state.load()["deployed"]["sha"], SHA_A)
        self.assertEqual(self.ex.c.state.load()["previous"]["sha"], SHA_B)

    def test_rollback_sin_anterior(self):
        self.deploy(SHA_A)
        self.assertNotEqual(self.run_op("rollback").rc, 0)

    def test_limpieza_solo_de_imagenes_del_proyecto_y_nunca_las_activas(self):
        self.ex.p["project"]["keep_releases"] = 2
        shas = [f"{i:012x}" + "0" * 28 for i in range(1, 6)]
        self.sys.origin = shas
        self.sys.head = shas[0]
        for s in shas[1:]:
            self.assertEqual(self.deploy(s).rc, 0)
        removed = [c[0][3] for c in self.sys.calls if c[0][:3] == [DOCKER, "image", "rm"]]
        self.assertTrue(removed)
        for img in removed:
            self.assertRegex(img, r"^bydlight-web:[0-9a-f]{12}$")
        st = self.ex.c.state.load()
        self.assertIn(st["deployed"]["tag"], {b["tag"] for b in st["built"]})
        self.assertIn(st["previous"]["tag"], {b["tag"] for b in st["built"]})


class Preflight(Base):
    def test_requiere_linea_base_aceptada(self):
        r = self.run_op("preflight")
        self.assertEqual(r.rc, 1)
        self.assertIn("linea base", r.err)

    def test_ok_y_registra_servicios_ajenos(self):
        accept_baseline(self.ex)
        r = self.run_op("preflight")
        self.assertEqual(r.rc, 0, r.err)
        others = self.ex.c.state.load()["others"]
        self.assertEqual(set(others), {"nginx-proxy", "another-app"})  # solo ajenos; el propio no se registra

    def test_verify_avisa_si_un_servicio_ajeno_cambia_pero_no_lo_toca(self):
        accept_baseline(self.ex)
        self.run_op("preflight")
        self.sys.others = "another-app|127.0.0.1:9000->9000/tcp|otro"
        self.deploy(SHA_A)
        r = self.run_op("verify")
        self.assertEqual(r.rc, 0)
        self.assertIn("AVISO", r.out)
        self.assertIn("nginx-proxy", r.out)

    def test_detecta_clon_sucio_y_disco_bajo(self):
        accept_baseline(self.ex)
        self.sys.dirty = True
        ex = make_exec(self.tmp.name, self.sys, disk_free_gb=lambda p: 1.0)
        ex.c.state.save(self.ex.c.state.load())
        r = ex.execute(req("preflight"))
        self.assertIn("cambios locales", r.err)
        self.assertIn("disco", r.err)


class Auditoria(Base):
    def test_se_audita_cada_operacion_y_no_se_filtran_trazas(self):
        self.run_op("status")
        self.run_op(f"fetch {SHA_B}")
        self.assertEqual([a["op"] for a in self.ex.audit_log], ["status", "fetch"])
        self.assertTrue(all(a["caller"] == "bddeploy" for a in self.ex.audit_log))

    def test_error_interno_no_filtra_detalles(self):
        def boom(*a, **k):
            raise RuntimeError("detalle secreto /etc/shadow")
        self.sys.run = boom
        r = self.run_op("status")
        self.assertEqual(r.rc, 70)
        self.assertNotIn("shadow", r.err)

    def test_bloqueo_concurrente(self):
        class Busy:
            def __enter__(self):
                raise O.Busy()

            def __exit__(self, *a):
                return False
        ex = make_exec(self.tmp.name, self.sys, lock_factory=Busy)
        self.assertEqual(ex.execute(req("status")).rc, 75)


class InitClone(Base):
    def test_clone_usa_clave_de_solo_lectura(self):
        ex = make_exec(self.tmp.name, self.sys)
        ex.p["project"]["app_dir"] = os.path.join(self.tmp.name, "nuevo", "app")
        r = ex.admin_init_clone()
        self.assertEqual(r.rc, 0)
        argv, env = next(c for c in self.sys.calls if "clone" in c[0])
        self.assertIn("--branch", argv)
        self.assertIn("main", argv)
        self.assertIn("/etc/bd-deploy/keys/prod_deploy", env["GIT_SSH_COMMAND"])

    def test_no_pisa_un_clon_existente(self):
        app = os.path.join(self.tmp.name, "x", "app")
        os.makedirs(os.path.join(app, ".git"))
        ex = make_exec(self.tmp.name, self.sys)
        ex.p["project"]["app_dir"] = app
        with self.assertRaises(O.OpError):
            ex.admin_init_clone()


if __name__ == "__main__":
    unittest.main()
