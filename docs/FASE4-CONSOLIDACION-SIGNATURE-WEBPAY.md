# Fase 4: consolidación de Bydlight Signature + experiencia comercial Webpay Plus

Fecha: 2026-11-04. Estado: **solo local, sin commit, sin push, sin despliegue.** Producción sigue en `5fef157` (verificar con `status` antes de afirmarlo) y Webpay sigue apagado e invisible allí.

Leyenda: **[HECHO]** implementado · **[PROBADO]** verificado con prueba o medición · **[PENDIENTE]** no hecho o requiere decisión.

## 1. Diseño definitivo aprobado

**[HECHO]** La variante D · Bydlight Signature es el diseño por defecto de todo el sitio (páginas públicas, planes, formularios, cotización, comprobantes, pie). Sin cookie, sin selector, sin `data-variant`.

- Hoja de estilos única: `src/styles/signature.css` (capas: 1 base minimalista, 2 identidad Signature, 3 módulo de cotización/pago y mensajes Webpay). Se carga después de `design.css`, `fase2.css` y el hero, con selector `html:root` (misma especificidad con que se validó en el laboratorio).
- Tipografías (autoalojadas por `next/font`, SIL OFL 1.1): Space Grotesk 400–600 (títulos), Inter (texto), IBM Plex Mono 400–500 (solo rótulos, cifras, datos técnicos). Reemplazan a Bricolage Grotesque, Geist y Geist Mono (retiradas; menos fuentes que descargar). Las variables van en `<html>`.
- Naranja Bydlight `#ff7a1a` como único acento: botón principal, marca de sección, estado activo, plan recomendado. Sin contornos naranjas en tarjetas.
- **Hero aprobado intacto [PROBADO]**: fotografía de infraestructura + escena 3D (`HeroNetwork.tsx` restaurado a su versión original sin ningún cambio), posición, textos, botones, etiquetas y capas. Comparación píxel a píxel contra las capturas aprobadas: 10 de 16 pantallas con 0 % de diferencia. Las 6 restantes: inicio (escena 3D en movimiento), nosotros y servicios móvil (bloques en mitad de la animación de entrada por scroll) y la cotización a 1366 px (diferencias dispersas de pocos píxeles en todo el cuerpo, sin cambios de posición; revisada a ojo, idéntica a la aprobada).

## 2. Laboratorio retirado

**[HECHO]** Eliminados del código de ejecución: `src/lab/`, `src/app/lab/`, el gancho de `src/app/layout.tsx`, el atributo `data-variant`, la cookie `bd-variant` y la comprobación en `HeroNetwork`.
Conservado: capturas (`docs/evidencias-diseno/comparativa/`, con `index.html` A/B/C/D), documentación (`docs/LABORATORIO-DISENO-ABC.md`, ahora marcada como retirada) y respaldo de estilos y código del selector en `docs/archivo-laboratorio/` (los `.ts/.tsx` pasan a `.txt` para que no se compilen; `LEEME.md` explica cómo reactivarlo).
`scripts/lab-seed.mjs` se conservó renombrado `scripts/seed-ordenes-ejemplo.mjs` (siembra órdenes de ejemplo con el doble del SDK de Transbank para revisar pantallas de pago; solo local).
**[PROBADO]** El build de producción no contiene `bd-variant`, `data-lab-ui` ni `data-variant` (JS, HTML ni CSS de `.next/static` y `.next/server`); `/lab` responde 404; `/`, `/planes`, `/servicios`, `/nosotros`, `/contacto`, `/proyectos` siguen estáticas (○).

## 3. Dónde aparece Webpay y política de disponibilidad

Fuente única: `src/lib/payments/availability.ts` → `webpayAnnounced()` = `paymentsEnabled()` (la misma que gobierna `/orden`, `/contratar` y las rutas `/api/pagos/*`). No hay segunda integración ni segundo interruptor.

| Dónde | Qué se muestra | Cuándo |
|---|---|---|
| `/planes` (lista de condiciones de pago, debajo de «Forma de pago: 50 % al iniciar…») | «Pago con tarjetas de crédito, débito y prepago mediante Webpay Plus, sujeto a disponibilidad y condiciones del medio de pago.» Sin botón de cobro; los planes siguen llevando a `/contacto` | solo con checkout habilitado |
| Pie de página (todas las páginas) | «Pagos procesados mediante Webpay Plus de Transbank.» Solo texto; sin logos ni sellos | solo con checkout habilitado |
| `/orden/[id]` cotización aprobada | Módulo «Resumen de la cotización» (estado, total, anticipo, saldo, vigencia, método de pago, condición de anticipo/saldo) y módulo «Pago seguro con Webpay Plus» con el botón «Pagar anticipo de $X» | solo con checkout habilitado y orden en etapa COTIZADA |
| `/orden/[id]` comprobante y estados | mismos datos de antes, solo presentación | con checkout habilitado |

