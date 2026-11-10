# Correos transaccionales (Brevo; implementado y probado, pendiente de instalar la clave en producción)

Estado (2026-11-09): **proveedor Brevo implementado y probado con `fetch` falso (nunca se contactó a Brevo); la clave API NO está instalada ni los correos activos en producción.** Mientras el titular no instale la clave y encienda `enabled`, el sistema no encola ni envía ningún correo (los pagos funcionan igual). Gmail OAuth quedó descartado y su código eliminado.

Configuración del titular ya hecha en Brevo/DNS: dominio `bydlightsolutions.com` autenticado (DKIM/DMARC), recepción en Zoho Mail, envío transaccional por Brevo, plan gratuito. Remitente `notificaciones@bydlightsolutions.com`; Reply-To `contacto@bydlightsolutions.com`.

## Qué envía el sistema
| Hecho | Destinatario | Plantilla |
|---|---|---|
| Solicitud creada | cliente + aviso interno a `contacto@` | `solicitud_recibida`, `nueva_solicitud` |
| Cotización aprobada (o actualizada) | cliente | `cotizacion_aprobada` (total con IVA, anticipo, saldo, vigencia) |
| Anticipo autorizado | cliente | `contratacion_confirmada` (confirmación escrita: proveedor, servicio, montos, versión y fecha de los términos, retracto) |
| Pago autorizado (anticipo o saldo) | cliente | `pago_autorizado` (comprobante) |
| Pago rechazado | cliente | `pago_rechazado` (sin cargo, enlace para reintentar) |
| Pago pendiente (resultado incierto) | cliente | `pago_pendiente` («estamos verificando»; NO es confirmación ni rechazo; un solo aviso) |
| Saldo habilitado | cliente | `saldo_habilitado` (acción requerida) |
| Pago en ERROR / hallazgos de conciliación | `contacto@` | `alerta_interna`, `alerta_conciliacion` |
Las plantillas existentes no cambiaron; se agregó `pago_pendiente`. No se envía correo por pago cancelado por el cliente. Con resultado incierto solo sale el aviso «estamos verificando»; el comprobante únicamente tras la autorización real de Transbank.

## Integración con Brevo (`src/lib/mail/transport.ts`)
- `POST https://api.brevo.com/v3/smtp/email`, cabecera `api-key`, JSON con `sender` (notificaciones@, «Bydlight Solutions»), `to`, `replyTo` (contacto@), `subject`, `htmlContent`, `textContent`, `tags`. Sin cabeceras libres: nada del cliente llega a una cabecera. Éxito = 2xx (`201 {messageId}`); timeout de 20 s.
- **Clave:** campo `apiKey` de `/data/config/mail.json` (0600) o variable `MAIL_BREVO_API_KEY`. Nunca en Git, imagen ni navegador; no se escribe en la cola, en los registros ni en los errores (prueba B13). Opcionales en el mismo archivo: `from`, `fromName`, `replyTo`, `notifyTo`.
- Una `mail.json` antigua de Gmail (sin `apiKey`) se trata como «sin configurar»: no se envía nada.

## Clasificación de errores y reintentos
| Respuesta | Tratamiento |
|---|---|
| 2xx | `ENVIADO`; el cuerpo se vacía de la cola |
| 400 y otros 4xx (mensaje/destinatario inválido); destinatario con formato inválido (sin llamar a Brevo) | **Permanente**: `FALLIDO`, sin reintento. Solo se guarda `brevo <estado> <código>`, nunca el cuerpo de la respuesta |
| 429, 402, 400 `not_enough_credits` (cuota o límite de velocidad) | **Se aplaza** (`Retry-After`, 1 h por defecto, máx. 12 h) **sin gastar intentos** y la tanda se detiene (el resto fallaría igual); se reanuda sola |
| 401 / 403 (clave inválida o revocada, **IP del servidor no autorizada en Brevo**) | Se aplaza 30 min sin gastar intentos, con mensaje «revisar clave API e IPs autorizadas»; el correo no se pierde. Si lleva más de 72 h aplazado queda `FALLIDO` y visible |
| 5xx, 408, red caída o timeout | Reintento con espera 1, 5, 30, 120 y 720 min; máximo 6 intentos; luego `FALLIDO` |

## Garantías de diseño (sin cambios)
- **Solo tras el estado real:** los correos de pago salen por transición de estado ya validada contra Transbank; órdenes históricas no generan correos retroactivos.
- **Idempotencia:** `dedupe_key` única (`mail_outbox`, migración 4); un callback repetido no duplica (prueba B12). No se usa idempotencia del lado de Brevo (no está documentada como garantía).
- **Entrega «al menos una vez»:** si el proceso cae justo después de que Brevo aceptó el mensaje y antes de marcarlo, podría reenviarse una vez (prueba B14). Es preferible a perder el aviso.
- **El correo nunca afecta al pago:** se encola después de guardar el estado, sin propagar errores.
- **Privacidad:** el cuerpo se vacía al enviarse; sin tokens ni tarjeta completa; texto del cliente escapado.

## Plan gratuito de Brevo (300 correos/día)
Una orden completa genera ≈ 7 correos (solicitud 2, cotización 1, anticipo 2, saldo habilitado 1, saldo pagado 1), es decir ~40 órdenes completas por día. Al agotarse la cuota el sistema aplaza y reanuda (prueba B8); no se pierden ni duplican correos. Verificar límites vigentes en la cuenta. Detalle y problemas típicos: `BREVO-CLAVE-API-PASOS.md`.

## Instalación y operación
Procedimiento completo (clave dedicada, autorizar la IP del servidor, `--init` con entrada oculta, prueba y apagado): **`docs/BREVO-CLAVE-API-PASOS.md`**; ubicación en la activación: Paso 6b de `BYDLIGHT-ETAPA-B-ACTIVACION.md`.
- Diagnóstico de solo lectura (clave, IP, remitente; no envía nada): `$RUN node /s/admin-remote.mjs mail-check --config-file /data/config/payments.json` (pruebas B15–B17; requiere el código que lo incluye desplegado).
- Estado y recuperación: `$RUN node /s/admin-remote.mjs mail-status|mail-dispatch --config-file /data/config/payments.json`. Un despachador interno corre cada 60 s.
- Apagar (≤ 5 s): `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false`.
- Variables equivalentes: `MAIL_ENABLED`, `MAIL_BREVO_API_KEY`.

## Pendiente fuera del código
- **Unificado (2026-11-09):** el correo público (`SITE.email`: páginas legales, contacto, plantillas, datos estructurados), el Reply-To y el aviso interno son `contacto@bydlightsolutions.com` (recibe Zoho Mail). Ya no queda ninguna referencia a `@gmail.com` en `src/`.
- El formulario de **contacto** usa EmailJS (plantilla `template_jnsxd4o`): su destino se define en el panel de EmailJS (decisión D8).
- Revisar bandeja y Spam con el correo de prueba real antes de la apertura pública.
