# Webpay Plus — respuestas para el formulario oficial de validación

Fecha: **2026-11-05**. Fuente: definición **pública** del formulario «SDK: Formulario de validación comercios» (`https://form.typeform.com/to/ibXdg6Av`, leída por la API pública de Typeform, solo lectura; **no se respondió ni se envió nada**). Esto reemplaza la nota anterior de `WEBPAY-REQUISITOS-OFICIALES.md` §3 («campos no verificados»): ahora se conoce el contenido real.

> El **código de comercio** (`597053109914`, productivo, informado por Transbank el 2026-11-05) es un **identificador**. **No es una API Key**. La llave secreta productiva se entrega **después** de aprobar esta validación. Las pruebas se hacen en **integración** con las credenciales públicas del SDK.

## 0. Reglas del formulario (textuales o resumidas de su definición)
1. Toma unos 30 minutos y exige hacer pruebas en la integración e indicar «evidencias como el token de las transacciones».
2. **Las transacciones a validar deben haberse hecho en los últimos 7 días; si no, la validación es RECHAZADA.** Hay que enviar el formulario antes de que venza la ventana (ver §3 y §5).
3. Hay un sitio nuevo de validación automática (`https://validador.transbankdevelopers.cl`, aplicación web que no se pudo leer sin navegador): el formulario dice que «también puedes continuar utilizando este formulario».
4. Al terminar: «Le enviaremos un correo al contacto comercial y contacto técnico que tenemos registrados para ese código de comercio solicitando una confirmación. Luego… te enviaremos tu API Key si la validación es correcta. Dentro de las próximas 24 horas hábiles».

## 1. Datos del comercio (campos en orden)
| Campo del formulario | Obligatorio | Qué ingresar | Fuente / nota |
|---|---|---|---|
| Código de comercio (número) | No | `597053109914` | Aviso de Transbank 2026-11-05 |
| R.U.T. asociado al código de comercio | Sí | El RUT con el que se afilió el comercio | **A confirmar por Diego.** El correo de afiliación `1-12087316724` está a nombre de **persona natural** (titular de la cuenta de abono). El sitio y los textos legales hablan de «Byd Light Solutions SpA». Ingresa exactamente el RUT que Transbank asoció al código |
| Nombre y apellido | Sí | Nombre de quien rinde la validación | Diego |
| Correo | Sí | Correo de contacto | Diego (usa uno que lea a diario: Transbank responde por ahí) |
| Teléfono | Sí | Teléfono de contacto | Diego |
| ¿Validación para un PSP de Transbank? | Sí | **No** | Es un comercio con su propio código |
| ¿Eres integrador? | Sí | **No** | Integración propia del comercio. (Si se contestara «Sí» pide RUT y empresa del integrador.) |
| RUT / empresa del integrador | Solo si «Sí» | No aplica | |
| Logo (GIF o PNG 130×59 px) | No | `docs/evidencias-webpay/logo-130x59.png` | **Pendiente: que Diego apruebe el logo** (derivado de `logo2.png`, fondo blanco) |
| ¿Integración dentro de una app móvil nativa? | Sí | **No** | Es un sitio web |
| Revisión del sitio (3 requisitos) | Sí | Ver §2: hoy **«No, aún me faltan algunos requisitos»** | Marcar «No» **permite continuar** («tu equipo se pondrá en contacto para coordinar») |
| URL para revisar el e-commerce | Sí | `https://bydlightsolutions.com` (o la URL de pruebas que se habilite; ver §2) | |
| URL de producción | No | `https://bydlightsolutions.com` | |
| Moneda contratada | Sí | **Pesos Chilenos (CLP)** | `amount` entero en CLP |
| Tipo de desarrollo | Sí | **Usando un SDK Oficial Transbank** | `transbank-sdk` 6.1.1 (Node.js) |
| Lenguaje | Sí | **Node.js** | Next.js 16 / Node ≥ 22.13 |
| Producto integrado | Sí | **Webpay Plus** | Captura simultánea, REST (no Mall, no captura diferida, no Oneclick) |
| Notas (opcional) | No | Ver §6 | |

## 2. Requisito «revisa tu sitio web»: hoy NO se cumple (y es un bloqueo real)
El formulario pide confirmar tres puntos y avisa que Transbank revisará la URL:
1. **URL activa y sin mantenimiento.** Cumple (`https://bydlightsolutions.com`).
2. **El sitio debe mostrar productos/servicios acordes al rubro declarado en la contratación.** El sitio los muestra (servicios y planes de desarrollo de software), pero **la contratación declarada en la afiliación es «Recaudación por internet / Webpay Plus»**; hay que confirmar que el rubro declarado coincide con ingeniería/desarrollo de software.
3. **«Debes contar con productos de prueba disponibles para realizar las validaciones necesarias.»** Hoy **no**: en producción el pago en línea está **apagado e invisible** (`ONLINE_CHECKOUT_UI=false`, `/contratar`→`/contacto`, `/orden*` 404) y los textos legales están ocultos (`LEGAL_PAGES_PUBLISHED=false`). Un revisor de Transbank que entre al sitio no podrá recorrer un pago.
4. Además (checklist anterior): `http://bydlightsolutions.com` responde 200 sin redirigir a HTTPS (Cloudflare «Always Use HTTPS» sin activar).

