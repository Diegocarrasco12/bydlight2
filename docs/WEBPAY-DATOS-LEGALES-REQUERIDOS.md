# Datos legales y comerciales que debe entregar el titular (2026-11-05)

Las 6 páginas están en borrador y responden 404 en producción (`LEGAL_PAGES_PUBLISHED=false`). **No se inventa ni se publica ningún dato.** Para publicar hacen falta las respuestas siguientes; lo marcado ⚖ debe validarlo un abogado. Fuente de las opciones: `WEBPAY-PROPUESTAS-LEGALES.md`.

## A. Datos objetivos (los puede dar usted directamente)
| # | Dato | Dónde aparece |
|---|---|---|
| 1 | RUT de Byd Light Solutions SpA | `/terminos`, `/informacion-comercial`, `/privacidad` |
| 2 | Dirección legal | las mismas tres |
| 3 | Régimen tributario / IVA: ¿precios + IVA o IVA incluido? (contador) | `/terminos`, `/informacion-comercial` |
| 4 | Horario de atención y tiempo de respuesta que **sí** puede cumplir | `/soporte` (3 campos) |
| 5 | Correo de contacto de privacidad y proveedores usados (hosting, correo, analítica) | `/privacidad` |

## B. Decisiones comerciales (usted decide; el texto lo valida abogado ⚖)
| # | Decisión | Página |
|---|---|---|
| 6 | Plazo y consecuencias de atraso del pago del saldo | `/terminos` |
| 7 | Tratamiento de retrasos de entrega | `/terminos` |
| 8 | Propiedad intelectual del entregable: cesión, licencia o momento de transferencia ⚖ | `/terminos` |
| 9 | Garantía y soporte posterior a la entrega (período y alcance) ⚖ | `/terminos`, `/soporte` |
| 10 | Devolución del anticipo antes de iniciar el trabajo | `/devoluciones` |
| 11 | Cancelación con trabajo en curso | `/devoluciones` |
| 12 | Derecho de retracto: opinión escrita de abogado ⚖ | `/devoluciones` |
| 13 | Plazo en que se refleja una anulación (confirmar por escrito con Transbank) | `/devoluciones` |
| 14 | Plazo de respuesta a solicitudes de devolución | `/devoluciones` |
| 15 | Forma de entrega y aceptación; rondas de revisión; quién contrata/paga terceros (hosting, dominios); disponibilidad y mantenimiento; confidencialidad/datos | `/servicios-digitales`, `/informacion-comercial` |
| 16 | Ley aplicable, tribunales y reclamos ⚖ | `/terminos` |
| 17 | Política de privacidad: base legal, finalidades, derechos y plazos ⚖ | `/privacidad` |
| 18 | ¿La aceptación de términos ocurre con casilla propia antes de pagar o en la cotización firmada fuera del sitio? (cambio funcional si es casilla) | `/orden/<id>` |
| 19 | Cuotas: ¿se ofrecen? Transbank no admite anulación parcial en cuotas (error 53) | `/devoluciones` |

## C. Cómo avanzar sin retrasar la compra de $50
La compra de prueba **no necesita** las páginas legales públicas (Fase C del procedimiento usa `/contratar` por URL directa). Las páginas legales sí deben estar publicadas antes de abrir el checkout al público (Fase D).

Cuando entregue los datos, los incorporo, quito los `[PENDIENTE]`, y le muestro el texto final para su aprobación expresa antes de cambiar `LEGAL_PAGES_PUBLISHED`.
