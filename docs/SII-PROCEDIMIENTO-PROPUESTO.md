# SII: procedimiento tributario propuesto (NO implementado; requiere confirmación del contador)
> **Cierre 2026-11-10:** el titular informó que el SII ya autorizó la emisión de facturas y boletas electrónicas; este pendiente administrativo queda CERRADO. El sistema sigue entregando solo el comprobante de pago; la emisión del documento tributario la hace el titular fuera del repositorio.

Fecha de consulta: 2026-11-06. **No se ingresó al SII, no se modificó ninguna configuración tributaria y el sitio no emite documentos tributarios.** El sistema solo entrega un *comprobante de pago* (Transbank) y un desglose informativo del IVA; ninguno se presenta como boleta o factura.

## 1. Lo verificado y lo no verificado
| Tema | Estado | Fuente |
|---|---|---|
| IVA de servicios: devengo | **Verificado (lectura parcial del texto oficial):** el art. 9 letra a) del DL 825 fija el devengo en la fecha de emisión de la factura o boleta; si no se emite o no se exige, en la fecha en que la remuneración se percibe o se pone a disposición del prestador. | BCN, DL 825 (idNorma 6369) |
| Anticipo | **Inferencia, no verificada:** aplicando lo anterior, un anticipo percibido sin documento previo devengaría IVA al percibirse. El art. 9 no menciona "anticipo" por nombre. | — |
| Obligación de emitir boleta/factura al recibir un anticipo | **No verificado** (arts. 52 y 53 DL 825 y resoluciones SII). | — |
| Voucher electrónico como boleta | **No verificado en texto oficial.** Fuentes secundarias indican que el contribuyente declara un modelo de emisión (siempre boleta electrónica, o que el comprobante de pago electrónico reemplace la boleta en pagos con tarjeta). Las resoluciones citadas no pudieron leerse. Portal: sii.cl, "Ticket por boleta". | SII (no leído) |
| Aplicación a ventas online de servicios | **No verificado:** si el comprobante de Webpay califica y cómo se acredita la entrega. | — |
| Factura a empresas (crédito fiscal IVA) | **No verificado.** Norma general conocida (DL 825, arts. 23 y 52): el crédito exige factura. | — |
| Conservación de documentos | **Verificado (SII, jurisprudencia 2006, `ja1118`):** facturas y boletas se conservan 6 años. Libros contables: 6 años (comerciales hasta la liquidación del negocio). | SII |

## 2. Procedimiento propuesto (para validar con el contador)
1. **Modelo de emisión:** definir con el contador si se declara "el voucher vale como boleta" para pagos con tarjeta o se emite boleta electrónica siempre. Mientras no esté definido, el sitio mantiene la leyenda "el comprobante no reemplaza el documento tributario".
2. **Clientes persona natural:** boleta electrónica por cada pago recibido (anticipo y saldo), o voucher según el modelo declarado, en el momento que el contador indique. El correo de "pago autorizado" ya entrega el monto, la fecha y el código de autorización para respaldar la emisión.
3. **Clientes empresa:** factura electrónica con los datos que el formulario ya recoge (razón social, RUT; giro y dirección opcionales que se solicitarán si faltan). Definir si se factura el anticipo al recibirlo o el total al entregar.
4. **Anticipos y saldos:** definir documento y momento de cada uno (percepción del pago vs. entrega).
5. **Respaldo:** conservar los comprobantes 6 años; la base de datos y los respaldos ya los guardan (ver `PRIVACIDAD-MATRIZ-CONSERVACION.md`).
6. **Conciliación contable:** el comando `audit` cuadra cotización, anticipo, saldo y pagos autorizados.

## 3. Preguntas concretas para el contador / SII
1. ¿Qué modelo de emisión de boletas tiene declarado BYDLIGHT SOLUTIONS SPA (RUT 78.161.844-6)? ¿Conviene el voucher como boleta para ventas online con Webpay?
2. ¿Tiene certificado digital y sistema de facturación electrónica (SII o de mercado) para emitir boleta y factura?
3. ¿El anticipo exige documento al recibirse, o puede documentarse al entregar/facturar? ¿Qué documento corresponde al saldo?
4. Con cotizaciones "IVA incluido": ¿cómo se expresa el neto/IVA en la factura (el sistema desglosa neto = total/1,19 redondeado y IVA por diferencia)?
5. Tratamiento ante devoluciones o retracto (nota de crédito).
**Requisito previo a la apertura pública:** respuesta a 1–3. Hasta entonces no se implementa ninguna emisión automática.
