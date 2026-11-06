# Privacidad: datos tratados y matriz de conservación propuesta

Fecha: 2026-11-06. Auditoría del código y de la base (SQLite en el volumen `/data`). **No se eliminó ni purgó nada; no existe ninguna purga automática.** Los plazos son **propuestas para aprobar**, no obligaciones legales inventadas; solo el plazo tributario de 6 años cuenta con fuente (SII, jurisprudencia 2006 `ja1118`, para facturas, boletas y libros).

## 1. Datos que el sistema trata realmente
| Dato | Dónde | Finalidad | Base jurídica (propuesta) | Proveedores |
|---|---|---|---|---|
| Nombre, correo, teléfono (opc.), mensaje de la solicitud | `orders` (SQLite, servidor propio Ubuntu) | Gestionar la solicitud y cotizar | Medidas precontractuales a petición del titular | Cloudflare (tránsito), Google (correo) |
| Persona/empresa; razón social, RUT, giro, dirección (solo empresas) | `orders` | Emitir el documento tributario | Ejecución del contrato; obligación legal tributaria | — |
| Cotización (monto, anticipo, saldo, vigencia) | `quotes` | Ejecutar el contrato | Contrato | — |
| Resultado del pago: estado, monto, código de autorización, fecha, últimos 4 dígitos, tipo de pago, cuotas | `attempts` | Acreditar la transacción, conciliar, tributario | Contrato; obligación legal; interés legítimo (seguridad) | Transbank |
| Eventos (aceptación de términos con versión y fecha, cambios de estado) | `events` (solo agregar) | Prueba de consentimiento y auditoría | Obligación legal; interés legítimo | — |
| Devoluciones | `refunds` | Contabilidad y reclamos | Obligación legal; contrato | Transbank |
| Registro de correos (plantilla, estado, fechas; cuerpo vaciado tras enviar) | `mail_outbox` | Prueba de confirmaciones | Interés legítimo; art. 12 A Ley 19.496 | Google (Gmail) |
| Contacto web (nombre, correo, mensaje) | EmailJS → bandeja del titular | Responder consultas | Consentimiento/solicitud | EmailJS |
| Conexión (IP, fecha) | Cloudflare y registros del servidor | Seguridad | Interés legítimo | Cloudflare |
**No se almacena:** número completo de tarjeta ni CVV (se ingresan solo en Transbank), tokens en los correos, credenciales en el repositorio. Cookies: ninguna de analítica ni publicidad.
Registros de aplicación: solo identificadores de orden, nunca tokens ni datos personales.

## 2. Matriz de conservación propuesta (para aprobar)
| Categoría | Plazo propuesto | Fundamento / nota |
|---|---|---|
| Órdenes con pago, cotizaciones, intentos autorizados, eventos, devoluciones, comprobantes | **6 años** desde el cierre | Respaldo tributario (SII, 6 años); acreditación de la operación |
| Solicitudes sin cotización ni pago | Propuesta: 12 meses desde la última comunicación y luego anonimizar | **Decisión del titular** (no hay plazo legal fijo) |
| Cotizaciones vencidas sin pago | Propuesta: 12 meses | Decisión del titular |
| Intentos rechazados/cancelados/expirados | Con la orden (misma regla) | Auditoría de fraude |
| Registro de correos enviados | 12–24 meses (sin cuerpo) | Prueba de la confirmación escrita; decisión del titular |
| Mensajes del formulario de contacto | Propuesta: 24 meses desde la última comunicación | Decisión del titular |
| Datos de conexión (Cloudflare/servidor) | Según el proveedor | Verificar la retención de cada proveedor |
| Respaldos de la base | Misma regla de la orden; rotar copias antiguas | Los respaldos contienen todo lo anterior |

## 3. Derechos y mecanismos técnicos
- **Acceso/portabilidad:** `admin-remote.mjs customer-data --email <correo>` exporta en JSON todas las órdenes y el registro de correos del titular (solo lectura, sin tokens). Implementado y probado.
- **Rectificación:** manual por el titular (sin API; se pide al responsable).
- **Supresión/anonimización:** **no automatizada.** Procedimiento propuesto, sujeto a aprobación: verificar identidad; si la orden tiene pago, se **conserva** lo exigido por la ley tributaria (6 años) y solo se anonimiza lo no necesario; si no tiene pago y venció el plazo propuesto, anonimizar nombre/correo/teléfono/mensaje. Requiere una migración y un comando administrativo con aprobación expresa antes de ejecutarse.
- **Respuesta:** por escrito desde `bydlightsolutions@gmail.com`, en los plazos que fije la ley.

## 4. Normativa vigente
- Ley 19.628 rige hoy. **Ley 21.719:** publicada el 13-12-2024; vigencia general prevista el **01-12-2026**.
- **Alerta:** hay un proyecto de postergación (boletín 18.623-07) que, según fuentes secundarias consultadas el 2026-11-06, el Senado aprobó en primer trámite el 28-10-2026 con una nueva vigencia (15-10-2027 en la versión aprobada, 01-12-2027 en la propuesta original) y que pasó a la Cámara; **no se encontró publicación como ley.** No se pudo verificar en camara.cl / senado.cl. Mientras no se publique, rige el 01-12-2026. **Verificar el estado oficial del boletín antes de publicar la política** (el texto dice "prevista", sin comprometer la fecha).
- Con la entrada en vigor, quedarán por revisar: base de licitud por finalidad, registro de actividades, medidas de seguridad, notificación de brechas, y designación de contacto o delegado.
