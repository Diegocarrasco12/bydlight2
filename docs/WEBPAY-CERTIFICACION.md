# Webpay Plus — diseño técnico, plan de certificación y decisiones pendientes

Estado al 2026-11-04 (Fase 2). Producción: **Webpay apagado e invisible** (`ONLINE_CHECKOUT_UI=false`, sin `payments.json`). Complementa `docs/ACTIVACION-WEBPAY.md` (infraestructura), `docs/PAGOS-SQLITE.md` (base) y `docs/EVIDENCIAS-INTEGRACION-WEBPAY.md` (pruebas).

## 1. Modelo de estados de un intento de pago
| Estado | Significado | ¿Bloquea un nuevo cobro? |
|---|---|---|
| `INICIADO` | Token creado; el cliente puede estar en Webpay | Sí, durante la ventana de abandono |
| `AUTORIZADO` | `status=AUTHORIZED` + `response_code=0` + coinciden `buy_order`, `session_id`, monto | — (pagado) |
| `RECHAZADO` | Transbank informó `FAILED` o un `response_code` ≠ 0 sin autorización | No |
| `CANCELADO` | El cliente pulsó «Anular compra» (`TBK_TOKEN`) | No |
| `EXPIRADO` | Sin autorización y el token ya no puede usarse (retorno por tiempo, o consulta de estado tras la ventana) | No |
| `PENDIENTE` | **Resultado desconocido** (falló el commit y no se pudo acreditar el estado, o la respuesta no fue concluyente). *No es un rechazo* | **Sí** |
| `ERROR` | Error técnico/inconsistencia (datos que no coinciden, retorno inválido, estados anulados inesperados, o 7 días sin respuesta). Requiere revisión manual | No (no hay cobro registrado) |

Reglas: un fallo de `commit` nunca marca rechazo; se consulta `status` (disponible 7 días) y, si tampoco responde, queda `PENDIENTE` y se reconcilia (visita a la orden, «Verificar estado», acción admin `reconcile`). Un retorno repetido de un `PENDIENTE` **no** vuelve a confirmar. Mientras haya un `INICIADO` vigente o un `PENDIENTE` no se crea otra transacción para la orden.

## 2. Abandono del pago
Ventana = 11 min en integración y 6 min en producción (token 5 min; formulario 10 min integración / 4 min producción; margen de 1–2 min). Pasada la ventana, antes de permitir un reintento se consulta `status`: `AUTHORIZED` → se registra el pago (no se cobra otra vez); `FAILED` → rechazado; `INITIALIZED` → `EXPIRADO`; consulta fallida → **sigue bloqueando**. La consulta explícita («Verificar estado», admin `reconcile`) puede resolver antes de la ventana pero nunca expira un intento vigente. Reemplaza el bloqueo fijo de 15 min.

## 3. Devoluciones / anulaciones (`src/lib/payments/refunds.ts`)
- API de Transbank: `POST …/transactions/{token}/refunds` (SDK `Transaction.refund(token, amount)`): reversa si es total y dentro de la ventana; anulación en otro caso. Pagos en cuotas no admiten anulación parcial (código 53).
- **Acceso**: solo la API administrativa firmada (HMAC, ventana de 60 s, nonce único) **y** el permiso explícito `adminRefunds: true` en `payments.json` (o `ADMIN_REFUNDS=true`); por defecto apagado (403). No hay ruta pública ni botón. No existe un sistema de usuarios administrativos; la firma con secreto único es la autenticación disponible (ver decisión D6).
- **Validaciones**: monto entero ≥ 1 y ≤ disponible (autorizado − devuelto); pago `AUTORIZADO`; en cuotas solo total; una sola devolución abierta por pago (índice único parcial en SQLite + bloqueo por orden).
- **Idempotencia**: `idempotencyKey` obligatoria (16–64 caracteres); misma clave = mismo resultado sin nueva llamada; con parámetros distintos se rechaza.
- **Auditoría**: tabla `refunds` (solicitante, motivo, tipo, montos, código de autorización de la anulación, error) + eventos solo-agregar `DEVOLUCION_SOLICITADA/COMPLETADA/INCIERTA/CONCILIADA_*`. Se registra la intención **antes** de llamar a Transbank.
- **Incertidumbre**: error de red/Transbank o respuesta inesperada → `INCIERTA` (bloquea nuevas); `reconcile-refund` consulta `status`: sigue `AUTHORIZED` sin devoluciones → `FALLIDA` (reintentable); `REVERSED/NULLIFIED` con monto coincidente → `COMPLETADA`; otro caso → sigue incierta (revisar en el portal de Transbank).
- Cliente: `node scripts/admin-remote.mjs refund <ID> --amount N [--key K] [--attempt A] [--reason "…"]` · `reconcile-refund <ID> --refund RF…`.
- No se ejecutó ninguna devolución real; las de la prueba fueron en integración.

