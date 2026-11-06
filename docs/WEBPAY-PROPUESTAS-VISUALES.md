# Propuestas visuales de «pagos seguros» (solo local, sin commit ni despliegue)

Estado 2026-11-06: tres propuestas (A, B, C) con el mismo contenido y los mismos medios autorizados. **No se eligió la definitiva.** Producción intacta: las propuestas solo se renderizan con `previewMode()` (`BD_PREVIEW=1` en desarrollo); en el build de producción se mantiene el diseño vigente y Webpay sigue invisible.

## Cómo verlas
`npm run preview:pagos` → http://localhost:3100. En la franja inferior «Vista previa» hay un selector **Pagos A · B · C** (también `?pay=a|b|c`; se recuerda en la sesión).

| Lugar | URL |
|---|---|
| Portada (sección completa) y pie | `/` |
| Planes (elemento discreto) | `/planes` |
| Contratación (panel junto al formulario) | `/contratar?plan=profesional` |
| Resumen previo al pago | `/orden/DEMOCOTIZADA` |
| Comprobante (logos oficiales ya integrados, datos íntegros) | `/orden/DEMOAPROBADA` |

## Medios autorizados (inventario)
- **Webpay Plus** y **Transbank**: autorizados por escrito por Transbank (PNG oficiales 300/800, «negativo» sobre fondo oscuro; «positivo» solo sobre placa blanca en C). Sin recolorear ni efectos.
- **Visa, Mastercard, American Express, Redcompra**: **no incluidos** (Transbank pidió confirmar con su área comercial las marcas habilitadas). Los recuadros «logo pendiente» de la vista previa antigua ya no aparecen en las propuestas.
- SVG oficiales existen en los zip de Transbank (`assets-pendientes/`), pero los PNG actuales se ven nítidos a los tamaños usados; no se copiaron al sitio.

## Comparación breve
- **A · Premium minimalista:** líneas finas, mucho aire, logos en una placa discreta. + Muy sobria, no compite con la propuesta principal, ligera. − Menos énfasis en confianza.
- **B · Confianza tecnológica:** panel con rejilla técnica, tres garantías de seguridad y logos con etiquetas. + Comunica seguridad con claridad. − Más «bloque» y más texto.
- **C · Signature Payments:** composición editorial oscura con naranja corporativo, pasos 1-2-3 y placa blanca con los logos oficiales «positivo». + La más memorable y explica el flujo solicitud → aprobación → anticipo. − La más grande; la placa blanca contrasta fuerte con el sitio oscuro.

## Archivos
Nuevos: `src/components/payments/PaymentTrust.tsx`, `PayVariantSwitch.tsx`, `src/styles/pagos-propuestas.css`, `scripts/renders3d/capturas-pagos-variantes.mjs`. Modificados: `PaymentBrandShowcase.tsx` (delegación en vista previa), `PreviewBar.tsx`, `availability.ts` (logos positivo y textos), `layout.tsx`, `Footer.tsx`, `planes/page.tsx`, `pagos.css`. No se tocó lógica de Transbank, finanzas, credenciales ni `payments.json`.
Capturas (sin versionar): `docs/evidencias-pagos-variantes/<ancho>/<variante>-<lugar>.png` a 1440/1024/768/390/320.
