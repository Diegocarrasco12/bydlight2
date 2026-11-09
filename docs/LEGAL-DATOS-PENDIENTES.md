# Datos legales y decisiones pendientes del titular (2026-11-06)

Las 6 páginas legales siguen en borrador y responden 404 en producción (`LEGAL_PAGES_PUBLISHED=false`). La publicación se bloquea por código: con la bandera en `true`, cualquier `[PENDIENTE]` (`<Pend>`) lanza error. **No se inventó ningún dato.** Este documento consolida y reemplaza la lista de `WEBPAY-DATOS-LEGALES-REQUERIDOS.md` (que conserva el detalle y las opciones). ⚖ = lo debe validar un abogado.

## 1. Marcadores `[PENDIENTE]` en el código (22 distintos) agrupados por lo que necesitamos

| Grupo | Marcadores | Qué debe entregar | Páginas |
|---|---|---|---|
| Identidad | RUT de la sociedad (×3), dirección legal (×3) | RUT y domicilio de Byd Light Solutions SpA | términos, información comercial, privacidad |
| Tributario | confirmar régimen tributario (×2) | Contador: ¿precios + IVA o IVA incluido? | términos, información comercial |
| Soporte | plazo de respuesta, horario, otros | Horario y plazo que **sí** puede cumplir | soporte |
| Pagos | cuotas; plazo de anulación (confirmar con Transbank y el banco emisor); habilitar texto cuando Transbank confirme | ¿Ofrece cuotas? Plazo por escrito de Transbank | devoluciones |
| Comercial | quién contrata y paga terceros; tratamiento de retrasos; consecuencias de atraso del saldo; garantía y soporte posterior; propiedad intelectual (cesión, licencia, momento) ⚖ | Decisión suya | términos, servicios digitales |
| Entrega | forma de entrega y aceptación, rondas de revisión, disponibilidad/mantenimiento | Decisión suya | servicios digitales |
| Devoluciones | devolución del anticipo antes de iniciar; cancelación con trabajo en curso; retracto ⚖; plazo de respuesta | Decisión suya + opinión escrita | devoluciones |
| Privacidad | base legal y finalidades ⚖; derechos y plazos ⚖; otros proveedores (hosting, correo, analítica); correo de privacidad; reconfirmar analítica | Decisión + abogado | privacidad |
| Jurídico | ley aplicable, tribunales y reclamos ⚖; «pendiente de revisión legal» | Abogado | términos |

## 2. Qué ya está resuelto (aceptación de términos)
Ítem 18 de la lista anterior: **implementado** casilla propia obligatoria en `/contratar` y en `/orden/<id>` (antes de pagar), validada en el servidor (`src/lib/terms.ts`, `checkTerms`) y registrada como evento `TERMINOS_ACEPTADOS` con versión y contexto (solicitud / pago-anticipo / pago-saldo). Pruebas incluidas.
- `TERMS_VERSION` es hoy `borrador-2026-11-06`. **Al publicar el texto final hay que cambiarla** (los formularios abiertos con la versión vieja serán rechazados y pedirán recargar).
- Mientras las páginas legales estén ocultas, la casilla se muestra sin enlaces. **Orden obligatorio:** publicar las páginas legales antes de abrir el checkout al público. Para la compra de prueba de $50 (solo titular) basta el borrador, si usted lo decide.

## 2b. Qué cubre y qué no cubre la prueba piloto de $50
El modo piloto (`PLAN-ACTIVACION-WEBPAY-PRODUCCION.md`) permite la compra de $50 del titular con las páginas legales todavía ocultas: la casilla de términos aparece sin enlaces y se registra la versión `borrador-2026-11-06`. **No** habilita el checkout para el público: eso exige los textos legales publicados (`LEGAL_PAGES_PUBLISHED=true`), que el código verifica.

## 3. Bloqueos que no son de texto
1. **Titularidad del comercio: RESUELTA (2026-11-09, confirmación del titular).** El contrato Webpay Plus está a nombre de Bydlight Solutions SpA, que es la vendedora en todos los textos; no se modifica el titular ni las credenciales. La cuenta bancaria de abonos (personal del representante) fue autorizada y validada por Transbank: **sin pendiente de Transbank**. Solo queda la consulta contable sobre su registro (ver `SII-PROCEDIMIENTO-PROPUESTO.md`).
2. **Logos de marcas:** Webpay Plus y Transbank ya están autorizados y publicados. Visa, Mastercard, Amex y Redcompra siguen sin anunciarse hasta que el área comercial de Transbank confirme las marcas habilitadas: ver `WEBPAY-LOGOS-FUENTES.md`.
3. **Credenciales productivas:** ya están instaladas en el servidor (`payments.json`, 0600); no se vuelven a pedir ni a tocar.

## 4. Qué hacer cuando entregue los datos
1. Se incorporan los datos y se eliminan los `[PENDIENTE]`; se muestra el texto final para su aprobación expresa.
2. Se actualiza `TERMS_VERSION` con la fecha de aprobación.
3. Solo entonces: `LEGAL_PAGES_PUBLISHED = true`, pruebas, build, `verify:prod` (ajustar las comprobaciones de «borrador no se publica»), commit y push; usted despliega.
