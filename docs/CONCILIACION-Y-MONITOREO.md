# Conciliación y monitoreo (implementado; programación pendiente)

Estado (2026-11-06): el comando `monitor` está implementado y probado. **No se instaló ninguna tarea programada ni se ejecutó nada en producción.**

## Qué hace `monitor`
Ejecuta `audit` (**solo lectura**: no llama a Transbank, no crea cargos, no cambia estados) y, si hay hallazgos de severidad alta o media, encola **una** alerta por correo al titular por día y por conjunto de hallazgos (idempotente).

| Detecta | Tipo de hallazgo |
|---|---|
| Transacciones pendientes demasiado tiempo | `PENDIENTE_LARGO` |
| Pagos autorizados no reflejados en la orden | `AUTORIZADO_NO_REFLEJADO` |
| Montos autorizados distintos del esperado / sin cotización | `MONTO_DISTINTO`, `PAGO_SIN_COTIZACION` |
| Duplicaciones | `PAGO_DUPLICADO` (además, la base lo impide con un índice único) |
| Inconsistencias de persistencia o redondeo | `COTIZACION_INCOHERENTE`, `COTIZACION_REDONDEO` |
| Reintentos anómalos (> 5 intentos o > 3 en una hora) | `REINTENTOS_ANOMALOS` |
| Intentos en ERROR / devoluciones inciertas | `REVISION_MANUAL`, `DEVOLUCION_INCIERTA` |
| Correos fallidos o atascados | `CORREOS_FALLIDOS`, `CORREOS_ATASCADOS` |
La **corrección** de estados sigue siendo una decisión humana o el comando `reconcile` (consulta a Transbank el estado real de pagos "en curso"; ya existía y también ocurre al abrir una orden). Los cambios automáticos de estado financiero **no** se agregan sin reglas verificadas.

## Programación propuesta (no instalada)
En el servidor Ubuntu del titular, un temporizador de cron o systemd, cada 15–30 minutos, con el contenedor efímero del runbook (`docs/DESPLIEGUE-WEBPAY-UBUNTU.md`, variable `$RUN`):
```
$RUN node /s/admin-remote.mjs monitor --config-file /data/config/payments.json
$RUN node /s/admin-remote.mjs mail-dispatch --config-file /data/config/payments.json   # opcional: el servidor ya despacha cada 60 s
```
Salida distinta de cero si falla la llamada. El secreto no se imprime. Instalarlo requiere configurar un servicio del servidor: solo con autorización del titular.

## Mientras no esté programado
Ejecutar `audit`/`monitor` a mano tras cada compra de prueba y diariamente durante las primeras 48 h de la apertura.