Condiciones:
1. **Desarrollo local**: habilitado por defecto (`NODE_ENV !== "production"`), sandbox y datos ficticios. La página de la orden rotula «Ambiente de pruebas: no se realizan cobros reales» siempre que Transbank esté en modo integración.
2. **Producción**: apagado e invisible hasta activación autorizada (`PAYMENTS_ENABLED=true` o `enabled=true` en `payments.json`, ver `docs/ACTIVACION-WEBPAY.md`). **[PROBADO]** con `next start` del build: 0 menciones de «Webpay» o «Transbank» en `/`, `/planes`, `/servicios`, `/nosotros`, `/contacto`, `/proyectos`; `/orden/*` y `/lab` 404; `/terminos` 404; `/contratar` redirige (307) a `/contacto`.
3. Las páginas estáticas se generan al compilar: tras activar Webpay hay que **recompilar y publicar** para que aparezcan los mensajes (falla de forma segura: sin activar, no se anuncia nada). Anotado en `availability.ts`.
4. `ONLINE_CHECKOUT_UI` (`src/lib/plans.ts`) sigue en `false`: los planes no enlazan a `/contratar`.

Monto: el valor de «Pagar anticipo de $X» sale de `amountDue()` sobre la cotización guardada en el servidor; el navegador solo envía `orderId` y `kind`. El frontend no calcula ningún monto.

## 4. Revisión del recorrido de pago (sin cambios de lógica)

Cotización → aprobación → anticipo → Webpay → resultado → comprobante, revisado en `src/lib/payments/service.ts`. **No se modificó la lógica financiera.** Resultado de la revisión (código) y respaldo (pruebas, 40/40 incluidas las de pagos con doble del SDK):

- Solo se cobra con cotización aprobada y vigente: `amountDue` exige etapa COTIZADA (anticipo) o SALDO_HABILITADO (saldo); anticipo vencido → rechazo `vencida`. **[PROBADO]**
- Monto siempre del servidor, entero ≥ 50, bajo bloqueo por orden (`withOrderLock`). **[PROBADO]**
- Sin duplicados: existe un intento INICIADO/PENDIENTE → «en curso»; pago ya AUTORIZADO → «pagado». **[PROBADO]**
- Un resultado incierto no se cierra ni se reintenta: `PENDIENTE` + reconciliación con `status` de Transbank; consulta fallida nunca rechaza. **[PROBADO]**
- El retorno del navegador no basta: se confirma con `commit` y se exige coincidencia de `buy_order`, `session_id` y monto; si no coincide → `ERROR` con revisión manual. **[PROBADO]**
- Retornos repetidos idempotentes; cancelación, expiración y retorno inválido tratados por separado. **[PROBADO]**
- Trazabilidad: `events` por orden y registro JSON sin tokens, tarjetas ni credenciales. Tarjeta: solo los últimos 4 dígitos; nunca número completo ni CVV.
- Comprobante por la página de la orden (código no adivinable, 40 consultas por IP cada 10 min).
- Observaciones (sin cambio): (a) el saldo no comprueba vigencia de cotización (por diseño: se habilita al avance); (b) el mensaje de validación de `parseSolicitud` dice «Debes aceptar las condiciones de contratación», pero la casilla de `/contratar` solo reconoce que es una solicitud y no enlaza términos: conviene revisar la redacción junto con las decisiones legales; (c) la medida anti-abuso `rateLimited` es en memoria (se reinicia al reiniciar el proceso y no se comparte entre réplicas).
- No se ejecutaron pagos ni se generaron transacciones nuevas; las pantallas se revisaron con órdenes de ejemplo ya sembradas.

## 5. Legales (sin cambios; todo sigue en borrador)

`LEGAL_PAGES_PUBLISHED=false`: `/terminos`, `/devoluciones`, `/soporte` dan 404 en producción, no están en el sitemap ni en el pie. No se tocó ningún marcador pendiente ni se activó casilla de aceptación (no existe casilla de aceptación de términos; la de `/contratar` es un reconocimiento de solicitud y esa ruta no es accesible en producción).
Pendientes de aprobación del titular (ya listados D1–D7 en `docs/WEBPAY-CERTIFICACION.md` §7): RUT y domicilio de la sociedad, régimen de IVA, plazos de entrega/respuesta, tratamiento de retrasos, propiedad intelectual, garantía, política de cancelación y devoluciones (porcentajes y plazos, derecho de retracto en servicios a medida), política de privacidad (hoy no existe), publicación, enlace desde el pie y logo 130×59 para el formulario de validación. Marcadores `Pend` actuales: 9 en términos, 5 en devoluciones, 3 en soporte.
Nota: el módulo de cotización enlaza a `/terminos` solo si `LEGAL_PAGES_PUBLISHED` es `true`.

