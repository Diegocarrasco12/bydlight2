# Borrador de correo a Transbank — NO ENVIADO

**Estado: borrador. No se envió ni se enviará sin autorización expresa del titular.** Antes de enviarlo el titular debe: completar los datos entre `[corchetes]`, decidir qué pregunta de la sección «Consultas» mantiene, y revisar que el texto es suyo. No contiene credenciales, llaves, secretos ni datos bancarios.

Destinatario: `soporte@transbank.cl` (según «Cómo empezar» de transbankdevelopers.cl, §«Valida»: «las consultas van a soporte@transbank.cl»).
Asunto sugerido: **Solicitud de validación Webpay Plus — Bydlight Solutions SpA — 1-12087316724**

---

Estimados Transbank:

Les escribo en representación de **Byd Light Solutions SpA** (RUT `[RUT de la sociedad]`), comercio en proceso de afiliación con número de seguimiento **1-12087316724**, sitio web https://bydlightsolutions.com. Datos de contacto: `[nombre y cargo]`, `[correo]`, `[teléfono]`.

**1. Producto y modalidad.** Integración propia de **Webpay Plus (REST, captura simultánea)** mediante el SDK oficial `transbank-sdk` para Node.js, versión 6.1.1. El sitio ofrece servicios de ingeniería y desarrollo de software; el pago en línea corresponde al anticipo de un proyecto previamente cotizado (monto calculado en el servidor desde la cotización, nunca desde el navegador).

**2. Resumen de la integración.**
- Creación de la transacción desde el servidor, redirección con `token_ws`, confirmación (`commit`) única al retorno y consulta de estado (`status`) ante respuestas inciertas.
- Aprobación solo si `status = AUTHORIZED` y `response_code = 0`, verificando que coincidan `buy_order`, `session_id` y monto.
- Manejo de los cuatro retornos documentados (normal, abortado `TBK_TOKEN`, timeout `TBK_ORDEN_COMPRA`/`TBK_ID_SESION` y retorno inválido).
- `buy_order` único por intento; un único pago autorizado por orden garantizado en la base de datos; comprobante propio con orden, comercio, monto, moneda, autorización, fecha, tipo de pago, cuotas, últimos cuatro dígitos y descripción.
- Anulaciones (`refund`) solo desde una operación administrativa autenticada, con registro de auditoría y clave de idempotencia.

**3. Pruebas realizadas en el ambiente de integración** (`webpay3gint.transbank.cl`, credenciales públicas de pruebas, sin cobros reales), el 2026-11-04: `[confirmar la lista y los números de orden antes de enviar; tomarlos de docs/EVIDENCIAS-INTEGRACION-WEBPAY.md]`
- Tarjetas aprobadas: VISA, American Express, Redcompra (débito), prepago VISA, y VISA con 3 cuotas.
- Tarjetas rechazadas: Mastercard, Redcompra, prepago Mastercard.
- Pago abortado por el usuario y reintento posterior exitoso.
- Anulaciones: total y parcial, repetición de la misma operación sin duplicarla, monto superior al saldo, e intento de anulación parcial en pago con cuotas.
- Consulta de estado y retornos anómalos (token inválido, retorno sin token, timeout del formulario).
Podemos enviar las órdenes de compra, fechas y horas, y capturas de cada caso.

**4. Consultas.**
1. ¿Cuál es el estado de nuestra afiliación `1-12087316724` y ya se asignó el **código de comercio productivo**? Entendemos que la validación solo se realiza con código productivo.
2. Para la validación de Webpay Plus con SDK, ¿qué **casos de prueba y evidencias** exige el formulario online (https://form.typeform.com/to/ibXdg6Av), además de órdenes de compra, fecha y hora y el logo de 130×59 px?
3. ¿Transbank exige que el comercio muestre en su sitio **términos y condiciones, política de devoluciones u otros datos legales**? Si es así, ¿con qué contenido mínimo?
4. ¿Cuál es la **ventana de anulación** de una venta (el error 284 indica que existe, pero la documentación no la señala) y qué restricciones aplican a anulaciones parciales y a ventas en cuotas?
5. `[Mantener solo si sigue sin resolverse]` **Cuenta de abono:** la sociedad es una SpA y la cuenta bancaria disponible para recibir los abonos está a nombre del representante legal. ¿Transbank acepta una cuenta de una persona natural distinta de la sociedad para los abonos de un comercio constituido como SpA? De no ser posible, ¿qué documentación o tipo de cuenta requieren?
6. ¿Qué documentos adicionales están pendientes para completar la afiliación?

Quedamos atentos a sus indicaciones y a la entrega del formulario o los pasos que correspondan.

Saludos cordiales,
`[nombre]`
`[cargo]` — Byd Light Solutions SpA
`[teléfono]` · `[correo]`
