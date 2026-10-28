# Despliegue de Bydlight2 (procedimiento comprobado)

Resumen operativo para retomar sin reconstruir nada. La guía completa de instalación y diseño del ejecutor está en `DEPLOY.md`
(raíz del repositorio); este documento recoge lo **comprobado en producción** y los problemas conocidos.
Los valores reales (host SSH, túnel, cuentas) **no** están en el repositorio ni deben añadirse: viven en el PC y el servidor del administrador.

## 1. Arquitectura general

```
PowerShell (Windows)  ──►  bd-deploy.ps1  ──ssh──►  Cloudflare Tunnel/Access ──► sshd (127.0.0.1:22 del servidor Ubuntu)
                                   clave dedicada, usuario `bddeploy`, ForceCommand bd-gate (sin shell, sin sudo general)
                                   │  gramática cerrada: <operación> [argumento]
                                   ▼  sudo -n bd-run  (única regla sudoers, Python -I, sin shell)
                    política + línea base de compose + locks + auditoría + git + `docker compose -p bydlight-prod`
```

- Es **independiente** de `oe-deploy` (Only Energy/projectmanager) y de otros proyectos: no comparte usuario, claves, política, estado,
  proyecto Docker ni puertos.
- Código: GitHub `Diegocarrasco12/bydlight2`, rama `main`. El servidor lo obtiene con una **deploy key de solo lectura**, solo commits de
  `origin/main` y solo fast-forward.
- Producción: proyecto Docker `bydlight-prod`, contenedor `web` publicado únicamente en `127.0.0.1:8200`; Cloudflare Tunnel (`cloudflared`
  en el servidor, administrado localmente por el administrador) lo expone en `bydlightsolutions.com` y `www`. **El túnel y el DNS no se
  modifican desde el ejecutor ni desde Claude.**
- Protección de otros contenedores: `preflight` guarda una línea base de contenedores ajenos (18 al 2026-10-27) y `verify` avisa si algo
  ajeno cambió; `bd-run` solo ejecuta comandos fijos y nunca recibe nombres de contenedor, rutas ni comandos del cliente.
- Política de infraestructura (validada antes de `build`/`up`): un solo servicio `web`, puerto solo `127.0.0.1:8200`, usuario no root,
  sistema de archivos de solo lectura, `cap_drop: ALL`, sin volúmenes, sin `environment`, sin redes externas, sin
  `privileged`/`network_mode`/`pid`/`devices`/`docker.sock`. Cualquier cambio estructural de Compose exige `accept-compose` con aprobación humana.
- Rollback: se conservan las imágenes de los últimos 5 releases; `up` revierte solo si el release nuevo no sana.

## 2. Operaciones (lista cerrada)

Cliente: `powershell -NoProfile -File C:/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1 -Op <operación> [-OpArgs <arg>]`

| Operación | Argumento | Efecto |
|---|---|---|
| `status` | — | Estado: commit desplegado/anterior, salud, línea base de compose |
| `preflight` | — | Clon limpio, compose = línea base, recursos, daemon; guarda línea base de contenedores ajenos |
| `compose-diff` | — | Compara el Compose del clon con la línea base aceptada |
| `list-releases` | — | Releases construidos |
| `job-status` | id del trabajo (el que devuelve `build`) | Estado de un trabajo en segundo plano |
| `logs` | **número** de líneas (no un nombre de contenedor) | Últimas líneas del contenedor |
| `fetch` | **SHA completo de 40 hex** | `git fetch` del commit de `origin/main` (solo fast-forward) |
| `build` | **SHA de 40 hex** | Construye en segundo plano; etiqueta `bydlight-web:<sha12>` |
| `up` | **SHA de 40 hex** | `up -d --no-deps --no-build --wait` + salud + HTTP; revierte solo si falla |
| `verify` | — | Verificación (también avisa si cambió algo ajeno) |
| `rollback` | — | Reactiva el release anterior |
| `accept-compose` | SHA | Acepta una nueva línea base de compose. **Requiere aprobación humana previa en el servidor (`bd-approve`)**. Nunca automático |

Los argumentos solo pueden contener `[a-z0-9-]` (el cliente lo valida; el servidor valida de nuevo).

## 3. Procedimiento comprobado (2026-10-27, `af71054` y `56fdcf1`)