**Decisión que necesita Diego** (afecta cómo se responde y cuándo conviene enviar): (a) responder «No» y coordinar con Transbank (permitido por el propio formulario), o (b) preparar antes un recorrido de pago visible con un «producto de prueba» (p. ej. orden de $50 pre-aprobada) en producción, lo que exige **activar el checkout, desplegar y hacer infraestructura** (`ACTIVACION-WEBPAY.md`), es decir, **cosas que no se hicieron ni se harán sin su autorización**.

## 3. Pruebas del bloque «Webpay Plus: Pruebas» (las exactas del formulario)
Cada respuesta es un campo de texto donde se pone el **token** (`token_ws` devuelto al crear la transacción) de **una transacción distinta y nueva** que cumpla la condición. Ambiente: **INTEGRACIÓN**. Las transacciones **deben tener menos de 7 días al validar**.

| Campo (`ref`) | Condición exacta del formulario | Caso nuestro | Token |
|---|---|---|---|
| `webpay_plus_credit_no_installments_approved` | Crédito, sin cuotas, **aprobar** | T1 | ver §4 |
| `webpay_plus_credit_no_installments_rejected` | Crédito, sin cuotas, **rechazar** | T2 | ver §4 |
| `webpay_plus_credit_with_installments_approved` | Crédito, **con cuotas** (cualquier número), **aprobar** | T3 | ver §4 |
| `webpay_plus_debit_approved` | Débito o prepago, **aprobar** | T4 | ver §4 |
| `webpay_plus_debit_rejected` | Débito o prepago, **rechazar** | T5 | ver §4 |
| `webpay_plus_canceled` | Nueva transacción, anotar el token, **«Anular compra y volver al comercio»** en el formulario de Webpay | T6 | ver §4 |
| ¿Implementaste anulaciones (refunds)? | Sí/No | **Sí** (la API administrativa firmada lo implementa) | — |
| `webpay_plus_refund_partial` (opcional) | Transacción **nueva** de crédito aprobada y **anulación parcial** (`PARTIALLY_NULLIFIED`), monto parcial > $50 y < total, **antes de 1 hora** | T7 | ver §4 |
| `webpay_plus_refund_total` (opcional) | Transacción **nueva** de crédito aprobada y **anulación total** inmediata (`REVERSED`), por el monto total, **antes de 1 hora** | T8 | ver §4 |

Observaciones:
- Las pruebas antiguas (Fases 2 y 5, 2026-11-04 y antes) **no se pueden usar**: sus tokens no se conservaron (la base de pruebas era desechable) y **vencen a los 7 días**. Por eso se **repitieron el 2026-11-05** (campaña en §4).
- Anulación parcial se prueba sobre un pago **sin cuotas**: Transbank no admite anulación parcial en cuotas (error 53).
- El orden en el formulario no importa para Transbank; lo que valida es que cada token exista en sus registros con el resultado correcto.

## 4. Tokens de la campaña del 2026-11-05 (integración)
Campaña ejecutada el **2026-11-05 entre 12:36 y 12:44 (hora de Chile)** contra `webpay3gint.transbank.cl`, credenciales públicas de integración (no se usó el código productivo ni llave alguna), servidor local con base nueva. Fuente de verdad: `docs/evidencias-webpay/campana-integracion-2026-11-05.json` (incluye hora UTC, tipo de pago, cuotas y `response_code`); capturas `docs/evidencias-webpay/c2-T1…T8-*.png`. Los tokens son del sandbox público (sin dinero, no son secretos).