## 6. Accesibilidad

Herramientas: axe-core 4 (WCAG 2 A/AA, 2.1 A/AA, buenas prácticas) sobre el sitio local y Lighthouse 12 sobre el build de producción.

- **axe [PROBADO]**: 42 pantallas (14 páginas incluidas `/contratar` y las 7 órdenes de ejemplo × 1366, 390 y 360 px): **0 infracciones**, contraste incluido. Antes de corregir encontró 2 en móvil, ya resueltas: barra inferior fija sin landmark (`role="region"` con etiqueta) y bloque de código desplazable sin foco por teclado (`tabIndex=0`).
- **Lighthouse accesibilidad (producción, móvil)**: home 100, `/planes` 100 (se corrigió el salto h1→h3 que figuraba pendiente en `docs/CALIDAD_Y_PRUEBAS.md`, con un `h2` solo para lectores de pantalla), `/proyectos` 100, escritorio home 100. `/nosotros` móvil **96**: `color-contrast` en un bloque que cruza el borde inferior durante la animación de entrada por scroll (`animation-timeline: view()`), medido a media opacidad (`#40444b`); con la animación completa axe no reporta nada y el gris real (`#8f95a1` sobre `#07090d`) da ≈ 6:1. Es un artefacto de medición, no un defecto de color; el mecanismo de revelado no se tocó porque cambiaría el comportamiento visual. **[PENDIENTE]** si se quiere puntuación 100 también ahí: propuesta (requiere aprobación) acortar el rango de la animación o iniciarla antes.
- Teclado y foco: el primer tabulador es «Saltar al contenido»; anillo de foco visible (2 px naranja claro) en enlaces y botones; etiquetas asociadas en los campos del formulario de contacto; un solo `h1` por página y sin saltos de nivel en las páginas revisadas.
- Movimiento reducido: el revelado por scroll respeta `prefers-reduced-motion` (sin animaciones CSS activas). El hero 3D tiene un modo de un solo cuadro para movimiento reducido (código original); no se verificó visualmente en esta fase.
- Observación (sin cambio): al tabular desde «Servicios» el foco recorre el submenú antes de llegar a «Proyectos» (comportamiento previo del menú).

## 7. Rendimiento (Lighthouse 12, build de producción local, bloqueo del script de Kaspersky solo en el navegador de prueba; laboratorio, no datos de usuarios)

| Página | Dispositivo | Rendimiento | LCP | TBT | CLS | Peso |
|---|---|---|---|---|---|---|
| Inicio | Móvil | 86 | 3,9 s | 80 ms | 0 | 558 KB |
| Planes | Móvil | 89 | 3,2 s | 200 ms | 0 | 334 KB |
| Nosotros | Móvil | 89 | 3,6 s | 80 ms | 0,003 | 652 KB |
| Proyectos | Móvil | 84 | 4,6 s | 50 ms | 0 | 652 KB |
| Inicio | Escritorio | 99 | 1,0 s | 0 ms | 0 | 1.039 KB |

- Comparación con la medición previa (`docs/CALIDAD_Y_PRUEBAS.md`, home móvil 80–85, LCP 3,6–3,9 s, escritorio 98): sin regresión; la cifra del LCP móvil es la simulación de red 4G lenta de Lighthouse. «Mejores prácticas» 81–82: solo falla `is-on-https` (prueba por HTTP local). SEO 100.
- Fuentes: ahora 3 familias (Space Grotesk, Inter, Plex Mono sin precarga) en lugar de Bricolage, Geist y Geist Mono; tipografía con `display: swap`.
- El coste del hero 3D no se tocó ni se simplificó. INP no se midió (no representativo en laboratorio); los datos de campo (CrUX) requieren tráfico real.
- **[PENDIENTE]** medir `https://bydlightsolutions.com/` real tras publicar, preferiblemente desde un equipo sin la inyección de Kaspersky.

## 8. Pruebas realizadas

