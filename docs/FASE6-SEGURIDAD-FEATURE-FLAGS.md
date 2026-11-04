# Fase 6 — Separación entre sitio público y pagos: controles y pruebas

Objetivo: poder publicar la actualización visual **sin activar Webpay**, con controles efectivos **del lado del servidor** (no un botón oculto ni una variable de frontend). Contexto: [auditoría](FASE6-AUDITORIA-PREPUBLICACION.md) · [personalización](FASE6-WEBPAY-PERSONALIZACION.md) · [checklist de activación](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md) · [seguridad Webpay](WEBPAY-EXPEDIENTE-CERTIFICACION.md) §10.

## 1. Interruptores y cómo se combinan
| Interruptor | Dónde | Efecto | Quién lo controla |
|---|---|---|---|
| `paymentsEnabled()` | `src/lib/payments/config.ts` | **Única fuente de verdad en el servidor.** En producción es `false` salvo `PAYMENTS_ENABLED=true` **o** `enabled:true` en `/data/config/payments.json`; un `false` en cualquiera de las dos lo apaga. Se relee cada ≤ 5 s | Titular (archivo en el servidor) |
| `adminRefundsEnabled()` | `config.ts` | Permiso aparte para devoluciones por la API administrativa; apagado por defecto | Titular |
| `adminSecret()` | `config.ts` | Sin secreto (≥ 32 car.) la API administrativa **no existe** (404) | Titular |
| `TBK_ENV` / credenciales | `config.ts` | Integración (credenciales públicas) o producción (exige código y llave; falla cerrado si faltan) | Titular |
| `ONLINE_CHECKOUT_UI` | `src/lib/plans.ts` (compilación) | Solo decide el **enlace** de «Solicitar plan» (`/contratar` o `/contacto`). **No es un control de seguridad** | Código (requiere recompilar) |
| `LEGAL_PAGES_PUBLISHED` | `src/lib/legal.ts` (compilación) | Las 4 páginas legales en borrador responden 404 mientras sea `false` | Código |
| `webpayAnnounced()` / `webpaySandbox()` | `src/lib/payments/availability.ts` | Textos públicos de Webpay (planes, pie, módulo de cotización) cuelgan de `paymentsEnabled()` | Derivado |

**Nota de diseño:** el apagado real está en el servidor y se evalúa en cada petición; los interruptores de compilación solo ordenan la interfaz. Las páginas estáticas congelan la política al compilar, por eso tras activar hay que recompilar para que aparezcan los textos (el apagado, en cambio, es inmediato).

## 2. Funcionalidades: autorizadas ahora vs. reservadas
| A. Autorizadas para publicar | B. Reservadas hasta Transbank |
|---|---|
| Diseño Signature, logo e imágenes, contenido público, navegación, responsive, formulario de contacto (EmailJS), SEO, 404/error | Inicio de transacciones (`/api/pagos/iniciar`), `/contratar`, `/orden*`, confirmación y consulta de pagos, API administrativa y devoluciones, credenciales productivas, textos que afirmen pagos en línea |

## 3. Qué hace cada ruta con Webpay apagado (verificado en el artefacto de producción)
| Ruta | Comportamiento | Control |
|---|---|---|
| `GET /orden`, `/orden/<id>` | **404** (sin abrir base, sin consultar) | `paymentsEnabled()` en la página |
| `GET /contratar` | **307 → `/contacto`** | idem |
| `POST /api/solicitudes` | **503**; no crea órdenes | `paymentsEnabled()` + `storageWritable()` |
| `POST /api/pagos/iniciar` | Redirige con `aviso=error`; **no llama a Transbank, no devuelve `token_ws`**. Origen ajeno: 403; `GET`: 405 | CSRF por origen + `paymentsEnabled()` |
| `POST /api/pagos/verificar` | Solo redirige; no consulta nada | `paymentsEnabled()` |
| `GET/POST /api/pagos/retorno/<id>` | **Se mantiene por razón técnica** (Webpay vuelve a esta URL) pero con pagos apagados **no confirma ni cambia estado**: solo redirige a la orden (404). Probado con `token_ws`, `TBK_TOKEN`, ambos, sin parámetros y por POST | `if (paymentsEnabled())` |
| `POST /api/admin` | **404** sin secreto; **404** con firma inventada; `GET` 405. Con secreto pero pagos apagados respondería 503 antes de ejecutar nada | `verifyAdminRequest` + `paymentsEnabled()` |
| `/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales` | **404** (borradores) | `LEGAL_PAGES_PUBLISHED` |
| Cualquier página pública | No contiene credenciales ni afirma pagos en línea; sin «WordPress/Divi» | pruebas de contenido |
| Disco | **No se crea la base ni ningún archivo** | la base solo se abre con pagos encendidos |

Comprobantes: solo se generan desde un intento `AUTORIZADO` guardado en la base; con pagos apagados no hay base ni orden, por lo que no puede mostrarse ningún comprobante.

## 4. Pruebas que lo demuestran
- **`npm run verify:prod`** (`scripts/verify-prod-lockdown.mjs`, **29/29**): arranca `.next/standalone/server.js` con `NODE_ENV=production`, **sin** `PAYMENTS_ENABLED`, `TBK_*` ni `ADMIN_API_SECRET` (lo que hay hoy en el servidor), y prueba por URL directa, peticiones HTTP manipuladas (origen ajeno, `amount=1`, firma HMAC inventada, retornos con tokens falsos, POST/GET cruzados) y contenido público; confirma que no se crea ninguna base. Sale con código 1 si algo queda expuesto. Debe ejecutarse **después de cada `npm run build` y antes de publicar**.
- `npm test` (41/41): lógica de pagos con doble del SDK, incluido `D1–D3` (acceso a devoluciones: 404/401/403, y apagadas por defecto).
- Fase 5: 34 casos contra el ambiente de integración de Transbank ([expediente](WEBPAY-EXPEDIENTE-CERTIFICACION.md)); no se hizo ninguna transacción real.

## 5. Riesgos y límites que quedan
1. El código de Webpay llegará por primera vez a producción (apagado). Ya está probado en contenedor en fases anteriores; la compilación del ejecutor (`build`) y `verify` lo confirmarán en el servidor.
2. El límite de solicitudes por IP es en memoria (se reinicia con el contenedor; sin pagos encendidos no tiene efecto).
3. `ONLINE_CHECKOUT_UI` y `LEGAL_PAGES_PUBLISHED` son constantes de compilación: un error humano al cambiarlas **no** habilita cobros por sí solo (los cobros dependen de `paymentsEnabled()` en el servidor), pero sí podría mostrar un enlace a `/contratar` que redirige a contacto.
4. `rateLimited` y la lectura de `clientIp` confían en `cf-connecting-ip`/`x-forwarded-for`: válido detrás de Cloudflare; un acceso directo a `127.0.0.1:8200` desde el propio servidor podría falsear la IP (sin impacto con pagos apagados).

## 6. Activación futura: explícita, verificable y reversible
Paso a paso en [FASE6-CHECKLIST-ACTIVACION-WEBPAY.md](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md). Principios: (a) crear `payments.json` con `enabled:false` primero; (b) activar solo con la compra de $50 y el titular presente; (c) apagado inmediato cambiando `enabled` a `false` (efecto en ≤ 5 s, sin redeploy); (d) rollback de imagen con `rollback` (con autorización).
