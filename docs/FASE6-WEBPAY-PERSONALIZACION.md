# Fase 6 — Personalización de la experiencia de pago Webpay (preparada, no publicada)

Todo lo de este documento está **desarrollado pero invisible en producción** (Webpay apagado: `/orden` y `/contratar` no existen para el público; ver [seguridad y feature flags](FASE6-SEGURIDAD-FEATURE-FLAGS.md)). Contexto: [auditoría](FASE6-AUDITORIA-PREPUBLICACION.md) · [identidad visual](FASE6-IDENTIDAD-VISUAL-SIGNATURE.md) · [expediente Webpay](WEBPAY-EXPEDIENTE-CERTIFICACION.md).

## 1. Límite de personalización de Transbank (investigado en transbankdevelopers.cl el 2026-11-04)
- **Parámetros de `create`:** `buy_order` (≤ 26), `session_id` (≤ 61), `amount` y `return_url` (≤ 256). **Ningún parámetro permite personalizar el formulario alojado** (logo, colores, textos ni nombre visible del comercio). La documentación lo describe como «URL de formulario de pago Webpay», alojado por Transbank.
- El nombre que muestra el formulario («WEBPAY REST SIMULTANEA» en integración) lo define el **código de comercio** en Transbank, no nuestro código. En producción mostrará el nombre registrado en la afiliación: **confirmar con Transbank qué nombre de fantasía figura** (pregunta incluida en [WEBPAY-CORREO-CERTIFICACION.md](WEBPAY-CORREO-CERTIFICACION.md) como pendiente de agregar si desea).
- **Decisión:** el formulario de Transbank **se mantiene intacto**. No se altera con CSS/JS, no se imita, no se capturan datos de tarjeta y no se interfiere con sus medidas de seguridad (el formulario se abre por redirección completa, no en iframe).
- Logos de Webpay/Transbank para el sitio: solo desde los packs oficiales (`https://www.transbankdevelopers.cl/brand-assets/`), cuyo manual de estilo define su uso; los términos de Transbank prohíben otro uso no autorizado. **No se incorporó ningún logo de Transbank**: si lo desea en el pie o en el pago, debe descargarlo del pack oficial y respetar su manual (pendiente de su decisión).

## 2. Lo que sí está bajo nuestro control y quedó diseñado en Signature
| # | Pieza solicitada | Dónde | Estado |
|---|---|---|---|
| 1 | Cotización aprobada | Panel «Resumen de la cotización» con estado (`Cotización aprobada`, `vencida`, `Anticipo pagado`…) | Listo |
| 2 | Resumen de contratación | `/orden/<código>`: plan, estados paso a paso (Solicitud → Cotización → Anticipo → Confirmación) | Listo |
| 3 | Valor total, anticipo y saldo | Lista de desglose con porcentaje y vigencia | Listo |
| 4 | Botón de pago | «Pagar anticipo de $X» / «Pagar saldo de $X»; el monto sale del servidor | Listo |
| 5 | Procesamiento | Pantalla «Te llevamos a Webpay para completar el pago» con logo (antes sin marca) y botón de respaldo sin JavaScript | **Nuevo en Fase 6** |
| 6 | Pago aprobado | Comprobante completo | Listo |
| 7 | Pago rechazado | «No se realizó ningún cobro. Puedes reintentar con otro medio» | Listo |
| 8 | Pago cancelado | Mensaje y reintento | Listo |
| 9 | Pago pendiente/incierto | «Estamos confirmando tu pago. **No vuelvas a pagar**…» y estado de error con orientación | Listo |
| 10 | Pago expirado | Mensaje y nuevo pago | Listo |
| 11 | Comprobante de transacción | Orden, comercio, monto, moneda, fecha, estado, autorización, tipo de pago, cuotas, monto por cuota, tarjeta •••• 4 dígitos, descripción | Listo (cubre lo que exige Transbank) |
| 12 | Versión imprimible | Botón «Imprimir comprobante» + hoja A4 con logo, datos de la sociedad, línea naranja y lista de dos columnas; también se guarda como PDF | **Nuevo en Fase 6** |
| 13 | Correos transaccionales | **No existen**: el sistema no envía correos de pago (EmailJS solo se usa en el formulario de contacto). Enviarlos exige elegir un proveedor de correo, credenciales y textos legales; **decisión suya** (no se improvisó) | No implementado |
| 14 | Móvil y accesibilidad | 390 px sin desbordes; `role="status"` en resultados; botones de ancho completo en móvil; sin violaciones axe en el sitio público | Verificado en pantalla móvil (capturas) |

## 3. Detalles de diseño del comprobante imprimible
Cabecera con logo oficial (`logo2-sm.png`), «Byd Light Solutions SpA», sitio y correo, y «Comprobante de pago · Orden XXXX»; filete naranja `#ff7a1a`; fondo blanco y texto negro (ahorra tinta); sin navegación, pie, botones ni pie de cotización; evita cortes de página dentro del comprobante. Solo se muestra para pagos **aprobados** (no existe comprobante para pagos no aprobados; hay una prueba automática de ello).

## 4. Evidencias (`docs/evidencias-fase6/despues/`)
`pago-aprobada-1366/390.png`, `pago-rechazada-…`, `pago-cancelada-…`, `pago-pendiente-…`, `pago-error-…`, `pago-solicitada-…`, `pago-cotizada-…` y `comprobante-imprimible-a4.png` / `.pdf`. Los datos son **ficticios** (órdenes de ejemplo sembradas con el doble del SDK, sin red ni cobros). El estado «expirado» no tiene captura propia porque requiere esperar la ventana real; su texto está en `orden/[id]/page.tsx` y su lógica probada (casos 12–14 del [expediente](WEBPAY-EXPEDIENTE-CERTIFICACION.md)).

## 5. Pendientes de su decisión
Logo oficial de Webpay/Transbank en el pie o en el pago (pack oficial); correos transaccionales (proveedor y textos); nombre de fantasía que Transbank mostrará; textos legales ([propuestas](WEBPAY-PROPUESTAS-LEGALES.md)).
