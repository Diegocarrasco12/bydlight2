"""La configuracion EFECTIVA de compose (docker compose config) se valida contra la politica; no se confia en el repo.
El fixture es la salida REAL de `docker compose config --format json` del docker-compose.prod.yml del repositorio."""
import copy
import json
import os
import shutil
import subprocess
import unittest

import common
import bd_lib as L

P = common.load_policy()


class ConfigReal(unittest.TestCase):
    def test_config_real_cumple_la_politica(self):
        self.assertEqual(L.validate_compose(common.fixture(), P), [])

    @unittest.skipUnless(shutil.which("docker") and os.path.exists(os.path.join(common.EXEC_DIR, "..", "..", "docker-compose.prod.yml")),
                         "requiere el CLI de docker y el repo completo")
    def test_fixture_coincide_con_el_compose_actual_del_repo(self):
        root = os.path.abspath(os.path.join(common.EXEC_DIR, "..", ".."))
        out = subprocess.run(["docker", "compose", "-p", "bydlight-prod", "--env-file", os.devnull, "-f", "docker-compose.prod.yml",
                              "config", "--format", "json"], cwd=root, capture_output=True, text=True,
                             env=dict(os.environ, BD_TAG="baseline"))
        if out.returncode != 0:
            self.skipTest("docker compose config no disponible")
        fresh = json.loads(out.stdout)
        fresh["services"]["web"]["build"]["context"] = "/srv/bydlight-prod/app"
        self.assertEqual(json.loads(json.dumps(fresh, sort_keys=True)), common.fixture(),
                         "el compose del repo cambio: regenere tests/fixtures/prod.json y revise el diff")


def _web(r):
    return r["services"]["web"]


MUTACIONES = [
    ("privileged", lambda r: _web(r).update(privileged=True), "clave no permitida 'privileged'"),
    ("network_mode host", lambda r: _web(r).update(network_mode="host"), "network_mode"),
    ("pid host", lambda r: _web(r).update(pid="host"), "'pid'"),
    ("ipc host", lambda r: _web(r).update(ipc="host"), "'ipc'"),
    ("cap_add", lambda r: _web(r).update(cap_add=["SYS_ADMIN"]), "cap_add"),
    ("devices", lambda r: _web(r).update(devices=["/dev/sda:/dev/sda"]), "devices"),
    ("volumes (docker.sock)", lambda r: _web(r).update(volumes=[{"type": "bind", "source": "/var/run/docker.sock", "target": "/var/run/docker.sock"}]), "volumes"),
    ("volumes (bind raiz)", lambda r: _web(r).update(volumes=[{"type": "bind", "source": "/", "target": "/host"}]), "volumes"),
    ("volumes_from", lambda r: _web(r).update(volumes_from=["nginx-proxy"]), "volumes_from"),
    ("userns host", lambda r: _web(r).update(userns_mode="host"), "userns_mode"),
    ("sysctls", lambda r: _web(r).update(sysctls={"net.ipv4.ip_forward": "1"}), "sysctls"),
    ("extra_hosts", lambda r: _web(r).update(extra_hosts=["x:host-gateway"]), "extra_hosts"),
    ("container_name ajeno", lambda r: _web(r).update(container_name="nginx-proxy"), "container_name"),
    ("depends_on ajeno", lambda r: _web(r).update(depends_on={"nginx-proxy": {"condition": "service_started"}}), "depends_on"),
    ("env_file", lambda r: _web(r).update(env_file=["/srv/otro/.env"]), "env_file"),
    ("environment (inyeccion de secretos ajenos)", lambda r: _web(r).update(environment={"X": "y"}), "environment"),
    ("command sobrescrito", lambda r: _web(r).update(command=["sh", "-c", "id"]), "command sobrescrito"),
    ("entrypoint sobrescrito", lambda r: _web(r).update(entrypoint=["/bin/sh"]), "entrypoint sobrescrito"),
    ("puerto 0.0.0.0", lambda r: _web(r)["ports"][0].update(host_ip="0.0.0.0"), "puerto publicado no autorizado"),
    ("puerto sin host_ip", lambda r: _web(r)["ports"][0].pop("host_ip"), "puerto publicado no autorizado"),
    ("puerto 80 (otro proyecto)", lambda r: _web(r)["ports"][0].update(published="80"), "puerto publicado no autorizado"),
    ("puerto de otro proyecto", lambda r: _web(r)["ports"][0].update(published="8191"), "puerto publicado no autorizado"),
    ("puerto extra", lambda r: _web(r)["ports"].append({"mode": "ingress", "host_ip": "127.0.0.1", "target": 22, "published": "2222", "protocol": "tcp"}),
     "puerto publicado no autorizado"),
    ("imagen ajena", lambda r: _web(r).update(image="evil/web:latest"), "imagen no autorizada"),
    ("imagen de otro proyecto", lambda r: _web(r).update(image="onlyenergy-prod-backend:baseline"), "imagen no autorizada"),
    ("servicio extra", lambda r: r["services"].update(sidecar={"image": "alpine", "mem_limit": "10m"}), "servicio no autorizado"),
    ("servicio renombrado", lambda r: r["services"].update(otro=r["services"].pop("web")), "servicio no autorizado"),
    ("build fuera del contexto", lambda r: _web(r)["build"].update(context="/srv/otro-proyecto"), "contexto de build"),
    ("build con dockerfile ajeno", lambda r: _web(r)["build"].update(dockerfile="../../x/Dockerfile"), "dockerfile distinto"),
    ("build con ssh", lambda r: _web(r)["build"].update(ssh=["default"]), "build.ssh"),
    ("build con network host", lambda r: _web(r)["build"].update(network="host"), "build.network"),
    ("build con contextos adicionales", lambda r: _web(r)["build"].update(additional_contexts={"x": "/"}), "build.additional_contexts"),
    ("servicio sin build", lambda r: (_web(r).pop("build"),), "debe construirse"),
    ("red externa", lambda r: r["networks"].update(app={"name": "server_default", "external": True}), "red externa"),
    ("red de otro proyecto", lambda r: r["networks"].update(app={"name": "server_default"}), "red fuera del proyecto"),
    ("red nueva", lambda r: r["networks"].update(extra={"name": "bydlight-prod_extra"}), "red no autorizada"),
    ("servicio en red ajena", lambda r: _web(r).update(networks={"app": None, "server_default": None}), "red no autorizada"),
    ("nombre de proyecto distinto", lambda r: r.update(name="server"), "nombre de proyecto"),
    ("proyecto de otro entorno", lambda r: r.update(name="onlyenergy-prod"), "nombre de proyecto"),
    ("volumenes de nivel superior", lambda r: r.update(volumes={"v": {"name": "bydlight-prod_v"}}), "nivel superior"),
    ("configs de nivel superior", lambda r: r.update(configs={"c": {"file": "/etc/shadow"}}), "nivel superior"),
    ("secrets de nivel superior", lambda r: r.update(secrets={"s": {"file": "/etc/shadow"}}), "nivel superior"),
    ("usuario root", lambda r: _web(r).update(user="root"), "usuario root"),
    ("usuario 0", lambda r: _web(r).update(user="0:0"), "usuario root"),
    ("sin usuario", lambda r: _web(r).pop("user"), "usuario root"),
    ("sistema de archivos escribible", lambda r: _web(r).update(read_only=False), "solo lectura"),
    ("sin cap_drop", lambda r: _web(r).pop("cap_drop"), "cap_drop"),
    ("sin limite de memoria", lambda r: _web(r).pop("mem_limit"), "sin mem_limit"),
    ("seccomp unconfined", lambda r: _web(r).update(security_opt=["seccomp=unconfined"]), "security_opt"),
    ("tmpfs arbitrario", lambda r: _web(r).update(tmpfs=["/etc"]), "tmpfs"),
    ("driver de logs remoto", lambda r: _web(r).update(logging={"driver": "syslog", "options": {"syslog-address": "tcp://x:1"}}), "driver de logs"),
    ("nivel superior extra", lambda r: r.update(x_extra={}), "nivel superior"),
]


