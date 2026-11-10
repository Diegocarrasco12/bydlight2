# Release final Bydlight2: preparación para despliegue manual (2026-11-10)

**Estado: PREPARADO PARA DESPLIEGUE MANUAL. Producción NO contiene todavía estas correcciones.** Claude no despliega: lo ejecuta el administrador en Ubuntu con `bd-run`. Informe técnico de origen: `docs/auditorias/CIERRE_FINAL_BYDLIGHT2_2026-11-10.md`.

## 1. SHA publicado en `main`
Este documento viaja dentro del commit que se publica, así que no puede contener su propio SHA. **El SHA completo a desplegar es el HEAD de `main` en GitHub**; se informa en la respuesta de entrega y se comprueba con:
```
git ls-remote https://github.com/Diegocarrasco12/bydlight2.git refs/heads/main
```
Producción actual (y destino del rollback): `b28448196fb89f9814621a709475029ae086dd21`. El administrador debe usar **exactamente** el SHA que se le informe y comprobar que coincide con ese `ls-remote`.

## 2. Rama y commits
Rama de desarrollo `etapa-b/checkout-publico`; `main` se actualiza solo por fast-forward (`origin/main` = `b28448196fb` es ancestro). Entre `b28448196fb` y el release hay una serie de commits de documentación y herramientas de administración, el diagnóstico `mail-check` de Brevo (`b6d1e27`), el arreglo de permisos de `00-admin.sh` (`466c6b4`) y el commit de cierre de este release.

## 3. Archivos incluidos
**Código que cambia en la imagen (respecto de producción):**
- `next.config.ts` (usa `src/lib/securityHeaders.ts`), `src/lib/securityHeaders.ts` (nuevo), `src/components/checkout/ContractForm.tsx`, `src/components/contact/ContactForm.tsx` (`method="post"`).
- `src/lib/mail/transport.ts` y `src/app/api/admin/route.ts`: `mail-check` (solo lectura, no envía correos).

**No viajan en la imagen (solo en el clon del servidor):** `scripts/admin-remote.mjs` (acción `mail-check`), `docs/**`, `tests/**`, `eslint.config.mjs`.
**Herramientas nuevas/actualizadas:** `docs/deploy/08-backup-release-final.sh` (nuevo), `docs/deploy/00-admin.sh`, `docs/deploy/SHA256SUMS-etapa-b.txt`.
**Pruebas nuevas:** `tests/cierre-seguridad.test.mjs`, `tests/backup-release-final.test.mjs`, `tests/admin-wrapper.test.mjs`.
**Informes:** `docs/auditorias/CIERRE_FINAL_BYDLIGHT2_2026-11-10.md` y capturas, este documento.
**Excluidos a propósito:** `tests/hooks.mjs` (solo saltos de línea), `bydlightredes/`, `assets-fuente/`, `.playwright-mcp/`, evidencias locales, bases SQLite y respaldos (no hay ninguno en el repositorio).

## 4. Pruebas realizadas (local, Windows, sin credenciales ni red productiva)
| Control | Resultado |
|---|---|
| `npm test` | **195 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas** |
| `npx tsc --noEmit` | sin errores |
| `npm run lint` | 0 errores (los 2 avisos de una prueba ya se corrigieron; reejecución limpia) |
| `npm run verify:prod` / `verify:pilot` | 36/36 y 33/33 |
| Checkout con mocks | cubierto por `payments.test.mjs` y `webpay-fase2.test.mjs` (aprobado, rechazado, cancelado, duplicados, monto manipulado, timeout, persistencia); no se repiten pagos ni correos reales |
| Formularios, HSTS, CSP | `tests/cierre-seguridad.test.mjs` CS1–CS8 |
| Respaldo del release | `tests/backup-release-final.test.mjs` BK1–BK5 (base SQLite real v5, docker/bd-run/curl simulados) |

## 5. Build
`npm run build` correcto (Next.js 16.4.3, standalone). Sin cambios en `package.json` ni `package-lock.json`.

## 6. Migraciones
**No hay migraciones.** `src/lib/payments/migrations.mjs` no cambia respecto de `b28448196fb` (versiones 1–5; producción ya está en v5). No se ejecuta ninguna migración durante este despliegue; `01`, `06` y `07` no se usan.

## 7. Compatibilidad de Compose
`docker-compose.prod.yml`, `Dockerfile`, `.dockerignore`, `package.json` y `package-lock.json` son idénticos a `b28448196fb`. Por eso `compose-diff` debe indicar **sin cambios** y **no hace falta `accept-compose`**. Si `compose-diff` muestra cualquier cambio: DETENERSE. Volumen `bydlight_data` en `/data`, `payments.json`, `mail.json` y variables: sin cambios; el código nuevo solo agrega cabeceras HTTP, el método de dos formularios y una acción de diagnóstico.

