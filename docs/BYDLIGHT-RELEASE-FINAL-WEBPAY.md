# Release final: cierre comercial y preparación de Webpay Plus (2026-11-06)

Estado: **todo en local. Sin push, sin despliegue, sin activar pagos públicos, sin transacciones reales, sin correos reales.** Producción sigue en `530b95c645fff70b3a2385fbc1ca4c41fe09d423` con pagos cerrados al público (modo piloto), `adminRefunds=false`; `payments.json` y credenciales no se tocaron; la orden histórica `3SJR79AE5RX8` no se alteró. Complementa `docs/BYDLIGHT-CIERRE-LEGAL-Y-DEPLOY.md`. Los textos legales son redacción técnica, **no asesoría ni certificación jurídica**.

## 1. Decisiones comerciales implementadas
| Decisión del titular | Implementación |
|---|---|
| Datos de la sociedad (razón social, RUT 78.161.844-6, domicilio, giro) | `src/lib/company.ts`; pie, contacto, términos, privacidad, comprobante, correos. El RUT personal del solicitante y el código de comercio no se publican (prueba automática). |
| Correo oficial `bydlightsolutions@gmail.com` | `SITE.email` y remitente/avisos de los correos. `contacto@…` ya no aparece en el código (prueba R16). |
| **Todos los precios incluyen IVA** | Etiquetas «IVA incluido» en planes, servicios, formulario, SEO y términos; ninguna suma de IVA en el sistema. |
| Personas y empresas | Selector en el formulario; datos tributarios solo para empresas. |
| Nombre «Bydlight Solutions SpA» | Documentos legales, comprobante y correos. La marca visual (logo, «Byd Light Solutions» en el pie/SEO) no se tocó. |
| Condiciones generales equilibradas | Términos ampliados (§5 abajo), sin cifras inventadas; lo específico va en la cotización. |

## 2. Cambios realizados (resumen técnico)
- **IVA:** `src/lib/tax.ts` (`ivaBreakdown`, `splitDeposit`), usado por `approveQuote`; la cotización muestra «IVA incluido (19 %)».
- **Migración 4** (solo agrega): columnas de tipo de cliente y tabla `mail_outbox`. Las órdenes existentes quedan como «persona».
- **Formulario y servidor:** `parseSolicitud` valida RUT (módulo 11) para empresas; persona natural no guarda datos de empresa.
- **Correos:** `src/lib/mail/*` (cola, transporte Gmail OAuth2, plantillas, notificador) + `src/instrumentation.ts` (despachador, inactivo sin configuración).
- **Monitoreo:** `src/lib/payments/monitor.ts`; nuevas comprobaciones de auditoría; acciones administrativas `monitor`, `mail-status`, `mail-dispatch`, `mail-test`, `customer-data`.
- **Scripts:** `scripts/mail-config-set.mjs`; `admin-remote.mjs` ampliado. `TERMS_VERSION` = `borrador-2026-11-06-r3`.
- **Documentos:** `CORREOS-TRANSACCIONALES`, `SII-PROCEDIMIENTO-PROPUESTO`, `PRIVACIDAD-MATRIZ-CONSERVACION`, `CONCILIACION-Y-MONITOREO`.
- No cambió la lógica de Webpay (inicio, commit, estados, idempotencia, índice único anti doble pago).

## 3. Estado del servicio de correos
Implementado y probado con transporte falso (18 pruebas del release, ninguna envía correo real). **REQUIERE CONFIGURACIÓN:** proyecto de Google Cloud, cliente OAuth y refresh token de `bydlightsolutions@gmail.com`, `mail.json` en el servidor y prueba con `mail-test`. Sin eso, no se encola ni envía nada y los pagos funcionan igual. Detalle y alternativas (proveedor transaccional con dominio propio): `docs/CORREOS-TRANSACCIONALES.md`. Correos: solicitud (cliente y titular), cotización, contratación confirmada (art. 12 A), pago autorizado con comprobante, rechazo, saldo habilitado, alertas. Garantías: idempotencia, cola persistente, reintentos controlados, el fallo del correo no revierte ni duplica pagos, solo se envía tras el estado real.

