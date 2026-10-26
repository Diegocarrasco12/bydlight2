"""Logica pura del ejecutor bd-deploy (bydlight2): gramatica de peticiones, politica, validacion del compose efectivo,
aprobaciones y estado. Sin acceso a Docker ni a la red: todo es probable sin servidor.

Patrones de seguridad tomados de projectmanager (oe-deploy), reescritos para un unico proyecto sin base de datos.
No comparte codigo, rutas, usuario, politica ni estado con oe-deploy.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from dataclasses import dataclass

# OJO: el `$` de Python acepta un salto de linea FINAL (una cadena terminada en \n casa con ^abc$): todas las anclas
# usan \A ... \Z y la validacion usa fullmatch.
SHA_RE = re.compile(r"\A[0-9a-f]{40}\Z")
TAG_RE = re.compile(r"\A[0-9a-f]{12}\Z")
JOB_RE = re.compile(r"\A[0-9a-f]{16}\Z")
LINES_RE = re.compile(r"\A[0-9]{1,3}\Z")
REQUEST_RE = re.compile(r"\A[a-z0-9-]+( [a-z0-9-]+){0,2}\Z")
NAME_RE = re.compile(r"\A[a-z][a-z0-9-]{2,30}\Z")
PATH_RE = re.compile(r"\A/[A-Za-z0-9._/-]*\Z")
BRANCH_RE = re.compile(r"\A[A-Za-z0-9][A-Za-z0-9._-]{0,40}\Z")
REMOTE_RE = re.compile(r"\Agit@github\.com:[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}\.git\Z")

# Lista CERRADA de operaciones. tier 0 = solo lectura, 1 = modifica el proyecto bydlight, 2 = exige aprobacion humana.
# args: tipos de argumento (validados por _check_arg). admin: solo el administrador por sudo directo, nunca por bd-gate.
OPS = {
    "status": {"args": (), "tier": 0},
    "preflight": {"args": (), "tier": 0},
    "verify": {"args": (), "tier": 0},
    "compose-diff": {"args": (), "tier": 0},
    "list-releases": {"args": (), "tier": 0},
    "job-status": {"args": ("job",), "tier": 0},
    "logs": {"args": ("lines",), "tier": 0},
    "fetch": {"args": ("sha",), "tier": 1},
    "build": {"args": ("sha",), "tier": 1},
    "up": {"args": ("sha",), "tier": 1},
    "rollback": {"args": (), "tier": 1},
    "accept-compose": {"args": ("sha",), "tier": 2},
}
ADMIN_OPS = ("init-clone",)


class RequestError(ValueError):
    """Peticion rechazada (mensaje seguro para el cliente)."""


@dataclass(frozen=True)
class Request:
    op: str
    args: tuple

    @property
    def tier(self) -> int:
        return OPS[self.op]["tier"]


def parse_request(raw, policy: dict | None = None) -> Request:
    """Gramatica cerrada: `<operacion> [argumento]`. Solo [a-z0-9-], sin metacaracteres, sin espacios extra."""
    if raw is None or not isinstance(raw, str):
        raise RequestError("sin comando")
    if len(raw) > 100 or not REQUEST_RE.fullmatch(raw):
        raise RequestError("formato de peticion invalido")
    parts = raw.split(" ")
    op, args = parts[0], tuple(parts[1:])
    if op not in OPS:
        raise RequestError("operacion no permitida")
    kinds = OPS[op]["args"]
    if len(args) != len(kinds):
        raise RequestError(f"'{op}' espera {len(kinds)} argumento(s)")
    for kind, value in zip(kinds, args):
        _check_arg(kind, value)
    return Request(op, args)


def _check_arg(kind: str, value: str) -> None:
    if kind == "sha" and SHA_RE.fullmatch(value):
        return
    if kind == "job" and JOB_RE.fullmatch(value):
        return
    if kind == "lines" and LINES_RE.fullmatch(value) and 1 <= int(value) <= 200:
        return
    raise RequestError(f"argumento invalido ({kind})")


# --------------------------------------------------------------------------------------
# Politica
# --------------------------------------------------------------------------------------

def _abs(path, what: str) -> None:
    if not isinstance(path, str) or not path.startswith("/") or ".." in path.split("/") or "\0" in path:
        raise ValueError(f"politica: {what} debe ser una ruta absoluta limpia")


def load_policy(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return validate_policy(json.load(fh))


def validate_policy(p: dict) -> dict:
    if p.get("version") != 1:
        raise ValueError("politica: version no soportada")
    c, pr = p.get("common"), p.get("project")
    if not isinstance(c, dict) or not isinstance(pr, dict):
        raise ValueError("politica: faltan 'common' y 'project'")
    for key in ("state_dir", "log_dir", "docker", "git", "known_hosts"):
        _abs(c.get(key), f"common.{key}")
    for key in ("app_dir", "deploy_key"):
        _abs(pr.get(key), f"project.{key}")
    if not isinstance(c.get("git_remote_url"), str) or not REMOTE_RE.fullmatch(c["git_remote_url"]):
        raise ValueError("politica: git_remote_url debe ser git@github.com:<usuario>/<repo>.git (sin placeholders)")
    if not isinstance(c.get("git_branch"), str) or not BRANCH_RE.fullmatch(c["git_branch"]) or ".." in c["git_branch"]:
        raise ValueError("politica: git_branch invalido")
    for key in ("min_mem_available_mb", "min_disk_free_gb", "build_timeout_s"):
        if not isinstance(c.get(key), int) or isinstance(c.get(key), bool) or c[key] < 0:
            raise ValueError(f"politica: common.{key} debe ser un entero >= 0")
    if not 60 <= c["build_timeout_s"] <= 7200:
        raise ValueError("politica: build_timeout_s entre 60 y 7200")
    if not isinstance(c.get("service_user"), str) or not NAME_RE.fullmatch(c["service_user"]):
        raise ValueError("politica: common.service_user invalido")
    for key in ("project", "image_repo", "service"):
        if not isinstance(pr.get(key), str) or not NAME_RE.fullmatch(pr[key]):
            raise ValueError(f"politica: project.{key} invalido")
    if not isinstance(pr.get("compose_files"), list) or not pr["compose_files"] or not all(
            isinstance(f, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*\.ya?ml", f) and ".." not in f
            for f in pr["compose_files"]):
        raise ValueError("politica: compose_files invalido")
    for key in ("port", "container_port"):
        if not isinstance(pr.get(key), int) or isinstance(pr.get(key), bool) or not 1024 <= pr[key] <= 65535:
            raise ValueError(f"politica: project.{key} invalido")
    if not pr.get("networks") or not all(isinstance(n, str) and NAME_RE.fullmatch(n) for n in pr["networks"]):
        raise ValueError("politica: project.networks invalido")
    if not pr.get("http_checks") or not all(isinstance(x, str) and PATH_RE.fullmatch(x) and ".." not in x
                                            for x in pr["http_checks"]):
        raise ValueError("politica: http_checks invalido (rutas relativas al sitio, al menos una)")
    if not isinstance(pr.get("keep_releases"), int) or isinstance(pr.get("keep_releases"), bool) or not 2 <= pr["keep_releases"] <= 20:
        raise ValueError("politica: keep_releases debe estar entre 2 y 20")
    return p


def compose_args(policy: dict) -> list:
    """Prefijo FIJO de todo comando compose: proyecto, directorio, archivos y env-file nulo (sin .env del repo)."""
    pr = policy["project"]
    argv = [policy["common"]["docker"], "compose", "-p", pr["project"], "--project-directory", pr["app_dir"],
            "--env-file", "/dev/null"]
    for f in pr["compose_files"]:
        argv += ["-f", posix_join(pr["app_dir"], f)]
    return argv


def posix_join(base: str, name: str) -> str:
    return base.rstrip("/") + "/" + name


def container_name(policy: dict) -> str:
    pr = policy["project"]
    return f"{pr['project']}-{pr['service']}-1"


# --------------------------------------------------------------------------------------
# Validacion de la configuracion EFECTIVA de compose (docker compose config --format json)
# --------------------------------------------------------------------------------------

ALLOWED_TOP = {"name", "services", "networks"}
# Claves de servicio benignas. Cualquier otra (privileged, network_mode, pid, cap_add, devices, volumes, ...) se rechaza.
ALLOWED_SERVICE_KEYS = {"build", "image", "restart", "user", "init", "read_only", "tmpfs", "cap_drop", "security_opt",
                        "mem_limit", "cpus", "pids_limit", "ports", "networks", "healthcheck", "logging",
                        "command", "entrypoint"}
BUILD_KEYS = {"context", "dockerfile"}


def validate_compose(rendered: dict, policy: dict) -> list:
    """Lista de violaciones frente a la politica (vacia = valido). Los mensajes no incluyen valores arbitrarios."""
    pr = policy["project"]
    out = []
    if not isinstance(rendered, dict):
        return ["configuracion ilegible"]
    for k in rendered:
        if k not in ALLOWED_TOP:
            out.append(f"clave de nivel superior no permitida '{k}'")
    if rendered.get("name") != pr["project"]:
        out.append("nombre de proyecto distinto del autorizado")
    services = rendered.get("services") or {}
    if set(services) != {pr["service"]}:
        out.append("servicio no autorizado o ausente (solo se permite el servicio de la politica)")
    for name, svc in services.items():
        if name == pr["service"]:
            out += _validate_service(svc, policy)
    nets = rendered.get("networks") or {}
    allowed_nets = {n: f"{pr['project']}_{n}" for n in pr["networks"]}
    for n, spec in nets.items():
        spec = spec or {}
        if spec.get("external"):
            out.append("red externa no permitida")
        elif n not in allowed_nets:
            out.append("red no autorizada")
        elif spec.get("name") != allowed_nets[n]:
            out.append("red fuera del proyecto")
        if set(spec) - {"name", "ipam"}:
            out.append("opciones de red no permitidas")
        if spec.get("ipam"):
            out.append("ipam personalizado no permitido")
    return out


def _validate_service(s: dict, policy: dict) -> list:
    pr = policy["project"]
    app_dir = pr["app_dir"]
    out = []
    for k in s:
        if k not in ALLOWED_SERVICE_KEYS:
            out.append(f"clave no permitida '{k}'")
    # Ni command ni entrypoint pueden sobrescribirse (compose los normaliza a null cuando no se definen).
    for k in ("command", "entrypoint"):
        if s.get(k) not in (None, [], ""):
            out.append(f"{k} sobrescrito no permitido")
    build = s.get("build")
    if not isinstance(build, dict):
        out.append("el servicio debe construirse desde el repositorio")
    else:
        for k in build:
            if k not in BUILD_KEYS:
                out.append(f"build.{k} no permitido")
        ctx = build.get("context")
        if ctx != app_dir:
            out.append("contexto de build fuera del arbol del proyecto")
        if build.get("dockerfile") != "Dockerfile":
            out.append("dockerfile distinto de Dockerfile")
    if s.get("image") != f"{pr['image_repo']}:baseline":
        out.append("imagen no autorizada (debe ser <repo>:${BD_TAG})")
    user = str(s.get("user", ""))
    if not re.fullmatch(r"[1-9][0-9]{3,8}(:[1-9][0-9]{3,8})?", user):
        out.append("usuario root o sin usuario no permitido (uid y gid numericos >= 1000)")
    if s.get("read_only") is not True:
        out.append("el sistema de archivos debe ser de solo lectura")
    if [str(x).upper() for x in (s.get("cap_drop") or [])] != ["ALL"]:
        out.append("cap_drop debe ser ALL")
    if sorted(s.get("security_opt") or []) != ["no-new-privileges:true"]:
        out.append("security_opt no permitido")
    if not s.get("mem_limit") or str(s.get("mem_limit")) in ("0", ""):
        out.append("sin mem_limit")
    for t in s.get("tmpfs") or []:
        if not re.fullmatch(r"/(tmp|app/\.next/cache)(:[a-z0-9=,]+)?", str(t)):
            out.append("tmpfs no permitido")
    ports = s.get("ports") or []
    want = {("127.0.0.1", str(pr["port"]), pr["container_port"], "tcp")}
    got = {(p.get("host_ip"), str(p.get("published")), p.get("target"), p.get("protocol", "tcp")) for p in ports}
    if got != want or len(ports) != 1:
        out.append("puerto publicado no autorizado (solo 127.0.0.1:<puerto de la politica>)")
    svc_nets = s.get("networks") or {}
    if isinstance(svc_nets, dict):
        names = set(svc_nets)
    else:
        names = set(svc_nets)
    if not names or not names <= set(pr["networks"]):
        out.append("red no autorizada")
    for v in (s.get("networks") or {}).values() if isinstance(s.get("networks"), dict) else []:
        if v:
            out.append("opciones de red del servicio no permitidas")
    logging = s.get("logging") or {}
    if logging.get("driver") not in (None, "json-file", "local"):
        out.append("driver de logs no permitido")
    return out


def config_hash(rendered: dict) -> str:
    """Huella canonica de la configuracion efectiva (calculada con BD_TAG fijo: el sha no la altera)."""
    return hashlib.sha256(json.dumps(rendered, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


# --------------------------------------------------------------------------------------
# Aprobaciones humanas (un solo uso, ligadas al commit)
# --------------------------------------------------------------------------------------

def approval_path(policy: dict, action: str, arg: str) -> str:
    if not re.fullmatch(r"[a-z-]+", action) or not SHA_RE.fullmatch(arg):
        raise ValueError("aprobacion invalida")
    return os.path.join(policy["common"]["state_dir"], "approvals", f"{action}-{arg}.json")


def write_approval(policy: dict, action: str, arg: str, minutes: int, who: str, now: float | None = None) -> str:
    if not 1 <= minutes <= 120:
        raise ValueError("vigencia entre 1 y 120 minutos")
    path = approval_path(policy, action, arg)
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    now = time.time() if now is None else now
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"action": action, "arg": arg, "expires": now + minutes * 60, "by": who}, fh)
    os.chmod(path, 0o600)
    return path


def consume_approval(policy: dict, action: str, arg: str, now: float | None = None) -> bool:
    """True y borra el archivo si existe y no ha vencido; un vencido tambien se borra."""
    path = approval_path(policy, action, arg)
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return False
    try:
        os.remove(path)
    except OSError:
        return False
    now = time.time() if now is None else now
    return data.get("action") == action and data.get("arg") == arg and float(data.get("expires", 0)) > now


# --------------------------------------------------------------------------------------
# Estado persistente (solo lo escribe root)
# --------------------------------------------------------------------------------------

class State:
    """state.json: despliegue actual, anterior, releases construidos, linea base de compose y de servicios ajenos."""

    DEFAULT = {"deployed": None, "previous": None, "built": [], "compose_baseline": None, "others": None}

    def __init__(self, policy: dict):
        self.dir = policy["common"]["state_dir"]
        self.path = os.path.join(self.dir, "state.json")

    def load(self) -> dict:
        try:
            with open(self.path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            data = {}
        out = json.loads(json.dumps(self.DEFAULT))
        out.update({k: v for k, v in data.items() if k in out})
        return out

    def save(self, data: dict) -> None:
        os.makedirs(self.dir, mode=0o750, exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
        os.chmod(tmp, 0o600)
        os.replace(tmp, self.path)


def tag_for(sha: str) -> str:
    return sha[:12]


def mem_available_mb(meminfo_text: str) -> int:
    for line in meminfo_text.splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1]) // 1024
    return 0


def redact(text: str) -> str:
    """Oculta valores que parezcan secretos antes de devolver salida de docker/git al cliente."""
    text = re.sub(r"(?i)\b(password|secret|token|key|authorization)(\s*[=:]\s*)\S+", r"\1\2***", text)
    return re.sub(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", "***", text, flags=re.S)


# --------------------------------------------------------------------------------------
# Arbol de un commit (salida de `git ls-tree -r <sha>`)
# --------------------------------------------------------------------------------------

def tree_problems(ls_tree_out: str, required: list) -> list:
    """Rechaza symlinks (120000), submodulos (160000), rutas absolutas/con '..'/'.git' y exige los archivos de `required`
    como blobs regulares. El sitio no usa nada de eso; un commit con symlinks podria apuntar compose o el Dockerfile a
    archivos de root y filtrarlos por los mensajes de error."""
    problems, present = [], {}
    for line in ls_tree_out.splitlines():
        meta, sep, path = line.partition("\t")
        parts = meta.split()
        if not sep or len(parts) != 3:
            problems.append("linea de arbol ilegible")
            continue
        mode, kind, _ = parts
        present[path] = mode
        comps = path.split("/")
        if mode == "120000":
            problems.append(f"symlink no permitido ({path[:60]})")
        elif mode == "160000" or kind == "commit":
            problems.append(f"submodulo no permitido ({path[:60]})")
        elif path.startswith("/") or ".." in comps or any(c.lower() == ".git" for c in comps):
            problems.append(f"ruta no permitida ({path[:60]})")
    for name in required:
        if present.get(name) not in ("100644", "100755"):
            problems.append(f"falta {name} como archivo regular")
    return problems


# --------------------------------------------------------------------------------------
# sudoers: una regla EXPLICITA por forma de peticion permitida (sin `bd-run` a secas)
# --------------------------------------------------------------------------------------

def sudoers_commands(bd_run: str) -> list:
    """Lineas `<ruta> <argumentos con comodines fnmatch>` que sudo debe aceptar. Son EXACTAMENTE la gramatica de
    parse_request: 40 clases [0-9a-f] para un SHA, 16 para un id de trabajo, 1-3 digitos para `logs`, y ninguna
    operacion de administrador (init-clone) ni --run-job (lo lanza bd-run mismo, sin sudo). Sin `*`."""
    sha, job = "[0-9a-f]" * 40, "[0-9a-f]" * 16
    cmds = []
    for op, spec in OPS.items():
        kinds = spec["args"]
        if not kinds:
            cmds.append(f"{bd_run} {op}")
        elif kinds == ("sha",):
            cmds.append(f"{bd_run} {op} {sha}")
        elif kinds == ("job",):
            cmds.append(f"{bd_run} {op} {job}")
        elif kinds == ("lines",):
            cmds += [f"{bd_run} {op} " + "[0-9]" * n for n in (1, 2, 3)]
        else:
            raise ValueError(f"sin regla de sudoers para los argumentos de {op}")
    return cmds


def sudoers_text(user: str, bd_run: str) -> str:
    if not NAME_RE.fullmatch(user) or not PATH_RE.fullmatch(bd_run):
        raise ValueError("usuario o ruta invalidos")
    bs = chr(92)  # continuacion de linea de sudoers
    body = (", " + bs + "\n").join("    " + c for c in sudoers_commands(bd_run))
    return (f"# bd-deploy: la cuenta {user} solo puede invocar bd-run con peticiones de la gramatica cerrada (cada forma es\n"
            f"# una regla explicita; bd-run y bd-gate las validan de nuevo). Generado por bd_lib.sudoers_text.\n"
            f'Defaults:{user} !requiretty, env_reset, !setenv, secure_path="/usr/sbin:/usr/bin:/sbin:/bin"\n'
            f"Cmnd_Alias BD_DEPLOY_OPS = {bs}\n{body}\n"
            f"{user} ALL=(root) NOPASSWD: BD_DEPLOY_OPS\n")
