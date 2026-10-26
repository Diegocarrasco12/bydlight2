# Despliegue de bydlight2 en el servidor propio (`bd-deploy`)

Guía de operación del despliegue automatizado y restringido de **bydlight2**. Es un sistema **independiente**: no comparte
usuario, política, estado, claves, aprobaciones, proyecto Docker ni puertos con `oe-deploy` (Only Energy/projectmanager) ni
con ningún otro proyecto del servidor. Toma de projectmanager solo los *patrones* de seguridad.

Los valores reales (hostnames, dominio, túnel, cuentas) viven fuera del repositorio. Aquí solo hay placeholders:
`<SERVER_HOST>`, `<SSH_HOSTNAME>`, `<WEB_DOMAIN>`, `<ADMIN_USER>`, `<ADMIN_SSH_ALIAS>`, `<GITHUB_USER>`.

## 1. Qué es y qué garantiza

```
Claude Code (Windows) ── powershell -File bd-deploy.ps1 ──ssh (id_ed25519_bddeploy)──▶ Cloudflare Access/Tunnel ──▶ sshd (127.0.0.1:22)
   reglas allow exactas + hook                          Match User bddeploy → ForceCommand bd-gate (sin privilegios)
                                                                 │ gramática cerrada: <operación> [argumento]
                                                                 ▼ sudo -n bd-run <operación> [argumento]   (única regla sudoers)
                                                            bd-run (root, Python -I, sin shell)
                       política · línea base de compose · locks · aprobaciones · auditoría · git + docker compose -p bydlight-prod
```

- `bddeploy`: sin sudo general, sin grupo `docker`, shell `nologin`, contraseña bloqueada, sin TTY ni reenvíos. Su clave SSH
  solo puede ejecutar `bd-gate`.
- `bd-gate` valida contra una **gramática cerrada** (solo `[a-z0-9-]`, operaciones fijas, SHA de 40 hex) y recién entonces
  invoca `sudo -n bd-run`. `bd-run` **vuelve a validar** y no confía en el llamador.
- `bd-run` solo ejecuta comandos **fijos**: `docker compose -p bydlight-prod --env-file /dev/null -f <archivo del proyecto> …`,
  `docker image inspect|rm bydlight-web:<tag>`, `docker ps` y `git` del clon de la aplicación con hooks desactivados.
  Nunca recibe nombres de contenedor, rutas ni comandos del cliente.
- Antes de construir o levantar valida la **configuración efectiva** (`docker compose config --format json`): un único servicio
  `web`, puerto solo `127.0.0.1:8200`, usuario no root, sistema de archivos de solo lectura, `cap_drop: ALL`, sin volúmenes,
  sin `environment`, sin redes externas ni de otros proyectos, sin `privileged`/`network_mode`/`pid`/`devices`/`docker.sock`.
  Cualquier cambio estructural exige **`accept-compose` con aprobación humana** (`bd-approve`).
- El código llega desde GitHub con una **deploy key de solo lectura**, solo commits de `origin/main` y solo *fast-forward*.
- `up` verifica salud del contenedor y HTTP; si el release nuevo no sana, **vuelve solo al anterior**.

**Lo que NO garantiza:** protege a los *otros proyectos del servidor* y a los secretos, pero no protege este sitio de un commit
malicioso que pase la política (el Dockerfile corre con red durante el build). La aprobación de cada despliegue a producción
sigue siendo tuya.

## 2. Archivos

| Archivo | Rol |
|---|---|
| `Dockerfile`, `docker-compose.prod.yml`, `.dockerignore` | Imagen Next.js *standalone* y compose de producción (el ejecutor valida su configuración efectiva). |
| `deploy/executor/bd_lib.py`, `bd_ops.py` | Gramática, política, validador de compose, aprobaciones, operaciones. |
| `deploy/executor/bd-gate`, `bd-run`, `bd-approve` | Comando forzado (sin privilegios), ejecutor (root), aprobación humana (root). |
| `deploy/executor/install.sh`, `lib-txn.sh`, `uninstall.sh` | Instalador **transaccional** (`--plan` por defecto, `--apply`, `--verify`); `lib-txn.sh` es el motor de reversión. |
| `deploy/executor/policy.example.json` | Plantilla de política (único placeholder: `<GITHUB_USER>`). La política **definitiva** (`policy.json`, sin placeholders) va solo en el paquete, no en el repo. |
| `deploy/executor/claude-code/` | Cliente `bd-deploy.ps1`, hook, generador/aplicador de reglas, ejemplo de config SSH. |
| `deploy/executor/tests/` | 129 pruebas automáticas (sin servidor), incluidas sudoers (emulación de sudo + fuzz) y reversión real con bash. |

### Garantías del instalador (`--apply`)