## 4. Verificación del IVA
Flujo Plan → Cotización → Anticipo → Webpay → Comprobante: el monto de la cotización es el **total final con IVA**; el anticipo es `round(total × %)` y el saldo la diferencia exacta; Transbank recibe exactamente el anticipo guardado (prueba R3 con 100.001, 149.990, 99.999 y 333.333); neto + IVA = total para todo total de 0 a 5.000 (R1) y desglose `neto = round(total/1,19)` (R1/R2). El desglose es informativo, no un documento tributario. **Los números de los planes no cambiaron** (por ejemplo 149.990 ahora incluye IVA; antes era «+ IVA»): decisión del titular, con impacto en el neto percibido. No se recalcularon cotizaciones ni órdenes históricas; la auditoría marca `COTIZACION_REDONDEO` si alguna difiere del cálculo estándar.

## 5. Formularios, documentos legales y cláusulas
- Formulario: persona natural (sin datos extra) o empresa (razón social y RUT obligatorios; giro y dirección opcionales). Verificado sin desborde a 1440/390/320 px.
- Páginas legales (ocultas en producción, `LEGAL_PAGES_PUBLISHED=false`): términos, cancelación/retracto/devoluciones, privacidad (con Gmail y datos de empresa), información comercial, servicios digitales, soporte. Sin marcadores `[PENDIENTE]`.
- **Cláusulas que redacté y requieren su aprobación antes de publicar** (en `/terminos`): aprobaciones por escrito o por vencimiento del plazo de revisión; propiedad intelectual (uso de entregables a medida tras el pago, Bydlight conserva sus herramientas y componentes reutilizables, referencia solo con autorización); dominios y cuentas a nombre del cliente cuando sea posible; soporte y mantenimiento no incluidos salvo cotización; garantía según la cotización sin plazo inventado; retracto y evaluación del trabajo ejecutado (`/devoluciones`).

## 6. Tributario (SII)
Ver `docs/SII-PROCEDIMIENTO-PROPUESTO.md`: lo verificado, lo no verificado y las preguntas al contador. **Requisito previo a la apertura pública:** modelo de emisión declarado, si el voucher actúa como boleta, cómo se factura a empresas y tratamiento del anticipo. No se emite ningún documento automáticamente ni se afirma que el comprobante sea boleta o factura.

## 7. Conciliación
Ver `docs/CONCILIACION-Y-MONITOREO.md`: `monitor` (solo lectura) implementado y probado; programación **sin instalar** (requiere autorización para configurar el servidor). El resto de las garantías (índice único contra doble pago, `reconcile`) sigue igual.

## 8. Privacidad
Ver `docs/PRIVACIDAD-MATRIZ-CONSERVACION.md`: datos reales, finalidades, proveedores, matriz de plazos **propuesta** (solo el plazo tributario de 6 años tiene fuente), exportación `customer-data`. Sin purgas. **Ley 21.719:** sigue vigente el 01-12-2026, pero un proyecto de postergación pasó al Senado y, según fuentes secundarias, fue aprobado en primer trámite el 28-10-2026 (pendiente en la Cámara); no se pudo verificar en fuentes oficiales: confirmar antes de publicar.

## 9. Pruebas ejecutadas (2026-11-06)
`tsc` limpio · ESLint `src scripts tests` limpio · `npm test` **99/99** (81 previas + 18 nuevas R1–R18; una prueba previa se actualizó por los campos nuevos) · build correcto · `verify:prod` 36/36 · `verify:pilot` 32/32 · formulario de contratación sin desborde (1440/390/320) · búsqueda de secretos y de datos personales del solicitante sin hallazgos en `src`, `scripts` y `tests` · `git diff --check` sin errores de espacios. `npm run lint` completo sigue fallando por la carpeta ajena `bydlightredes/` (no modificada). El build muestra una advertencia de tracing de Turbopack (el modo standalone incluye `demos/`); no afecta al funcionamiento; no se comprobó si ya existía antes de estos cambios.

