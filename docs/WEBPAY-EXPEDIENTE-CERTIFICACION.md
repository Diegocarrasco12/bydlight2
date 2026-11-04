# Webpay Plus — expediente técnico para validación con Transbank

Versión: Fase 5 · fecha: **2026-11-04** · rama `feature/rediseno-2026` (sin commit de esta fase) · producción: sitio en `5fef157`, **Webpay apagado e invisible**.
Este expediente **no es una certificación ni una aprobación**: la validación solo puede otorgarla Transbank. Todo resultado de este documento ocurrió en el **ambiente de integración** (`webpay3gint.transbank.cl`, credenciales públicas de pruebas, sin dinero). Los casos con doble del SDK se rotulan «mock»; no se presentan como resultados oficiales. Documentos relacionados: `WEBPAY-CHECKLIST-CERTIFICACION.md`, `WEBPAY-REQUISITOS-OFICIALES.md`, `EVIDENCIAS-INTEGRACION-WEBPAY.md`, `WEBPAY-PROPUESTAS-LEGALES.md`, `WEBPAY-CORREO-CERTIFICACION.md`, `PAGOS-SQLITE.md`, `ACTIVACION-WEBPAY.md`.

## 1. Identificación del proyecto
| Dato | Valor |
|---|---|
| Comercio | Byd Light Solutions SpA (ingeniería y desarrollo de software, Chile) |
| Sitio | https://bydlightsolutions.com |
| Seguimiento / afiliación Transbank | `1-12087316724` (estado actual y código de comercio productivo: **no verificados**, ver §13) |
| RUT de la sociedad | **No consta en el repositorio** (completar por el titular) |
| Repositorio | `Diegocarrasco12/bydlight2` |
| Pila | Next.js 16 · React 19 · TypeScript · Node ≥ 22.13 (`node:sqlite`) · SDK `transbank-sdk` 6.1.1 (versión fijada) |
| Servicio vendido | Anticipo (y saldo) de un proyecto de software previamente **cotizado y aprobado** por Bydlight |

## 2. Modalidad de integración
- **Webpay Plus, captura simultánea, API REST**, integración propia con el SDK oficial para Node.js. No es plugin ni Mall ni captura diferida.
- Formulario de validación correspondiente (según transbankdevelopers.cl): «Webpay Plus, Webpay Plus Mall y OneClick Mall con SDK o API directa» → `https://form.typeform.com/to/ibXdg6Av` (ver `WEBPAY-REQUISITOS-OFICIALES.md` §3).
- Ambiente: la configuración elige integración o producción explícitamente (`src/lib/payments/config.ts`). Integración usa `IntegrationCommerceCodes.WEBPAY_PLUS` e `IntegrationApiKeys.WEBPAY` del SDK; producción exige código y llave en la configuración del servidor y **falla cerrado** si faltan.

## 3. Arquitectura
| Capa | Archivo | Función |
|---|---|---|
| Rutas HTTP | `src/app/api/pagos/{iniciar,retorno/[orderId],verificar}`, `api/solicitudes`, `api/admin` | Entradas públicas (solicitud, inicio, retorno, verificación) y administrativa firmada |
| Dominio | `src/lib/payments/service.ts` | Solicitudes, cálculo de monto, `startPayment`, `handleReturn`, `verifyOrder`, conciliación |
| Devoluciones | `refunds.ts` | Anulación total/parcial, idempotencia, estados inciertos |
| Comprobante | `voucher.ts` | Datos del comprobante propio |
| Persistencia | `db.ts`, `store.ts`, `migrations.mjs` | SQLite con restricciones, transacciones, migraciones con checksum |
| Configuración | `config.ts`, `availability.ts` | Variables de entorno o `payments.json` (0600); política única `paymentsEnabled()` |
| Seguridad admin | `adminAuth.ts`, `adminOps.ts`, `http.ts` | HMAC, nonce, mismo origen, límites |
| Páginas | `src/app/orden/[id]/page.tsx` (+ `ContractForm`) | Estado de la orden, botón de pago, comprobante |

Todo el código que toca Transbank y las credenciales es `server-only`: nada de eso llega al navegador. **Una sola réplica** (bloqueo por orden en el proceso + índices únicos en la base como segunda barrera).