- **Transaccional**: registra todo lo que crea (`new`) o modifica (`modified`, con copia previa). Si algo falla, recibe
  señal o `die`, revierte solo y **verifica** la reversión; la reversión solo puede tocar rutas de una lista permitida
  (`TXN_ALLOW`), nunca fuera de ellas. `txn_new` se niega a pisar algo que ya existe.
- **sudoers explícito**: una regla por forma de petición (`bd-run status`, `bd-run build [0-9a-f]×40`, …), sin `*` ni
  `bd-run` a secas; no hay regla para `init-clone` ni `--run-job`. `visudo -cf` antes de instalar.
- **sshd compatible con oedeploy**: el bloque `Match User bddeploy` va en su propio drop-in (`50-bd-deploy.conf`), no toca
  `50-oe-deploy.conf`; el instalador compara `sshd -T -C user=…,addr=…` de los demás usuarios antes y después y revierte
  si difiere.
- **Autopruebas de permisos** sin combinaciones `! a && ! b` (que pasaban en falso si faltaba la ruta): cada condición se
  comprueba por separado con el resultado de `runuser` explícito.

Pruebas: `cd deploy/executor && python -B -m unittest discover -s tests`.

## 3. Operaciones (lista cerrada)

| Nivel | Operación | Qué hace |
|---|---|---|
| 0 | `status`, `preflight`, `verify`, `compose-diff`, `list-releases`, `job-status <id>`, `logs <n>` | Solo lectura. `preflight` guarda la línea base de contenedores ajenos; `verify` avisa si algo ajeno cambió. |
| 1 | `fetch <sha>` | `git fetch` de un solo refspec con la deploy key; commit de `origin/main`, solo fast-forward, clon limpio. |
| 1 | `build <sha>` | En segundo plano (`job-status`); exige compose válido e igual a la línea base. Etiqueta `bydlight-web:<sha12>`. |
| 1 | `up <sha>` | `up -d --no-deps --no-build --wait` + salud + HTTP; si falla, **revierte** al release anterior. |
| 1 | `rollback` | Reactiva el release anterior (las imágenes de los últimos 5 se conservan). |
| 2 | `accept-compose <sha>` | Acepta la línea base de compose. **Requiere** `sudo bd-approve accept-compose <sha>` (un solo uso, 1–120 min). |
| admin | `init-clone` | Solo `sudo bd-run init-clone` del administrador (nunca por `bd-gate`): clona el repo con la deploy key. |

Fuera del ejecutor (manual, como administrador): túnel y Cloudflare, DNS, secretos, sudoers, firewall, `prune`, `down -v`,
cualquier otro proyecto.

## 4. Flujo de actualización (cuando todo esté instalado)

```
bd-deploy -Op preflight                      # clon limpio, compose = línea base, recursos, daemon
bd-deploy -Op fetch -OpArgs <sha40>
bd-deploy -Op compose-diff                   # si cambió Dockerfile/compose: revisar; si difiere, aprobar accept-compose
bd-deploy -Op build -OpArgs <sha40>          # + job-status <id> hasta "done"
bd-deploy -Op up -OpArgs <sha40>             # salud + HTTP; revierte solo si falla
bd-deploy -Op verify
```

Cada operación que modifica (`fetch`, `build`, `up`, `rollback`, `accept-compose`) pasa por regla `ask` en Claude Code: se
confirma en el chat. **No se despliega sin orden expresa del usuario.**

## 5. Instalación en el servidor (la ejecuta el administrador; plan primero)

Prerrequisitos ya cumplidos: Ubuntu 24.04, Docker/Compose, usuario `bddeploy` (sin sudo/docker, `nologin`, contraseña
bloqueada, `/var/lib/bd-deploy-home/.ssh` 700), clave `id_ed25519_bddeploy` generada en el PC, SSH en `127.0.0.1:22`,
puerto `8200` libre.

**A. Copiar el paquete y la clave pública (PowerShell en el PC):**

```powershell
cd C:\Users\dcarrasco\Desktop\Proyectos\bd-deploy-package
Get-FileHash .\bd-executor.tgz -Algorithm SHA256      # comparar con bd-executor.tgz.sha256
scp .\bd-executor.tgz "$HOME\.ssh\id_ed25519_bddeploy.pub" <ADMIN_SSH_ALIAS>:/tmp/
```

**B. En el servidor (como administrador):**

```bash
sha256sum /tmp/bd-executor.tgz                       # comparar con bd-executor.tgz.sha256
mkdir -p ~/bd-exec && tar -xzf /tmp/bd-executor.tgz -C ~/bd-exec   # incluye policy.json definitiva (sin placeholders)
sudo bash ~/bd-exec/install.sh --policy ~/bd-exec/policy.json --admin-user "$USER" --pubkey-file /tmp/id_ed25519_bddeploy.pub
```

Eso es el **plan** (no cambia nada). Si es correcto, aplicar y verificar:

