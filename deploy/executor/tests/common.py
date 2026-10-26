"""Utilidades de prueba: politica de ejemplo, fixtures reales de `docker compose config` y un Docker/Git SIMULADO que
registra cada comando. Ninguna prueba toca un servidor, Docker real ni la red."""
import contextlib
import copy
import json
import os
import stat
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
EXEC_DIR = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, EXEC_DIR)
sys.path.insert(0, os.path.join(EXEC_DIR, "claude-code"))

import bd_lib as L  # noqa: E402
import bd_ops as O  # noqa: E402

SHA_A = "a" * 40
SHA_B = "b" * 40
SHA_C = "c" * 40
DOCKER = "/usr/bin/docker"
GIT = "/usr/bin/git"


def load_policy(state_dir=None, log_dir=None):
    with open(os.path.join(EXEC_DIR, "policy.example.json"), encoding="utf-8") as fh:
        raw = fh.read().replace("<GITHUB_USER>", "usuario-prueba")
    p = json.loads(raw)
    L.validate_policy(p)
    # Rutas de prueba (en Windows no son POSIX): se asignan DESPUES de validar la politica de ejemplo.
    if state_dir:
        p["common"]["state_dir"] = state_dir
    if log_dir:
        p["common"]["log_dir"] = log_dir
    return p


def fixture():
    with open(os.path.join(HERE, "fixtures", "prod.json"), encoding="utf-8") as fh:
        return json.load(fh)


class FakeSystem(O.Runner):
    """Simula git y docker del servidor. `calls` conserva TODOS los argv ejecutados para auditarlos en las pruebas."""

    def __init__(self, policy):
        self.p = policy
        self.calls = []
        self.head = SHA_A
        self.origin = [SHA_A, SHA_B, SHA_C]          # historia lineal de origin/main
        self.dirty = False
        self.images = set()
        self.running_tag = None
        self.health = "healthy"
        self.fail_up_tags = set()                    # tags cuyo `up` falla o queda no sano
        self.build_fail = False
        self.others = "nginx-proxy|0.0.0.0:80->80/tcp|server\nanother-app|127.0.0.1:9000->9000/tcp|otro"
        self.config = fixture()
        self.fetch_fail = False
        self.tree = ("100644 blob 1111111111111111111111111111111111111111\tDockerfile\n"
                     "100644 blob 2222222222222222222222222222222222222222\tdocker-compose.prod.yml\n"
                     "100644 blob 3333333333333333333333333333333333333333\tsrc/app/page.tsx\n")
        self.symlinked = set()                       # archivos del clon que "son" symlinks (para check_files)
        self.has_dockerignore = True

    def _tag(self, env_extra):
        return (env_extra or {}).get("BD_TAG", "baseline")

    def run(self, argv, timeout=120, env_extra=None, cwd=None, out_limit=None):
        self.calls.append((list(argv), dict(env_extra or {})))
        exe, rest = argv[0], argv[1:]
        R = O.Result
        if exe == GIT:
            sub = rest[rest.index("-C") + 2:] if "-C" in rest else rest
            sub = [x for x in sub]
            if sub[0] == "rev-parse":
                return R(0, self.head + "\n")
            if sub[0] == "status":
                return R(0, " M x\n" if self.dirty else "")
            if sub[0] == "fetch":
                return R(1, "", "fatal: no se pudo leer del remoto") if self.fetch_fail else R(0)
            if sub[0] == "cat-file":
                return R(0 if sub[2].split("^")[0] in self.origin + ["d" * 40] else 128)
            if sub[0] == "merge-base":
                a, b = sub[2], sub[3]
                if b.startswith("refs/remotes/origin/"):
                    return R(0 if a in self.origin else 1)
                ia = self.origin.index(a) if a in self.origin else None
                ib = self.origin.index(b) if b in self.origin else None
                return R(0 if ia is not None and ib is not None and ia <= ib else 1)
            if sub[0] == "merge":
                self.head = sub[2]
                return R(0)
            if sub[0] == "diff":
                return R(0, "src/app/page.tsx\n")
            if sub[0] == "ls-tree":
                return R(0, self.tree)
            return R(0)
        if exe == DOCKER:
            if rest[:1] == ["compose"]:
                tag = self._tag(env_extra)
                cmd = rest[rest.index("-f") + 2:]            # tras el ultimo -f <archivo>
                while cmd and cmd[0] in ("-f",):
                    cmd = cmd[2:]
                if cmd[0] == "config":
                    cfg = copy.deepcopy(self.config)
                    cfg["services"]["web"]["image"] = f"bydlight-web:{tag}" if "web" in cfg["services"] else None
                    return R(0, json.dumps(cfg))
                if cmd[0] == "build":
                    if self.build_fail:
                        return R(1, "", "build error")
                    self.images.add(tag)
                    return R(0, "built")
                if cmd[0] == "up":
                    if tag in self.fail_up_tags:
                        self.running_tag = tag
                        self.health = "unhealthy"
                        return R(1, "", "container unhealthy")
                    self.running_tag = tag
                    self.health = "healthy"
                    return R(0)
                if cmd[0] == "ps":
                    if "--format" in cmd and cmd[cmd.index("--format") + 1] == "{{.Image}}":
                        return R(0, f"bydlight-web:{self.running_tag}\n" if self.running_tag else "")
                    if self.running_tag is None:
                        return R(0, "")
                    return R(0, json.dumps({"Service": "web", "State": "running", "Health": self.health,
                                            "Image": f"bydlight-web:{self.running_tag}"}) + "\n")
                if cmd[0] == "logs":
                    return R(0, "log de prueba password=hunter2\n")
                return R(0)
            if rest[:2] == ["image", "inspect"]:
                return R(0 if rest[2].split(":")[1] in self.images else 1)
            if rest[:2] == ["image", "rm"]:
                self.images.discard(rest[2].split(":")[1])
                return R(0)
            if rest[:1] == ["ps"]:
                mine = f"bydlight-prod-web-1|127.0.0.1:8200->3000/tcp|{self.p['project']['project']}"
                return R(0, mine + "\n" + self.others + "\n")
            if rest[:1] == ["version"]:
                return R(0, "29.1.3\n")
        return R(127, "", "comando no previsto por el simulador")


