# Auditoría técnica Webpay Plus — 2026-11-04

Seguimiento Transbank: 1-12087316724. Fase de **diagnóstico**: no se modificó código, no se desplegó, no hay commit. Webpay sigue apagado e invisible en producción (`ONLINE_CHECKOUT_UI=false`, sin `payments.json`).

## 1. Estado actual
- Integración completa en **ambiente de integración**, pero **nunca ejercitada en producción** ni con evidencias formales para Transbank.
- SDK oficial `transbank-sdk` 6.1.1 (fijado). Persistencia en SQLite (`node:sqlite`).
- Infraestructura de producción **no aplicada**: falta volumen `/data`, `payments.json` y `accept-compose` (`docs/ACTIVACION-WEBPAY.md` §5).
- Correo de Transbank: la búsqueda en Gmail por el número de seguimiento no devolvió resultados, así que **no pude leer su solicitud original**. Conviene pegar su texto para contrastarlo con este informe.

## 2. Funcionalidades implementadas
| Área | Archivo | Estado |
|---|---|---|
| create + redirección POST con `token_ws` | `service.ts` `startPayment`, `api/pagos/iniciar` | OK |
| Retorno normal (commit único), abortado (`TBK_TOKEN`), timeout (`TBK_ORDEN_COMPRA`), inválido (ambos) | `service.ts` `handleReturn`, `api/pagos/retorno/[orderId]` (GET y POST) | OK |
| Aprobación solo con `AUTHORIZED` + `response_code=0` + coincidencia de `buy_order`, `session_id`, monto | `evaluate()` | OK |
| status ante fallo de commit / recuperación | `handleReturn`, `verifyOrder` | OK |
| Idempotencia: retorno repetido no re-confirma; índice único parcial: 1 pago autorizado por orden y tipo | `service.ts`, migraciones | OK |
| Monto siempre desde cotización en servidor; `buy_order` único (17 car.) | `amountDue`, `startPayment` | OK |
| HTTPS obligatorio en producción para `return_url` | `startPayment` | OK |
| Logs sin token ni tarjeta; solo últimos 4 dígitos | `log()`, `evaluate()` | OK |
| CSRF (`sameOrigin`), rate limit, interruptor `enabled` | `http.ts`, `config.ts` | OK |

## 3. Resultados de pruebas (ejecutadas hoy, sin pagos reales)
- `npm test`: **18/18 pasan** (aprobado, rechazado, cancelado, duplicado, monto manipulado, inexistente, admin firmado, reinicio, interrumpido, expiración, retorno inválido, config, https, validación).
- `npx tsc --noEmit`: sin errores. Árbol git sin cambios (solo archivos sin seguimiento previos).
- **Límite importante:** las pruebas usan un **stub** del SDK (`tests/stubs/transbank-sdk.mjs`). No prueban contra `webpay3gint.transbank.cl`. La documentación indica pruebas sandbox manuales anteriores, pero **no hay evidencias archivadas** (capturas, `buy_order`, tokens, códigos de autorización) en el repo.
- No ejecuté el sandbox real en esta fase (no era necesario para el diagnóstico y requiere activar `enabled` localmente).

## 4. Requisitos de Transbank vs. estado (fuente: transbankdevelopers.cl, consultada hoy)
| Requisito | Estado |
|---|---|
| Sitio activo con HTTPS | Sitio activo; HTTP responde 200 (pendiente «Always Use HTTPS», requiere Cloudflare con autorización) |
| Pruebas en integración con tarjetas de prueba: aprobadas y rechazadas (VISA, AMEX, Mastercard, Redcompra, prepago) | **Pendiente de ejecutar y documentar** con evidencias |
| Comparar monto y `buy_order` devueltos | Implementado |
| Comprobante propio del comercio (nº orden, comercio, monto, autorización, fecha, tipo de pago, cuotas, últimos 4, descripción) | **Parcial**: faltan tipo de pago legible, cuotas, nombre del comercio y descripción en pantalla (`orden/[id]/page.tsx` `Result`); los datos sí se guardan |
| Informar al cliente si el pago se aborta/rechaza | Implementado |
| Logo 130×59 px GIF/PNG | **No encontrado** preparado |
| Formulario online de validación + evidencias | **Pendiente** (acción del titular) |
| Llave secreta de producción y compra real de $50 | Posterior a la validación |
| Anulación/reversa (`refund`) | **No implementada** |

