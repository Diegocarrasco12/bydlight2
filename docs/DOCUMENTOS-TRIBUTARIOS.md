# Documentos tributarios: modelo de datos y flujo manual (preparado 2026-11-09)

> Modelo declarado por el titular: normalmente **no** se emite una boleta adicional cuando el voucher electrónico tiene validez tributaria. Por eso el sistema no da por supuesto que todo pago necesita boleta: el titular decide por pago (`voucher_pago`, `boleta`, etc.).

**Alcance:** el sistema **registra** los documentos que el titular emite por los canales autorizados del SII (sistema gratuito de boletas electrónicas, facturación). **No emite, no firma y no se comunica con el SII.** No se implementó emisión automática: requiere confirmar antes los requisitos y autorizaciones aplicables (ver «Pendientes»). Un voucher de Webpay **no se asume** como documento: cada pago autorizado queda «pendiente de documento» hasta que se registra uno.

## Situación tributaria informada por el titular (2026-11-09)
Bydlight Solutions SpA, RUT 78.161.844-6, Pro Pyme General (14D), actividad 620200. Inscrita en el sistema gratuito de boletas electrónicas del SII; para pagos electrónicos normalmente se usa el comprobante de pago electrónico como boleta, según las condiciones aplicables. La **verificación de actividades para emitir facturas se solicitó el 2026-11-09 y NO está confirmada como aprobada**: hasta que el SII la apruebe, no se deben emitir facturas nacionales; las de exportación ya se emitieron antes a un cliente español.

## Modelo (migración 5, tabla `tax_documents`)
| Campo | Regla |
|---|---|
| `kind` | `boleta`, `factura` (nacional), `factura_exportacion`, `nota_credito`, `voucher_pago` |
| `status` | `PENDIENTE` (preparado) → `EMITIDO` (con folio y fecha reales) → `ANULADO` (queda el registro); `NO_REQUERIDO` solo para `voucher_pago` |
| `voucher_pago` | **Un pago no siempre requiere documento adicional:** si el voucher electrónico del medio de pago tiene validez tributaria, se registra así (sin folio ni fecha: no lo emite Bydlight) y el pago deja de figurar como pendiente. Impide registrar además una boleta (emisión duplicada) hasta anular este registro |
| `attempt_id` | El pago AUTORIZADO al que corresponde. El **importe sale del pago**, nunca del operador (la nota de crédito puede ser parcial, sin superar el documento corregido) |
| Duplicados | La base impide **dos documentos vigentes por pago** (índice único) y repetir **folio dentro de un tipo**; `EMITIDO` exige folio y fecha |
| `factura` | Exige orden de **empresa** con razón social y RUT validado |
| `factura_exportacion` | Exige receptor extranjero (`receiverTaxId`, `receiverName`); un RUT chileno se rechaza; IVA registrado en 0 (el tratamiento lo define el contador) |
| `nota_credito` | Exige un documento `EMITIDO` de la misma orden como referencia |
Cada registro y anulación deja un evento en la orden (`DOCUMENTO_TRIBUTARIO_REGISTRADO`, `..._ANULADO`). Moneda: solo CLP.

## Conciliación manual y fechas
- `taxdoc-pending` lista los pagos AUTORIZADOS sin documento vigente y agrega un `summary` por `tipoCliente/tipoPago` (persona o empresa; anticipo o saldo) con cantidad y total. Solo agrupa: **no clasifica un pago como boleta ni emite nada**; la decisión (voucher, boleta o factura) es del titular por cada pago. Un anticipo y su saldo son pagos distintos y se documentan por separado.
- El titular informó haber declarado el 2026-11-09 el modelo de emisión ante el SII. **La fecha desde la que rige ese modelo no está verificada** (el titular mencionó 2026-12-01; confirmarla en el sitio del SII o con el contador). Mientras no se confirme el modelo efectivamente vigente, cada cobro debe documentarse manualmente y los textos públicos solo dicen que el voucher «puede» tener validez según el modelo vigente. Las facturas a empresas dependen de la verificación de actividades del SII (no confirmada).

## Uso (el titular, con el patrón de `$RUN` del procedimiento)
```
$RUN node /s/admin-remote.mjs taxdoc-pending --config-file /data/config/payments.json                       # pagos aún sin documento
$RUN node /s/admin-remote.mjs taxdoc-register <ORDEN> --attempt <ID_PAGO> --kind boleta --config-file ...    # queda PENDIENTE
$RUN node /s/admin-remote.mjs taxdoc-issue <ORDEN> --doc <ID_DOC> --folio 1234 --date 2026-11-09 --config-file ...
$RUN node /s/admin-remote.mjs taxdoc-register <ORDEN> --attempt <ID_PAGO> --kind boleta --folio 1234 --date 2026-11-09 --config-file ...  # directo EMITIDO
$RUN node /s/admin-remote.mjs taxdoc-void <ORDEN> --doc <ID_DOC> --reason "motivo" --config-file ...
$RUN node /s/admin-remote.mjs taxdoc-list <ORDEN> --config-file ...
```
El ID del pago aparece en `show <ORDEN>`. Anular aquí **no** anula nada ante el SII: se hace por los canales del SII y luego se refleja el estado.

## Cómo se separa del resto
- No cambia pagos, cotizaciones, correos ni la página de la orden. Los textos públicos siguen diciendo que el comprobante de pago acredita la transacción y no reemplaza el documento tributario que corresponda (ver D3).
- Migración aditiva: el código anterior la ignora; un rollback de código no la revierte ni pierde datos.
- Cuarentena de errores: un fallo al registrar un documento no afecta pagos (operación aparte, bajo el mismo bloqueo por orden).

## Pendientes (decisiones del titular y del contador; no se asumió ninguna)
1. **¿El comprobante electrónico de pago de Webpay vale como boleta?** El titular indica que «normalmente» sí, según condiciones. Falta confirmación escrita del contador/SII de las condiciones; hasta entonces los textos públicos mantienen la redacción cautelosa (no se cambió ningún texto legal sin su aprobación).
2. **Facturas nacionales:** esperar la aprobación de la verificación de actividades. Hasta entonces `taxdoc-register --kind factura` es solo un registro preparatorio.
3. **Exportación:** tratamiento de IVA y datos mínimos del receptor según el contador.
4. **Emisión automática:** no implementada. Si más adelante se autoriza, el flujo ya tiene dónde engancharse: `PENDIENTE` → emisión por el proveedor autorizado → `EMITIDO` con folio, sin cambiar el modelo.