## 4. Flujo de pago
1. **Solicitud** (`/contratar` → `/api/solicitudes`): crea una orden `SOLICITADA` con código de 12 caracteres aleatorios. No hay cobro.
2. **Cotización aprobada** (solo por operación administrativa autenticada): fija total, anticipo y vigencia. El cliente **no tiene ninguna ruta** que cree o cambie un monto.
3. **Anticipo**: `POST /api/pagos/iniciar` ignora cualquier monto del navegador; calcula el importe desde la cotización guardada, crea un `buy_order` único (`BL<id>-NN`, 17 car.), llama `create` de Transbank y entrega un formulario auto-enviado con `token_ws`.
4. **Pago en Webpay** (tarjeta, autenticación bancaria).
5. **Retorno** (`GET /api/pagos/retorno/<orden>`): se identifican los cuatro formatos documentados. Con `token_ws` se hace `commit` **una sola vez** desde el servidor. **Nunca** se marca pagado por el solo retorno del navegador.
6. **Evaluación**: pagado solo si `status = AUTHORIZED`, `response_code = 0` y coinciden `buy_order`, `session_id` y monto.
7. **Confirmación y comprobante**: la página de la orden muestra el comprobante propio (orden, comercio, monto, moneda, fecha, estado, autorización, tipo de pago, cuotas, tarjeta •••• últimos 4, descripción).
8. **Saldo**: se habilita desde la misma página cuando la administración lo decide; mismo flujo con `kind = saldo`.

## 5. Manejo de estados
Intento (`attempts.status`): `INICIADO` → `AUTORIZADO` | `RECHAZADO` | `CANCELADO` | `EXPIRADO` | `PENDIENTE` | `ERROR`.
- `PENDIENTE` = resultado desconocido (falló la red o el commit). **Bloquea nuevos cobros** hasta resolverse; se concilia con `status`, nunca con un segundo `commit`.
- `ERROR` = revisión manual (retorno inválido, cierre tras 7 días sin resolución).
- Abandono: ventana propia de **11 min en integración / 6 en producción** (Transbank: formulario 10/4 min) con consulta de estado previa antes de liberar la orden.
- Devolución (`refunds.status`): `COMPLETADA` | `INCIERTA` | `FALLIDA`, con conciliación por `status`.
- Protecciones en la base: un único pago autorizado por orden y tipo (índice único parcial `attempts_one_authorized`), `buy_order` y `token` únicos, eventos solo-agregar.

## 6. Matriz de pruebas (clasificada)
**La matriz oficial de Transbank NO está verificada** (ver `WEBPAY-REQUISITOS-OFICIALES.md` §3): el formulario público solo muestra su pantalla de bienvenida sin responderlo; no hay lista publicada de casos obligatorios. La matriz de abajo es **la nuestra**, construida desde las tarjetas y flujos publicados. Clase: **O** = exigido por la documentación como comportamiento del comercio (retornos, monto/orden, comprobante); **R** = recomendada; **C** = complementaria (propia).
Resultado: PASS / FAIL / BLOCKED / N/A. «Real» = contra servidores de integración de Transbank; «Local» = código real del servidor con peticiones propias, sin respuesta oficial; «Mock» = doble del SDK.

