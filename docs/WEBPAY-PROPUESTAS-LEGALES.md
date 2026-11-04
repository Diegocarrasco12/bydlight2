# Webpay Plus — revisión legal/comercial y propuestas para aprobación

Fecha: 2026-11-04. **No es asesoría legal.** Es un inventario de lo que falta en los borradores y de opciones para que el titular decida; todo lo marcado «validar con asesor legal» necesita revisión de un profesional antes de publicar. Nada de esto se ha publicado (`LEGAL_PAGES_PUBLISHED = false`: las páginas responden 404 en producción y no están en menú ni sitemap).

Regla seguida: **no se inventó ningún plazo, garantía, exclusión de retracto, tratamiento tributario ni responsabilidad contractual.** Donde faltaba una decisión, se dejó la pregunta y, como máximo, opciones neutras.

## 1. Estado de los cuatro borradores

| Página | Ruta | Campos pendientes (`<Pend>`) |
|---|---|---|
| Términos y condiciones de contratación | `/terminos` | **9**: RUT, domicilio, régimen/IVA, plazo y atraso del saldo, retrasos de entrega, propiedad intelectual, garantía, política de privacidad, ley/tribunales/reclamos |
| Cancelación y devoluciones | `/devoluciones` | **5**: devolución antes de empezar, cancelación con trabajo en curso, derecho de retracto, plazo de reflejo de una anulación, plazo de respuesta |
| Contacto y soporte | `/soporte` | **3**: horario, tiempo de respuesta, soporte posterior a la entrega |
| Servicios digitales | `/servicios-digitales` | **5**: forma de entrega/aceptación, terceros (hosting, dominios, pasarelas), rondas de revisión, disponibilidad/mantenimiento, confidencialidad y datos |
| **Total** | | **22 decisiones** |

**Falta además una página de política de privacidad**: `/terminos` §9 la remite a un texto que no existe. Hay un formulario que recoge nombre, correo, teléfono y mensaje (`/api/solicitudes`, `/contacto`), por lo que la política es necesaria; su contenido lo debe redactar/validar un profesional.

## 2. Contradicciones y ambigüedades detectadas
1. **Casilla de `/contratar`**: el texto dice «Entiendo que esto es una *solicitud*… el pago del anticipo solo se habilita una vez aprobada la cotización». **No** acepta términos legales, pero el mensaje de error del servidor decía «Debes aceptar las condiciones de contratación». → **Corregido en esta fase** (ver §5).
2. **Dónde se aceptan los términos**: hoy ninguna acción del cliente acepta `/terminos`. La página de la orden (`/orden/<id>`) solo enlaza a ellos si `LEGAL_PAGES_PUBLISHED`. Si el titular quiere que el pago implique aceptación, hace falta una casilla distinta y propia en el pago (cambio funcional y de contrato: **requiere decisión del titular**, no se hizo).
3. **Anulación vs. devolución**: `/devoluciones` §4 dice que Bydlight «solicita la anulación a Transbank por el medio original de pago». Es lo que hace el sistema (anulación por la API de Transbank), pero **no hay ninguna política publicada** de cuándo se acepta una devolución. §1–§3 están vacías.
4. **Anulación parcial en cuotas**: Transbank no la admite (error 53). La política de devoluciones debería decir qué se hace en esos casos (p. ej. devolución total y nuevo cobro, u otro medio). Decisión del titular.
5. **Anticipo y saldo**: `/terminos` §4 habla de anticipo y saldo, pero no define cuándo se habilita el saldo (el sistema lo hace «al avance», por decisión administrativa) ni qué pasa si no se paga.
6. **Cotización vigente**: el comprobante muestra «válida hasta»; los términos no explican qué ocurre al vencer.
7. **Datos de la sociedad**: el pie de página y los términos no muestran RUT ni domicilio. Los datos de identificación del proveedor suelen exigirse en comercio electrónico; **confirmar con asesor legal** qué debe figurar.

