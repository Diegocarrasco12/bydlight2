# Webpay Plus: auditoría, vista previa local y diseño de pagos (2026-11-06)

> Trabajo **solo local**: sin commit, push ni despliegue. Producción no cambia (Webpay apagado, legales en 404).

## 1. Cómo ver la vista previa

```
npm install            # solo la primera vez (Node >= 22.13)
npm run preview:pagos
```

URL: **http://localhost:3100/vista-previa** (índice con todas las rutas). Se detiene con Ctrl+C.

La vista previa es un modo de **desarrollo** (`BD_PREVIEW=1` + `NODE_ENV=development`, lo fija el script). Garantías:

- En producción (`next build` / `next start` / imagen Docker) **siempre está apagada**, aunque exista la variable (`src/lib/preview.ts`, prueba V1).
- No llama a Transbank (ni integración ni producción), ignora credenciales y no crea base de datos (`createTransaction()` lanza error en vista previa; prueba V2).
- Las órdenes son ficticias (`src/lib/payments/preview-data.ts`, ids `DEMO…`); `POST /api/solicitudes` no guarda nada; el botón de pago abre una pantalla de **simulación** con el aviso «Vista previa · simulación».
- Una franja fija «Vista previa» (abajo a la derecha) rotula todas las pantallas.

## 2. Rutas a visitar

| Qué revisar | Ruta |
|---|---|
| Franja de pagos en portada (bajo «Páginas web desde…») | `/` |
| Franja en planes, servicios y servicios con plan | `/planes`, `/servicios`, `/servicios/desarrollo-web`, `/servicios/ecommerce` |
| Solicitud (formulario) | `/contratar?plan=profesional` |
| Consultar una orden | `/orden` |
| Solicitud recibida · cotización lista para pagar (resumen previo al pago) · cotización vencida | `/orden/DEMOSOLICITA` · `/orden/DEMOCOTIZADA` · `/orden/DEMOVENCIDA2` |
| Pago aprobado y comprobante · aprobado en cuotas con devolución | `/orden/DEMOAPROBADA` · `/orden/DEMOCUOTAS22` |
| Rechazado · cancelado · expirado · pendiente · error | `/orden/DEMORECHAZOS` · `/orden/DEMOCANCELAD` · `/orden/DEMOEXPIRADO` · `/orden/DEMOPENDIENT` · `/orden/DEMOERROR222` |
| Saldo habilitado · proyecto pagado | `/orden/DEMOSALDO222` · `/orden/DEMOPAGADA22` |
| Redirección a Webpay (simulada) | botón «Pagar anticipo» en `/orden/DEMOCOTIZADA` |
| Legales (borrador) | `/legal`, `/terminos`, `/informacion-comercial`, `/devoluciones`, `/servicios-digitales`, `/privacidad`, `/soporte` |

Capturas (26 pantallas × escritorio 1440 px y móvil 390 px): `docs/evidencias-preview-pagos/escritorio/` y `.../movil/` (sin versionar, como las demás carpetas de evidencia).

## 3. Auditoría: qué existe, qué está incompleto, qué no existe

**Existe y funciona (probado: 49 pruebas, campaña de integración T1–T9 con Transbank en `docs/EVIDENCIAS-INTEGRACION-WEBPAY.md`)**
- Solicitud de plan (`/contratar`, `/api/solicitudes`) con campo trampa, límite de frecuencia, validación de origen y tope de tamaño.
- Cotización aprobada por el administrador (CLI `scripts/orders-admin.mjs` y API firmada): monto, % de anticipo, vigencia y nota.
- Pago de anticipo y saldo con Webpay Plus: monto siempre calculado en el servidor, confirmación servidor-a-servidor, idempotencia, reintentos, recuperación de pagos «en curso».
- Estados: aprobado, rechazado, cancelado, expirado, pendiente (incierto), error. Comprobante imprimible A4 con códigos de Transbank.
- Devoluciones administrativas (API firmada, apagadas por defecto), reconciliación, persistencia SQLite con respaldo.
- Seguridad: pagos, `/contratar`, `/orden*` y legales cerrados en producción hasta activar.

**Existía incompleto y se resolvió hoy (solo local)**
- Comunicación visual de pagos con tarjeta (no había nada en el diseño): franja «Paga de forma segura con Webpay Plus» + íconos de crédito/débito/prepago, solo si el checkout está habilitado.
- Resumen previo al pago (concepto, medio, total, aviso de seguridad, enlaces legales) y pasos 1–4 coherentes («Solicitud · Cotización · Pago · Confirmación»).
- Estados con ícono y color; cotización vencida ya no ofrece pagar; pantalla de redirección con marca, spinner y aviso de conexión segura.
- Páginas legales: menú lateral, índice `/legal`, columna «Legal» en el pie, navegación móvil; el componente `[PENDIENTE]` **lanza error de compilación** si las páginas se publican con marcadores (prueba L1/L2).

**Incompleto: depende de decisiones o material del titular**
- Texto de las 6 páginas legales (22 marcadores `[PENDIENTE]`; ver §5).
- Aceptación de términos con casilla propia antes de pagar o en la cotización firmada (decisión 18); hoy el resumen solo enlaza los textos (sin casilla).
- Logotipos oficiales de Webpay/Transbank y marcas de tarjetas: no hay archivos ni autorización (ver §4).
- Cuotas: no se anuncian; Transbank no admite anulación parcial en cuotas (decisión 19).
- HTTPS forzado en Cloudflare, `reconcile` periódico y consulta con `TBK_TOKEN` al abortar (opcionales).