Compatibilidad con la versión publicada: la API `/api/solicitudes` y las rutas de pago no cambian; el formulario sigue enviando JSON por `fetch` (el `method="post"` solo actúa si el JavaScript no carga). La CSP está en modo **Report-Only** (no bloquea nada, **no es una CSP aplicada**).

## 8. Script de respaldo
`docs/deploy/01-backup-etapa-a.sh` y `03-backup-etapa-b.sh` **ya no sirven**: exigen la Etapa A desplegada, esquema 3/4 y el checkout cerrado; fallarían (con seguridad). Se creó uno específico:
- **Ruta:** `docs/deploy/08-backup-release-final.sh` (en la carpeta del repositorio local).
- **Qué hace:** confirma SHA desplegado `b28448196fb…`, proyecto, contenedor, volumen e imagen; autoprueba `node:sqlite`; copia la base con `VACUUM INTO` desde una conexión de solo lectura (consistente con la app en uso); `integrity_check`; exige esquema v5; guarda la copia, `payments.json` y `mail.json` **fuera del volumen** (`/srv/bydlight-prod/backups`, modo 600, root); registra el estado de cobros y rechaza `adminRefunds=true`. No detiene ni modifica nada, no migra, no borra respaldos anteriores ni sobrescribe, y no imprime secretos. Cualquier anomalía termina con `RESPALDO RELEASE FINAL FALLO`.
- Los cobros pueden estar abiertos: es esperado; el script solo lee.

## 9. SHA256 del script de respaldo (LF)
`603cdca665c84938d0cd341abc9bd131ae53081dee302af62bef13c0b27028a4`  `08-backup-release-final.sh`
(`docs/deploy/SHA256SUMS-etapa-b.txt` lista también `00-admin.sh` = `c5c3202d0caad133d15fdbfc7c3367ae1c44c53c5d1749700e83941396c4c7bb`.)

## 10. Comandos exactos de despliegue (administrador, Ubuntu)
Variable: `SHA=<SHA_COMPLETO_INFORMADO>` (40 caracteres).

**Paso 0: estado inicial**
```
sudo bd-run status                 # anote 'desplegado' (debe ser b28448196fb89f9814621a709475029ae086dd21) y salud OK
sudo bd-run preflight
sudo bd-run compose-diff           # debe decir que NO hay cambios
```
**Paso 1: respaldo.** En Windows (carpeta `docs/deploy` del repositorio, ya en `main`):
```
tr -d '\r' < 08-backup-release-final.sh | sha256sum      # 603cdca6...27028a4
scp 08-backup-release-final.sh bydlight:~/
```
En Ubuntu:
```
cd ~ && sha256sum 08-backup-release-final.sh    # debe ser 603cdca665c84938d0cd341abc9bd131ae53081dee302af62bef13c0b27028a4; si no, NO lo ejecute
sudo bash ~/08-backup-release-final.sh $SHA
```
Éxito: imprime `== 0.` … `== 7.`, `integrity_check=ok schema_v=5 …` y termina con **`RESPALDO RELEASE FINAL OK`**. Anote la línea `Datos para comparar` (órdenes, pagos y monto autorizado). Si falla: detenerse y enviar la salida; no se modificó nada.

