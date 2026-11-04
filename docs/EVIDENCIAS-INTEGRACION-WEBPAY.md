# Matriz de pruebas y evidencias — Webpay Plus (Fase 2, 2026-11-04)

Seguimiento Transbank: 1-12087316724. **Todo lo de este documento ocurrió en el ambiente de integración** (`webpay3gint.transbank.cl`, código de comercio de integración y tarjetas publicadas por Transbank, sin dinero). **No es certificación.** Producción sigue apagada.

## 1. Dos tipos de prueba (no mezclar)
| Tipo | Qué prueba | Dónde |
|---|---|---|
| **Automáticas con doble (mock) del SDK** | Lógica propia: estados, idempotencia, montos, devoluciones, auditoría, persistencia, autorización de la API admin. **No hablan con Transbank.** | `npm test` → 41 pruebas (`tests/payments.test.mjs` 18 + `tests/webpay-fase2.test.mjs` 22 + `tests/smoke.test.mjs` 1) |
| **Reales contra integración de Transbank** | Que create/redirección/commit/refund funcionan contra los servidores reales de pruebas | Sección 3 (ejecución manual guiada con navegador, base SQLite temporal local, servidor `next dev` local) |

## 2. Resultado de las pruebas automáticas (mock)
`npm test`: 41/41 (Fase 5 agregó la 17b) · `npx tsc --noEmit`: sin errores · `npm run lint`: sin errores · `npm run build`: correcto.

Cobertura nueva (Fase 2): confirmación incierta (commit y status fallan → PENDIENTE, sin segundo commit ni nuevo cobro, recuperación posterior), commit con respuesta no concluyente, cierre a revisión manual tras 7 días, estados anulados inesperados, abandono (ventana 11 min integración / 6 min producción, consulta de estado antes de reintentar, bloqueo si la consulta falla), comprobante (campos, omisión de lo no informado, no existe para pagos no aprobados), devolución total/parcial/en cuotas, validaciones de monto y orden, idempotencia, devolución incierta y su conciliación, concurrencia, persistencia tras reinicio, acceso no autorizado a la API admin (404 sin secreto, 401 sin firma o cuerpo alterado, 403 sin permiso `adminRefunds`), migración 3 con datos existentes.

## 3. Pruebas reales en integración de Transbank (2026-11-04, hora de Chile ~11:30–11:40)
Tarjetas y credenciales de bank-test: solo las publicadas en transbankdevelopers.cl (VISA 4051 8856 0044 6623, Mastercard 5186 0595 5959 0568; RUT 11.111.111-1, clave 123). Los comprobantes solo muestran los últimos 4 dígitos.

| # | Caso | Orden de compra | Resultado observado | Evidencia |
|---|---|---|---|---|
| 1 | VISA aprobada, sin cuotas, $50.000 | `BL6RECTYEBYMF5-01` | Aprobada. Código de autorización `1213`, tipo `VN` (Crédito sin cuotas), tarjeta `•••• 6623`. Comprobante propio completo | `docs/evidencias-webpay/01-visa-aprobada.png` |
| 2 | Mastercard rechazada | `BLFDXFFBY4GZM7-01` | Rechazada; la orden queda sin pagar y se puede reintentar | `02-mastercard-rechazada.png` |
| 3 | Pago anulado por el usuario («Anular compra y volver») | `BLRZC22D6JW5ET-01` | Cancelado (retorno `TBK_TOKEN`); no se confirma; mensaje claro | `03-anulado-por-usuario.png` |
| 4 | Anulación **parcial** $10.000 del caso 1 (API admin firmada, `adminRefunds` activado solo en el servidor local de prueba) | refund `RFdcfbe8cda48c5a53` | `NULLIFIED`, `nullified_amount` 10.000, `balance` 40.000, autorización de la anulación `962138` | salida registrada en esta sesión |
| 5 | Repetir la anulación con la misma clave de idempotencia | — | `replayed: true`, **sin** segunda llamada a Transbank | idem |
| 6 | Anulación del saldo $40.000 | segunda devolución | `NULLIFIED`, `balance` 0, autorización `856180` | `04-comprobante-con-devolucion.png` |
| 7 | Otra devolución sobre el pago ya devuelto | — | Rechazada por la lógica propia («ya fue devuelto en su totalidad»), sin llamar a Transbank | idem |