| # | Caso | Clase | Tipo | Resultado | Esperado / observado |
|---|---|---|---|---|---|
| 1 | VISA aprobada | O | Real | **PASS** | Aprobada, autorización `1213`, comprobante completo (Fase 2) |
| 2 | Mastercard rechazada | O | Real | **PASS** | Rechazada, sin cobro, reintento posible (Fase 2) |
| 3 | AMEX aprobada | R | Real | **PASS** | `BLBPEQAZ63DGYG-01`, autorización `1617`, `•••• 2032` |
| 4 | Redcompra aprobada (4051 8842 3993 7763) | R | Real | **PASS** | `BLSAJCS7U9SSCY-01`, autorización `1415`, «Débito (Redcompra)», sin vencimiento ni CVV |
| 5 | Redcompra aprobada, segunda tarjeta publicada (4511 3466 6003 7060) | R | Real | **PASS** | `BL6KVFUFYQ9JXT-01`, autorización `1819`, «Débito (Redcompra)» |
| 6 | Redcompra rechazada | R | Real | **PASS** | `BL5NW6VEMXR4GB-01`, `FAILED`, orden sin pagar |
| 7 | Prepago VISA aprobada | R | Real | **PASS** | `BLPPUZ67XUGRXH-01`, autorización `3122`, tipo «Prepago» |
| 8 | Prepago Mastercard rechazada | R | Real | **PASS** | `BLXAAVGDVSKZ5V-01`, `FAILED`, sin cobro |
| 9 | Pago en cuotas (VISA, 3 cuotas) | R | Real | **PASS** | `BLS4YPVFDPBMWP-01`, autorización `1213`, 3 cuotas de $16.667, tipo `SI` |
| 10 | Cancelación por el usuario | O | Real | **PASS** | `BLRWS5HKS4SGDN-01` `CANCELADO`; Transbank `status` = `INITIALIZED` (sin cobro). Repetido en Fase 2 |
| 11 | Reintento tras cancelación | C | Real | **PASS** | `BLRWS5HKS4SGDN-02` aprobada |
| 12 | Timeout real del formulario (formulario abierto sin pagar ~10 min) | O | Real | **PASS (con observación)** | Webpay abortó el formulario («Tu transacción no se pudo llevar a cabo. Ningún cargo fue realizado»); al pulsar «Intentar nuevamente» volvió a `/api/pagos/retorno/<orden>` **sin ningún parámetro** (la documentación dice `TBK_ORDEN_COMPRA` y `TBK_ID_SESION`). El intento `BLJ8UJJTY2FQSQ-01` pasó a `EXPIRADO` por antigüedad tras consultar `status` (`INITIALIZED`); el cliente vio «Pago expirado… No se realizó ningún cobro». Captura `f5-timeout-formulario-webpay.png` |
| 13 | Expiración por abandono (ventana propia de 11 min) | O | Real + Local | **PASS** | `BLNHQH7QDUD4YN-01`: nuevo pago bloqueado dentro de la ventana; a los 11 min la visita consultó a Transbank (`INITIALIZED`) y pasó a `EXPIRADO` |
| 14 | Retorno de timeout (sintético) | O | Local | **PASS** | `TBK_ORDEN_COMPRA`+`TBK_ID_SESION` sin token → `EXPIRADO` |
| 15 | Consulta de estado (`status`) | O | Real | **PASS** | Aprobado/anulado → `NULLIFIED`; rechazado → `FAILED` (-1); sin pagar o cancelado → `INITIALIZED` |
| 16 | Confirmación (commit) | O | Real | **PASS** | 10 pagos reales confirmados una vez cada uno (7 aprobados, 3 rechazados); un segundo `commit` directo (sondeo con el SDK) devuelve el estado vigente, sin error |
| 17 | Token inválido | O | Real + Local | **PASS** | Transbank: `commit`/`status`/`refund` con token falso → **HTTP 422** «Invalid value for parameter: token». Nuestro retorno con token desconocido no cambia ningún estado |
| 18 | Retorno incompleto / sin parámetros | O | Local | **PASS** | Sin cambio de estado, redirige a la orden |
| 19 | Retorno inválido (`token_ws` + `TBK_TOKEN`) | O | Local + Mock | **PASS** | Con token desconocido no cambia nada; con token propio → `ERROR` (mock) |
| 20 | Intento duplicado | O | Local | **PASS** | Pago ya aprobado → `?aviso=sin-pago`; intento abierto → `?aviso=en-curso`; **no se crea un segundo cobro** |
| 21 | Monto manipulado | O | Local + Mock | **PASS** | Enviar `amount=1` es ignorado (intento por $50.000); respuesta con monto distinto → no aprobada (mock) |
| 22 | Respuesta incierta / fallo de comunicación | O | Mock | **PASS (mock)** | Commit y `status` fallan → `PENDIENTE`, sin segundo commit; recuperación posterior. **Transbank real no permite provocar este fallo** |
| 23 | Fallo temporal de Transbank | R | — | **BLOCKED** | No inducible en el ambiente oficial; cubierto solo con mock (caso 22) |
| 24 | Devolución parcial | R | Real | **PASS** | AMEX: $10.000 → `NULLIFIED`, saldo 40.000 (autorización `135048`). Antes en VISA |
| 25 | Devolución del resto | R | Real | **PASS** | AMEX: $40.000 → saldo 0 (`116072`) |
| 26 | Devolución total mismo día (REVERSED) | R | Real | **PASS** | Cuotas y Redcompra: `type = REVERSED` |
| 27 | Misma operación de devolución repetida | R | Real | **PASS** | Misma clave → `replayed: true`, **sin** segunda llamada a Transbank |
| 28 | Devolución superior al saldo / sobre pago agotado / sobre pago rechazado | R | Local | **PASS** | «El monto excede lo disponible», «ya fue devuelto en su totalidad», «No hay un pago autorizado» |
| 29 | Devolución parcial en cuotas | R | **Local** | **PASS (validación local)** | Se rechaza **antes** de llamar a Transbank (error 53 documentado). **No** es una respuesta real de Transbank |
| 30 | Acceso no autorizado a devoluciones | C | Mock | **PASS (mock)** | 404 sin secreto, 401 sin firma/alterada, 403 sin permiso `adminRefunds` |
| 31 | Reinicio / persistencia | C | Mock + Local | **PASS** | Pruebas R7/S1; respaldo y chequeo de integridad del servidor de pruebas |
| 32 | Error «volver al sitio» (`token_ws`+`TBK_TOKEN`, solo producción) | O | — | **BLOCKED** | Solo reproducible en producción (documentación) |
| 33 | Compra real de $50 en producción | O | — | **BLOCKED** | Requiere código de comercio productivo y llave |
| 34 | AMEX/otras tarjetas **no publicadas** | — | — | **N/A** | No se prueba con tarjetas distintas de las publicadas |

