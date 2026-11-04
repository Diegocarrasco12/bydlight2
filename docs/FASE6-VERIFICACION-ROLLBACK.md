# Fase 6.1 — Verificación del respaldo y del rollback

## Veredicto
| Aspecto | Estado |
|---|---|
| **Lógica del rollback** (código del ejecutor + 129 pruebas locales) | **VERIFICADA en simulación** |
| **Estado real en el servidor** (SHA publicado, release anterior, salud) | **NO VERIFICADO** |
| Consulta de solo lectura (`status`, `list-releases`) | **No se pudo ejecutar** |
| Despliegue | **BLOQUEADO hasta resolver lo anterior** (instrucción de la Fase 6.1) |

## 1. Por qué no hay SHA ni lista de releases
Se autorizó `status` y `list-releases`. El intento de `status` falló porque **el cliente `C:\Users\dcarrasco\.claude\tools\bd-deploy\bd-deploy.ps1` no existe**: en esa carpeta solo queda `bd-deploy-guard.py`. Es el problema ya documentado (Claude no puede escribir allí). La copia vigente está en `deploy/executor/claude-code/bd-deploy.ps1` (revisada, 43 líneas: valida `-Op` contra una lista cerrada, argumentos `[a-z0-9-]` y llama a `ssh.exe -F ~/.ssh/bd-deploy.config … bd-deploy "<petición>"` sin shell, agente ni reenvíos). Tampoco puedo leer `~/.ssh` (denegado), así que no sé si `bd-deploy.config` existe. **No usé SSH directo ni ninguna alternativa**; el guard lo prohíbe y el proyecto también.

**Necesito del administrador:** restaurar el cliente desde `deploy/executor/claude-code/bd-deploy.ps1` hacia `C:\Users\dcarrasco\.claude\tools\bd-deploy\bd-deploy.ps1` (o ejecutar él mismo `-Op status` y `-Op list-releases` desde PowerShell normal y pegarme la salida).

Lo único «publicado» que consta es documental: `5fef157` desplegado el 2026-10-28 por el titular, con rollback esperado `5f00015` ([ESTADO_ACTUAL.md](ESTADO_ACTUAL.md)). **No se verificó contra el servidor.**

## 2. Cómo se identifica cada versión (del código de `deploy/executor/bd_ops.py`)
- Cada release es una imagen Docker `bydlight-web:<12 primeros hex del SHA>` (tag derivado del commit completo de 40 hex).
- Estado del ejecutor (en el servidor, `state_dir` `/var/lib/bd-deploy`): `deployed {sha,tag,ts}`, `previous {sha,tag,ts}`, `built [..]`, línea base de Compose y línea base de contenedores ajenos.
- `status` muestra `desplegado`, `anterior`, nº de releases y salud; `list-releases` muestra `tag sha` marcando `<- desplegado` y `(anterior)`.
- «Último release sano» = `deployed` (solo se promociona tras pasar salud Docker **y** HTTP 200 en `/`, `/servicios`, `/proyectos`, `/nosotros`, `/contacto`). `previous` fue el `deployed` anterior, también promovido solo tras pasar esas pruebas.

## 3. Cómo funciona el rollback y qué aísla (comprobado leyendo el código y con pruebas)
| Requisito de la fase | Resultado | Evidencia |
|---|---|---|
| 1. Identifica una versión anterior conocida y sana | Sí, **si existe `previous` y su imagen sigue en el servidor**; si no, falla con «no hay un release anterior disponible» | `op_rollback`; pruebas `test_rollback_sin_anterior`, `test_segundo_despliegue_guarda_el_anterior` |
| 2. Restaura exclusivamente Bydlight | Sí: `docker compose -p bydlight-prod up -d --no-deps --no-build --pull never --wait web` (un solo servicio, sin construir ni descargar) | `_activate`; `test_up_usa_no_build_y_no_pull` |
| 3. No modifica otros contenedores | Sí: el ejecutor no acepta nombres de contenedor ni comandos libres; `preflight` guarda línea base de ajenos y `verify` solo **avisa** si cambian | `test_ok_y_registra_servicios_ajenos`, `test_verify_avisa_si_un_servicio_ajeno_cambia_pero_no_lo_toca` |
| 4. No reinicia Docker globalmente | Sí: ninguna operación del ejecutor toca el daemon; `preflight` solo lee (`docker version`, `docker ps`). Nota: `build` usa `docker compose build --pull` y puede descargar la imagen base de Node al caché compartido (no afecta a otros contenedores en ejecución) | `op_preflight`, `run_build_job` |
| 5. No elimina datos persistentes | Sí: **Bydlight no tiene volúmenes ni datos** (`docker-compose.prod.yml` sin `volumes`; política: sin volúmenes y sin variables de entorno). La limpieza de imágenes solo borra `bydlight-web:<12hex>` antiguas y **nunca** la desplegada ni la anterior | `test_limpieza_solo_de_imagenes_del_proyecto_y_nunca_las_activas` |
| 6. No altera Cloudflare, DNS ni certificados | Sí: el ejecutor no tiene operaciones de red externa; el puerto sigue en `127.0.0.1:8200` | política y Compose |
| 7. Permite comprobar la salud tras restaurar | Sí: `_activate` espera `--wait` (120 s) y comprueba salud + HTTP; el rollback falla («el release anterior no sano») si no sana; después `verify` y `status` | `op_rollback`, `op_verify` |
| Reversión **automática** al desplegar | `up` vuelve al release anterior si el nuevo no sana (salud o HTTP) y deja el estado sin avanzar | `test_rollback_automatico_si_el_nuevo_no_sana`, `test_http_fallido_tambien_revierte` |
| Primer despliegue fallido | Informa «sin release anterior» y no promociona | `test_primer_despliegue_fallido_informa` |
| `rollback` exige línea base de Compose igual | Sí (`require_baseline`); si el Compose cambió, se bloquea | `op_rollback` |