## 5. Riesgos y problemas detectados
1. **Sin reversa/anulación (`refund`)**: ni API ni operación administrativa. Si se cobra por error o hay devolución, no hay camino en el sistema. Probable observación en certificación o necesidad operativa inmediata.
2. **Sin evidencias reutilizables**: Transbank compara con sus registros; hay que generar una corrida limpia y guardar `buy_order`, fecha/hora, monto, código de autorización y capturas.
3. **Comprobante incompleto** respecto de lo recomendado (ver arriba).
4. **Sin página de condiciones / política de devoluciones**: el formulario de solicitud exige aceptar «condiciones de contratación» pero no encontré en `src/app` una página que las contenga. Requisito habitual de comercio electrónico y probable observación.
5. **Fallo de `commit` seguido de `status` ≠ AUTHORIZED** marca el intento `ERROR` definitivo (`service.ts` ~206-214), incluso si el estado fuese transitorio (p. ej. aún `INITIALIZED`). Caso límite; revisar con la tabla de estados de Transbank.
6. **Expiración de intentos en 15 min** (`PENDING_MAX_MIN`), mientras el token vive 5 min y el formulario 4 (producción). Un cliente que abandona queda bloqueado hasta 15 min si no hay retorno ni verificación. Solo UX; se puede acortar a ~6 min.
7. **Exclusión mutua solo en proceso** (`withOrderLock`): válido con una sola réplica; la base igual impide doble pago.
8. **Documentación desactualizada**: dice 17 pruebas; hoy son 18.
9. **Cadena de activación aún bloqueada por infraestructura**: sin volumen/`payments.json` no hay dónde persistir en producción; requiere política del ejecutor + `accept-compose` (humano).
10. `/orden` responde 404 con pagos apagados: para probar en integración hay que correr **localmente** con `enabled`; no hace falta tocar producción. `return_url` de integración puede ser `localhost`.

## 6. Plan hasta la certificación
**A. Código (requiere tu autorización para empezar):**
1. Completar el comprobante (tipo de pago, cuotas, comercio, descripción, fecha).
2. Página pública de condiciones de contratación y devoluciones (texto lo valida el titular; no inventar cláusulas legales).
3. Implementar `refund` (SDK `Transaction.refund`) como operación **administrativa firmada**, con registro en `events` y estado propio; sin botón público.
4. Revisar manejo de `status` no autorizado tras fallo de commit; acortar expiración de intentos.
5. Pruebas automáticas nuevas para 3 y 4.

**B. Evidencias en sandbox (local, sin dinero):**
Con `enabled` solo en local y credenciales de integración del SDK, ejecutar y registrar: VISA aprobada, AMEX aprobada, Redcompra aprobada, Mastercard rechazada, Redcompra rechazada, prepago aprobada y rechazada, pago anulado por el usuario, timeout (esperar 10 min en integración) y una anulación/reversa. Guardar tabla con `buy_order`, token (parcial), fecha, resultado y capturas en `docs/` (sin secretos).

**C. Titular:**
1. Preparar logo 130×59 px.
2. Completar el formulario online de validación y adjuntar evidencias.
3. Aprobar el cambio de infraestructura (volumen `/data` + `accept-compose`) cuando corresponda.
4. Tras conformidad: recibir llave secreta, crear `payments.json`, compra real de $50 y recién entonces activar la UI (`ONLINE_CHECKOUT_UI`).

## 7. Siguiente acción concreta recomendada
Autorizar la **Etapa 1 de implementación local** (puntos A1–A5, sin despliegue ni commit hasta que lo apruebes) y, en paralelo, pegarme el correo de Transbank con el seguimiento 1-12087316724 para contrastar sus requisitos exactos. Después ejecuto la corrida de evidencias en sandbox (B).

---

## Addendum — Fase 2 (2026-11-04): estado de cada hallazgo
| Hallazgo | Resultado |
|---|---|
| 1. Sin reversa/anulación | **Resuelto** (capa de dominio + API admin firmada con permiso `adminRefunds`, apagada por defecto). Probada en integración (parcial y total) |
| 2. Sin evidencias reutilizables | **Parcial**: 3 casos + devolución con capturas; faltan AMEX, Redcompra, prepago, cuotas, expiración real (`docs/EVIDENCIAS-INTEGRACION-WEBPAY.md`) |
| 3. Comprobante incompleto | **Resuelto** (`voucher.ts`) |
| 4. Sin página de condiciones | **Borradores creados, no publicados** (404 en producción) — requieren decisiones del titular (`docs/WEBPAY-CERTIFICACION.md` §7) |
| 5. Commit fallido ⇒ ERROR definitivo | **Resuelto**: nuevo estado `PENDIENTE` + reconciliación por `status` |
| 6. Bloqueo de 15 min | **Resuelto**: ventana 11/6 min con consulta de estado previa a cualquier reintento |
| 7. Bloqueo solo en proceso | Sin cambio (una réplica); la base impide doble pago y doble devolución abierta |
| 8. Documentación desactualizada | Actualizada (40 pruebas) |
| 9/10. Infraestructura | Sin cambios (no se tocó producción) |
| Hallazgo nuevo | Corregido: `startPayment` resolvía intentos vencidos después de validar el monto (posible doble cobro); detectado por la prueba B2 |