Conteo de los 34 casos: **30 PASS** (incluye los rotulados «mock», «local» y «validación local»), **3 BLOCKED** (23, 32, 33), **1 N/A** (34), 0 FAIL, 0 sin ejecutar. «Casos oficiales aprobados» no existe como término: Transbank no ha publicado una lista oficial. Lo verificable es: **12 casos reales de pago (1–12), 4 de devolución real (24–27) y 3 de consulta/commit/token (15–17), todos contra el ambiente de integración, PASS**; el resto son locales o mock y están rotulados.

**Observación sobre el timeout (caso 12):** en integración el retorno tras el timeout llegó sin parámetros, distinto de lo documentado. El sistema lo tolera porque no depende de ese retorno: expira por antigüedad (11 min en integración, 6 en producción) y consulta `status` antes de liberar. Efecto de UX: entre el timeout de Webpay (10 min integración / 4 producción) y la ventana propia (11 / 6) el cliente que vuelve ve «Pago en curso» hasta 1–2 min. Propuesta (no aplicada, cambia el flujo): tratar un retorno sin parámetros como señal de abandono y consultar `status` de inmediato.

## 7. Resultados ejecutados (resumen)
- `npm test`: **41/41** (40 existentes + 1 nueva de regresión del mensaje de la casilla, 17b). `npx tsc --noEmit`, `npm run lint`, `npm run build`: ver §15.
- Sondeo directo con el SDK contra integración: `commit` repetido (devuelve estado vigente), `status` (3 estados) y token falso (HTTP 422) en `commit`, `status` y `refund`.
- Revisión del servidor de pruebas: 15 órdenes, integridad de la base `ok`, claves foráneas `ok`, migración v3, respaldo con `VACUUM INTO` verificado.
- Correcciones de esta fase: mensaje de la casilla de `/contratar` (ver `WEBPAY-PROPUESTAS-LEGALES.md` §5). Ningún cambio en lógica de pagos, devoluciones ni contratos financieros.

