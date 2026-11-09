# Privacidad: dónde están los datos, retención, eliminación y derechos (2026-11-09)

> Plazos **propuestos para aprobación del titular** (no hay purga automática). Nada de esto se ha ejecutado sobre datos productivos. Complementa `docs/PRIVACIDAD-MATRIZ-CONSERVACION.md` (parte de su contenido, p. ej. Gmail, está desactualizado: hoy el correo es Brevo/Zoho).

## 1. Dónde se almacenan datos personales
| Lugar | Datos | Tratamiento |
|---|---|---|
| SQLite `/data/bydlight.db`, tabla `orders` | nombre, correo, teléfono, empresa, mensaje, RUT/giro/dirección (empresas) | **Comercial**: anonimizable si no hay contratación ni pago |
| `quotes.note` | texto libre de la cotización | se borra al anonimizar la orden |
| `attempts`, `refunds`, `tax_documents`, `events` | pagos (últimos 4 dígitos, autorización), devoluciones, documentos, eventos sin datos personales | **Tributario/contable**: no se tocan nunca |
| `mail_outbox` | correo destinatario (el cuerpo se vacía al enviar) | se anonimiza con la orden (solo filas enviadas/fallidas) |
| Casilla Zoho (`contacto@`) | mensajes del formulario de contacto (llegan por EmailJS) | **Manual**: borrar los mensajes sin relación contractual vencido el plazo |
| Respaldos `/srv/bydlight-prod/backups` | copia de todo lo anterior | caducan; no se reescriben |
| Brevo, Cloudflare, Transbank, EmailJS, WhatsApp | según su función | por sus propias condiciones |

## 2. Qué se anonimiza y qué no
Se anonimiza (reemplazo, no borrado de filas) una orden **solo si** cumple todo: etapa `SOLICITADA` o `COTIZADA`; sin cotización vigente; sin ningún pago autorizado, pendiente o en curso; sin devoluciones; sin documentos tributarios; sin correos pendientes; y con más de **24 meses** de inactividad (el plazo no puede ser menor). Quedan intactos: la fila, fechas, plan, intentos, eventos y cotización (sin su nota). Cualquier orden con pago o antecedente tributario **se conserva** (obligación legal; plazo tributario general de 6 años).

## 3. Comandos (siempre simulan salvo `--execute`; use el patrón `$RUN` del procedimiento de activación)
```
$RUN node /s/admin-remote.mjs privacy-scan --config-file /data/config/payments.json                        # simulación: lista elegibles y cuántas se retienen
$RUN node /s/admin-remote.mjs privacy-scan --execute --limit 50 --config-file /data/config/payments.json     # ejecuta (máx. 200 por vez)
$RUN node /s/admin-remote.mjs privacy-erase <ORDEN> --config-file ...                                          # simula una supresión a solicitud
$RUN node /s/admin-remote.mjs privacy-erase <ORDEN> --execute --config-file ...
$RUN node /s/admin-remote.mjs privacy-rectify <ORDEN> --name "Nuevo Nombre" --phone "+56..." --config-file ...
$RUN node /s/admin-remote.mjs customer-data --email <correo> --config-file ...                                 # acceso: exportación JSON
```
Cada ejecución agrega una línea a `/data/privacy-audit.log` (modo 600; id de ejecución, fecha, modo, plazo, conteos e IDs de orden; **sin datos personales**) y un evento `PRIVACIDAD_ANONIMIZADA` en la orden. No existe cron: la ejecuta el titular, p. ej. cada 6 meses, **siempre simulando antes** y con el respaldo del procedimiento de activación a mano. No existe orden que borre filas.

## 4. Respaldos
`docs/deploy/05-caducidad-respaldos.sh` (simulación por defecto; `--ejecutar` para borrar): solo actúa en `/srv/bydlight-prod/backups` sobre nombres exactos de respaldo, plazo 90 días (mínimo 30), nunca borra los 2 `.db` más recientes. Probado con archivos ficticios en un directorio temporal; no se ejecutó en el servidor.

## 5. Atender una solicitud de un titular (responder por escrito; plazos según la ley vigente)
1. Verificar identidad (el correo desde el que escribe debe coincidir con el de la orden; si hay dudas, pedir el código de orden).
2. **Acceso/portabilidad:** `customer-data --email` y entregar la exportación por un canal seguro.
3. **Rectificación:** `privacy-rectify` (nombre, correo, teléfono, empresa). Datos de documentos tributarios ya emitidos no se editan: se corrigen con la nota de crédito que corresponda.
4. **Supresión/oposición:** `privacy-erase` (simula; luego `--execute`). Si responde «con pago o documentos», informar por escrito que esos datos se conservan solo por obligación legal. Borrar además sus mensajes en la casilla Zoho cuando no haya relación contractual.
5. Anotar la fecha de solicitud y de respuesta. Los respaldos reflejan la supresión al caducar (≤ 90 días).
