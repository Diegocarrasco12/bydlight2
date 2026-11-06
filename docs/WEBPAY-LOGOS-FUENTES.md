# Marcas de pago: fuentes oficiales, estado y autorizaciones pendientes (2026-11-06, 2.ª actualización)

**Estado público: ninguna marca está autorizada para publicarse.** En producción no aparece ningún logotipo (`PAYMENT_LOGOS` vacío). En la vista previa local se muestran, solo para evaluar el diseño, los archivos oficiales que se pudieron obtener; el resto aparece como recuadro rotulado.

## Qué se obtuvo y de dónde
| Marca | Fuente oficial | Estado del archivo | Autorización / verificación faltante |
|---|---|---|---|
| **Webpay Plus (Transbank)** | https://www.transbankdevelopers.cl/brand-assets → `logo-webpay-plus.zip` (PNG y SVG, fondo blanco/negro, 80/300/800 px; manual `03.07 Manual_TBK_Developers.pdf` dentro del zip) | **Descargado** a `assets-pendientes/pagos/webpay-plus/` (fuera de `public/`, ignorado por git y Docker). En el diseño se usa la versión «fondo negro» (negativo full color) en 800 px, sin modificar. | Términos de Transbank Developers (https://www.transbankdevelopers.cl/termino-y-condiciones, §4): la marca «Webpay Plus» es de Transbank S.A.; su uso exige **autorización previa, expresa y por escrito**; la licencia del sitio solo cubre desarrollar e implementar integraciones. Falta esa autorización. |
| **Redcompra** | Marca de Transbank. No figura entre los 15 packs de `brand-assets` (Transbank, Webpay, OneClick, Onepay, PatPass, POS, QR, Cuotas…). | No obtenido. | Pedir a Transbank el logo y la autorización. Su documentación sí lista «débito Redcompra» como medio de Webpay Plus, pero depende de lo activado en el comercio. |
| **Visa** | Visa Brand Center, https://brand.visa.com (descarga «Visa Brand Mark»: SVG/PNG; reglas de uso para comercios aceptantes). | No obtenido: el portal no entrega el archivo por descarga directa automatizable. | Que el titular lo descargue y acepte las reglas de uso, y que Transbank confirme que Visa está habilitada en el contrato. |
| **Mastercard** | Mastercard Brand Center, https://www.mastercard.com/brandcenter (descarga de «acceptance mark»). | No obtenido: HTTP 403 y exige aceptar el *Artwork Download Agreement* (no se acepta en nombre del titular). | El titular debe aceptar el acuerdo, descargar el archivo sin alterarlo, y Transbank confirmar la marca habilitada. |
| **American Express** | Portal de comercios de American Express (material de señalización para comercios que aceptan la tarjeta). | No obtenido. | **No confirmada como habilitada**: Transbank indica que los medios dependen del contrato del comercio. No mostrar hasta confirmación escrita. |

## Qué dice Transbank sobre los medios aceptados
Webpay Plus opera con «tarjetas de crédito, débito Redcompra o prepago», según los productos que el comercio tenga activados (https://www.transbankdevelopers.cl/producto/webpay). La documentación no lista marcas (Visa, Mastercard, American Express…) como aceptadas; las tarjetas internacionales dependen de la configuración del comercio. **Por eso no se anuncia ninguna marca de tarjeta: solo «Crédito, débito y prepago a través de Webpay Plus».** La confirmación de marcas debe pedirse al ejecutivo comercial de Transbank (código de comercio productivo).

## Cómo se muestran hoy
- Producción: ningún logotipo ni marca (banda con el texto y las categorías).
- Vista previa local: Webpay Plus con el logo oficial (pendiente de autorización) y recuadros «logo pendiente» para Visa, Mastercard, American Express y Redcompra.
- Para ver los logos de tarjetas en la vista previa: guardar los archivos oficiales **sin modificar** en `assets-pendientes/pagos/cards/` como `visa.svg`, `mastercard.svg`, `amex.svg`, `redcompra.svg` (o `.png`). Se sirven solo en vista previa por `/vista-previa/logos/…`, que en producción da 404.

## Cómo publicar cuando haya autorización
1. Webpay Plus: autorización escrita de Transbank → copiar el PNG/SVG autorizado a `public/img/pagos/` → declarar en `PAYMENT_LOGOS.webpay` (`src/lib/payments/availability.ts`).
2. Tarjetas: confirmación escrita de las marcas habilitadas + archivos descargados por el titular → `PAYMENT_LOGOS.cards`. Solo las confirmadas.
3. Revisar con `npm run preview:pagos`, `npm test`, `npm run build` y `npm run verify:prod`.

Los logotipos nunca se redibujan, se recolorean ni se generan con IA; solo se escalan conservando proporción, con el área libre que da la superficie que los contiene.