## 8. Evidencias
Capturas en `docs/evidencias-webpay/` (viewport móvil): Fase 2 `01–04`; Fase 5: `f5-redcompra-aprobada-comprobante`, `f5-redcompra-rechazada`, `f5-prepago-visa-aprobada`, `f5-prepago-mc-rechazada`, `f5-visa-3-cuotas-aprobada`, `f5-cancelado-por-usuario`, `f5-reintento-tras-cancelacion-aprobado`. Logo para el formulario: `logo-130x59.png`. Tabla con orden de compra, autorización y salida de cada devolución en `EVIDENCIAS-INTEGRACION-WEBPAY.md` §3b. **Zona horaria:** las fechas de la base están en UTC; la hora de Chile en noviembre es UTC−3 (importante al contrastar con los registros de Transbank). Las órdenes de prueba viven en una base temporal desechable (no en el repositorio); lo que queda como evidencia son las capturas y este registro.

## 9. Devoluciones y anulaciones
- Solo por la **API administrativa firmada** (`POST /api/admin`, acción `refund`); no existe botón ni endpoint público. Exige: secreto ≥ 32 caracteres, firma HMAC-SHA256 con ventana de 60 s y nonce de un solo uso, mismo permiso `adminRefunds` (**apagado por defecto**), clave de idempotencia de 16–64 caracteres.
- Valida monto > 0, no mayor al saldo devolvible y que exista un pago autorizado; un pago en cuotas solo admite devolución total (validación local previa al error 53).
- Auditoría: cada devolución queda en `refunds` y en `events` (solo-agregar), con quién la pidió.
- Estado incierto (error de red o respuesta no concluyente): `INCIERTA`, sin reintentar a ciegas; se concilia con `status`. Una devolución abierta bloquea otra sobre el mismo pago (concurrencia probada, R6).
- **Real**: parcial, resto, total mismo día (`REVERSED`), repetición idempotente. **No probado contra Transbank**: ventana de anulación vencida (error 284, plazo no publicado), `INCIERTA` real (no inducible), devoluciones sobre cuotas parciales (rechazadas localmente antes de llamar).

## 10. Seguridad
- Credenciales de producción: solo en el servidor (`payments.json` 0600 en `/data/config`, o variables), nunca en Git ni en la imagen; `server-only`. Integración usa credenciales públicas del SDK.
- No se guarda número de tarjeta ni CVV; solo últimos 4 dígitos, autorización y estado. Verificado en el log del servidor de pruebas: sin tarjetas, sin secreto administrativo ni claves de idempotencia; los eventos registran solo ids de orden y `buy_order`.
- **Observación:** el `token_ws` aparece en la línea de petición del log de **desarrollo** de Next (`GET …/retorno/<id>?token_ws=…`). Es inherente al protocolo (Webpay vuelve por GET con el token) y por sí solo no permite cobrar ni devolver sin credenciales. Verificar que producción (`next start`, Cloudflare Tunnel) no persista query strings en logs de larga duración.
- Protección de acceso: mismo origen en POST, límite de solicitudes por IP **en memoria** (se reinicia con el proceso; no se comparte entre réplicas), campo trampa anti-bot, `Cache-Control: no-store`, `noindex`, `Referrer-Policy: same-origin`, página de orden con código de 12 caracteres (≈59 bits) y límite de consultas.
- Pagos apagados por defecto en producción (`paymentsEnabled()` falla cerrado); sin configuración no se abre ninguna base ni archivo.
- Recomendaciones oficiales de seguridad (escaneos trimestrales, WAF, auditoría anual): **no implementadas por el proyecto**; ver §13.

## 11. Persistencia (SQLite)
- `node:sqlite` (integrado en Node ≥ 22.13; **experimental**: emite aviso), WAL, `synchronous=FULL`, claves foráneas, `busy_timeout`; escritura de cada orden en transacción `BEGIN IMMEDIATE`; restricciones `CHECK`/únicos en la base (montos, estados, un pago autorizado por orden y tipo, saldo = total − anticipo).
- Migraciones versionadas con checksum (hoy v3); la app se niega a arrancar si una migración aplicada fue alterada. Migración 3 probada con datos existentes (S1).
- Respaldo `VACUUM INTO` (consistente en caliente) y restauración con copia previa: `scripts/orders-admin.mjs backup|restore|check` — **respaldo y chequeo re-verificados hoy** sobre la base de pruebas (`integridad: ok | claves foráneas: ok | migración: v3`). No hay respaldo automático programado (ver §14).
- Volumen esperado: bajo (decenas de órdenes). Concurrencia: bloqueo por orden en el proceso (válido con una sola réplica) + restricciones de la base; sin tarea de conciliación en segundo plano (la conciliación ocurre al visitar la orden o por la acción administrativa `reconcile`).
- Permisos: archivo 0600, directorio 0700, usuario `node` (uid 1000).