```
status → fetch <sha40> → preflight → compose-diff → build <sha40> → job-status <id> (hasta "done") → up <sha40> → verify → status
```

1. Hacer commit y `push` a `main` (con autorización) y obtener el **SHA completo** (`git rev-parse HEAD`).
2. `status` (estado previo y salud).
3. `fetch <sha40>`.
4. `preflight` y `compose-diff`: debe decir **política CUMPLE y línea base igual**. Si difiere, **detenerse** y pedir aprobación administrativa.
5. `build <sha40>` → devuelve un id; consultar `job-status <id>` (llamadas individuales, no bucles largos) hasta terminar.
6. `up <sha40>` (con orden expresa del usuario).
7. `verify` y `status`: salud OK, HTTP OK, contenedores ajenos sin cambios.
8. Comprobar el dominio público (HTML nuevo, assets, rutas, ausencia de Webpay/WordPress). El puerto 8200 local **no** prueba el sitio público.
9. Informar SHA, resultado e incidencias. **No** hacer `rollback` sin autorización.

**Despliegue 2026-10-28 (`67287c08d1f57c327aa22aa888a8a301df781b0d`, Fase 3):** Claude Code ejecutó `status`, `fetch` (clon 56fdcf1 → 67287c0, 42 archivos), `preflight` (OK, 18 ajenos), `compose-diff` (CUMPLE / línea base igual) y `build` (job `75578b96a9d33739`, imagen `bydlight-web:67287c08d1f5`). El cliente `bd-deploy.ps1` desapareció antes del `up`; el administrador ejecutó `up` y `verify` desde PowerShell normal. `status` posterior: desplegado `67287c0`, anterior `56fdcf1`, salud OK, línea base aceptada. Rollback no necesario (si hiciera falta: `rollback`, vuelve a `56fdcf1`).
Comprobación pública (Playwright, 1440 y 390 px): `/` con `.hn` y sin `.hx` en entrada directa, F5 y clic en el logo; WebGL activo tras ~4 s; `/servicios/soluciones-erp` y `/soluciones-saas` responden 200 sin imágenes rotas; sin errores de consola ni desborde horizontal; `/contratar` 307 y `/orden` 404 (Webpay apagado); el sitemap incluye ambos servicios. Sin revisar: `logs` del contenedor.

Resultados del despliegue anterior (administrador, `56fdcf1`): `fetch` ok; `preflight` OK; `compose-diff` CUMPLE/igual; `build` →
`bydlight-web:56fdcf1cb6e0`; `up` ok (salud y HTTP); `verify` OK; `status` salud OK; 5 releases; 18 ajenos en la línea base.

## 4. Restaurar el cliente local

`bd-deploy.ps1` desapareció tres veces de la carpeta de herramientas (causa no confirmada). Si falta:

```powershell
Copy-Item "C:\Users\dcarrasco\Desktop\Proyectos\bydlight2\deploy\executor\claude-code\bd-deploy.ps1" "C:\Users\dcarrasco\.claude\tools\bd-deploy\bd-deploy.ps1"
```

(o `! cp "/c/Users/dcarrasco/Desktop/Proyectos/bydlight2/deploy/executor/claude-code/bd-deploy.ps1" "/c/Users/dcarrasco/.claude/tools/bd-deploy/bd-deploy.ps1"` desde Claude Code).
Claude no puede escribir en esa carpeta (reglas `deny` de Edit/Write). Quien copia es el administrador. El 2026-10-27 el administrador confirmó que el
archivo (2412 bytes) permaneció disponible tras restaurarlo.

## 5. Configuración SSH dedicada (sin secretos)

- Archivo `%USERPROFILE%\.ssh\bd-deploy.config`, **separado** de `~/.ssh/config` y de `oe-deploy.config`; plantilla en
  `deploy/executor/claude-code/ssh-config.example` (`Host bd-deploy`, usuario `bddeploy`, clave exclusiva `id_ed25519_bddeploy`,
  `IdentitiesOnly`, sin agente ni reenvíos, sin TTY, `ProxyCommand` con `cloudflared access ssh`).
- El cliente invoca `ssh.exe -F <ese archivo> -o BatchMode=yes … bd-deploy "<operación> [arg]"`. **No guardar claves privadas ni su contenido en el repo,
  en documentos ni en la conversación.** Si caduca la sesión de Cloudflare Access, usar un service token propio de bydlight en variables de entorno del PC.
