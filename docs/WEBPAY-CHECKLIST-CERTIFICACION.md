# Webpay Plus — checklist de validación con Transbank

Fecha: **2026-11-04**. Estados posibles: **CUMPLIDO** (verificado con evidencia), **PARCIAL**, **PENDIENTE**, **BLOQUEADO** (depende de un tercero), **NO VERIFICADO** (no hay fuente o prueba), **N/A**. «Obligatorio» = publicado como exigencia en la documentación oficial (`WEBPAY-REQUISITOS-OFICIALES.md`). **Estado global: NO LISTO** (hay obligatorios pendientes). No se declara READY mientras alguno de los obligatorios siguientes siga pendiente.

## A. Obligatorios publicados por Transbank
| Requisito | Estado | Evidencia | Acción pendiente |
|---|---|---|---|
| Sitio web activo | CUMPLIDO | https://bydlightsolutions.com responde | — |
| HTTPS en todos los endpoints | **PENDIENTE** | Código exige HTTPS en `return_url` de producción (`startPayment`); el dominio público responde HTTP 200 (hallazgo 2026-10-27) | Titular: activar «Always Use HTTPS» en Cloudflare (no se tocó Cloudflare) |
| Ambiente explícito en el SDK | CUMPLIDO | `config.ts` `createTransaction`; prueba de configuración (mock) | — |
| Crear, redirigir con `token_ws` y confirmar (`commit`) al retorno | CUMPLIDO | 10 pagos reales en integración, 7 aprobados y 3 rechazados (`EVIDENCIAS…` §3 y §3b) | — |
| Aprobación solo con `AUTHORIZED` + `response_code 0` | CUMPLIDO | `evaluate()`; pruebas mock; 9 casos reales | — |
| Verificar que monto y `buyOrder` coinciden | CUMPLIDO | `evaluate()`; prueba de monto manipulado (mock) y `amount=1` ignorado (local) | — |
| Comprobante propio con todos los campos (no usar voucher de Transbank) | CUMPLIDO | `voucher.ts`; capturas `01`, `f5-*` | — |
| Informar al cliente si se rechaza, cancela o vence | CUMPLIDO | Capturas `02`, `f5-redcompra-rechazada`, `f5-cancelado-por-usuario` | — |
| Manejo de los 4 retornos documentados | CUMPLIDO | Normal, abortado, timeout sintético, inválido: casos 10, 14, 18, 19 del expediente | — |
| Respetar límites de campos (`buy_order` ≤ 26, etc.) | CUMPLIDO | `BL<id>-NN` = 17 caracteres | — |
| Logo 130×59 px GIF/PNG | PARCIAL | `docs/evidencias-webpay/logo-130x59.png` generado desde `logo2.png` | Titular: aprobar el logo o entregar otro |
| Formulario de validación completado con órdenes y fecha/hora | PENDIENTE | Los datos existen (tabla de órdenes y UTC−3); formulario sin abrir por el titular | Titular: completar `https://form.typeform.com/to/ibXdg6Av` **cuando tenga código productivo** |
| Código de comercio productivo (condición para que Transbank valide) | **BLOQUEADO** | Texto oficial: «solo validará… comercios con código de comercio productivo» | Titular/Transbank: confirmar afiliación `1-12087316724` |
| Llave secreta de producción | BLOQUEADO | Se entrega tras validar | Titular: custodiarla al recibirla |
| Prueba real de $50 en producción | BLOQUEADO | Cierra el proceso (docs y FAQ) | Posterior a validación |

## B. Recomendaciones técnicas
| Requisito | Estado | Evidencia | Acción pendiente |
|---|---|---|---|
| Consultar `status` solo ante error inesperado | CUMPLIDO | Reconciliación de `PENDIENTE`; abandono con consulta previa | — |
| En abort, consultar con `TBK_TOKEN` | PARCIAL | Cancela sin consultar; verificado que Transbank deja `INITIALIZED` (sin cobro) | Propuesta técnica (bajo riesgo) a aprobar |
| No usar iframe | CUMPLIDO | Redirección POST | — |
| Respaldos fuera de la ubicación principal | PENDIENTE | `backup` existe y funciona; sin programación ni copia externa | Titular: infraestructura (§14 expediente) |
| Escaneos trimestrales, WAF/IPS, auditoría anual | NO CUBIERTO | Sin evidencia | Titular: decidir alcance |
| No validar `vci` | CUMPLIDO | No se usa | — |

