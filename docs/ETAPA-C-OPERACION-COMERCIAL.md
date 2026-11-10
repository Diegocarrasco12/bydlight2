# Etapa C: Brevo productivo y apertura de cobros (guía operativa, 2026-11-10)

Resume en orden lo que falta **hacer en el servidor y en Brevo**. No repite gestiones ni la compra de $50 (ya realizadas); no reemplaza el detalle de `BYDLIGHT-ETAPA-B-ACTIVACION.md` (Pasos 6b, 6f y 7) ni de `BREVO-CLAVE-API-PASOS.md`, a los que remite. Los comandos usan `RUN="sudo bash $HOME/00-admin.sh"` y `RUNTTY="sudo bash $HOME/00-admin.sh --tty"` (ejecutor `docs/deploy/00-admin.sh`; ver §0b). **Ya no se monta el clon directamente en ningún comando**: con el clon privado de root (700) y el contenedor uid 1000 daba `Cannot find module`.

## 0b. Ejecutor de scripts administrativos (administrador, una vez; sin desplegar código)
`00-admin.sh` (versión 2026-11-10) copia los scripts permitidos a un directorio temporal legible, verifica su SHA-256, los monta de solo lectura en un contenedor uid 1000 sin capacidades y borra la copia al terminar; el clon conserva sus permisos. No requiere `fetch/build/up`: es un archivo de `docs/deploy/` que se copia aparte. SHA-256 (LF) esperado: `c5c3202d0caad133d15fdbfc7c3367ae1c44c53c5d1749700e83941396c4c7bb`.
```
# WINDOWS (carpeta docs/deploy del repositorio, rama etapa-b/checkout-publico actualizada)
tr -d '\r' < 00-admin.sh | sha256sum
scp 00-admin.sh bydlight:~/
# UBUNTU
cd ~ && sha256sum 00-admin.sh        # debe ser c5c3202d...c4c7bb; si no, NO lo ejecute
sudo bash ~/00-admin.sh --print node /s/payments-config-set.mjs /data/config/payments.json --show   # solo muestra el comando
sudo bash ~/00-admin.sh node /s/payments-config-set.mjs /data/config/payments.json --show           # prueba de lectura
```
Éxito: aparecen líneas `preparado scripts/... sha256=...` (stderr) y el resumen sin secretos con `adminRefunds: false` y `credencialesTransbank: true`. Si aparece `Cannot find module`, detenerse y enviar la salida completa. Rollback: volver a la versión anterior del archivo (no cambia nada persistente) o no usarlo.

**Qué se omite por decisión del titular:** Paso 6d (compra de prueba por Webpay) y 8.2–8.3 (otra compra de $50): la compra real ya consta; no se repiten. Publicidad Webpay y páginas legales se mantienen (`ONLINE_CHECKOUT_UI=true`, `LEGAL_PAGES_PUBLISHED=true`).

## 0. Cliente de despliegue (administrador; Claude no puede escribir en esa carpeta)
Causa de la ausencia: no demostrada (ya había desaparecido cuatro veces según `ESTADO_ACTUAL.md` §5). Copia legítima: `deploy/executor/claude-code/bd-deploy.ps1`, versionada desde el commit `0d06acf` y sin modificaciones locales; SHA-256 `cf9b67e18ee2b32c813e5998e5deac12c1adc1d88b2a4469f6187bcb59826109` (comparar antes de copiar). En PowerShell normal:
```
Get-FileHash C:\Users\dcarrasco\Desktop\Proyectos\bydlight2\deploy\executor\claude-code\bd-deploy.ps1 -Algorithm SHA256
Copy-Item C:\Users\dcarrasco\Desktop\Proyectos\bydlight2\deploy\executor\claude-code\bd-deploy.ps1 C:\Users\dcarrasco\.claude\tools\bd-deploy\bd-deploy.ps1
```
Después Claude puede ejecutar `-Op status` (solo lectura) y comprobar el SHA desplegado. Mientras no exista, las confirmaciones del servidor las da el administrador. No se usan SSH ni Docker directos.

