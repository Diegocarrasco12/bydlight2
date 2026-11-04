# Fase 6 — Checklist de activación futura de Webpay Plus (NO ejecutar hasta autorización de Transbank y del titular)

**Recibir el código de comercio productivo NO equivale a autorización para cobrar.** Cada etapa exige confirmación expresa del titular. Nada de esto se ha hecho. Contexto: [expediente](WEBPAY-EXPEDIENTE-CERTIFICACION.md) · [ACTIVACION-WEBPAY](ACTIVACION-WEBPAY.md) · [PAGOS-SQLITE](PAGOS-SQLITE.md) · [seguridad](FASE6-SEGURIDAD-FEATURE-FLAGS.md) · [plan de despliegue](FASE6-PLAN-DESPLIEGUE.md).

Regla general: **ningún secreto en el repositorio, en logs, en capturas ni en chats.**

## Etapa 0 — Prerrequisitos (fuera del código)
- [ ] Transbank responde el correo (ref. `1-12087316724`) y confirma afiliación y requisitos.
- [ ] Código de comercio productivo recibido por el canal oficial.
- [ ] Cuenta bancaria de abono confirmada **por el titular** directamente con Transbank (no la modifica Claude).
- [ ] Nombre de fantasía que mostrará el formulario confirmado.
- [ ] Formulario de validación/certificación completado por el titular con las evidencias ([expediente](WEBPAY-EXPEDIENTE-CERTIFICACION.md)); Transbank lo aprueba por escrito.
- [ ] Pruebas adicionales que Transbank exija ejecutadas y registradas.

## Etapa 1 — Requisitos legales
- [ ] Completar los campos `[PENDIENTE]` y decisiones D1–D13 ([propuestas](WEBPAY-PROPUESTAS-LEGALES.md)): RUT, domicilio, IVA, plazos, PI, garantía, cancelación/devolución, ley y tribunales, horarios.
- [ ] Revisión por abogado; política de privacidad redactada.
- [ ] Publicar páginas legales (`LEGAL_PAGES_PUBLISHED=true` en código, con commit y despliegue autorizados).
- [ ] Decidir logo oficial de Webpay/Transbank (pack oficial y su manual) y correos transaccionales (proveedor, textos).

## Etapa 2 — Infraestructura (requiere administrador)
- [ ] Cambio de Compose: volumen `/data` para SQLite y `payments.json`; revisar política y línea base; **`accept-compose` lo ejecuta una persona**, nunca automático. Detenerse y pedir aprobación administrativa.
- [ ] Respaldo de `/data` programado; HTTPS forzado en el dominio (pendiente conocido).
- [ ] Crear `/data/config/payments.json` con permisos 0600, **`enabled:false`**, `TBK_ENV` producción, código y llave productivos, y `adminSecret` ≥ 32 caracteres. Hecho por el titular en el servidor.
- [ ] Sin tocar Cloudflare, túnel, DNS ni otros contenedores.

## Etapa 3 — Despliegue con pagos aún apagados
- [ ] Compilar con `ONLINE_CHECKOUT_UI=true` (cambio de código autorizado) → `npm test`, `tsc`, `lint`, `build`.
- [ ] Publicar por el procedimiento de [FASE6-PLAN-DESPLIEGUE.md](FASE6-PLAN-DESPLIEGUE.md) §4.
- [ ] Verificar que, con `enabled:false`, `/api/pagos/iniciar` sigue sin llamar a Transbank.

## Etapa 4 — Activación controlada
- [ ] Titular presente. Cambiar `enabled` a `true` (efecto en ≤ 5 s, sin redeploy).
- [ ] Una compra real de **$50** con tarjeta propia; revisar autorización, comprobante, estado en base y abono.
- [ ] Probar rechazo/cancelación solo si Transbank lo pide.
- [ ] Devoluciones administrativas: mantener `adminRefundsEnabled()` apagado salvo necesidad; si se usa, probarlas con la compra de $50.
- [ ] Confirmar con el titular el paso a operación normal.

## Etapa 5 — Monitoreo
- [ ] Revisar `logs` y órdenes cada día la primera semana (pendientes/inciertos, errores 5xx).
- [ ] Conciliar abonos con Transbank.
- [ ] Revisar límites de solicitudes y alertas.

## Etapa 6 — Desactivación inmediata y rollback
- **Apagado inmediato:** cambiar `enabled` a `false` en `payments.json` (≤ 5 s; `/orden*` vuelve a 404, `iniciar` deja de operar; los retornos de pagos ya iniciados no confirman nada mientras esté apagado, por lo que el titular debe conciliar manualmente con Transbank).
- **Rollback de imagen:** `rollback` del ejecutor (con autorización) → `verify` → `status`.
- No borrar `/data`; conservar la base para auditoría.