- `npm test`: 40/40 (incluye regresión de Webpay con doble del SDK: pagos, rechazos, cancelación, pendientes, anulaciones, comprobante, migración). Sandbox oficial de Transbank no fue necesario ni se usó.
- `npx tsc --noEmit`: sin errores. `npm run lint`: sin avisos. `npm run build`: correcto (29 páginas).
- Navegación y responsive: sin desbordamiento horizontal en las capturas finales a 1920, 1366 y 390 px (inicio, planes, cotización, comprobante y estados rechazado, cancelado, pendiente, error y solicitud recibida) y antes, en D, en 80 combinaciones (5 tamaños × 16 páginas).
- Rutas públicas: mismo comportamiento (estáticas, sin cookies de variante; `/contratar` redirige; `/orden` 404 en producción).
- Regresión de cotizaciones: las 7 órdenes de ejemplo se renderizan con sus estados (solicitada, cotizada, aprobada, rechazada, cancelada, pendiente, error).
- No se ejecutaron pagos reales ni se crearon transacciones.

## 9. Archivos modificados

Nuevos: `src/styles/signature.css`, `src/lib/payments/availability.ts`, `scripts/seed-ordenes-ejemplo.mjs`, `docs/archivo-laboratorio/*`, `docs/evidencias-fase4-signature/*`, `docs/FASE4-CONSOLIDACION-SIGNATURE-WEBPAY.md`.
Modificados: `src/app/layout.tsx` (fuentes y hoja Signature; sin laboratorio), `src/app/globals.css` y `src/styles/design.css` (variables de fuente), `src/app/orden/[id]/page.tsx` (módulos de cotización y pago), `src/app/planes/page.tsx` y `src/components/home/sections.tsx` (nota Webpay y `h2` accesible), `src/components/footer/Footer.tsx` (nota Webpay), `src/components/navbar/Navbar.tsx` (landmark), `src/components/home/blocks.tsx` (foco del bloque de código), `docs/LABORATORIO-DISENO-ABC.md`.
Eliminados del código: `src/lab/`, `src/app/lab/` (respaldados en `docs/archivo-laboratorio/`).
Sin cambios: `HeroNetwork.tsx`, `src/lib/payments/service.ts` y el resto de la lógica de pagos, Docker, Compose, Cloudflare, credenciales.
Componentes reutilizados: `.bd-panel`, `.bd-dl`, `.bd-flow`, `.bd-result`, `.bd-note`, `.bd-btn`, `MaintenanceBlock`, `PlansGrid`, `Footer`.

## 10. Riesgos conocidos

- Las páginas estáticas congelan la política de disponibilidad al compilar (ver §3 punto 3).
- El mensaje «sujeto a disponibilidad…» y «Pagos procesados mediante Webpay Plus de Transbank» solo deben publicarse una vez activado el medio de pago y autorizada su exhibición; no se usó ningún logo ni sello de Transbank.
- `rateLimited` en memoria (ver §4).
- En el hero, el naranja de marca convive con la fotografía y la escena 3D de tono azul aprobado.
- El revelado por scroll puede puntuar contraste a media opacidad en Lighthouse (ver §6).

## 11. Pendientes

Legales (titular): D1–D7 de `docs/WEBPAY-CERTIFICACION.md`, política de privacidad, publicación de páginas legales, enlace desde el pie y redacción de la casilla de `/contratar`.
Técnicos: certificación Transbank (casos de integración restantes), logo 130×59, decisión sobre devoluciones (API firmada vs panel), volumen `/data` y política del ejecutor (`accept-compose`) para activar, medición en el dominio real, decisión sobre el revelado de `/nosotros` móvil.

## 12. Plan de despliegue futuro (NO autorizado todavía)

1. Titular aprueba esta fase; se hace commit explícito con `git add <archivos>` (revisar `git diff` y secretos; confirmar `Diegocarrasco12/bydlight2`).
2. Push autorizado → SHA completo de 40 hex.
3. `status → fetch <sha> → preflight → compose-diff → build → job-status → up → verify → status` con `bd-deploy.ps1` (docs/DESPLIEGUE.md). Si cambia Compose, detenerse y pedir aprobación administrativa; no ejecutar `accept-compose` automáticamente.
4. Sitio nuevo en producción **con Webpay apagado** (así se probó: sin mensajes de Webpay).
5. Aparte y con autorización expresa: certificación, decisiones legales, `payments.json` con `enabled=true` y recompilación para que aparezcan los mensajes.

## 13. Plan de rollback

Rollback esperado: `5f000150f40529abaa70c1dd7d39e4c486c129e2` (versión anterior al hero actual); verificar con `status` el SHA desplegado y el de rollback antes de usarlo. La operación `rollback` solo con autorización. Para esta fase en particular, el estado previo inmediato es el SHA desplegado actual (`5fef157`). El respaldo de estilos A/B/C/D permite reconstruir cualquier variante.