## C. Casos de prueba (nuestra matriz; la oficial no es conocida)
| Requisito | Estado | Evidencia | Acción pendiente |
|---|---|---|---|
| VISA aprobada / Mastercard rechazada | CUMPLIDO | Casos 1–2 | — |
| AMEX aprobada | CUMPLIDO | Caso 3 | — |
| Redcompra aprobada / rechazada | CUMPLIDO | Casos 4, 5 (las dos tarjetas aprobadas publicadas) y 6 | — |
| Prepago aprobada / rechazada | CUMPLIDO | Casos 7–8 | — |
| Cuotas | CUMPLIDO | Caso 9 (3 cuotas); anulación parcial en cuotas: rechazo local (no real) | Preguntar a Transbank (error 53) |
| Cancelación y reintento | CUMPLIDO | Casos 10–11 | — |
| Timeout real del formulario | CUMPLIDO (con observación) | Caso 12: retorno real sin parámetros, resuelto por expiración por antigüedad + `status`; captura `f5-timeout-formulario-webpay.png` | Opcional: tratar el retorno sin parámetros como abandono; confirmar con Transbank si ocurre igual en producción |
| Expiración por abandono | CUMPLIDO | Caso 13 (11 min, `status` previo) | — |
| Consulta de estado / commit repetido / token inválido | CUMPLIDO | Casos 15–17 (HTTP 422 real) | — |
| Doble intento, retorno incompleto/inválido | CUMPLIDO | Casos 18–20 (local) | — |
| Devoluciones parcial, resto, REVERSED, idempotencia | CUMPLIDO | Casos 24–28 (reales y locales) | — |
| Fallo de comunicación / fallo temporal de Transbank | PARCIAL | Solo mock (caso 22); no inducible en el ambiente oficial | Declarar como «cubierto con mock» |
| Error «volver al sitio» | BLOQUEADO | Solo reproducible en producción | Verificar en la compra de $50 |
| Casos exactos del formulario oficial | NO VERIFICADO | Formulario sin responder (una pregunta por pantalla) | Titular: leerlo cuando lo abra |

## D. Seguridad, datos y operación
| Requisito | Estado | Evidencia | Acción pendiente |
|---|---|---|---|
| Monto calculado en el servidor, orden única, un solo pago autorizado | CUMPLIDO | Índice `attempts_one_authorized`; casos 20–21 | — |
| Nunca pagar por el solo retorno del navegador | CUMPLIDO | `handleReturn`; token inválido sin efecto | — |
| Logs sin datos sensibles | PARCIAL | Log de pagos limpio; `token_ws` visible en el log de desarrollo de Next (protocolo) | Verificar logs de producción/túnel |
| Devoluciones solo con autenticación y permiso | CUMPLIDO | Casos 30; `adminRefunds` apagado por defecto | — |
| Pagos apagados e invisibles en producción | CUMPLIDO | `paymentsEnabled()` falla cerrado; `ONLINE_CHECKOUT_UI=false`; Webpay no se activó | — |
| Persistencia: integridad, respaldo, restauración, migraciones | CUMPLIDO (local) | `check` y `backup` re-verificados; migración v3 | — |
| Persistencia productiva (volumen, `payments.json`, respaldos) | PENDIENTE | Propuesta en `ACTIVACION-WEBPAY.md` §5 | Autorización de infraestructura + `accept-compose` |
| Réplica única, `node:sqlite` experimental, sin conciliación en segundo plano, límite en memoria | RIESGO ACEPTADO | `PAGOS-SQLITE.md` | Decisión del titular |

## E. Legal y comercial
| Requisito | Estado | Evidencia | Acción pendiente |
|---|---|---|---|
| Términos, devoluciones, soporte, servicios digitales | PENDIENTE | 4 borradores con 22 campos sin completar; 404 en producción | Titular: decisiones D1–D13 + asesor legal |
| Política de privacidad | PENDIENTE | No existe | Titular: encargar redacción |
| ¿Transbank exige textos legales visibles? | NO VERIFICADO | Sin texto oficial | Preguntar a Soporte (borrador de correo) |
| Mensaje de la casilla de `/contratar` | CUMPLIDO | Corregido; prueba 17b | — |
| Aceptación de términos en el pago | PENDIENTE | No existe casilla propia | Decisión D10 |

## F. Afiliación
| Requisito | Estado | Evidencia | Acción pendiente |
|---|---|---|---|
| Estado de afiliación `1-12087316724` | NO VERIFICADO | Sin respuesta de Transbank leída | Titular: confirmar con Transbank |
| Modalidad Webpay Plus REST simultánea | NO VERIFICADO | Contrato no leído | Confirmar con Soporte |
| Cuenta de abono de una SpA con cuenta personal del representante | NO VERIFICADO | Sin fuente oficial vigente | Pregunta concreta en el borrador de correo |
| Documentos pendientes de afiliación | NO VERIFICADO | — | Preguntar a Transbank |