```bash
sudo bash ~/bd-exec/install.sh --policy ~/bd-exec/policy.json --admin-user "$USER" --pubkey-file /tmp/id_ed25519_bddeploy.pub --apply
sudo bash ~/bd-exec/install.sh --verify
```

`--apply` muestra la **deploy key pública**: agrégala en GitHub (repositorio bydlight2 → Settings → Deploy keys) **sin** permiso
de escritura. Luego completa `/etc/bd-deploy/known_hosts` con la huella **verificada** de github.com:

```bash
ssh-keyscan -t ed25519 github.com | sudo tee /etc/bd-deploy/known_hosts
ssh-keygen -lf /etc/bd-deploy/known_hosts     # comparar con las huellas publicadas por GitHub
```

**C. Primer clon y línea base de compose (administrador):**

Requiere que el `Dockerfile`, `docker-compose.prod.yml` y `deploy/` ya estén **commiteados y subidos** a `main` (hoy no lo
están: hace falta tu aprobación para el commit y el push).

```bash
sudo /usr/local/sbin/bd-run init-clone
sha=$(sudo git -C /srv/bydlight-prod/app rev-parse HEAD)
sudo /usr/local/sbin/bd-approve accept-compose "$sha"
sudo /usr/local/sbin/bd-run accept-compose "$sha"
```

(Se hace como administrador porque `bddeploy` aún no tiene acceso SSH habilitado hasta la sección 6.)

## 6. Conectar Claude Code (SSH + Cloudflare, sin tocar lo existente)

Solo después de que `install.sh --verify` pase **sin fallas**.

1. El túnel debe tener una entrada de ingress `ssh://localhost:22` con un hostname (`<SSH_HOSTNAME>`) protegido por Cloudflare
   Access. Si ya existe (el que usa el administrador), se **reutiliza solo como transporte**: la autorización la decide sshd
   por usuario y clave (`bddeploy` está limitado a `bd-gate`). Si no existe o hay que agregar el hostname web, es un cambio
   del túnel que **requiere tu autorización expresa** y no se hace desde aquí.
2. Si la sesión de Access caduca, crear un **service token propio de bydlight** (en la política de Access del hostname SSH) y
   definir en el PC `TUNNEL_SERVICE_TOKEN_ID` y `TUNNEL_SERVICE_TOKEN_SECRET`. Nunca en archivos ni en el repo.
3. En el PC: copiar `deploy/executor/claude-code/ssh-config.example` a `%USERPROFILE%\.ssh\bd-deploy.config` y completar
   `<SSH_HOSTNAME>`, `<RUTA_USUARIO>` y `<RUTA_CLOUDFLARED>`. Es un archivo **separado** de `~/.ssh/config` y de `oe-deploy.config`.
4. Habilitar el acceso del `bddeploy` en el servidor ya lo hizo `install.sh --apply` (authorized_keys con `restrict,command=`
   y `from="127.0.0.1,::1"`; el bloque sshd `50-bd-deploy.conf`).
5. Aplicar las reglas de Claude Code (plan por defecto, aditivo y reversible; no toca las reglas de `oe-deploy`):

```powershell
python deploy\executor\claude-code\apply_claude_config.py            # plan
python deploy\executor\claude-code\apply_claude_config.py --apply    # copia el cliente a ~/.claude/tools/bd-deploy y fusiona reglas
python deploy\executor\claude-code\apply_claude_config.py --rollback # restaura settings.json
```

   Reiniciar Claude Code y revisar `/permissions`. Opcional: `claude-code/extra-sensitive.txt` (no versionado) con el hostname
   SSH real para que el hook también lo bloquee fuera del cliente.
6. Probar: `powershell -NoProfile -File $HOME\.claude\tools\bd-deploy\bd-deploy.ps1 -Op status` debe responder; intentos de
   `bash`, `status; id` u operaciones de otros proyectos deben terminar en `rechazado` (exit 126).

## 7. Rollback, desinstalación y auditoría

- Imagen anterior: `bd-deploy -Op rollback` (o automático si `up` no sana). Los datos no existen (sitio sin base de datos).
- `sudo bash deploy/executor/uninstall.sh [--apply]`: retira wrappers, política, claves, sudoers y bloque sshd; **conserva**
  el usuario, el estado, la auditoría, el clon y el proyecto Docker en ejecución.
- Auditoría: `/var/log/bd-deploy/audit.log` (JSON por operación y por rechazo); rechazos del gate en `syslog` (`bd-gate`).
- Estado: `/var/lib/bd-deploy/state.json` (release actual/anterior, línea base de compose).

## 8. Pendiente que requiere tu autorización (no se hace por defecto)

- Entrada de ingress del túnel `bydlight-tunnel` hacia `http://localhost:8200` y el DNS de `<WEB_DOMAIN>`. Mientras no exista,
  el sitio corre solo en `127.0.0.1:8200` y no es público.
- Primer despliegue a producción (`fetch/build/up`).
