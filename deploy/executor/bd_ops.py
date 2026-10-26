"""Operaciones del ejecutor bd-deploy. Cada operacion usa comandos FIJOS (docker compose del proyecto bydlight y git del
clon de la aplicacion). Los argumentos del cliente ya llegan validados por bd_lib.parse_request.

Todo acceso al sistema pasa por `Runner`/`Ctx` (inyectables): las pruebas demuestran, sin servidor, exactamente que
comandos se ejecutarian y cuales jamas.
"""
from __future__ import annotations

import json
import os
import secrets
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

import bd_lib as L
from bd_lib import Request

SAFE_ENV = {"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "HOME": "/root",
            "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "DOCKER_BUILDKIT": "1"}
OUT_LIMIT = 24000
BD_RUN = "/usr/local/sbin/bd-run"


@dataclass
class Result:
    rc: int = 0
    out: str = ""
    err: str = ""


class OpError(Exception):
    """Operacion rechazada o fallida de forma controlada (mensaje seguro para el cliente)."""

    def __init__(self, msg: str, rc: int = 1):
        super().__init__(msg)
        self.rc = rc


class Busy(OpError):
    def __init__(self):
        super().__init__("otra operacion de bd-deploy esta en curso", 75)


class Runner:
    """Ejecuta argv SIN shell y con entorno limpio. Nunca recibe cadenas del cliente sin validar."""

    def run(self, argv, timeout=120, env_extra=None, cwd=None, out_limit=OUT_LIMIT) -> Result:
        env = dict(SAFE_ENV)
        env.update(env_extra or {})
        try:
            p = subprocess.run(argv, capture_output=True, timeout=timeout, env=env, cwd=cwd)
        except subprocess.TimeoutExpired:
            return Result(124, "", f"tiempo agotado ({timeout}s)")
        except OSError as e:
            return Result(127, "", f"no se pudo ejecutar: {e.__class__.__name__}")
        return Result(p.returncode, p.stdout.decode("utf-8", "replace")[-out_limit:],
                      p.stderr.decode("utf-8", "replace")[-OUT_LIMIT:])


def _http_get(url: str, timeout: int = 10) -> int:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310 (solo 127.0.0.1 desde la politica)
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except (urllib.error.URLError, OSError):
        return 0


class _FileLock:
    def __init__(self, path):
        self.path = path
        self.fh = None

    def __enter__(self):
        import fcntl
        os.makedirs(os.path.dirname(self.path), mode=0o750, exist_ok=True)
        self.fh = open(self.path, "a+")
        try:
            fcntl.flock(self.fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.fh.close()
            raise Busy()
        return self

    def __exit__(self, *a):
        if self.fh:
            self.fh.close()


@dataclass
class Ctx:
    policy: dict
    runner: Runner = field(default_factory=Runner)
    audit_sink: object = None
    http_get: object = staticmethod(_http_get)
    now: object = staticmethod(time.time)
    meminfo: object = staticmethod(lambda: open("/proc/meminfo").read())
    disk_free_gb: object = staticmethod(lambda p: shutil.disk_usage(p).free / 2**30)
    lock_factory: object = None
    spawn: object = None
    token: object = staticmethod(lambda: secrets.token_hex(16))
    job_id: object = staticmethod(lambda: secrets.token_hex(8))
    caller: str = "?"
    conn: str = "?"
    build_lock_factory: object = None
    lstat: object = staticmethod(os.lstat)
    realpath: object = staticmethod(os.path.realpath)

    def __post_init__(self):
        self.state = L.State(self.policy)
        if self.lock_factory is None:
            self.lock_factory = lambda: _FileLock(os.path.join(self.policy["common"]["state_dir"], "lock"))
        if self.build_lock_factory is None:
            self.build_lock_factory = lambda: _FileLock(os.path.join(self.policy["common"]["state_dir"], "build.lock"))
        if self.spawn is None:
            self.spawn = self._spawn

    def _spawn(self, job_id: str, token: str) -> None:
        env = dict(SAFE_ENV, BD_JOB_TOKEN=token)
        subprocess.Popen([BD_RUN, "--run-job", job_id], env=env, start_new_session=True,  # noqa: S603
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)


class Executor:
    def __init__(self, ctx: Ctx):
        self.c = ctx
        self.p = ctx.policy
        self.pr = ctx.policy["project"]
        self.cm = ctx.policy["common"]

    # ------------------------------------------------------------------ helpers
    def audit(self, op, args, rc, msg=""):
        if self.c.audit_sink:
            self.c.audit_sink({"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(self.c.now())), "op": op,
                               "args": list(args), "rc": rc, "caller": self.c.caller, "conn": self.c.conn,
                               "msg": msg[:200]})

    def docker(self, *args, tag="baseline", timeout=120):
        return self.c.runner.run(L.compose_args(self.p) + list(args), timeout=timeout, env_extra={"BD_TAG": tag})

    def git_env(self, key=False) -> dict:
        """Entorno de git determinista: sin configuracion global/de sistema (url.insteadOf, hooks, filtros...) y, si
        se necesita la red, SOLO la deploy key de solo lectura (-F /dev/null ignora ~/.ssh/config de root)."""
        env = {"GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0"}
        if key:
            env["GIT_SSH_COMMAND"] = (
                f"ssh -F /dev/null -i {self.pr['deploy_key']} -o IdentitiesOnly=yes -o BatchMode=yes "
                f"-o StrictHostKeyChecking=yes -o UserKnownHostsFile={self.cm['known_hosts']} -o ForwardAgent=no")
        return env

    def git(self, *args, timeout=120, key=False, out_limit=OUT_LIMIT):
        argv = [self.cm["git"], "-c", "core.hooksPath=/dev/null", "-C", self.pr["app_dir"], *args]
        kw = {} if out_limit == OUT_LIMIT else {"out_limit": out_limit}
        return self.c.runner.run(argv, timeout=timeout, env_extra=self.git_env(key), **kw)

    def check_files(self):
        """Los archivos que lee docker compose/build deben ser archivos regulares DENTRO del clon: un symlink hacia un
        archivo de root (p. ej. la deploy key) filtraria su contenido en los mensajes de error del parser."""
        app = self.pr["app_dir"]
        names = list(self.pr["compose_files"]) + ["Dockerfile"]
        for name in names + [".dockerignore"]:
            path = app.rstrip("/") + "/" + name
            try:
                st = self.c.lstat(path)
            except FileNotFoundError:
                if name == ".dockerignore":
                    continue
                raise OpError(f"falta {name} en el clon")
            except OSError:
                raise OpError(f"no se puede leer {name}")
            import stat as _st
            if _st.S_ISLNK(st.st_mode) or not _st.S_ISREG(st.st_mode):
                raise OpError(f"{name} no es un archivo regular (symlink o especial): rechazado")
            real = self.c.realpath(path)
            if real != path:
                raise OpError(f"{name} resuelve fuera de su ruta: rechazado")

    def build_pending(self) -> bool:
        """True si hay un build en curso (lock tomado o trabajo 'running' reciente): fetch/build no deben tocar el arbol."""
        try:
            with self.c.build_lock_factory():
                pass
        except Busy:
            return True
        jobs = os.path.join(self.c.state.dir, "jobs")
        try:
            names = os.listdir(jobs)
        except OSError:
            return False
        for n in names:
            try:
                with open(os.path.join(jobs, n), encoding="utf-8") as fh:
                    job = json.load(fh)
            except (OSError, ValueError):
                continue
            if job.get("status") == "running" and self.c.now() - float(job.get("ts", 0)) < self.cm["build_timeout_s"] + 300:
                return True
        return False

    def head(self) -> str:
        r = self.git("rev-parse", "HEAD")
        sha = r.out.strip()
        if r.rc != 0 or not L.SHA_RE.fullmatch(sha):
            raise OpError("el clon de la aplicacion no existe o no es valido (use init-clone como administrador)")
        return sha

    def render(self, tag="baseline") -> dict:
        self.check_files()
        r = self.docker("config", "--format", "json", tag=tag)
        if r.rc != 0:
            detail = r.err.strip().splitlines()[-1][:160] if r.err.strip() else "sin detalle"
            raise OpError("docker compose config fallo: " + L.redact(detail))
        try:
            return json.loads(r.out)
        except ValueError:
            raise OpError("docker compose config devolvio JSON invalido")

    def checked_config(self) -> tuple:
        """(config, hash, baseline_igual). Rechaza si la politica no se cumple."""
        cfg = self.render()
        problems = L.validate_compose(cfg, self.p)
        if problems:
            raise OpError("compose rechazado por la politica: " + "; ".join(problems))
        h = L.config_hash(cfg)
        base = self.c.state.load()["compose_baseline"]
        return cfg, h, bool(base) and base["hash"] == h

    def require_baseline(self):
        cfg, h, same = self.checked_config()
        if not same:
            raise OpError("el compose efectivo difiere de la linea base aceptada: revise compose-diff y apruebe "
                          "'accept-compose' (sudo bd-approve accept-compose <sha>)")
        return cfg

    def health(self) -> list:
        """Problemas de salud del servicio (vacio = sano) segun `compose ps`."""
        r = self.docker("ps", "--all", "--format", "json")
        if r.rc != 0:
            return ["compose ps fallo"]
        rows = []
        for line in r.out.splitlines():
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    pass
        if len(rows) == 1 and isinstance(rows[0], list):
            rows = rows[0]
        mine = [x for x in rows if x.get("Service") == self.pr["service"]]
        if not mine:
            return ["el servicio no existe"]
        out = []
        for row in mine:
            if row.get("State") != "running":
                out.append(f"estado {row.get('State')}")
            elif row.get("Health") not in ("healthy", "", None):
                out.append(f"salud {row.get('Health')}")
        return out

    def http_problems(self) -> list:
        out = []
        for path in self.pr.get("http_checks", []):
            code = self.c.http_get(f"http://127.0.0.1:{self.pr['port']}{path}")
            if code != 200:
                out.append(f"{path} -> {code}")
        return out

    def others_snapshot(self) -> dict:
        r = self.c.runner.run([self.cm["docker"], "ps", "--format",
                               '{{.Names}}|{{.Ports}}|{{.Label "com.docker.compose.project"}}'], timeout=30)
        snap = {}
        for line in r.out.splitlines():
            parts = line.split("|")
            if len(parts) == 3 and parts[2] != self.pr["project"]:
                snap[parts[0]] = parts[1]
        return snap

    def image_exists(self, tag: str) -> bool:
        return self.c.runner.run([self.cm["docker"], "image", "inspect", f"{self.pr['image_repo']}:{tag}"],
                                 timeout=30).rc == 0

    # ------------------------------------------------------------------ dispatcher
    def execute(self, req: Request) -> Result:
        try:
            with self.c.lock_factory():
                res = getattr(self, "op_" + req.op.replace("-", "_"))(*req.args)
        except OpError as e:
            res = Result(e.rc, "", str(e))
        except Exception as e:  # noqa: BLE001 - nunca filtrar trazas al cliente
            res = Result(70, "", f"error interno ({e.__class__.__name__})")
        self.audit(req.op, req.args, res.rc, res.err or res.out.splitlines()[0] if (res.err or res.out) else "")
        return res

    # ------------------------------------------------------------------ nivel 0
    def op_status(self) -> Result:
        st = self.c.state.load()
        lines = [f"proyecto: {self.pr['project']}",
                 f"desplegado: {st['deployed']['sha'] if st['deployed'] else '(ninguno)'}",
                 f"anterior: {st['previous']['sha'] if st['previous'] else '(ninguno)'}",
                 f"releases construidos: {len(st['built'])}",
                 f"linea base de compose: {'aceptada' if st['compose_baseline'] else 'SIN ACEPTAR'}"]
        r = self.git("rev-parse", "HEAD")
        lines.append(f"clon en: {r.out.strip() if r.rc == 0 else '(sin clon)'}")
        problems = self.health()
        lines.append("salud: " + ("OK" if not problems else "; ".join(problems)))
        return Result(0, "\n".join(lines))

    def op_preflight(self) -> Result:
        problems = []
        head = self.head()
        if self.git("status", "--porcelain").out.strip():
            problems.append("el clon tiene cambios locales")
        try:
            _, _, same = self.checked_config()
            if not same:
                problems.append("compose sin linea base aceptada o distinto de ella")
        except OpError as e:
            problems.append(str(e))
        mem = L.mem_available_mb(self.c.meminfo())
        if mem < self.cm.get("min_mem_available_mb", 0):
            problems.append(f"memoria disponible {mem} MB insuficiente")
        free = self.c.disk_free_gb(self.pr["app_dir"])
        if free < self.cm.get("min_disk_free_gb", 0):
            problems.append(f"disco libre {free:.0f} GB insuficiente")
        if self.c.runner.run([self.cm["docker"], "version", "--format", "{{.Server.Version}}"], timeout=30).rc != 0:
            problems.append("el daemon de Docker no responde")
        st = self.c.state.load()
        st["others"] = self.others_snapshot()
        self.c.state.save(st)
        if problems:
            return Result(1, "", "preflight FALLA: " + "; ".join(problems))
        return Result(0, f"preflight OK (clon {head[:12]}; {len(st['others'])} contenedores ajenos registrados como linea base)")

    def op_verify(self) -> Result:
        st = self.c.state.load()
        problems = self.health() + self.http_problems()
        if st["deployed"]:
            r = self.docker("ps", "--format", "{{.Image}}")
            want = f"{self.pr['image_repo']}:{st['deployed']['tag']}"
            if want not in r.out.split():
                problems.append("la imagen en ejecucion no coincide con el release desplegado")
        notes = []
        base = st.get("others")
        if base is not None:
            now = self.others_snapshot()
            for name, ports in base.items():
                if name not in now:
                    notes.append(f"AVISO: el contenedor ajeno {name} ya no esta")
                elif now[name] != ports:
                    notes.append(f"AVISO: cambiaron los puertos de {name}")
        if problems:
            return Result(1, "\n".join(notes), "verify FALLA: " + "; ".join(problems))
        return Result(0, "\n".join(["verify OK (salud y HTTP)"] + notes))

    def op_compose_diff(self) -> Result:
        cfg = self.render()
        problems = L.validate_compose(cfg, self.p)
        base = self.c.state.load()["compose_baseline"]
        lines = ["politica: " + ("CUMPLE" if not problems else "VIOLA: " + "; ".join(problems))]
        if not base:
            lines.append("linea base: SIN ACEPTAR")
        elif base["hash"] == L.config_hash(cfg):
            lines.append("linea base: igual")
        else:
            lines.append("linea base: DIFIERE")
            lines += ["  " + d for d in diff_config(base["config"], cfg)]
        return Result(0 if not problems else 1, "\n".join(lines))

    def op_list_releases(self) -> Result:
        st = self.c.state.load()
        lines = []
        for rel in sorted(st["built"], key=lambda x: x["ts"], reverse=True):
            mark = " <- desplegado" if st["deployed"] and st["deployed"]["tag"] == rel["tag"] else (
                " (anterior)" if st["previous"] and st["previous"]["tag"] == rel["tag"] else "")
            lines.append(f"{rel['tag']}  {rel['sha']}{mark}")
        return Result(0, "\n".join(lines) or "(sin releases)")

    def op_job_status(self, job_id: str) -> Result:
        try:
            with open(os.path.join(self.c.state.dir, "jobs", job_id + ".json"), encoding="utf-8") as fh:
                job = json.load(fh)
        except (OSError, ValueError):
            raise OpError("trabajo inexistente")
        tail = "\n".join(job.get("log", "").splitlines()[-15:])
        return Result(0 if job["status"] != "failed" else 1, f"estado: {job['status']}\n{tail}".rstrip())

    def op_logs(self, lines: str) -> Result:
        r = self.docker("logs", "--no-color", "--tail", lines, self.pr["service"], timeout=30)
        return Result(r.rc, L.redact(r.out + r.err))

    # ------------------------------------------------------------------ nivel 1
    def op_fetch(self, sha: str) -> Result:
        branch = self.cm["git_branch"]
        if self.build_pending():
            raise OpError("hay un build en curso: espere a que termine (job-status) antes de actualizar el clon")
        old = self.head()
        if self.git("status", "--porcelain").out.strip():
            raise OpError("el clon tiene cambios locales: no se actualiza")
        ref = f"+refs/heads/{branch}:refs/remotes/origin/{branch}"
        r = self.git("fetch", "--no-tags", self.cm["git_remote_url"], ref, key=True, timeout=300)
        if r.rc != 0:
            detail = r.err.strip().splitlines()[-1][:160] if r.err.strip() else "sin detalle"
            raise OpError("git fetch fallo: " + L.redact(detail))
        if self.git("cat-file", "-e", f"{sha}^{{commit}}").rc != 0:
            raise OpError("el commit no existe en el repositorio")
        if self.git("merge-base", "--is-ancestor", sha, f"refs/remotes/origin/{branch}").rc != 0:
            raise OpError(f"el commit no pertenece a origin/{branch}")
        if self.git("merge-base", "--is-ancestor", old, sha).rc != 0:
            raise OpError("solo se permite avanzar (fast-forward) desde el commit actual del clon")
        # Antes de tocar el arbol de trabajo: el commit no puede contener symlinks, submodulos ni rutas raras, y debe
        # traer los archivos que lee compose. Se falla CERRADO si la salida de git se trunca.
        limit = 8_000_000
        tree = self.git("ls-tree", "-r", sha, out_limit=limit)
        if tree.rc != 0 or len(tree.out) >= limit:
            raise OpError("no se pudo inspeccionar el arbol del commit")
        bad = L.tree_problems(tree.out, list(self.pr["compose_files"]) + ["Dockerfile"])
        if bad:
            raise OpError("commit rechazado: " + "; ".join(bad[:5]))
        r = self.git("merge", "--ff-only", sha)
        if r.rc != 0:
            raise OpError("no se pudo avanzar el clon")
        changed = self.git("diff", "--name-only", old, sha).out.split()
        flags = [f for f in ("Dockerfile", "docker-compose.prod.yml", "package-lock.json", "next.config.ts") if f in changed]
        msg = f"clon actualizado {old[:12]} -> {sha[:12]} ({len(changed)} archivos)"
        if flags:
            msg += "\nATENCION cambios de infraestructura: " + ", ".join(flags) + " (revise compose-diff)"
        return Result(0, msg)

    def op_build(self, sha: str) -> Result:
        if self.head() != sha:
            raise OpError("el clon no esta en ese commit: ejecute fetch primero")
        if self.build_pending():
            raise OpError("ya hay un build en curso (job-status)")
        if self.git("status", "--porcelain").out.strip():
            raise OpError("el clon tiene cambios locales")
        self.require_baseline()
        mem = L.mem_available_mb(self.c.meminfo())
        if mem < self.cm.get("min_mem_available_mb", 0):
            raise OpError(f"memoria disponible {mem} MB insuficiente para construir")
        if self.c.disk_free_gb(self.pr["app_dir"]) < self.cm.get("min_disk_free_gb", 0):
            raise OpError("disco libre insuficiente para construir")
        job_id, token = self.c.job_id(), self.c.token()
        jobs = os.path.join(self.c.state.dir, "jobs")
        os.makedirs(jobs, mode=0o700, exist_ok=True)
        with open(os.path.join(jobs, job_id + ".json"), "w", encoding="utf-8") as fh:
            json.dump({"id": job_id, "token": token, "sha": sha, "status": "running", "log": "", "ts": self.c.now()}, fh)
        os.chmod(os.path.join(jobs, job_id + ".json"), 0o600)
        self.c.spawn(job_id, token)
        return Result(0, f"build iniciado en segundo plano; consulte: job-status {job_id}")

    def run_build_job(self, job_id: str) -> Result:
        """Lo ejecuta bd-run --run-job (con token). Toma el lock de build (fetch/build lo respetan) y no el lock global,
        para que las lecturas sigan respondiendo. El release solo se registra si el arbol NO cambio durante el build."""
        path = os.path.join(self.c.state.dir, "jobs", job_id + ".json")
        with open(path, encoding="utf-8") as fh:
            job = json.load(fh)
        tag = L.tag_for(job["sha"])

        def finish(status, log):
            job.update(status=status, log=L.redact(log)[-4000:], token="")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(job, fh)
            return Result(0 if status == "done" else 1, "", "" if status == "done" else log[-200:])

        try:
            with self.c.build_lock_factory():
                if self.head() != job["sha"]:
                    return finish("failed", "el clon cambio de commit antes de construir")
                if self.git("status", "--porcelain").out.strip():
                    return finish("failed", "el clon tiene cambios locales")
                self.require_baseline()
                r = self.docker("build", "--pull", self.pr["service"], tag=tag, timeout=self.cm["build_timeout_s"])
                if r.rc != 0 or not self.image_exists(tag):
                    return finish("failed", (r.out + r.err)[-3000:])
                if self.head() != job["sha"] or self.git("status", "--porcelain").out.strip():
                    return finish("failed", "el arbol cambio durante el build: imagen descartada")
                with self.c.lock_factory():
                    st = self.c.state.load()
                    st["built"] = [b for b in st["built"] if b["tag"] != tag] + [
                        {"tag": tag, "sha": job["sha"], "ts": self.c.now()}]
                    self.c.state.save(st)
                return finish("done", f"imagen {self.pr['image_repo']}:{tag} construida")
        except Busy:
            return finish("failed", "otro build esta en curso")
        except OpError as e:
            return finish("failed", str(e))
        except Exception as e:  # noqa: BLE001 - el trabajo nunca queda 'running' para siempre
            return finish("failed", f"error interno ({e.__class__.__name__})")

    def _activate(self, tag: str) -> list:
        """Levanta el release `tag` y devuelve los problemas de salud/HTTP (vacio = sano)."""
        r = self.docker("up", "-d", "--no-deps", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "120",
                        self.pr["service"], tag=tag, timeout=200)
        if r.rc != 0:
            return ["up fallo: " + L.redact((r.err.strip().splitlines() or ["sin detalle"])[-1])]
        return self.health() + self.http_problems()

    def _promote(self, st: dict, sha: str, tag: str) -> None:
        st["previous"] = st["deployed"]
        st["deployed"] = {"sha": sha, "tag": tag, "ts": self.c.now()}
        keep = {st["deployed"]["tag"]} | ({st["previous"]["tag"]} if st["previous"] else set())
        built = sorted(st["built"], key=lambda b: b["ts"], reverse=True)
        for b in built[self.pr["keep_releases"]:]:
            if b["tag"] not in keep and L.TAG_RE.fullmatch(b["tag"]):
                self.c.runner.run([self.cm["docker"], "image", "rm", f"{self.pr['image_repo']}:{b['tag']}"], timeout=60)
                st["built"] = [x for x in st["built"] if x["tag"] != b["tag"]]
        self.c.state.save(st)

    def op_up(self, sha: str) -> Result:
        if self.head() != sha:
            raise OpError("el clon no esta en ese commit")
        self.require_baseline()
        tag = L.tag_for(sha)
        st = self.c.state.load()
        if not any(b["tag"] == tag and b["sha"] == sha for b in st["built"]) or not self.image_exists(tag):
            raise OpError("ese commit no tiene imagen construida: ejecute build y espere 'done'")
        prev = st["deployed"]
        problems = self._activate(tag)
        if not problems:
            self._promote(st, sha, tag)
            return Result(0, f"desplegado {tag}; salud y HTTP OK")
        if prev and self.image_exists(prev["tag"]):
            back = self._activate(prev["tag"])
            state = "REVERTIDO al release anterior" + ("" if not back else " (el anterior tampoco sana: " + "; ".join(back) + ")")
        else:
            state = "sin release anterior al que volver"
        raise OpError(f"el release {tag} no sano ({'; '.join(problems)}); {state}")

    def op_rollback(self) -> Result:
        st = self.c.state.load()
        prev = st["previous"]
        if not prev or not self.image_exists(prev["tag"]):
            raise OpError("no hay un release anterior disponible")
        self.require_baseline()
        problems = self._activate(prev["tag"])
        if problems:
            raise OpError("el release anterior no sano: " + "; ".join(problems))
        self._promote(st, prev["sha"], prev["tag"])
        return Result(0, f"rollback a {prev['tag']} OK")

    # ------------------------------------------------------------------ nivel 2
    def op_accept_compose(self, sha: str) -> Result:
        if self.head() != sha:
            raise OpError("el clon no esta en ese commit")
        cfg = self.render()
        problems = L.validate_compose(cfg, self.p)
        if problems:
            raise OpError("compose rechazado por la politica: " + "; ".join(problems))
        if not L.consume_approval(self.p, "accept-compose", sha):
            raise OpError("requiere aprobacion humana: el administrador debe ejecutar 'sudo bd-approve accept-compose <sha>'", 77)
        st = self.c.state.load()
        st["compose_baseline"] = {"hash": L.config_hash(cfg), "config": cfg, "sha": sha}
        self.c.state.save(st)
        return Result(0, "linea base de compose aceptada")

    # ------------------------------------------------------------------ solo administrador (nunca por bd-gate)
    def admin_init_clone(self) -> Result:
        app = self.pr["app_dir"]
        if os.path.exists(os.path.join(app, ".git")):
            raise OpError("el clon ya existe")
        os.makedirs(os.path.dirname(app), exist_ok=True)
        env = {"GIT_TERMINAL_PROMPT": "0", "GIT_SSH_COMMAND": (
            f"ssh -i {self.pr['deploy_key']} -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes "
            f"-o UserKnownHostsFile={self.cm['known_hosts']} -o ForwardAgent=no")}
        r = self.c.runner.run([self.cm["git"], "-c", "core.hooksPath=/dev/null", "clone", "--branch", self.cm["git_branch"],
                               self.cm["git_remote_url"], app], timeout=300, env_extra=env)
        if r.rc != 0:
            raise OpError("git clone fallo: " + L.redact((r.err.strip().splitlines() or ["sin detalle"])[-1]))
        return Result(0, f"clon creado en {self.head()}")


def diff_config(old, new, prefix="") -> list:
    """Diferencias legibles entre dos configuraciones efectivas (rutas planas)."""
    out = []
    if isinstance(old, dict) and isinstance(new, dict):
        for k in sorted(set(old) | set(new)):
            if k not in old:
                out.append(f"+ {prefix}{k}")
            elif k not in new:
                out.append(f"- {prefix}{k}")
            else:
                out += diff_config(old[k], new[k], f"{prefix}{k}.")
    elif old != new:
        out.append(f"~ {prefix.rstrip('.')}")
    return out