**No implementado**
- Correos transaccionales (cotización, comprobante, devolución): hoy el sitio solo envía el formulario de contacto por EmailJS.
- Panel web de administración (la gestión es por CLI/API desde la máquina del administrador).
- Emisión de boleta o factura electrónica (SII).
- Comprobante en PDF descargable (hay versión imprimible).
- Cancelación de la orden por el cliente.

## 4. Logotipos y marcas
No se dibujó ni imitó ninguna marca. La franja usa íconos genéricos y la palabra «Webpay Plus» en texto. Para mostrar el logotipo oficial: descargar el kit desde Transbank, confirmar por escrito que el uso está autorizado, guardar el archivo en `public/img/pagos/` y completar `WEBPAY_OFFICIAL_LOGO` en `src/lib/payments/availability.ts`. Las marcas de tarjetas (Visa, Mastercard, American Express, Redcompra) no se usan hasta tener esa autorización. El texto «crédito, débito y prepago» coincide con lo probado en integración; no se anuncian cuotas.

## 5. Datos que el titular debe entregar (no se inventan)
**A. Objetivos:** (1) RUT de Byd Light Solutions SpA; (2) dirección legal; (3) régimen de IVA: ¿precios + IVA o IVA incluido?; (4) horario de atención y tiempo de respuesta que sí puede cumplir; (5) correo de privacidad y proveedores (hosting, correo, analítica).

**B. Decisiones (varias con abogado):** (6) plazo y consecuencias de atraso del saldo; (7) retrasos de entrega; (8) propiedad intelectual del entregable; (9) garantía y soporte posterior; (10) devolución del anticipo antes de iniciar; (11) cancelación con trabajo en curso; (12) derecho de retracto (opinión de abogado); (13) plazo de reflejo de una anulación (confirmar con Transbank); (14) plazo de respuesta a devoluciones; (15) entrega y aceptación, rondas de revisión, terceros (hosting, dominios), disponibilidad, confidencialidad; (16) ley aplicable, tribunales y reclamos; (17) política de privacidad (base legal, finalidades, derechos, plazos); (18) casilla de aceptación antes de pagar o cotización firmada; (19) ¿se ofrecen cuotas?

**C. Material:** logotipos oficiales con autorización escrita (§4); aprobación del logo 130×59.

Detalle por página en `docs/WEBPAY-DATOS-LEGALES-REQUERIDOS.md`.

## 6. Pruebas
Resultados del 2026-11-06: `npx tsc --noEmit` y `npm run lint` sin errores; `npm test` 49/49 (7 nuevas: V1–V4 vista previa, L1–L3 legales); `npm run build` OK; `npm run verify:prod` 33/33 sobre el artefacto de producción (incluye `/legal` y `/vista-previa` en 404, sin pagos ni órdenes). Revisión visual: 26 rutas × escritorio 1440 px y móvil 390 px, sin desbordes horizontales reales. Defecto encontrado y corregido durante la revisión: desborde móvil del menú legal. No se probó en un teléfono físico ni se midió Lighthouse tras los cambios.

## 7. Segunda ronda (2026-11-06): Bento y PaymentBrandShowcase
- «Lo que construimos»: Bento asimétrico (principal 7x2 + 5 tarjetas) en `src/components/home/blocks.tsx` y `src/styles/bento.css` (clases `.bx-*`, iconos 56 px, ilustraciones decorativas, hover discreto, `prefers-reduced-motion`, 12/2/1 columnas).
- Pagos: `src/components/payments/PaymentBrandShowcase.tsx` con variantes `hero` (portada, planes), `compact` (servicios, pie) y `checkout` (/contratar y resumen de pago). Reemplaza a PaySeal. Textos: «Paga con tus tarjetas favoritas» / «Crédito, débito y prepago a través de Webpay Plus».
- Logotipos: **ninguno incluido** (bloqueo: autorización escrita de Transbank; marcas de tarjetas sin confirmar). Ver `docs/WEBPAY-LOGOS-FUENTES.md`. En la vista previa hay recuadros punteados rotulados donde irán.
- Pruebas: tsc, lint, 49/49, build OK, verify:prod 33/33; sin desbordes horizontales a 1440, 768, 390 y 320 px. Capturas: `docs/evidencias-bento-pagos/`.

## 8. Tercera ronda (2026-11-06): renders 3D y marcas oficiales
- Bento con renders 3D (docs/RENDERS-3D.md). PaymentBrandShowcase rediseñado como banda de marcas (docs/WEBPAY-LOGOS-FUENTES.md).
- Webpay Plus: logo oficial descargado de transbankdevelopers.cl/brand-assets, solo en vista previa (falta autorización escrita). Visa/Mastercard/Amex/Redcompra: sin archivos oficiales ni confirmación de habilitación.
- Pruebas: tsc, lint, 49/49, build, verify:prod 36/36; sin desbordes a 1440/1024/768/390/320 (Playwright con viewports reales: scripts/renders3d/capturas.mjs).
