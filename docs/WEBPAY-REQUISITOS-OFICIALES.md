# Webpay Plus — requisitos oficiales (auditoría de documentación)

> **Actualización 2026-11-05:** Transbank creó el código de comercio productivo `597053109914` (identificador, no API Key). El formulario oficial es público y se conoce su contenido: **ver `docs/WEBPAY-FORMULARIO-VALIDACION-RESPUESTAS.md`** (campos, respuestas, tokens de la campaña de integración T1–T8 del 2026-11-05, plazo de 7 días, bloqueos). Donde este documento dice «formulario sin verificar», «código productivo pendiente» o «casos oficiales no verificados», prevalece esa actualización. Formulario no enviado; Webpay sigue apagado en producción.

Fecha de consulta: **2026-11-04**. Fuentes oficiales leídas ese día (solo lectura, sin autenticarse en nada):
- <https://www.transbankdevelopers.cl/documentacion/webpay-plus>
- <https://www.transbankdevelopers.cl/documentacion/como_empezar>
- <https://www.transbankdevelopers.cl/referencia/webpay> (primeros 100 000 de 122 058 caracteres; la parte final es de Webpay Plus Mall y no se leyó)
- <https://www.transbankdevelopers.cl/ayuda> (preguntas frecuentes)
- <https://form.typeform.com/to/ibXdg6Av> (formulario de validación; **solo la pantalla de bienvenida**, ver §3)

Regla de este documento: lo que no está en una fuente oficial leída no se afirma. Cada requisito va con su clase:
**1** obligatorio publicado · **2** recomendación técnica · **3** depende del formulario de validación · **4** condición comercial de afiliación · **5** a confirmar con soporte.

## 1. Requisitos obligatorios publicados (clase 1)

| # | Requisito (texto oficial resumido) | Fuente | Estado en Bydlight |
|---|---|---|---|
| 1.1 | Contar con un **sitio web activo**. | como_empezar §8 | Cumple (sitio público activo; ver nota HTTPS) |
| 1.2 | **HTTPS** en los endpoints del comercio, en integración y producción (Transbank no acepta integraciones sin HTTPS desde 2018-12-01). | como_empezar §8 | Código: `startPayment` exige HTTPS para `return_url` en producción. **Pendiente de infraestructura:** el dominio público hoy responde HTTP 200 (hallazgo 2026-10-27, Cloudflare) |
| 1.3 | Configurar el ambiente **explícitamente** en el SDK (`buildForIntegration` / `buildForProduction`). | webpay-plus | Cumple (`config.ts` `createTransaction`) |
| 1.4 | Tras el retorno, **confirmar (commit)** con `token_ws`. Aprobada solo si `response_code = 0` **y** `status = AUTHORIZED`. | webpay-plus | Cumple (`evaluate()`; verificado con 10 commits reales —7 aprobados y 3 rechazados—, ver expediente) |
| 1.5 | **Verificar que monto y `buyOrder` devueltos coincidan** con los enviados al crear. | como_empezar §8 | Cumple (también `session_id`); prueba automática de monto manipulado |
| 1.6 | Mostrar un **comprobante propio** (en REST no hay voucher de Transbank) con: orden, comercio, monto, moneda, autorización, fecha, tipo de pago, cuotas, últimos 4 dígitos y descripción. Informar si fue rechazada. | como_empezar §8 | Cumple (`voucher.ts`; evidencias con capturas) |
| 1.7 | Manejar los **cuatro retornos**: normal (`token_ws`), timeout (`TBK_ID_SESION`+`TBK_ORDEN_COMPRA`), abortado (`TBK_TOKEN`+…), error con «volver al sitio» (`token_ws`+`TBK_TOKEN`+…, solo producción). En el abortado no se confirma e informar al cliente que el pago no se completó. | webpay-plus | Cumple (`handleReturn`); abortado y timeout comprobados. **Observación real:** en integración el retorno tras el timeout llegó **sin parámetros** (la documentación indica `TBK_ORDEN_COMPRA`/`TBK_ID_SESION`); el sistema no depende de ese retorno (expira por antigüedad con consulta de estado) |
| 1.8 | Respetar límites: `buy_order` ≤ 26 (letras, números y `\|_=&%.,~:/?[+!@()>-`), `session_id` ≤ 61, `amount` entero en CLP ≤ 17, `return_url` ≤ 256, token de 64. | referencia/webpay | Cumple (`buy_order` = `BL<id>-NN`, 17 car.) |
| 1.9 | `refund` debe indicar el **código de comercio** que hizo la transacción (en Webpay Plus simple el SDK usa el configurado). | referencia/webpay | Cumple (SDK) |
| 1.10 | **Logo** de la tienda GIF o PNG de **130×59 px** para la validación. | como_empezar §6 | Preparado: `docs/evidencias-webpay/logo-130x59.png` (derivado de `logo2.png`, fondo blanco; el titular debe aprobarlo) |
| 1.11 | **Código de comercio productivo**: «Transbank solo validará las integraciones de aquellos comercios que tengan un código de comercio productivo». | como_empezar §6; ayuda | **Pendiente (externo):** depende de la afiliación |
| 1.12 | **Prueba en producción** para cerrar el proceso (la documentación indica una compra de $50). | como_empezar §7; ayuda | Pendiente (posterior a la validación) |
| 1.13 | La llave secreta es confidencial («como una contraseña»). | como_empezar §7 | Cumple (solo servidor, `payments.json` 0600; ver expediente §10) |