Notas: (a) la autenticación bancaria de pruebas muestra el comprobante propio del comercio tras volver (no el voucher de Transbank, como exige la documentación). (b) Tras la prueba se detuvo el servidor local y el secreto administrativo de prueba era temporal (no se guardó en el repositorio).

## 3b. Fase 5 — casos adicionales reales en integración (2026-11-04, ~16:24–16:45 UTC = 13:24–13:45 hora de Chile)
Servidor `next dev` local, base SQLite desechable, `adminRefunds` activado solo en esa base. Credenciales y tarjetas públicas. Las horas de la base están en **UTC**.

| # | Caso | Orden de compra | Resultado observado | Evidencia |
|---|---|---|---|---|
| 8 | AMEX 3700 0000 0002 032 aprobada, $50.000 | `BLBPEQAZ63DGYG-01` | Aprobada, autorización `1617`, `•••• 2032`, crédito sin cuotas | (texto del comprobante registrado) |
| 9 | Redcompra 4051 8842 3993 7763 aprobada | `BLSAJCS7U9SSCY-01` | Aprobada, autorización `1415`, `Débito (Redcompra)`, `•••• 7763`; no pide vencimiento ni CVV | `f5-redcompra-aprobada-comprobante.png` |
| 9b | Redcompra 4511 3466 6003 7060 aprobada (2.ª tarjeta publicada) | `BL6KVFUFYQ9JXT-01` | Aprobada, autorización `1819`, `Débito (Redcompra)` | (texto del comprobante registrado) |
| 10 | Redcompra 5186 0085 4123 3829 rechazada | `BL5NW6VEMXR4GB-01` | Rechazada (`FAILED`), orden sin pagar | `f5-redcompra-rechazada.png` |
| 11 | Prepago VISA 4051 8860 0005 6590 aprobada | `BLPPUZ67XUGRXH-01` | Aprobada, autorización `3122`, `Prepago`, `•••• 6590` | `f5-prepago-visa-aprobada.png` |
| 12 | Prepago Mastercard 5186 1741 1062 9480 rechazada | `BLXAAVGDVSKZ5V-01` | Rechazada, sin cobro | `f5-prepago-mc-rechazada.png` |
| 13 | VISA 3 cuotas | `BLS4YPVFDPBMWP-01` | Aprobada, autorización `1213`, 3 cuotas de $16.667, tipo `SI` («Crédito, cuotas sin interés») | `f5-visa-3-cuotas-aprobada.png` |
| 14 | Cancelación por el usuario | `BLRWS5HKS4SGDN-01` | `CANCELADO`, sin cobro; Transbank `status` = `INITIALIZED` | `f5-cancelado-por-usuario.png` |
| 15 | Reintento tras cancelar (VISA) | `BLRWS5HKS4SGDN-02` | Aprobada, autorización `1213` | `f5-reintento-tras-cancelacion-aprobado.png` |
| 16 | Anulación parcial $10.000 de la AMEX | refund `RFa6b2d4429f008362` | `NULLIFIED`, saldo 40.000, autorización `135048` | salida registrada |
| 17 | Repetir con la misma clave | — | `replayed: true`, sin segunda llamada a Transbank | idem |
| 18 | Anulación de $45.000 (saldo 40.000) | — | Rechazada localmente: «excede lo disponible (40000)» | idem |
| 19 | Anulación del resto $40.000 | `RF34d92e80aeae7c80` | `NULLIFIED`, saldo 0, autorización `116072` | idem |
| 20 | Otra anulación tras agotar | — | «ya fue devuelto en su totalidad» (sin llamar a Transbank) | idem |
| 21 | Anulación total mismo día, pago en cuotas | `RFadfe2f265adb6007` | `type = REVERSED` | idem |
| 22 | Anulación total mismo día, Redcompra | `RFaee59a823518d1df` | `type = REVERSED` | idem |
| 23 | Anulación parcial $10.000 sobre pago en 3 cuotas | — | Rechazada **por validación local previa** (código 53 de Transbank): **no** es respuesta real de Transbank | idem |
| 24 | Anulación sobre pago rechazado | — | «No hay un pago autorizado que devolver» | idem |