class NoLock:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Clock:
    def __init__(self, t=1_800_000_000.0):
        self.t = t

    def __call__(self):
        self.t += 1
        return self.t


def make_exec(tmp, system=None, **over):
    policy = load_policy(os.path.join(tmp, "state"), os.path.join(tmp, "log"))
    system = system or FakeSystem(policy)
    audit = []
    spawned = []
    def lstat(path):
        name = path.rsplit("/", 1)[-1]
        if name == ".dockerignore" and not system.has_dockerignore:
            raise FileNotFoundError(path)
        mode = (stat.S_IFLNK | 0o777) if name in system.symlinked else (stat.S_IFREG | 0o644)
        return types.SimpleNamespace(st_mode=mode)

    def realpath(path):
        return "/etc/bd-deploy/keys/prod_deploy" if path.rsplit("/", 1)[-1] in system.symlinked else path

    kw = dict(policy=policy, runner=system, audit_sink=audit.append, http_get=lambda url: 200, now=Clock(),
              meminfo=lambda: "MemAvailable: 4000000 kB\n", disk_free_gb=lambda p: 100.0, lock_factory=NoLock,
              build_lock_factory=NoLock, lstat=lstat, realpath=realpath,
              spawn=lambda j, t: spawned.append((j, t)), caller="bddeploy")
    kw.update(over)
    ctx = O.Ctx(**kw)
    ex = O.Executor(ctx)
    ex.audit_log, ex.spawned, ex.system = audit, spawned, system
    return ex


def accept_baseline(ex, sha=SHA_A):
    L.write_approval(ex.p, "accept-compose", sha, 10, "admin", now=ex.c.now())
    return ex.execute(L.parse_request(f"accept-compose {sha}"))


def req(text):
    return L.parse_request(text)


@contextlib.contextmanager
def noop():
    yield