class Mutaciones(unittest.TestCase):
    def test_cada_mutacion_peligrosa_es_rechazada(self):
        for nombre, mutador, esperado in MUTACIONES:
            with self.subTest(nombre):
                r = copy.deepcopy(common.fixture())
                mutador(r)
                violaciones = L.validate_compose(r, P)
                self.assertTrue(violaciones, f"NO se rechazo: {nombre}")
                self.assertTrue(any(esperado in v for v in violaciones), f"{nombre}: {violaciones}")

    def test_los_mensajes_no_filtran_valores(self):
        r = copy.deepcopy(common.fixture())
        _web(r)["environment"] = {"JWT_SECRET": "VALOR-SECRETO-XYZ"}
        _web(r)["cap_add"] = ["VALOR-SECRETO-XYZ"]
        self.assertNotIn("VALOR-SECRETO-XYZ", " ".join(L.validate_compose(r, P)))

    def test_hash_estable_y_sensible_a_cambios(self):
        a, b = common.fixture(), common.fixture()
        self.assertEqual(L.config_hash(a), L.config_hash(b))
        b["services"]["web"]["mem_limit"] = "1073741824"
        self.assertNotEqual(L.config_hash(a), L.config_hash(b))


class PoliticaInvalida(unittest.TestCase):
    def _p(self, **cambios):
        import json as j
        p = j.loads(open(os.path.join(common.EXEC_DIR, "policy.example.json"), encoding="utf-8").read().replace("<GITHUB_USER>", "u"))
        for path, v in cambios.items():
            a, b = path.split(".")
            p[a][b] = v
        return p

    def test_politica_de_ejemplo_valida(self):
        L.validate_policy(self._p())

    def test_rechaza_valores_peligrosos(self):
        for path, v in [("project.app_dir", "relativo/ruta"), ("project.app_dir", "/srv/../etc"),
                        ("common.git_remote_url", "https://github.com/x/y.git"), ("common.git_remote_url", "git@evil.com:x/y.git"),
                        ("project.port", 80), ("project.port", 22), ("project.compose_files", ["../otro.yml"]),
                        ("project.service", "WEB;id"), ("common.service_user", ""), ("project.keep_releases", 0),
                        ("project.http_checks", ["http://externo/"]), ("common.docker", "docker")]:
            with self.subTest(path=path, v=v):
                with self.assertRaises(ValueError):
                    L.validate_policy(self._p(**{path: v}))


if __name__ == "__main__":
    unittest.main()
