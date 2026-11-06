# Marcas de pago: fuentes oficiales, estado y autorizaciones (2026-11-06, 3.ª actualización)

**Autorización recibida (Transbank, Plataforma Técnica de Incorporaciones, respuesta escrita):** el comercio con productos contratados puede usar los logotipos oficiales de **Webpay Plus** y **Transbank**; también se autoriza el uso de los logotipos oficiales de tarjetas y Redcompra, **pero las marcas efectivamente habilitadas para el comercio deben confirmarse con el área comercial de Transbank**. Recursos: https://www.transbankdevelopers.cl/brand-assets (paquetes `logo-webpay-plus.zip`, `logo-tbk.zip`, `logo-redcompra.zip`; manual «Manual de uso TBK Developers»).

## Estado público
| Elemento | Estado |
|---|---|
| **Webpay Plus** | **Publicado.** Versión «negativo full color» (las superficies del sitio son oscuras), PNG 300 y 800 px **idénticos al original** (`public/img/pagos/webpay-plus-negativo-*.png`; también la versión positiva para impresión del comprobante). Se escalan sin recolorear ni redibujar |
| **Transbank** | **Publicado** como procesador de pagos («Pagos procesados por…») en pie de página, checkout, orden y comprobante (`transbank-negativo-*.png`; `transbank-positivo-*.png` disponible) |
| Visa, Mastercard, American Express, Redcompra | **No se anuncian.** Pendiente de confirmación comercial (qué marcas tiene el contrato). `PAYMENT_LOGOS.cards` está vacío a propósito |

**Nota sobre el paquete `logo-redcompra.zip`:** no es solo el logo de Redcompra; contiene composiciones de tarjetas (Visa, Mastercard, Magna, American Express, Diners Club, Red Compra). Usarlas equivale a anunciar esas marcas, por eso no se publican hasta la confirmación. Los archivos oficiales se descargaron el 2026-11-06 fuera del repositorio.

## Cómo agregar marcas de tarjeta cuando Transbank confirme
1. Confirmación escrita del área comercial de Transbank con la lista de marcas habilitadas.
2. Copiar **sin modificar** los archivos oficiales correspondientes a `public/img/pagos/` y declararlos en `PAYMENT_LOGOS.cards` (`src/lib/payments/availability.ts`). Solo las confirmadas.
3. `npm run preview:pagos` para revisar el diseño; `npm test`, `npm run build`, `npm run verify:prod`, `npm run verify:pilot` (este último valida que hoy no aparezca ninguna marca de tarjeta).

## Reglas de uso aplicadas
Nunca se redibujan, recolorean ni se generan con IA; solo se escalan conservando proporción y con el área libre que da la superficie que los contiene. No se modifica la interfaz alojada por Transbank.

## Historial (2026-11-06, versiones anteriores de este documento)
La versión inicial indicaba que ninguna marca estaba autorizada y que no existía un paquete de Redcompra; ambas afirmaciones quedaron superadas por la respuesta de Transbank y por la descarga de `logo-redcompra.zip`.