| Caso | Campo del formulario | Token (`token_ws`, integración) | Orden de compra | Resultado | Hora de creación |
|---|---|---|---|---|---|
| T1 | `webpay_plus_credit_no_installments_approved` | `01ab64165fc7861681a58dda170c2fd516f93914f7dcc38015c10914b9d44d90` | `BLWZYEZRF65UYC-01` | AUTORIZADO · AUTHORIZED · aut. 1213 | 2026-11-05 12:36:08 (Chile) |
| T2 | `webpay_plus_credit_no_installments_rejected` | `01ab0c2c60338ff771579964b65ffcc22f1b881dd9c0d373f2ef886ab2ebb33c` | `BLPX8GJM24BUJF-01` | RECHAZADO · FAILED · aut. — | 2026-11-05 12:38:13 (Chile) |
| T3 | `webpay_plus_credit_with_installments_approved` | `01ab2dca029d610f6fbadaca0a6dbedaf05ea0fc70106de8d878488c67ca0676` | `BLHXMMKQN6S8KU-01` | AUTORIZADO · AUTHORIZED · aut. 1213 | 2026-11-05 12:40:08 (Chile) |
| T4 | `webpay_plus_debit_approved` | `01ab7870a80943b52b0274a5a03cc10f4ef2eb476978abd453aab30c64452f99` | `BLHSPTJVRWUZP6-01` | AUTORIZADO · AUTHORIZED · aut. 1415 | 2026-11-05 12:41:01 (Chile) |
| T5 | `webpay_plus_debit_rejected` | `01ab297597efe5c84ad370bdfc4a9f35b321a359cf90cd491bb1d7b6862e03f5` | `BLYUYH339DWDVM-01` | RECHAZADO · FAILED · aut. — | 2026-11-05 12:41:42 (Chile) |
| T6 | `webpay_plus_canceled` | `01abee67d12ba127fdd01c05942a012533f6f8f343c05b77d64249095fabe2c7` | `BLZFH4MQBTQKRU-01` | CANCELADO · — · aut. — | 2026-11-05 12:42:38 (Chile) |
| T7 | `webpay_plus_refund_partial` | `01ab0eb45a38e8e4f497d633257fd3edbd54387fabb1ec7387cbc2edc01047c2` | `BLHGE95MAWAPSE-01` | AUTORIZADO · AUTHORIZED · aut. 1213 | 2026-11-05 12:42:56 (Chile) |
| T8 | `webpay_plus_refund_total` | `01ab890947c88468be53f0729f8f59571312df41e41f3b770ee40d688bb57037` | `BLS79FZAKXS9JS-01` | AUTORIZADO · AUTHORIZED · aut. 1213 | 2026-11-05 12:43:21 (Chile) |

- **Plazo:** la primera transacción (T1) se creó 2026-11-05 12:36 (Chile). El formulario rechaza transacciones de más de 7 días: **enviar a más tardar el 2026-11-12 antes de las 12:36 (Chile)**, o repetir la campaña.
- **T7:** anulación parcial de $20.000 sobre $50.000 (VISA, sin cuotas). El `refund` devolvió `type NULLIFIED` con saldo $30.000 (autorización 603538) y la consulta `status` posterior muestra `PARTIALLY_NULLIFIED`. El formulario pide «PARTIALLY_NULLIFIED»: es lo que aparece en `status`; es un dato para anotar en Notas.
- **T8:** anulación total de $50.000 el mismo día: `type REVERSED`.
- **T5:** tarjeta de rechazo `5186 0085 4123 3829`, tomada de las evidencias del 4/11 (caso Redcompra/prepago rechazado). **No se verificó contra la tabla oficial vigente que sea de débito/prepago**; si Transbank lo observa, repetir T5 con la tarjeta de débito o prepago de rechazo publicada en <https://www.transbankdevelopers.cl/documentacion/como_empezar#ambientes>.
- **Complementarios:** `status` por SDK sobre todos los tokens coincide con la base; `commit` repetido sobre T1 devolvió el estado vigente (`AUTHORIZED`, $50.000, autorización 1213) sin error.

## 5. Qué sigue faltando (resumen)
| # | Pendiente | Quién |
|---|---|---|
| 1 | Aprobar logo 130×59 | Diego |
| 2 | Confirmar el RUT asociado al código (persona natural vs SpA) y el rubro declarado | Diego / Transbank |
| 3 | Decidir cómo cumplir «productos de prueba disponibles» y la revisión del sitio (§2) | Diego |
| 4 | HTTPS forzado en Cloudflare | Diego |
| 5 | Enviar el formulario **antes de 7 días** desde las pruebas (o repetir las pruebas el mismo día del envío) | Diego |
| 6 | Tras la API Key: infraestructura (`/data`, `payments.json`), activación, compra real de $50 | Diego / administrador |
| 7 | Textos legales aprobados (D1–D13) antes de publicar | Diego + asesor |

## 6. Texto sugerido para «Notas» (opcional)
> Integración propia de Webpay Plus (REST, captura simultánea) con el SDK oficial de Node.js 6.1.1. Los pagos corresponden al anticipo de proyectos de software previamente cotizados y aprobados. El checkout en línea está desactivado en producción hasta recibir la conformidad de la validación; podemos habilitar un recorrido de prueba en el sitio si lo requieren. Todas las pruebas se hicieron en integración en la fecha indicada.

## 7. Documentos a adjuntar
- **Logo** `logo-130x59.png` (único archivo que pide el formulario).
- No se pide ningún otro adjunto. Las **capturas** de `docs/evidencias-webpay/` son respaldo propio (no se suben al formulario; guardarlas por si Soporte las pide).