## 1. Brevo (titular + administrador; ~15 min)
Orden exacto (detalle y errores típicos en `BREVO-CLAVE-API-PASOS.md`):
1. **Administrador, en el servidor:** `curl -s https://api.ipify.org` → IP pública de salida.
2. **Titular, en Brevo:** *Security → Authorised IPs → Add an IP* con esa IP (≈ 5 min en aplicarse); *SMTP & API → API Keys → Generate* con nombre `bydlight-prod-servidor`, copiarla **solo** a su gestor de contraseñas (no al chat). Confirmar en *Senders & Domains* que `notificaciones@bydlightsolutions.com`/el dominio figura autenticado.
3. **Titular, en la consola del servidor** (entrada oculta; `-it` obligatorio): `docker run --rm -it ... node /s/mail-config-set.mjs /data/config/mail.json --init` (comando completo en `BREVO-CLAVE-API-PASOS.md` §C). Comprobar con `--show`: `claveApiBrevo: true`.
4. **Requisito que suele olvidarse:** `mail-test`, `mail-check`, `mail-status` y el despachador **exigen `payments.json` con `enabled=true`** (la ruta administrativa responde 503 si no). Con `access=pilot` el checkout público sigue cerrado:
   `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=pilot`
5. `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=true`, luego `mail-test` (envía **un** correo solo a `contacto@bydlightsolutions.com`, nunca a clientes) y `mail-status`.
6. **Éxito (única forma de declarar Brevo operativo):** `"sent": 1`, el correo llega a `contacto@` (revisar Spam) desde `notificaciones@`, `mail-status` sin `FALLIDO` y «Delivered» en Brevo → *Transactional → Logs*. Si falla: `mail-config-set.mjs … enabled=false` y enviar a Claude la salida de `mail-status` (sin secretos).
7. Confirmar en el panel de EmailJS el destino del formulario de contacto (D8).
`mail-check` (diagnóstico sin envío) solo existe si se despliega el código nuevo; **no es necesario**: `mail-test` ya distingue clave/IP (mensaje «revisar clave API e IPs autorizadas»).

## 2. Controles previos a abrir cobros (administrador; solo lectura)
Con los cobros todavía en `access=pilot` (o `enabled=false`):
- Configuración: `$RUN node /s/payments-config-set.mjs /data/config/payments.json --show` → debe indicar `adminRefunds: false`, `access: pilot` (o `enabled: false`) y credenciales presentes (el comando no las imprime).
- Base de datos: `sudo bash ~/04-verificar-migracion-5.sh` → «MIGRACION 5 VERIFICADA OK» (integridad, claves foráneas, órdenes y pago de $50 presentes).
- Coherencia de pagos: `$RUN node /s/admin-remote.mjs audit --config-file /data/config/payments.json` (solo lectura).
- Cierre público: bloque del Paso 6f de `BYDLIGHT-ETAPA-B-ACTIVACION.md` («BLOQUE 6f OK»).
- Estado del servidor tras restaurar el cliente: `-Op status` (salud OK, `desplegado = b28448196fb` o el SHA acordado, `anterior` presente para rollback).
- Cubierto por pruebas automáticas (173/173 al 2026-11-10; `npm test`): idempotencia del retorno y de pagos repetidos, un solo `commit` por intento, anti duplicados, estados pendiente/rechazado/cancelado, devoluciones apagadas por defecto, controles de acceso del checkout y de la API administrativa, y correos sin duplicados. `verify:prod` (36/36) y `verify:pilot` (33/33) pasan sobre el artefacto local.

## 3. Apertura (solo con confirmación expresa del titular; reversible en ≤ 5 s)
```
$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=public
sleep 6
$RUN node /s/payments-config-set.mjs /data/config/payments.json --show
curl -s -o /dev/null -w '/contratar: %{http_code} (esperado 200)\n' https://bydlightsolutions.com/contratar
```
Condición: Brevo en «éxito» (punto 1.6) y controles del punto 2 aprobados. Vigilar 48 h con `monitor` y `mail-status`. Las cotizaciones siguen aprobándose a mano (`approve`): nadie paga sin cotización aprobada.

## 4. Cerrar o revertir
| Necesidad | Acción |
|---|---|
| Cerrar cobros YA (≤ 5 s) | `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false` |
| Volver a solo piloto | `… access=pilot` |
| Apagar correos (no afecta pagos) | `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false` |
| Código | `sudo bd-run rollback` (el código anterior ignora las migraciones 4 y 5); nunca `down -v` ni borrar el volumen |

Nota: con `enabled=false` en `payments.json` tampoco funciona la API administrativa ni el despacho de correos (ver punto 1.4).
