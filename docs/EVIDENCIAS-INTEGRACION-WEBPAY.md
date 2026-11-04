# Matriz de pruebas y evidencias — Webpay Plus (Fase 2, 2026-11-04)

Seguimiento Transbank: 1-12087316724. **Todo lo de este documento ocurrió en el ambiente de integración** (`webpay3gint.transbank.cl`, código de comercio de integración y tarjetas publicadas por Transbank, sin dinero). **No es certificación.** Producción sigue apagada.

## 1. Dos tipos de prueba (no mezclar)
| Tipo | Qué prueba | Dónde |
|---|---|---|
| **Automáticas con doble (mock) del SDK** | Lógica propia: estados, idempotencia, montos, devoluciones, auditoría, persistencia, autorización de la API admin. **No hablan con Transbank.** | `npm test` → 40 pruebas (`tests/payments.test.mjs` 17 + `tests/webpay-fase2.test.mjs` 22 + `tests/smoke.test.mjs` 1) |
| **Reales contra integración de Transbank** | Que create/redirección/commit/refund funcionan contra los servidores reales de pruebas | Sección 3 (ejecución manual guiada con navegador, base SQLite temporal local, servidor `next dev` local) |

## 2. Resultado de las pruebas automáticas (mock)
`npm test`: 40/40 · `npx tsc --noEmit`: sin errores · `npm run lint`: sin errores · `npm run build`: correcto.

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

## 4. Casos que Transbank menciona y **aún no están ejecutados** en integración
- AMEX aprobada (3700 0000 0002 032, CVV 1234) · Redcompra débito aprobada (4051 8842 3993 7763 / 4511 3466 6003 7060) y rechazada (5186 0085 4123 3829) · prepago VISA aprobada / prepago Mastercard rechazada · pago **en cuotas** (verifica `installments_amount`) · **expiración real** del formulario (10 min en integración) · retorno por tiempo excedido real · reversa el mismo día con REVERSED (la prueba 6 salió NULLIFIED).
- Orden `EDV96HR23VZJ` (AMEX) quedó sembrada en la base temporal local, que ya no existe; repetir con una base nueva.
- Los casos exactos que exige el formulario de validación **no son públicos**: la documentación solo dice «una serie de pruebas y envío de evidencias». Hay que leer el formulario cuando el titular lo abra.

## 5. Hallazgos de la ejecución real
- El flujo propio funcionó a la primera contra integración (create → POST `token_ws` → autenticación → retorno GET → commit → comprobante).
- El SDK 6.1.1 lanza `TransbankError` con mensaje de texto (sin código HTTP); por eso un error de red o de Transbank en `refund` se trata como **incierto** y se concilia con `status`, nunca como éxito ni fracaso supuesto.
- Un error propio detectado y corregido gracias a las pruebas: al iniciar un pago, los intentos vencidos se resolvían *después* de validar el monto, lo que habría permitido un segundo cobro si el primero resultaba autorizado. Ahora se resuelven antes (prueba B2).