## 12. Manejo de errores
Errores de red o respuestas inciertas nunca se tratan como éxito ni rechazo supuesto. El SDK 6.1.1 lanza errores con mensaje de texto (sin código HTTP; ej. HTTP 422 viene como «Request failed with status code 422 / Invalid value for parameter: token»); por eso la decisión se toma con `status`, no con el tipo de error. Mensajes al cliente: rechazado, cancelado, en curso, vencido y error, sin datos sensibles.

## 13. Pendientes
**Externos / del titular (bloquean la solicitud formal):**
1. **Afiliación con código de comercio productivo**: Transbank solo valida con él (verificado en su documentación). Estado de `1-12087316724` sin confirmar.
2. **Formulario de validación**: campos y casos exigidos sin verificar (§6); el titular debe abrirlo y completarlo (no se hizo en su nombre).
3. **Cuenta de abono** de una SpA con cuenta del representante: pregunta a Soporte (no verificada oficialmente).
4. **Logo 130×59 px**: preparado; aprobar o reemplazar.
5. **22 decisiones legales** y página de privacidad (`WEBPAY-PROPUESTAS-LEGALES.md`); opinión sobre retracto.
6. **HTTPS público**: el dominio responde HTTP 200 hoy (Cloudflare «Always Use HTTPS» sin activar; requiere al titular).
**Técnicos (propuestas, no aplicadas):**
7. En el flujo abortado, consultar `status` con `TBK_TOKEN` antes de marcar `CANCELADO` (práctica indicada por la documentación; riesgo actual nulo, verificado).
8. Conciliación en segundo plano (hoy ocurre al visitar la orden).
9. Evaluar alternativa al módulo experimental `node:sqlite` si el volumen o la política lo exigen.
10. Respaldos programados y fuera del servidor.

## 14. Requisitos para producción (infraestructura — no aplicada, requiere autorización)
- Volumen persistente `/data` (dueño uid/gid 1000) y `/data/config/payments.json` 0600 (código, llave, `publicBaseUrl`, `adminSecret`; `enabled:false` hasta la compra de $50). Cambios de Dockerfile/Compose y política del ejecutor + `accept-compose` humano: detalle exacto en `ACTIVACION-WEBPAY.md` §5. **No se tocó Docker ni se desplegó.**
- Respaldos diarios con `backup`, retención definida, copia cifrada fuera del servidor; el respaldo contiene datos personales.
- Una sola réplica. Node ≥ 22.13 en la imagen.
- HTTPS con redirección forzada (Cloudflare).
- Activación: `ONLINE_CHECKOUT_UI=true` + **recompilar** (las páginas estáticas congelan la política al compilar) con `fetch → preflight → compose-diff → build → up → verify`; recién entonces `enabled:true`. Las páginas legales siguen con `LEGAL_PAGES_PUBLISHED=false` hasta su aprobación.
- Escaneos de vulnerabilidades, WAF y auditoría: recomendaciones oficiales sin cubrir.

## 15. Estado final de preparación
**NO LISTO para solicitar certificación formal.** Lo técnico está terminado y comprobado en integración, pero hay requisitos obligatorios pendientes que no dependen del código: código de comercio productivo, formulario de validación, HTTPS público y prueba real en producción. Tampoco se conoce la matriz oficial. Para mostrar progreso verificable: ver el checklist (`WEBPAY-CHECKLIST-CERTIFICACION.md`). Validaciones finales (2026-11-04, tras los cambios de esta fase): `npm test` 41/41 · `npx tsc --noEmit` sin errores · `npm run lint` sin errores · `npm run build` correcto (luego `git checkout next-env.d.ts`) · sin la palabra «WordPress»/«Divi» en `src` · sin secretos ni tokens en los documentos nuevos · servidor de pruebas detenido y base desechable fuera del repositorio. Sin commit, sin push, sin despliegue; Webpay sigue apagado en producción.
