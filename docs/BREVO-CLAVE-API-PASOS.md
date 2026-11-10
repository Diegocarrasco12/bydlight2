# Brevo: clave API de los correos transaccionales, pasos exactos (los hace el titular)

Reemplaza a la guía de Gmail OAuth (descartada). El servidor envía los correos de Bydlight (solicitud, cotización, contratación confirmada, comprobante, alertas) por la API transaccional de Brevo, desde `notificaciones@bydlightsolutions.com` (dominio ya autenticado con DKIM/DMARC), con **Reply-To `contacto@bydlightsolutions.com`** (que recibe Zoho). El único secreto es la **clave API de Brevo**.

**La clave no se pega en el chat, en correos, en el repositorio ni en el historial de la consola.** Se escribe solo en la consola del servidor, con entrada oculta, y queda en `/data/config/mail.json` (modo 0600, volumen `bydlight-prod_bydlight_data`). Nunca llega al navegador ni a la imagen.

**Cuándo se hace:** la clave se instala **después de desplegar la Etapa B** (Paso 6b del procedimiento), porque el script y el código que la usan vienen en esa versión. Las partes A y B de abajo se pueden hacer antes, en el panel de Brevo.

## A. Crear una clave API dedicada (panel de Brevo)
1. Brevo → su nombre (arriba a la derecha) → **SMTP & API → pestaña «API Keys» → Generate a new API key**.
2. Nombre: `bydlight-prod-servidor`. Cópiela **una sola vez** a su gestor de contraseñas (empieza con `xkeysib-`). Brevo no la vuelve a mostrar.
3. No reutilice la clave en otros sistemas: si se filtra, se revoca sin afectar a nada más.

## B. Autorizar la IP del servidor (paso que más falla)
Si en **Seguridad → Authorised IPs** está activo el control de IPs (Brevo puede activarlo solo), cualquier petición desde una IP no autorizada recibe **401 aunque la clave sea correcta**.
1. En el servidor Ubuntu: `curl -s https://api.ipify.org ; echo` (IP pública de salida; los contenedores salen por la misma IP).
2. Brevo → **Security → Authorised IPs → Add an IP** → esa IP. Tarda unos 5 minutos en aplicarse.
3. Si su proveedor cambia la IP del servidor, los envíos darán 401 hasta actualizarla (ver «Problemas»).

## C. Instalar la clave en el servidor (sin mostrarla)
Con `RUN="sudo bash $HOME/00-admin.sh"` (ejecutor `docs/deploy/00-admin.sh` copiado a `~` con su SHA-256 verificado) y **el código de la Etapa B ya desplegado**. **No monte `/srv/bydlight-prod/app/scripts` con `docker run -v`**: el clon es privado de root (700) y el contenedor corre como uid 1000, así que node falla con `Cannot find module '/s/mail-config-set.mjs'`. El ejecutor prepara una copia legible de solo lectura de los scripts, verifica su SHA-256 y la borra al terminar:
```
sudo bash $HOME/00-admin.sh --tty node /s/mail-config-set.mjs /data/config/mail.json --init
```
Pegue la clave cuando la pida (no se ve al escribir; el `-it` es necesario) y Enter. Queda `enabled: false`. Si existía una configuración antigua de Gmail en `mail.json`, se descarta. Compruebe sin ver secretos:
```
$RUN node /s/mail-config-set.mjs /data/config/mail.json --show
```
Debe mostrar `claveApiBrevo: true`, `from: notificaciones@bydlightsolutions.com`, `replyTo` y `notifyTo: contacto@bydlightsolutions.com`.

## D. Diagnosticar, encender y probar
Antes de encender, el diagnóstico de **solo lectura** `mail-check` (disponible desde el commit que lo introduce; no envía ningún correo ni gasta cuota) confirma la clave, la IP autorizada y el remitente. Funciona con `enabled=false`:
```
$RUN node /s/admin-remote.mjs mail-check --config-file /data/config/payments.json
```
Debe responder `keyAccepted: true`, `senderActive: true` y `problems: []`. Si `problems` nombra la IP o la clave, corrija la parte B o C y repita. Si el remitente figura como inexistente pero el dominio está autenticado con DKIM/DMARC, continúe con `mail-test`, que es la prueba definitiva.
```
$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=true
$RUN node /s/admin-remote.mjs mail-test --config-file /data/config/payments.json
$RUN node /s/admin-remote.mjs mail-status --config-file /data/config/payments.json
```
**Éxito:** `mail-test` responde `"sent": 1` y llega **un** correo a `contacto@bydlightsolutions.com` (revise Spam; debe verse remitente `notificaciones@bydlightsolutions.com`) y `mail-status` no muestra `FALLIDO`. En Brevo → **Transactional → Logs** aparece el envío como «Delivered».

Si no llega o falla: `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false` y envíe a Claude la salida de `mail-status` (sin secretos).

## Problemas típicos (el campo `lastError` de `mail-status` los nombra; nunca incluye la clave)
| Mensaje | Causa | Qué hacer |
|---|---|---|
| `brevo 401 … revisar clave API e IPs autorizadas` / `403` | Clave equivocada o revocada, o IP del servidor no autorizada (parte B) | Corregir y esperar: el correo **no se pierde**; se reintenta cada 30 min sin gastar intentos (hasta 72 h) |
| `brevo 429 … cuota o limite` / `not_enough_credits` | Se agotó el plan gratuito (300 correos/día) o hay límite de velocidad | Se aplaza (respeta `Retry-After`, mínimo 1 h por defecto), la tanda se detiene y se reanuda sola; nada se pierde ni se duplica |
| `brevo 400 invalid_parameter` | Dirección o contenido inválido | Queda `FALLIDO` sin reintentar; revise el correo del cliente |
| `brevo 5xx` / «sin respuesta» | Falla transitoria de Brevo o de red | Reintentos 1, 5, 30, 120 y 720 min; máximo 6 |

## E. Límites del plan gratuito (Brevo)
- **300 correos por día** (API y SMTP), según la documentación de Brevo consultada el 2026-11-09. Verifique en su cuenta los límites vigentes (Brevo los cambia) y si el plan gratuito agrega algún pie o marca de Brevo a los correos transaccionales: se revisa en el correo de prueba.
- **Consumo estimado por orden:** solicitud (cliente + aviso interno) = 2; cotización = 1; anticipo = 2 (contratación + comprobante); saldo habilitado = 1; saldo pagado = 1. Una orden completa ≈ 7 correos → **unas 40 órdenes completas por día** caben en el plan. Las alertas internas se limitan a una por día y por conjunto de hallazgos.
- Si se supera, el sistema no falla: aplaza y envía al día siguiente. Para más volumen, subir de plan en Brevo (no requiere cambios de código).

## F. Mantenimiento
- **Rotar la clave:** crear una nueva en Brevo, repetir C (`--init` reemplaza la clave), probar con D y luego revocar la antigua en Brevo.
- **Apagar los correos** (≤ 5 s, no afecta a los pagos): `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false`.
- Antes de abrir al público, confirme además en el panel de **EmailJS** el destino del formulario de contacto (decisión D8).
