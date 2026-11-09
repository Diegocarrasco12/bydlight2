# Revisión legal de la Etapa B (2026-11-09): textos listos para aprobación, NO aprobados

**Estado:** los seis documentos publicados quedaron redactados y coherentes entre sí, pero **ninguno está aprobado por el titular ni por un abogado**: este documento no es asesoría jurídica. `TERMS_VERSION = "2026-11-09-r5"` es la **etiqueta de edición del texto** (fecha de redacción + revisión), no una fecha de aprobación; la aprobación del titular se registra aparte (decisión D1) y no se escribe en ninguna página.

## Documentos y estado
| Documento (ruta) | Contenido y cambios de esta ronda | Estado |
|---|---|---|
| Términos de contratación (`/terminos`) | §2 nuevo: dos modalidades (precio publicado de contratación directa; proyectos a medida fuera del pago en línea). Estados de pago y tratamiento tributario remitidos a Información comercial. Plazos: referencial por plan, definitivo en la cotización | Listo para aprobación |
| Información comercial y medios de pago (`/informacion-comercial`) | **Es la política de pagos.** Nuevo: modalidades, estados de pago (autorizado, pendiente, rechazado, cancelado/expirado, devuelto), y «Documentos tributarios» reescrito | Listo para aprobación |
| Cancelación, retracto y devoluciones (`/devoluciones`) | Sin cambios: ya reproduce los plazos de la Ley 19.496 y no excluye el retracto ni declara irreembolsables los anticipos | Listo para aprobación |
| Servicios digitales (`/servicios-digitales`) | Sin cambios (contratación y prestación: entrega, responsabilidades, revisiones, disponibilidad, confidencialidad) | Listo para aprobación |
| Privacidad y cookies (`/privacidad`) | Renombrada; ancla `#cookies`; base de los tratamientos; estado actual de la Ley 21.719 (proyecto de postergación); proveedores Brevo y Zoho Mail | Listo para aprobación |
| Contacto y soporte (`/soporte`) | Sin cambios; correo único `contacto@bydlightsolutions.com` | Listo para aprobación |
| Índice (`/legal`) y pie de página | Enlazan los seis documentos | Verificado (prueba LG1) |
No existe una «política de cookies» ni una «política de pagos» como páginas separadas: están como secciones con ancla dentro de Privacidad y de Información comercial, para no duplicar textos que puedan contradecirse. Si se prefieren páginas aparte es un cambio menor.

## Contraste con la normativa (fuentes consultadas el 2026-11-09; verificar el texto vigente en bcn.cl antes de aprobar)
- **Ley 19.496, art. 3 bis b (retracto en contratos a distancia/electrónicos):** 10 días desde la contratación del servicio (90 si no se envió la confirmación escrita del art. 12 A); en servicios ya prestados la devolución cubre lo no prestado; el proveedor devuelve sin retener gastos antes de 45 días. La política publicada lo reproduce. El sitio **envía la confirmación escrita** (correo `contratacion_confirmada`) tras el pago del anticipo: prueba R10. Fuente: https://iura.cl/19496/3-bis
- **Exclusión del retracto:** el reglamento publicado en el Diario Oficial el 2024-08-27 regula cómo comunicar las exclusiones y las acota a bienes (no devolvibles, perecibles, confeccionados a medida, de higiene). Bydlight **no excluye** el retracto en sus servicios; excluirlo exigiría informarlo de forma inequívoca antes de contratar y pagar, y es una decisión legal que no se tomó. Fuente: alerta legal Guerrero (2024).
- **Reglamento de Comercio Electrónico (Decreto 6/2021, vigente desde 2022-03-24):** exige información clara y completa del proveedor, del costo total y de las condiciones antes de contratar. El sitio informa razón social, RUT, domicilio, contacto, precio final con IVA incluido, anticipo/saldo y vigencia antes de pagar, y el servicio sin despacho. No se encontró modificación del decreto en 2026. Recomendado: que un abogado confirme que no falta ningún dato exigido.
- **Ley 19.628 (vigente) y Ley 21.719:** la 21.719 entraría en vigencia el **2026-12-01**, pero el Ejecutivo ingresó el 2026-08-31 un proyecto (Boletín 18.623-07) para **postergarla al 2027-12-01**; las fuentes (septiembre 2026) no confirman su aprobación. La política lo dice sin afirmar una fecha firme. **Revisar el estado del boletín antes del 1 de diciembre.** Fuentes: https://www.cuatrecasas.com/es/latam/art/proyecto-que-modifica-ley-proteccion-datos-personales, https://www.cariola.cl/app/uploads/2026/09/Alerta-legal_-2septiembre.pdf
- **Cookies:** la política dice que no hay cookies de analítica ni publicidad. Evidencia: el código no incorpora herramientas de seguimiento (prueba LG7) y una petición `HEAD` a la portada de producción no devolvió `Set-Cookie`. Solo existe la cookie técnica de acceso controlado (piloto).

## Tratamiento tributario (decisión del titular aplicada, sin afirmar lo no acreditado)
- Los comprobantes del sitio y los correos son **informativos: no son boleta ni factura** de Bydlight.
- El voucher electrónico del medio de pago **puede** tener validez tributaria según el SII; en ese caso no se emite boleta adicional (modelo `voucher_pago` en `tax_documents`: un pago **no siempre** requiere documento adicional).
- La **factura no es automática** y depende de la habilitación vigente ante el SII (verificación solicitada el 2026-11-09, sin aprobación confirmada): ningún texto promete facturar.
- Una sola nota (`TAX_NOTE`) se usa en la página de la orden y en los correos; prueba LG5 impide reintroducir afirmaciones contrarias.

## Lo que NO se inventó
Domicilio (solo el de la Declaración de Inicio de Actividades), teléfono (el ya publicado), plazos de entrega (los publicados por plan, confirmados en la cotización), garantías comerciales (se remite a las legales y a la cotización), plazos de respuesta a reclamos (se dice «por escrito», sin plazo), fechas de aprobación o de «última actualización» (ninguna; prueba LG6).

## Decisiones que requieren intervención humana o profesional
1. **Aprobación expresa de los seis textos (D1)**, idealmente con revisión de un abogado, en especial: cláusulas de aprobaciones por vencimiento del plazo de revisión, propiedad intelectual, dominios y cuentas, retracto con evaluación del trabajo ejecutado, y la lista de datos del Reglamento de Comercio Electrónico.
2. **Contador/SII:** confirmar por escrito si el voucher de Webpay vale como boleta en su caso (para usar `voucher_pago` sin emitir boleta adicional) y esperar la aprobación de la verificación de actividades antes de ofrecer factura.
3. **Estado del Boletín 18.623-07** antes del 2026-12-01 (ajustar el texto de §7 de Privacidad si cambia).
4. **Fecha de aprobación (D6):** si desea que la etiqueta de edición coincida con su fecha de aprobación, cámbiela (`src/lib/terms.ts`) y recompile; no es obligatorio.
