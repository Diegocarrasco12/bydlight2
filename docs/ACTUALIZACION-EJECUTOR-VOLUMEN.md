# Actualización mínima del ejecutor `bd-deploy` para admitir el volumen `/data` (2026-11-06)

Estado: **preparado, nada aplicado en el servidor.** Lo ejecuta el administrador (root). No despliega nada, no usa Docker Compose y no toca la aplicación.

## 1. Diagnóstico
`preflight` falla con `clave de nivel superior no permitida 'volumes'` porque el `bd_lib.py` instalado el 2026-10-26 rechaza todo volumen. La corrección **ya existe en Git** (commit `8d58bea`, incluido en `b7c34a5`) y es mínima:

| Archivo | Cambio |
|---|---|
| `bd_lib.py` (+49 −3 líneas) | La política admite una clave opcional `project.data_volume = {name, target}`; `target` solo puede ser `/data`. Sin esa clave, **se rechaza todo volumen como hasta hoy**. |
| `policy.json` instalada | Se añade `"data_volume": {"name": "bydlight_data", "target": "/data"}` dentro de `project`. |

No cambian: los wrappers `bd-gate`/`bd-run`/`bd-approve`, `bd_ops.py`, sudoers, sshd, clave de deploy, estado, auditoría, ni la gramática de comandos (la superficie de sudo queda idéntica; el script lo comprueba).

## 2. Qué admite y qué sigue rechazando el validador
Admite **solo**: un volumen de nivel superior llamado como declara la política, con nombre efectivo `<proyecto>_<volumen>` (`bydlight-prod_bydlight_data`), y **un único** montaje en `web` de tipo `volume`, origen `bydlight_data`, destino `/data`, sin opciones.
Rechaza (con prueba): bind mounts (largos y cortos), `tmpfs`/`npipe`, otro destino o subdirectorio de `/data`, `subpath`, `read_only`/`nocopy` en el montaje, segundo montaje, volumen externo, `driver`/`driver_opts` (bind encubierto), `labels`/`external`, nombre fuera del proyecto, volumen extra de nivel superior, `volumes_from`. Siguen vigentes usuario no-root, solo lectura, `cap_drop ALL`, `no-new-privileges`, puertos `127.0.0.1:8200`, redes, límites, imagen, `build`, etc. (49 mutaciones previas + las nuevas, con el volumen presente).

La aprobación **`bd-approve accept-compose <sha40>` sigue obligatoria**: el cambio de Compose altera la huella de configuración y `up` queda bloqueado hasta aceptarla. Esta actualización no la ejecuta ni la sustituye.

## 3. Pruebas ejecutadas (en el equipo de desarrollo, sin servidor ni Docker)
- `python -I -m unittest discover -s deploy/executor/tests` → **137 pruebas, OK** (133 previas + 4 nuevas: 12 variantes negativas adicionales, no-relajación de las demás restricciones, compatibilidad hacia atrás sin volúmenes, volumen declarado sin montaje).
- Autoprueba embebida en `update-volume.sh` (1 positiva, 1 sin volumen, 9 negativas, política sin `data_volume`) ejecutada aparte contra la política de ejemplo → OK. `bash -n update-volume.sh` → sintaxis correcta.
- **Huellas:** las de `bd_lib.py` y `bd_ops.py` confirmadas por el administrador coinciden con el commit `0d06acf` y con las constantes del script.
- **No ejecutado:** el flujo completo de `update-volume.sh` (respaldo, instalación, fotografías, rollback) no pudo simularse localmente (sin Docker ni root). Por eso el script arranca en modo **plan** (solo lectura) y está construido para abortar y restaurar ante cualquier diferencia. Revise el plan antes de `--apply`.