## 2. Recomendaciones técnicas (clase 2)
- No usar iframe para Webpay Plus. → No se usa (redirección POST con `token_ws`).
- Token de creación vive 5 min; formulario máximo **4 min en producción / 10 min en integración**. → Ventana de abandono propia 6 / 11 min.
- Consultar estado (`status`, disponible 7 días) solo ante errores inesperados. → Se usa para reconciliar `PENDIENTE`.
- No validar el campo `vci` (se agregan valores sin documentar). → No se valida.
- En caso de abort, consultar la transacción con `TBK_TOKEN`. → **Brecha menor:** el código marca `CANCELADO` sin consultar. Verificado contra Transbank que un pago abortado queda `INITIALIZED` (sin cobro); el riesgo es nulo, pero la consulta es la práctica indicada. Propuesta en `docs/WEBPAY-EXPEDIENTE-CERTIFICACION.md` §13.
- `buy_order` único en integración. → Único siempre.
- Seguridad: escaneo de vulnerabilidades al menos cada 3 meses, componentes actualizados, WAF/IPS y OWASP, acceso restringido, **respaldos fuera de la ubicación principal**, monitoreo y auditoría externa anual. → Parcial: ver expediente §10/§14 (no hay escaneos ni WAF propios; Cloudflare delante del servidor).
- No depender del certificado público de Webpay (renovación 2026-08-25). → No se depende de él.
- SOAP será deprecado; usar REST. → Se usa REST (SDK 6.1.1).

## 3. Lo que depende del formulario de validación (clase 3)
- Formulario para Webpay Plus con SDK o API directa: <https://form.typeform.com/to/ibXdg6Av> («SDK: Formulario de validación comercios»). Es **público** (no pide iniciar sesión para abrirlo).
- **Verificado:** su pantalla de bienvenida dice que sirve para quien necesita «comenzar a operar con dinero real en el ambiente de producción», que **no** es el formulario correcto si se instaló un plugin oficial (WooCommerce, Prestashop, Magento, Virtuemart, Opencart), y que al validar «te enviaremos tu API Key en 24 horas hábiles».
- **No verificado:** los campos y preguntas siguientes. Typeform muestra una pregunta por pantalla y avanzar exige responder; no se respondió ninguna ni se envió nada para no inventar contenido ni dejar datos en un formulario real. Según la página «Cómo empezar», la evidencia pedida son **órdenes de compra y fecha/hora de las transacciones de prueba** más el logo 130×59 px; Soporte contrasta con sus registros.
- **No hay una matriz universal publicada de casos obligatorios.** La documentación publica tarjetas de prueba (VISA, AMEX, Mastercard, Redcompra, prepago) y dice que Soporte comprueba que los casos coincidan con sus registros; qué casos exige el formulario no se puede afirmar. **La matriz oficial no se declara conocida.**
- Para Transacción Completa y PatPass existen formularios de evidencias en Word; **no aplican** a Webpay Plus.

## 4. Condiciones comerciales de afiliación (clase 4)
- Afiliarse en `publico.transbank.cl` con formulario firmado digitalmente; el código de comercio llega por correo (como_empezar §1). «Para optar a todos los servicios de Transbank debes tener un comercio afiliado» (ayuda). El ambiente de integración es de acceso libre.
- Comisiones, costos, documentos exigidos, plazos de afiliación: **no publicados en transbankdevelopers.cl** (están en transbank.cl / oferta comercial). Los abonos (débito 24 h hábiles, crédito 48 h hábiles) los registra `docs/ACTIVACION-WEBPAY.md` como publicados; no se re-verificaron hoy.
- Paso a producción: «24 hrs» tras validar y con documentación correcta (ayuda).
- Ventas de prueba en producción: «se pueden anular y serán abonadas nuevamente al comercio, descontando la comisión».

## 5. Puntos a confirmar con Transbank (clase 5)
1. Estado de la afiliación `1-12087316724` y si ya existe **código de comercio productivo** (sin él no hay validación).
2. Que la modalidad contratada es **Webpay Plus (REST, captura simultánea)** y no otra.
3. Qué **casos de prueba** exige el formulario de validación y qué evidencia adicional pide.
4. Si exige **página de términos/devoluciones o datos legales visibles**; si lo hace, con qué contenido mínimo (no hay texto oficial leído).
5. **Cuenta de abono**: ver §6.
6. Si el **abandono real** en producción devuelve `TBK_TOKEN`/timeout igual que en integración. En integración el retorno tras el timeout del formulario llegó **sin parámetros**, distinto de la documentación; el flujo «error y volver al sitio» solo es reproducible en producción.
7. Si la conformidad cubre pagos en **cuotas** y **anulaciones parciales**, y la ventana de anulación (el código de error 284 existe, pero la documentación no da el plazo).
8. Procedimiento de **devoluciones** en producción por parte del comercio y límites.

## 6. Cuenta bancaria de abono (cuenta personal del representante legal para una SpA)
- La documentación técnica (`ayuda`, `como_empezar`) **no trata** la cuenta de abono ni la distinción persona natural/jurídica.
- Una FAQ de Transbank encontrada por búsqueda (PDF anónimo, sin fecha, que menciona documentos de identidad con vencimiento 2020) afirma que la cuenta de abono «puede ser tuya o de un tercero» y que una empresa debe tener inicio de actividades y subir su escritura si se le solicita. **No se trata como fuente oficial vigente**: es un documento antiguo y no se pudo leer su texto (PDF de imagen).
- **No se asume** que Transbank acepte una cuenta personal del representante legal para una SpA. La consulta concreta está en `docs/WEBPAY-CORREO-CERTIFICACION.md`. No se tocó ningún dato bancario.

## 7. Conclusión
Los requisitos técnicos de clase 1 que dependen del código están cubiertos y comprobados contra el ambiente de integración. Los pendientes son externos o de infraestructura (afiliación con código productivo, HTTPS público, formulario de validación) y de decisión del titular (textos legales, logo).