**Paso 2: descargar**
```
sudo bd-run fetch $SHA
git -C /srv/bydlight-prod/app rev-parse HEAD     # debe imprimir exactamente $SHA
```
**Paso 3: compilar**
```
sudo bd-run build $SHA                 # anote el id del trabajo si lo devuelve
sudo bd-run job-status <ID_DEL_TRABAJO>   # repetir hasta que termine OK
```
**Paso 4: comprobaciones**
```
sudo bd-run preflight
sudo bd-run compose-diff               # sin cambios; si hay cambios: DETENERSE
```
**Paso 5: desplegar** (solo si todo lo anterior es correcto)
```
sudo bd-run up $SHA
```
**Paso 6: verificar**
```
sudo bd-run status                     # salud OK, desplegado = $SHA, anterior = b28448196fb89f9814621a709475029ae086dd21
sudo bd-run verify
sudo bd-run compose-diff
```
**Comprobaciones específicas del release** (solo lectura; no crean órdenes, pagos ni correos):
```
# a) Checkout 200 y Webpay sigue público
curl -s -o /dev/null -w '/contratar: %{http_code} (esperado 200)\n' https://bydlightsolutions.com/contratar
RUN="sudo bash $HOME/00-admin.sh"
$RUN node /s/payments-config-set.mjs /data/config/payments.json --show     # enabled: true, access: public, adminRefunds: false, credencialesTransbank: true
# b) Formularios protegidos
curl -s https://bydlightsolutions.com/contratar | grep -o '<form[^>]*>' | head -1           # debe incluir method="post"
curl -s https://bydlightsolutions.com/contacto  | grep -o '<form[^>]*>' | head -1           # debe incluir method="post"
# c) Cabeceras (HSTS y CSP en modo informe)
curl -sI https://bydlightsolutions.com/ | grep -iE 'strict-transport-security: max-age=86400|content-security-policy-report-only|x-frame-options|x-content-type-options'
# d) Recursos estáticos (todos 200) y ausencia de 502
curl -s https://bydlightsolutions.com/ -o /tmp/home.html
for a in $(grep -oE '/_next/static/[^"\\ ]+\.(js|css|woff2)' /tmp/home.html | sort -u); do curl -s -o /dev/null -w "%{http_code} $a\n" "https://bydlightsolutions.com$a"; done | sort | uniq -c | sort -rn | head
for i in $(seq 1 20); do curl -s -o /dev/null -m 25 -w '%{http_code} %{time_starttransfer}s\n' "https://bydlightsolutions.com/?v=$i"; done | sort | uniq -c
# e) Persistencia SQLite (compare con 'Datos para comparar' del respaldo: órdenes, pagos y monto no pueden bajar)
sudo bash ~/04-verificar-migracion-5.sh                                       # MIGRACION 5 VERIFICADA OK (compara contra la instantánea de la Etapa B; ver nota)
# f) Brevo sigue habilitado (solo lectura; no envía correos)
$RUN node /s/admin-remote.mjs mail-status --config-file /data/config/payments.json
$RUN node /s/admin-remote.mjs mail-check  --config-file /data/config/payments.json        # clave e IP autorizadas; solo consulta a Brevo
```
Nota sobre (e): `04-verificar-migracion-5.sh` compara con `etapa-b-*.ref` (instantánea de la Etapa B); como el volumen solo crece, sigue siendo válido. La referencia exacta de este release es `/srv/bydlight-prod/backups/release-final-*.ref`.
Esperado: ningún 502, ningún `FALLIDO` en `mail-status`, todas las respuestas 200.

## 11. Rollback
Registrar antes de empezar el SHA actual: **`b28448196fb89f9814621a709475029ae086dd21`** (aparece como `anterior` en `status` tras el `up`).
```
sudo bd-run rollback          # vuelve a la imagen anterior; el volumen y la base NO se tocan
sudo bd-run verify
sudo bd-run status
```
Solo con operaciones documentadas de `bd-run` (`rollback` sin argumentos); nunca `down -v`. **No se restaura SQLite automáticamente**: si hubo órdenes o pagos después del respaldo, se conservan; restaurar la base solo es posible con decisión explícita y entonces se pierde todo lo posterior. El código anterior ignora las migraciones 4 y 5, y este release no agrega migraciones, así que la base sirve a ambos códigos.

**Detener el despliegue (no hacer `up`) si:** `compose-diff` muestra cambios; `preflight` rechaza algo; el respaldo no termina en `RESPALDO RELEASE FINAL OK`; el `fetch` no deja el clon en `$SHA`; el `build` falla; el estado inicial no es `b28448196fb…` con salud OK.
**Evaluar el rollback si**, tras `up`: `verify` falla o la salud no es OK; `/contratar` no responde 200; aparecen 502 persistentes distintos de los ya conocidos; `mail-status` muestra fallidos nuevos; las cabeceras o formularios no son los esperados; el conteo de órdenes o pagos baja respecto del respaldo. Antes de revertir, si hay pagos en curso, conciliar (`reconcile`) y avisar al titular.
Apagado de cobros inmediato (no es rollback): `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false`.