## 4. Qué necesito de usted antes de aplicar (sin credenciales ni secretos)
En el servidor, solo huellas (no contenido):
```
sudo sha256sum /usr/local/lib/bd-deploy/bd_lib.py /usr/local/lib/bd-deploy/bd_ops.py /etc/bd-deploy/policy.json
```
`bd_lib.py` debe ser `315858b8fe3207b0a4d3df9c9507c4f3fa891e1fcb3c9eb61df12f7e0365067a` y `bd_ops.py` `301f4d590108bdad2822571ec9537a546e985d6c75c215c6364b339445f999e5` (son las del commit de 2026-10-26). `policy.json`, confirmada por el administrador el 2026-11-06: `0a852437ca9c25d2a81090a43a9a4fd473d0fdec1d82ee900b2123ac6cb7b606` (específica del servidor; el script la exige antes de aplicar). **Si difieren, no continúe**: el script también se detiene. No tengo copia de lo instalado; si difiere, envíeme el `diff` contra el archivo del commit `0d06acf`.

## 5. Procedimiento administrativo (root)
1. **Entregar los archivos.** El script `update-volume.sh` y las pruebas nuevas están sin publicar. Con su autorización los subo a Git (commit + push); o cópielos a mano desde `deploy/executor/`. El `bd_lib.py` necesario ya está en el commit descargado.
2. **Preparar el origen** (carpeta con el `bd_lib.py` aprobado), por ejemplo desde el clon descargado en el servidor: `git -C /srv/bydlight-prod/app show b7c34a540603b1cf71b4322f63f886e841e6fdb9:deploy/executor/bd_lib.py > /root/bd-src/bd_lib.py` (y copie ahí `update-volume.sh`). El script verifica la huella (`a0590dad…cc8e`) antes de usarlo.
3. **Plan, solo lectura:** `sudo bash update-volume.sh --src /root/bd-src` → debe terminar con `OK` en todas las líneas y "plan: no se cambió nada".
4. **Ventana tranquila** (sin otros despliegues). Opcional: `sudo bd-run status`, anote el resultado.
5. **Aplicar:** `sudo bash update-volume.sh --src /root/bd-src --apply`. Crea `/root/bd-deploy-backup-AAAAMMDD-HHMMSS` (modo 700) con `bd_lib.py`, `policy.json`, huella de sudoers y una fotografía de **todos** los contenedores, volúmenes y redes. Instala el `bd_lib.py` por reemplazo atómico, añade `data_volume`, valida la política, comprueba que la superficie sudo es idéntica, ejecuta la autoprueba y compara contenedores/volúmenes/redes antes y después. Ante cualquier fallo restaura y lo verifica.
6. **Comprobar los 18 contenedores:** el propio script compara `docker ps -a` (ID, nombre, imagen, puertos) antes y después y exige igualdad. Compruébelo también a mano: `diff <(sort /root/bd-deploy-backup-*/before/containers.txt | cut -d'|' -f1-3) <(docker ps -a --no-trunc --format '{{.ID}}|{{.Names}}|{{.Image}}' | sort)`.
7. **Verificar:** `sudo bd-run status` (la versión `df19553c28e0` sigue `healthy`) y `sudo bd-run preflight` → ya no debe rechazar `volumes`. Siga con `compose-diff` y revíselo: solo deben aparecer el volumen y su montaje.
8. **Aprobación (manual, nunca automática):** `sudo bd-approve accept-compose <sha40>` solo después de revisar el `compose-diff`. Después, el despliegue sigue `docs/DESPLIEGUE-MANUAL-UBUNTU.md` (a través de `bd-run`, no Compose directo).

## 6. Rollback del propio protocolo
```
sudo bash update-volume.sh --rollback /root/bd-deploy-backup-AAAAMMDD-HHMMSS
sudo bd-run status
```
Restaura `bd_lib.py` y `policy.json` byte a byte (verifica huella y `cmp`) y compara contenedores con la fotografía previa. Equivale a dejar el protocolo exactamente como el 26-oct (rechaza otra vez todo volumen). Alternativa manual: copiar los dos archivos del respaldo a su ruta (`root:root 644`).

## 7. Límites
- No se modifica nada fuera de `/usr/local/lib/bd-deploy/bd_lib.py` y `/etc/bd-deploy/policy.json`; solo se leen estados de Docker (`ps`, `volume ls`, `network ls`).
- No se activa Webpay ni se despliega. La creación del volumen ocurre únicamente en el `up` posterior, ya aprobado por usted.