## 4. Comprobante
`src/lib/payments/voucher.ts` + `src/app/orden/[id]/page.tsx`: comercio, orden de compra, descripción, monto (CLP), fecha/hora (`transaction_date` de Transbank; zona America/Santiago), estado, código de autorización, tipo de pago (VD/VN/VC/SI/S2/NC/VP), cuotas y monto de cuota (solo si Transbank lo informa), últimos 4 dígitos, monto devuelto. Los datos no entregados se omiten. Sin tokens ni número completo. Responsive (una columna en móvil) y con estilo de impresión. Mensajes específicos para rechazado, cancelado, expirado, error y pendiente («no vuelvas a pagar»).

## 5. Migración 3 (SQLite)
Reconstruye `attempts` (nuevo estado `PENDIENTE`, columnas `transaction_date` e `installments_amount`; conserva los datos) y crea `refunds`. Se aplica sola al abrir la base. **No hay base en producción todavía**, así que no hay datos reales que migrar; probada con datos de ejemplo (prueba S1).

## 6. Páginas legales: BORRADOR, no publicadas
`/terminos`, `/devoluciones`, `/soporte`, `/servicios-digitales`: contienen solo datos verificables del sitio (razón social, correo, WhatsApp, descripción de servicios, Webpay como medio de pago) y marcadores **`[PENDIENTE: …]`** donde falta una decisión. Controladas por `LEGAL_PAGES_PUBLISHED=false` en `src/lib/legal.ts`: en producción responden **404**, no están en el menú, el pie ni el sitemap, `noindex`. Visibles con `npm run dev`. La casilla «acepto las condiciones» del formulario de contratación **no se tocó** (sigue oculta con el checkout).

## 7. Decisiones que debe aprobar el titular
| # | Decisión |
|---|---|
| D1 | Aprobar o corregir el texto de las 4 páginas; completar RUT, domicilio, plazos de entrega/respuesta, garantía, soporte, propiedad intelectual y tratamiento de IVA |
| D2 | Política de cancelación: devolución del anticipo antes y durante el trabajo (porcentajes y plazos); aplicación del derecho de retracto a servicios a medida (validar con asesor legal) |
| D3 | Cuándo publicar las páginas (`LEGAL_PAGES_PUBLISHED=true`), enlazarlas desde el pie y activar la casilla de aceptación |
| D4 | Política de privacidad (hoy no existe) |
| D5 | Logo 130×59 px GIF/PNG para el formulario de validación |
| D6 | Si las devoluciones seguirán operándose por la API firmada con un solo secreto, o si se construye un panel con usuarios y roles antes de habilitarlas en producción |
| D7 | Autorizar el cambio de infraestructura (volumen `/data`, política del ejecutor, `accept-compose`) cuando corresponda |

## 8. Plan hasta la certificación
1. **Hecho (esta fase)**: comprobante, estados inciertos, abandono, devoluciones administrativas, pruebas automáticas, pruebas reales de 3 casos + devolución en integración, borradores legales.
2. **Titular**: decidir D1–D5 y abrir el formulario de validación de Transbank para ver los casos exactos requeridos.
3. **Claude (con autorización)**: ejecutar en integración los casos restantes (AMEX, Redcompra, prepago, cuotas, expiración real, reversa el mismo día) y completar `docs/EVIDENCIAS-INTEGRACION-WEBPAY.md`.
4. **Titular**: enviar el formulario con evidencias y logo. *No se declara certificado hasta recibir la conformidad de Transbank.*
5. **Tras la conformidad**: llave secreta de producción en el servidor (`payments.json`, 0600), volumen `/data`, despliegue autorizado, compra real de $50, y recién entonces `ONLINE_CHECKOUT_UI=true`.

## 9. Riesgos vigentes
- `node:sqlite` sigue siendo experimental en Node 22 (`docs/PAGOS-SQLITE.md`).
- Exclusión mutua solo en proceso: una única réplica del servicio.
- Un `PENDIENTE` o `INCIERTA` requiere que alguien concilie; no hay tarea en segundo plano (se resuelve al visitar la orden, con «Verificar estado» o con la acción `reconcile`). Recomendable un `reconcile` periódico una vez en producción.
- Aún no se probó una reversa el mismo día (`REVERSED`) ni el comportamiento en cuotas contra integración.