## 12. Acciones pendientes de Cloudflare (TI; Claude no las aplica)
1. **Always Use HTTPS:** panel de Cloudflare → `bydlightsolutions.com` → *SSL/TLS → Edge Certificates → Always Use HTTPS* = **On** (equivalente: Redirect Rule http → https, 301).
2. Verificar: `curl -sI http://bydlightsolutions.com/ | head -3` y `…/contratar` → `301` (o `308`) con `Location: https://…`; `curl -sI https://bydlightsolutions.com/ | head -1` → 200.
3. **Sin bucles:** el origen no redirige a HTTPS; la redirección vive solo en el borde, y el túnel entrega HTTP al origen. No cambiar el modo SSL ni agregar redirecciones en la aplicación.
4. **Webpay:** el retorno ya es `https://` (prueba 16 de `payments.test.mjs`) y Transbank llama a una URL HTTPS: Always Use HTTPS no lo afecta. Comprobación sin pagar: `curl -s -o /dev/null -w '%{http_code}\n' https://bydlightsolutions.com/orden` → 200.
5. **No** activar HSTS preload ni HSTS en Cloudflare. El HSTS del código (`max-age=86400`, sin `includeSubDomains` ni `preload`) lo envía el origen; los navegadores solo lo respetan por HTTPS y Cloudflare lo reenvía sin cambios, por lo que no introduce riesgo por el proxy. Subir la vigencia a 6–12 meses solo tras 1–2 semanas con HTTPS forzado y sin incidencias.
6. Rollback de Cloudflare: *Always Use HTTPS* = Off.

## 13. Diagnóstico de los errores 502 (TI, solo lectura)
Hecho verificado: la portada antigua venía de la **caché del navegador** de pruebas (`transferSize 0`, título antiguo); es un fenómeno distinto de los 502. Los 502 y timeouts (14:50–14:55 UTC y 16:11–16:13 UTC del 2026-11-10) fueron reales y **su causa no está demostrada**. Comprobar, con la hora de Chile (UTC−3: 11:50–11:56 y 13:11–13:13):
```
sudo bd-run status
docker inspect bydlight-prod-web-1 -f '{{.RestartCount}} {{.State.OOMKilled}} {{.State.StartedAt}} {{.State.Health.Status}}'
docker logs --since 6h bydlight-prod-web-1 2>&1 | tail -150
sudo journalctl -u cloudflared --since "2026-11-10 11:40" --until "2026-11-10 13:30" --no-pager | tail -100
docker stats --no-stream bydlight-prod-web-1
```
Cloudflare: *Analytics → Traffic* (códigos 5xx por hora) y *Zero Trust → Networks → Tunnels* (reconexiones del conector). Interpretación: `RestartCount` alto u `OOMKilled=true` → memoria (`mem_limit 512m`); reconexiones del túnel → red; ninguno → enviar la salida. Recursos estáticos y hashes de Next: el HTML se sirve con `max-age=0, must-revalidate` y los chunks llevan hash inmutable; los 404 de chunks observados correspondían a HTML de una versión muy anterior (anterior al 2026-10-27), no al release actual (14/14 recursos vigentes respondieron 200 en dos rondas).

## 14. Riesgos residuales
- **Intermitencia del origen (P1-b): abierta y no demostrada.** No se detiene el release por una hipótesis, pero no se afirma que esté resuelta; el despliegue reinicia el contenedor y puede coincidir con un corte breve.
- **CSP solo en modo informe:** no protege todavía; se aplicará en una etapa posterior tras revisar la consola, incluida la redirección real a Webpay (no probada con CSP).
- **HTTP sin redirigir** hasta que TI active Always Use HTTPS.
- **HSTS** con vigencia de 1 día: efecto limitado a propósito.
- **Respaldo y rollback:** el rollback conserva la base; restaurar un respaldo perdería lo posterior.
- **El `00-admin.sh` corregido** no se validó en un contenedor real (solo con Docker simulado).
- Producción en uso: durante el `up` (segundos) puede haber una interrupción breve; evitar hacerlo con un pago en curso.

## 15. Checklist final de producción
- [ ] Estado inicial: `status` OK, desplegado `b28448196fb…`; `compose-diff` sin cambios.
- [ ] Hash de `08-backup-release-final.sh` verificado en Ubuntu.
- [ ] `RESPALDO RELEASE FINAL OK` y archivos en `/srv/bydlight-prod/backups/` (db, payments.json, mail.json, `.ref`).
- [ ] `fetch` deja el clon en `$SHA`; `build` OK; `preflight` y `compose-diff` OK.
- [ ] `up $SHA`; `status`/`verify`/`compose-diff` OK; `anterior` = `b28448196fb…`.
- [ ] `/contratar` 200; `payments-config-set --show`: `enabled`, `access: public`, `adminRefunds: false`.
- [ ] Formularios con `method="post"`; HSTS y CSP Report-Only presentes.
- [ ] Recursos estáticos 200; 20 solicitudes sin 502.
- [ ] `04-verificar-migracion-5.sh` OK; conteos ≥ `release-final-*.ref`.
- [ ] `mail-status` sin fallidos; `mail-check` OK.
- [ ] Cloudflare: Always Use HTTPS activo y redirección 301/308 comprobada.
- [ ] TI envió la salida del diagnóstico 502.
- [ ] Informar resultados (SHA, estado, incidencias).