Pruebas ejecutadas el 2026-11-04 en local (sin red, Docker ni servidor: se usa un *runner* simulado): `python -m unittest discover -s deploy/executor/tests` → **129 pruebas, OK**.

## 4. Lo que NO se pudo demostrar
- Que el servidor tenga `previous` distinto de `deployed` y con imagen disponible (pendiente conocido [PENDIENTES.md](PENDIENTES.md) (e)).
- Que el ejecutor instalado sea la misma versión que `deploy/executor` del repositorio.
- La salud actual del servicio y que la línea base de Compose siga «aceptada».
- Que `bd-deploy.config` y la clave dedicada estén presentes en este equipo.
- Un rollback real (**no se ejecuta en producción**, por instrucción).

## 5. Recursos persistentes y alcance de una operación sobre Bydlight
| Recurso | Dónde | Quién lo toca |
|---|---|---|
| Imágenes `bydlight-web:<12hex>` (máx. 5, `keep_releases`) | Docker del servidor | `build`, `up`, `rollback`, limpieza del propio ejecutor |
| Contenedor `web` del proyecto `bydlight-prod` (127.0.0.1:8200) | Docker | `up`, `rollback` (únicos afectados) |
| Clon del repositorio | `/srv/bydlight-prod/app` | `fetch`, `build` |
| Estado y trabajos del ejecutor | `/var/lib/bd-deploy`, `/var/log/bd-deploy` | Ejecutor |
| Clave de despliegue (solo lectura de GitHub) | `/etc/bd-deploy/keys/` | Administrador |
| Datos de aplicación | **Ninguno** (sin volumen; Webpay apagado, sin base ni `payments.json`) | — |
| Cloudflare Tunnel / DNS / certificados | Fuera del alcance del ejecutor | Titular |
Servicios afectados por un despliegue o rollback: **solo el contenedor `web` de Bydlight**. Los ≈ 18 contenedores ajenos no se tocan; durante `build` comparten CPU/RAM/disco (el ejecutor exige 1536 MB libres y 10 GB de disco antes de compilar).

## 6. Respaldo previo al despliegue
| Elemento | Naturaleza | ¿Existe? | Qué hacer |
|---|---|---|---|
| Código | **Reproducible** (Git + GitHub `Diegocarrasco12/bydlight2`; cada release es un SHA) | Sí (GitHub); la imagen anterior queda en el servidor | Confirmar con `list-releases` que `anterior` existe |
| Imagen del release actual | Reproducible desde el SHA; además queda como `previous` | A verificar | Es el respaldo funcional: mientras exista, el rollback es inmediato |
| Configuración propia (`docker-compose.prod.yml`, `Dockerfile`) | En Git, **sin cambios** respecto de `5fef157` | Sí | Nada |
| Línea base de Compose y política del ejecutor | Estado/configuración del servidor (`/var/lib/bd-deploy`, `/etc/bd-deploy`) | Existe en el servidor, no leída | **Requiere al administrador**: copia de solo lectura de `state.json` (sin claves) antes de publicar. No la hice: exige acceso al servidor |
| Variables de entorno | **Ninguna** (política: sin `environment`; Webpay apagado) | N/A | Nada |
| Secretos | Claves SSH y de despliegue fuera del repositorio | N/A | No se copian a documentos |
| Datos persistentes | **No existen** | N/A | Nada que respaldar hoy. **Cambiará** al activar Webpay (volumen `/data`, SQLite, `payments.json`): ver [checklist de activación](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md) |
No existe un mecanismo de backup del servidor que yo haya podido consultar (no hay acceso de lectura). Para crear respaldos nuevos o tocar archivos del servidor **necesito su autorización expresa**.

## 7. Advertencia futura sobre el rollback con Webpay encendido
Mientras Webpay esté apagado, volver a `5fef157` es inocuo (no hay datos). Una vez activado y con órdenes en SQLite, **un rollback a una imagen anterior sin el código de pagos dejaría pagos sin atender**; entonces el apagado inmediato (`enabled:false`) y la conciliación manual con Transbank deben preceder a cualquier rollback de imagen.

## 8. Qué desbloquea el despliegue
1. Restaurar el cliente (o que el administrador entregue `status` y `list-releases`).
2. Confirmar `desplegado = 5fef157…` (o el real) y `anterior` presente y distinto, `salud: OK`, línea base «aceptada».
3. Si `anterior` no existe o es igual al desplegado: **no publicar** hasta tener un rollback viable (p. ej., que el administrador valide la imagen previa) o aceptar por escrito el riesgo.