## 3. Información que Transbank podría exigir mostrar
**No hay un texto oficial leído que obligue a mostrar términos, devoluciones o datos legales** en la documentación técnica de Webpay Plus (ver `docs/WEBPAY-REQUISITOS-OFICIALES.md` §5, punto 4). Lo único publicado y obligatorio en pantalla es el comprobante de pago y el aviso de rechazo/abandono, ya implementados. Cualquier exigencia adicional se confirma con Soporte (pregunta incluida en el borrador de correo). Mientras no se confirme, **no se afirma que sea obligatoria ni opcional**.

## 4. Propuestas para decidir (marcar una opción por punto)
Las opciones son **neutras y sin cifras**: el titular completa los valores.

| # | Decisión | Opciones | Necesita abogado |
|---|---|---|---|
| D1 | Identificación del proveedor | (a) mostrar RUT y domicilio en pie y `/terminos`; (b) solo en `/terminos` | Sí (qué datos son exigibles) |
| D2 | Tratamiento de IVA en precios | (a) precios + IVA; (b) precios con IVA incluido; (c) otro | Sí / contador |
| D3 | Devolución del anticipo antes de iniciar | (a) devolución total; (b) devolución parcial con retención de un % que usted fije; (c) sin devolución | Sí (validez de cláusulas) |
| D4 | Cancelación con trabajo en curso | (a) cobro del trabajo realizado según avance acordado en la cotización; (b) otra fórmula | Sí |
| D5 | Derecho de retracto | Pedir opinión escrita sobre si aplica a desarrollo a medida; **no publicar una regla definitiva sin ella** | **Sí** |
| D6 | Plazo de devolución efectiva | Informar «según el banco emisor» sin cifra, o la cifra que Transbank confirme por escrito | Confirmar con Transbank |
| D7 | Cuotas y anulación parcial | (a) devolución total + nuevo cobro; (b) devolución por otro medio; (c) no ofrecer cuotas | Sí / Transbank |
| D8 | Propiedad intelectual del entregable | (a) cesión al pago total; (b) licencia de uso; (c) otra | **Sí** |
| D9 | Garantía y soporte posterior | Período y alcance que usted fije; separar garantía de mantenimiento | Sí |
| D10 | Aceptación de términos en el pago | (a) casilla propia en la orden antes de pagar; (b) aceptación en la cotización firmada, fuera del sitio | Sí (cambio funcional: no hecho) |
| D11 | Política de privacidad | Encargar redacción a un profesional (datos recogidos: nombre, correo, teléfono, empresa, mensaje; EmailJS y Webpay como terceros) | **Sí** |
| D12 | Horario y tiempo de respuesta | Los que usted pueda cumplir (no prometer SLA no operable) | No |
| D13 | Ley aplicable, tribunales, reclamos | Texto validado por abogado | **Sí** |

## 5. Cambio realizado en esta fase: mensaje de la casilla
- **Antes** (`src/lib/payments/service.ts`, `parseSolicitud`): «Debes aceptar las condiciones de contratación.»
- **Ahora**: «Marca la casilla para confirmar que entiendes que esto es una solicitud de cotización.»
- La validación no cambia (la casilla sigue siendo obligatoria y se acepta `true`, `"on"` o `"true"`); no cambia ninguna obligación legal ni el comportamiento. Ninguna prueba dependía del texto antiguo. Se añadió una prueba de regresión (ver expediente §7).

## 6. Qué NO se ha hecho
No se publicó ninguna página legal, no se redactaron cláusulas, no se fijaron plazos, garantías ni cifras, y no se modificó la casilla ni el flujo de pago. La publicación requiere: (1) sus decisiones D1–D13, (2) revisión legal, (3) cambiar `LEGAL_PAGES_PUBLISHED` a `true` por su autorización expresa, (4) enlazar desde pie/orden (y, si se desea, sitemap).
