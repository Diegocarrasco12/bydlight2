# Correos transaccionales (implementado; pendiente de configuración externa)

Estado (2026-11-06): **código implementado y probado con un transporte falso; NO configurado ni activo en producción.** Hasta que el titular cree las credenciales y encienda `enabled`, el sistema no encola ni envía ningún correo (los pagos funcionan igual).

## Qué envía el sistema
| Hecho | Destinatario | Plantilla |
|---|---|---|
| Solicitud creada | cliente + titular (aviso interno) | `solicitud_recibida`, `nueva_solicitud` |
| Cotización aprobada (o actualizada) | cliente | `cotizacion_aprobada` (total con IVA, anticipo, saldo, vigencia) |
| Anticipo autorizado | cliente | `contratacion_confirmada` (confirmación escrita: proveedor, servicio, montos, versión y fecha de los términos, retracto) |
| Pago autorizado (anticipo o saldo) | cliente | `pago_autorizado` (comprobante) |
| Pago rechazado | cliente | `pago_rechazado` (sin cargo, enlace para reintentar) |
| Saldo habilitado | cliente | `saldo_habilitado` (acción requerida) |
| Pago en ERROR / hallazgos de conciliación | titular | `alerta_interna`, `alerta_conciliacion` |
No se envía correo por pago cancelado por el cliente ni por resultado incierto (PENDIENTE) hasta que Transbank confirme. El comprobante es parte del correo de pago.

## Garantías de diseño
- **Solo tras el estado real:** los correos de pago salen cuando el intento pasó a AUTORIZADO/RECHAZADO con datos ya validados contra Transbank, por transición de estado (nunca por consulta ni retorno repetido). Órdenes históricas no generan correos retroactivos.
- **Idempotencia:** `dedupe_key` única en la cola (`mail_outbox`, migración 4). Un callback repetido no duplica.
- **Persistente y con reintentos:** espera 1, 5, 30, 120 y 720 min; máximo 6 intentos; luego `FALLIDO` (alerta en `monitor`). Un envío interrumpido vuelve a `PENDIENTE` a los 10 min.
- **El correo nunca afecta al pago:** se encola después de guardar el estado y sin propagar errores.
- **Privacidad:** al enviarse, el cuerpo se vacía de la cola; solo se conserva el registro (plantilla, estado, fechas).
- **Entrega "al menos una vez":** si el proceso cae justo tras aceptar el proveedor, podría reenviarse una vez.
- Sin tokens ni tarjeta completa en ningún correo; texto del cliente escapado; sin inyección de cabeceras.

## Método evaluado
| Opción | Evaluación |
|---|---|
| **API de Gmail + OAuth2 (implementada)** | Envía desde `bydlightsolutions@gmail.com` sin usar la contraseña de la cuenta; sin dependencias nuevas; solo `fetch`. Costo: $0. Límites de envío diarios de Gmail (verificar los vigentes); remitente `@gmail.com` (sin dominio propio). |
| SMTP de Gmail con contraseña de aplicación | Descartado: credencial de larga vida con acceso amplio; Google lo desaconseja para nuevos desarrollos. |
| Proveedor transaccional (por ejemplo Amazon SES, Postmark, Resend, Brevo) | Mejor entregabilidad y remitente con dominio propio (SPF/DKIM de `bydlightsolutions.com`), pero requiere cuenta, verificación de dominio y registros DNS (Cloudflare) y costo según volumen (consultar precios vigentes). **No se contrató ni se creó ninguna cuenta.** Recomendado si el volumen crece. |
El transporte está aislado (`src/lib/mail/transport.ts`): cambiar de proveedor es reemplazar un archivo.

## Configuración (la hace el titular; nada se ejecutó)
1. Google Cloud (cuenta del titular): crear proyecto, **habilitar Gmail API**, pantalla de consentimiento, y crear un **cliente OAuth** (tipo "Aplicación web" con URI de redirección de OAuth Playground, o "Escritorio"). Scope único: `https://www.googleapis.com/auth/gmail.send`.
2. Importante: si la app queda en modo **"Testing"**, el refresh token **caduca a los 7 días**; hay que pasarla a **"En producción"** (para uso propio basta sin verificación, con la advertencia de Google). Verificar la política vigente al configurar.
3. Obtener **una vez** el refresh token con la cuenta `bydlightsolutions@gmail.com` (OAuth 2.0 Playground con "Use your own OAuth credentials", o un flujo local).
4. En el servidor, con el patrón de contenedor efímero del runbook (`$RUN`):
   `$RUN node /s/mail-config-set.mjs /data/config/mail.json --init` (pide las 3 credenciales sin eco), luego `... enabled=true`. Archivo `0600`, nunca en el repositorio.
5. Probar sin tocar clientes: `$RUN node /s/admin-remote.mjs mail-test --config-file /data/config/payments.json` (envía un correo de prueba **solo** a `bydlightsolutions@gmail.com`).
6. Estado y recuperación: `... mail-status` y `... mail-dispatch`. Un despachador interno corre cada 60 s mientras el servidor está activo.
Apagar: `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false` (≤ 5 s). Variables de entorno equivalentes: `MAIL_ENABLED`, `MAIL_CLIENT_ID`, `MAIL_CLIENT_SECRET`, `MAIL_REFRESH_TOKEN`.

## Pendiente de verificar fuera del código
- El formulario de **contacto** usa EmailJS (plantilla `template_jnsxd4o`): su destinatario se define en el panel de EmailJS, no en el repositorio. Confirmar allí que apunta a `bydlightsolutions@gmail.com` y no a `contacto@bydlightsolutions.com`.
- Revisar la bandeja/Spam con un correo de prueba real antes de la apertura pública.
