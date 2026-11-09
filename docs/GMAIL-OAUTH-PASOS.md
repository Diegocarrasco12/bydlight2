# Gmail OAuth para los correos transaccionales: pasos exactos (los hace el titular)

Objetivo: que el servidor envíe los correos de Bydlight (solicitud, cotización, contratación confirmada, comprobante de pago, alertas) desde `bydlightsolutions@gmail.com` **sin usar la contraseña de la cuenta**. Se necesitan tres valores: **clientId**, **clientSecret** y **refreshToken**. **No los pegue en el chat, en correos ni en el repositorio**: se escriben solo en la consola del servidor, con entrada oculta, y quedan en `/data/config/mail.json` (modo 0600).

Las pantallas de Google cambian de nombre con frecuencia; si algún menú no coincide, busque el equivalente. El código usa solo el permiso `https://www.googleapis.com/auth/gmail.send` (enviar; no puede leer correo).

## A. Proyecto y API (cuenta `bydlightsolutions@gmail.com`)
1. Entre a https://console.cloud.google.com con **`bydlightsolutions@gmail.com`** (así el remitente y la cuenta autorizada son la misma).
2. Cree un proyecto: nombre «Bydlight Correos».
3. **APIs y servicios → Biblioteca →** busque **Gmail API → Habilitar**.

## B. Pantalla de consentimiento (paso crítico: «En producción»)
1. **APIs y servicios → Pantalla de consentimiento de OAuth** (o «Google Auth Platform»). Tipo de usuario: **Externo** (cuenta @gmail.com).
2. Nombre de la app «Bydlight Correos»; correo de asistencia y de contacto: `bydlightsolutions@gmail.com`.
3. **Permisos (scopes):** agregue `https://www.googleapis.com/auth/gmail.send`.
4. **Publicar la app → «En producción».** Si queda en «Prueba/Testing», el refresh token **caduca a los 7 días** y los correos dejarán de salir sin aviso. Para uso propio no hace falta la verificación de Google; al autorizar verá la advertencia «Google no verificó esta app»: **Avanzado → Ir a Bydlight Correos (no seguro)** es esperable porque la app es suya.

## C. Credenciales
1. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
2. **URI de redireccionamiento autorizado:** `https://developers.google.com/oauthplayground`
3. Cree y copie el **ID de cliente** y el **secreto del cliente** (guárdelos en su gestor de contraseñas, no en el chat).

## D. Obtener el refresh token (OAuth 2.0 Playground)
1. Abra https://developers.google.com/oauthplayground
2. Engranaje (arriba a la derecha) → marque **«Use your own OAuth credentials»** → pegue su ID de cliente y secreto. Verifique que «Access type» sea **Offline**.
3. Paso 1: en el cuadro «Input your own scopes» escriba `https://www.googleapis.com/auth/gmail.send` → **Authorize APIs** → elija `bydlightsolutions@gmail.com` → permita.
4. Paso 2: **Exchange authorization code for tokens** → copie el **Refresh token** (empieza con `1//`). No necesita el access token.
5. Cuando termine, en el engranaje puede pulsar **Revoke** del *access token* del Playground si lo desea; el refresh token que copió sigue siendo válido hasta que lo revoque en su cuenta de Google.

## E. Instalar en el servidor (sin mostrar secretos)
Defina `TAG` y `RUN` como en el procedimiento de la Etapa B (`BYDLIGHT-ETAPA-B-ACTIVACION.md`, Paso 1) y ejecute:
```
docker run --rm -it --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/s:ro bydlight-web:$TAG node /s/mail-config-set.mjs /data/config/mail.json --init
```
Pega los tres valores cuando los pida (no se ven al escribir; el `-it` es necesario). Queda `enabled: false`. Compruebe sin ver secretos:
```
$RUN node /s/mail-config-set.mjs /data/config/mail.json --show
```
Debe decir `credencialesOAuth: true`. Después:
```
$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=true
$RUN node /s/admin-remote.mjs mail-test --config-file /data/config/payments.json
$RUN node /s/admin-remote.mjs mail-status --config-file /data/config/payments.json
```
**Éxito:** llega **un** correo de prueba a `bydlightsolutions@gmail.com` (revise Spam) y `mail-status` no muestra correos `FALLIDO`. Si no llega o hay errores: `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false`, y envíe a Claude la salida de `mail-status` (sin secretos). Errores típicos: `invalid_grant` (token caducado o revocado: app en «Prueba» o contraseña de la cuenta cambiada; repetir D y `--init`), `403` (falta habilitar Gmail API o el scope), `401` (clientId/clientSecret equivocados).

## F. Mantenimiento
- Cambiar la contraseña de la cuenta de Gmail **revoca** el refresh token de los permisos de Gmail: habrá que repetir los pasos D y E.
- Gmail limita los envíos diarios de una cuenta personal; para el volumen inicial basta. Si el negocio crece, evalúe un proveedor transaccional con dominio propio (`CORREOS-TRANSACCIONALES.md`).
- Apagar los correos en cualquier momento (≤ 5 s): `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false`. Los pagos siguen funcionando.
- Antes de abrir al público, confirme además en el panel de **EmailJS** que el formulario de contacto envía a `bydlightsolutions@gmail.com`.