Sondeo directo con el SDK oficial (integración): `commit` repetido sobre un pago ya confirmado → devuelve el estado vigente sin error; `status` → `NULLIFIED` (pago anulado), `FAILED` con `response_code -1` (rechazado), `INITIALIZED` (cancelado o sin pagar); `commit`, `status` y `refund` con un token falso → **HTTP 422 «Invalid value for parameter: token»**.

Retornos y protección de duplicados (código real del servidor, peticiones propias; **no** son respuestas oficiales): token desconocido, `token_ws`+`TBK_TOKEN` desconocidos y retorno sin parámetros → sin cambio de estado; `TBK_ORDEN_COMPRA`+`TBK_ID_SESION` → `EXPIRADO`; reiniciar pago sobre orden pagada → `?aviso=sin-pago`; con intento abierto → `?aviso=en-curso`; `amount=1` en el formulario de inicio → ignorado (intento por $50.000).

Expiración por abandono: orden `NHQH7QDUD4YN` con intento abierto (`BLNHQH7QDUD4YN-01`, 16:29:52 UTC); durante la ventana, un nuevo intento se bloquea («Pago en curso»); a los 11 min la visita a la orden consultó a Transbank (`INITIALIZED`) y el intento pasó a `EXPIRADO` (16:41:30 UTC).

Timeout real del formulario de Webpay: orden `J8UJJTY2FQSQ`, formulario abierto a las 16:35:02 UTC y dejado sin pagar. A los ~10 min Webpay mostró «Tu transacción no se pudo llevar a cabo. Ningún cargo fue realizado en tu tarjeta, por favor intenta nuevamente» (captura `f5-timeout-formulario-webpay.png`; sin redirección automática). Al pulsar «Intentar nuevamente» el navegador volvió a `GET /api/pagos/retorno/J8UJJTY2FQSQ` **sin ningún parámetro** en la URL (la documentación indica `TBK_ORDEN_COMPRA` y `TBK_ID_SESION`; **diferencia observada en integración**, no se sabe si ocurre igual en producción). El retorno vacío no cambió el estado; la visita a la orden consultó `status` (`INITIALIZED`) y marcó `EXPIRADO` (16:46:54 UTC) por antigüedad. El cliente vio «Pago expirado… No se realizó ningún cobro. Puedes iniciar un nuevo pago».

## 4. Casos que Transbank menciona y **no se ejecutaron**
- Error «volver al sitio» (`token_ws`+`TBK_TOKEN`): solo reproducible en producción según la documentación.
- Fallo temporal de Transbank y respuesta incierta real: no se pueden provocar en el ambiente oficial; solo mock.
- Los casos exactos que exige el formulario de validación **no son públicos**: la pantalla de bienvenida del formulario (`https://form.typeform.com/to/ibXdg6Av`) no los muestra y el resto exige responder. Hay que leerlo cuando el titular lo abra.

## 5. Hallazgos de la ejecución real
- El flujo propio funcionó a la primera contra integración (create → POST `token_ws` → autenticación → retorno GET → commit → comprobante).
- El SDK 6.1.1 lanza `TransbankError` con mensaje de texto (sin código HTTP); por eso un error de red o de Transbank en `refund` se trata como **incierto** y se concilia con `status`, nunca como éxito ni fracaso supuesto.
- Un error propio detectado y corregido gracias a las pruebas: al iniciar un pago, los intentos vencidos se resolvían *después* de validar el monto, lo que habría permitido un segundo cobro si el primero resultaba autorizado. Ahora se resuelven antes (prueba B2).