## 10. SHA final del release
**Commit local de código del release: `41b4c0bac3237e408cad1e80140b6f4f3b26947a`** (rama `feature/rediseno-2026`, sin push). Un commit posterior solo de documentación no cambia el código; el SHA a desplegar es el del último commit que usted autorice publicar (confírmelo con `git rev-parse HEAD`). HEAD de partida: `1b2442d55776b256d67b8e5325bcc5cb5119295a` (SHA de código del cierre legal: `a44f90186cb88239b0e77ebd30c61df570952ca8`).

## 11. Requisitos pendientes
1. Configurar el correo (§3) y probar con `mail-test`.
2. Confirmar en el panel de EmailJS que el formulario de contacto envía a `bydlightsolutions@gmail.com`.
3. Respuesta del contador/SII (§6).
4. Aprobar las cláusulas (§5), la matriz de conservación y el texto de retracto (revisión de abogado recomendada).
5. Verificar el estado oficial del boletín 18.623-07.
6. Decidir el porcentaje de anticipo por defecto (hoy 50 %) y la vigencia de las cotizaciones.
7. Programar `monitor` (opcional, recomendado).

## 12. Procedimiento de despliegue (Etapa A: publicación técnica con pagos públicos cerrados; la ejecuta el titular)
Compose no cambia, no hay `accept-compose`. **La migración 4 se aplica sola al primer acceso a la base**: es solo aditiva, pero haga primero un respaldo.
```
SHA=<SHA_FINAL_DE_40_CARACTERES>          # el que se registre en §15 tras su autorización de push
sudo bd-run status ; sudo bd-run list-releases
# respaldo previo (runbook docs/DESPLIEGUE-WEBPAY-UBUNTU.md §6.7: orders-admin.mjs backup)
sudo bd-run fetch $SHA ; git -C /srv/bydlight-prod/app rev-parse HEAD     # debe ser $SHA
sudo bd-run preflight ; sudo bd-run compose-diff                          # sin cambios de Compose
sudo bd-run build $SHA ; sudo bd-run job-status <ID>                      # repetir hasta OK
sudo bd-run up $SHA ; sudo bd-run verify ; sudo bd-run status
```
Esperado en Etapa A: `/` 200, `/contratar` y solicitudes cerradas al público (acceso solo por enlace piloto), páginas legales 404, `/vista-previa` 404, correo apagado (sin `mail.json`), pagos públicos cerrados. Comprobar después `admin-remote.mjs audit` y que la orden histórica sigue intacta.

## 13. Procedimiento de activación pública (Etapa B; solo con su autorización expresa)
Prerrequisitos: §11 completos, respaldo vigente, rollback ensayado, correo probado, `audit` sin hallazgos altos.
1. Código: `TERMS_VERSION` definitiva (fecha de aprobación, sin «borrador»), `LEGAL_PAGES_PUBLISHED=true`, `ONLINE_CHECKOUT_UI=true`, decisión de indexación; actualizar `verify-prod-lockdown`/`verify-prod-pilot` y las pruebas L3/G7 (hoy exigen páginas ocultas y banderas en false); pruebas, build, commit, push y despliegue con §12.
2. `payments-config-set.mjs /data/config/payments.json enabled=true access=public` (efecto ≤ 5 s) y `mail-config-set.mjs /data/config/mail.json enabled=true` si el correo ya se probó.
3. Compra mínima autorizada por usted (cotización de $100 con anticipo 50 %) + `audit` + revisión del correo recibido.
4. Vigilancia 48 h con `monitor`/`audit`/`reconcile`.

## 14. Rollback
Inmediato, sin redeploy: `payments-config-set.mjs … enabled=false` o `access=pilot`; `mail-config-set.mjs … enabled=false`. De código: `sudo bd-run rollback` (versión anterior estable `530b95c…`), luego `verify` y `status`. La migración 4 es aditiva: el código anterior sigue funcionando con la base migrada (las columnas y la tabla nuevas se ignoran). Nunca `down -v` ni borrar el volumen; restaurar el respaldo solo ante corrupción.

## 15. Registro del release
- Código: `41b4c0bac3237e408cad1e80140b6f4f3b26947a`. Sin push ni despliegue realizados.