- Reglas de Claude Code: `.claude/settings.json` del repo (en `.gitignore`): lecturas en `allow`; `fetch/build/up/rollback/accept-compose` en `ask`;
  `ssh/scp/sftp/cloudflared` denegados. Hook `bd-deploy-guard.py` (en la carpeta de herramientas): bloquea cualquier comando que mencione ssh/.ssh/el
  ejecutor salvo la invocación exacta anterior. Plantillas y aplicador: `deploy/executor/claude-code/` (`apply_claude_config.py`, `gen_settings.py`).

## 6. Diagnóstico de errores de uso

| Síntoma | Causa conocida |
|---|---|
| `argumento invalido (lines)` en `logs` | Se pasó un nombre; `logs` recibe un número |
| `throw` del script (exit 1, con mensaje) | Argumento/formato inválido o falta `~\.ssh\bd-deploy.config` |
| exit 126 / «rechazado» | El gate rechazó la petición (gramática cerrada) |
| `build` aparentemente «terminado» | Verificar siempre con `job-status <id>`; no interpretar texto de error como fin |
| Comando bloqueado por el hook | Solo se admite la forma exacta de una sola línea; no usar `echo`, pipes ni comandos multilínea con el ejecutor |
| Sitio público sin cambios tras `up` | El puerto 8200 no es el dominio público; revisar el túnel (administrador) y la caché del navegador |

Auditoría en el servidor: `/var/log/bd-deploy/audit.log`; estado: `/var/lib/bd-deploy/state.json` (lo consulta el administrador).

## 7. Caché tras desplegar

El HTML se sirve con `max-age=0, must-revalidate` desde la versión `af71054`. Navegadores que cachearon el HTML del sitio estático anterior pueden
mostrar una página sin estilos hasta que expire su caché (recarga forzada). No se hizo purga de Cloudflare; no purgar globalmente sin autorización.

## 8. Cambios de infraestructura

Si cambian `Dockerfile`, `docker-compose.prod.yml` o la política: detenerse, regenerar `deploy/executor/tests/fixtures/prod.json` si corresponde,
ejecutar las pruebas del ejecutor (`cd deploy/executor && python -B -m unittest discover -s tests`) y pedir al administrador la aprobación
(`accept-compose`). Los scripts de `deploy/` y los Dockerfile deben mantener finales de línea LF (`.gitattributes`).

## 9. Problema pendiente: código de salida 21 dentro de Claude Code

**Hechos comprobados**
- Desde **PowerShell normal** del administrador, `bd-deploy.ps1 -Op status` devuelve código 0 y la salud correcta (conexión SSH funcional).
- Desde las herramientas Bash/PowerShell de Claude Code, el mismo comando devolvió **código 21 sin salida** en varias sesiones; antes del 2026-10-27 funcionaba
  desde Claude Code.
- El 21 **no** lo produce el script (sus validaciones usan `throw`, exit 1, con mensaje) ni el servidor (códigos 0, 1, 2, 78 y 126). Lo devuelve `ssh.exe`
  hijo, con `exit $LASTEXITCODE`. La herramienta de Claude Code no muestra stderr.
- Identidad (`AD\dcarrasco`), `HOME`/`USERPROFILE`, PowerShell 5.1 y `PATH` (incluye `C:\Windows\System32\OpenSSH`) coinciden con los de la consola normal.
  No hay sección `sandbox` en la configuración de Claude Code. La regla `deny Read(~/.ssh/**)` aplica a las herramientas de archivo de Claude, no a procesos hijo.
- En Windows, 21 equivale a `ERROR_NOT_READY` (coincidencia observada, **no probada** como causa).

**Causa raíz: no demostrada.** No afirmar que Kaspersky, SSH, el agente o el entorno sean culpables sin evidencia. No eludir controles de seguridad
(sandbox, hook, reglas `deny`) para «arreglarlo».

**Alternativa validada:** el administrador ejecuta el flujo de despliegue en PowerShell normal (así se desplegaron `af71054` y `56fdcf1`).

**Diagnóstico propuesto (no ejecutado; requiere al administrador):** correr el cliente con `Start-Process … -RedirectStandardError` para capturar stderr
en un proceso sin consola, y revisar eventos de Kaspersky sobre `ssh.exe`. Registrar el resultado aquí.
