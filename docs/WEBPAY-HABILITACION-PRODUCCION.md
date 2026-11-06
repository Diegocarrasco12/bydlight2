# Webpay Plus: habilitación para clientes reales (preparación, 2026-11-06)

**Estado:** el código está técnicamente listo para operar; la activación pública está **BLOQUEADA** por requisitos legales y comerciales que no son de código (sección 6). Nada se ha publicado, desplegado ni activado en esta fase. Producción sigue con `enabled=false`, `access=pilot`, `adminRefunds=false`, entorno Transbank `production`.

## 1. Estado funcional por componente (auditoría del código existente)
| Componente | Dónde | Estado |
|---|---|---|
| Solicitud (`POST /api/solicitudes`) | `service.createOrder`, `parseSolicitud` | Listo. Valida datos y casilla de términos en servidor; ignora precios del cliente; exige modo abierto (piloto o público). |
| Aprobación de cotización | `adminOps.approveQuote`, API firmada | Listo. Solo el administrador (HMAC) fija monto, % de anticipo y vigencia; no cambia con pago autorizado o en curso. |
| Anticipo y saldo | `amountDue`, `quotes` (SQLite) | Listo. El monto sale siempre de la cotización guardada (entero CLP ≥ 50); `deposit + balance = total` impuesto por la base. |
| Webpay Plus | `startPayment`, SDK `transbank-sdk` | Listo y **probado con compra real de $50** (orden `3SJR79AE5RX8`, `BL3SJR79AE5RX8-01`, AUTHORIZED, código 0). Transacción creada solo en backend; retorno `https` obligatorio en producción. |
| Confirmación | `handleReturn`, `evaluate` | Listo. `commit` una sola vez; valida `buy_order`, `session_id`, monto y código 0; resultado dudoso = `PENDIENTE` (nunca rechazo) y se consulta `status`. |
| Comprobante | `voucher.ts`, `/orden/[id]` | Listo. Ahora incluye *Orden Bydlight*, *Total de la cotización (anticipo %)* y *Saldo pendiente*; sin token ni tarjeta completa (solo últimos 4). Leyenda: no reemplaza el documento tributario. |
| Correos | — | **PENDIENTE: no existe servicio de correo transaccional.** EmailJS solo se usa en el formulario de contacto. Ni el cliente ni Bydlight reciben correo al pagar; el cliente consulta `/orden/<código>`. |
| Panel administrativo | `/api/admin` + `scripts/admin-remote.mjs` | Listo (CLI firmado, sin interfaz web): `list [--q]`, `show`, `approve`, `release-balance`, `close`, `reconcile`, **`audit`** (nuevo). Búsqueda por orden, orden de compra, correo o nombre; muestra total, anticipo, saldo y cobrado. |
| Conciliación | `reconcilePending`, `settleStale`, `auditPayments` | Listo (manual/bajo demanda). **Recomendado** programar `reconcile` + `audit` periódicos (ver §9). |
| Seguridad | `http.ts`, `adminAuth.ts`, `pilot.ts` | Listo: `sameOrigin` (CSRF), límite de tasa por IP en iniciar/verificar, firma HMAC con nonce, 404 sin secreto, cookie piloto firmada, cabeceras `no-store`. El limitador es en memoria (1 instancia). |
| Acceso piloto vs público | `config.checkoutMode` | Listo: `public` solo con `access=public` **y** `ONLINE_CHECKOUT_UI=true` **y** `LEGAL_PAGES_PUBLISHED=true`; si falta algo se degrada a piloto. |
| Diseño | landing, navbar, planes, footer C, orden, comprobante | Aprobado (Signature D). Visible solo cuando Webpay se «anuncia» (ver §7). |

## 2. Qué se agregó en esta fase
1. `auditPayments()` (solo lectura, sin llamar a Transbank): detecta `AUTORIZADO_NO_REFLEJADO`, `MONTO_DISTINTO`, `PAGO_DUPLICADO`, `PAGO_SIN_COTIZACION`, `PENDIENTE_LARGO` (>30 min), `REVISION_MANUAL`, `DEVOLUCION_INCIERTA`, `COTIZACION_INCOHERENTE`, `SIN_CODIGO_AUTORIZACION`. Acción `audit` en `/api/admin` y `node scripts/admin-remote.mjs audit`.
2. Búsqueda y resumen financiero en `list` (`--q texto`, escapa comodines).
3. Comprobante ampliado y leyenda tributaria; frase «luego volverás a esta página» en el resumen previo al pago.
4. 12 pruebas nuevas (`tests/habilitacion.test.mjs`): doble clic, reutilización de token, auditoría (sana / no reflejado / monto / pendiente largo / revisión manual / solo lectura), API firmada, búsqueda, comprobante, recuperación de confirmación perdida, separación publicidad–cobros.
5. Diseño aprobado consolidado (secciones previas): `SecurePaySection`, `CtaTrust`, insignia del navbar, footer C, propuestas A/B (solo vista previa).

## 3. Problemas encontrados y corregidos
- Navbar: el ancla `/#pagos-seguros` no llegaba a destino desde el menú móvil (scroll bloqueado y alturas `content-visibility`): se cierra el menú, se navega y se reajusta la posición.
- Mensaje de seguridad: se corrigió «no almacena los datos de tu tarjeta» a «no solicita ni almacena el número completo ni el código de seguridad» (se conservan los últimos 4 dígitos para el comprobante).
- Sin brecha de doble cobro encontrada: lo impiden el bloqueo por orden, el estado `en-curso` y un índice único en la base (verificado en H1/H5).

## 4. Pruebas (2026-11-06, sin red ni credenciales)
`tsc` limpio · ESLint sobre `src scripts tests` limpio · `npm test` **73/73** (61 previas + 12 nuevas) · build correcto · `verify:prod` 36/36 · `verify:pilot` 32/32 · capturas responsive de landing, navbar, planes, checkout y comprobante en 320–1440 px sin desbordes. Cobertura de la lista solicitada: cotización válida/no aprobada/vencida/monto alterado (payments 6, 5, 10), aprobado/rechazado/cancelado (1, 2, 3), retorno interrumpido y reintento (A1, B1–B3, 12), doble clic (H1, 13), duplicación y reutilización de token (4, H2, H5), recuperación (H10, B2), protección de endpoints y admin no autorizado (9, D1, H8), comprobantes (C1, C2, H9). **No existen pruebas de correo porque no hay correo.** «Fallo de base de datos»: solo cubierto a nivel de rutas (503 sin almacenamiento, `verify:prod`); la caída *durante* la escritura posterior a la confirmación se recupera con `reconcile` (H10) pero no se simula.
Nota: el lint completo (`npm run lint`) hoy falla por una carpeta ajena y sin versionar `bydlightredes/` (JS minificado) que apareció en el árbol; no es parte de este proyecto y no se tocó.

## 5. Configuración necesaria (ya instalada en el servidor)
`/data/config/payments.json` (0600): `enabled`, `env:"production"`, `commerceCode`, `apiKey`, `adminSecret`, `access`, `adminRefunds`. No se versiona ni se imprime. Compose y Dockerfile **no cambian** en este release (sin `accept-compose`).

## 6. Requisitos legales y comerciales pendientes (bloquean la Etapa B)
1. Datos legales y 22 marcadores `[PENDIENTE]` (`LEGAL-DATOS-PENDIENTES.md`): RUT, domicilio, régimen tributario/IVA, soporte, cuotas, plazo de anulación, retracto, privacidad, jurisdicción (varios requieren abogado).
2. Titularidad: el comercio Transbank está a nombre de una persona natural; los textos deben coincidir con quien cobra.
3. Marcas de tarjeta: confirmación escrita del área comercial de Transbank (hoy solo Webpay Plus y Transbank). No afirmar cuotas sin interés.
4. Correos transaccionales (proveedor, remitente, plantillas): decisión suya.
5. Documento tributario: procedimiento de emisión (boleta/factura) y quién lo emite.
6. Publicar los textos finales, actualizar `TERMS_VERSION` y aprobarlos expresamente.

## 7. Separación publicidad / cobros (verificado)
- `enabled` (payments.json): capacidad de cobrar. `access`: quién entra (`pilot|public`). `ONLINE_CHECKOUT_UI` + `LEGAL_PAGES_PUBLISHED` (código): apertura pública y anuncio. `previewMode()`: solo desarrollo con `BD_PREVIEW=1`, nunca en producción.
- **Hallazgo:** hoy el **anuncio comercial** (sección de pagos, insignia del navbar, footer C, mensajes junto al CTA) y la **apertura pública** comparten las mismas dos banderas de código (`webpayAnnounced() = publicCheckoutReady()`). Por eso, con `ONLINE_CHECKOUT_UI=false`, **ninguno de los diseños aprobados es visible en producción**; aparecen todos juntos al abrir el checkout público. Es deliberado (no anunciar lo que no se puede usar). Si desea mostrar la información de Webpay *antes* de abrir el checkout, hay que crear una bandera de código distinta (p. ej. `WEBPAY_INFO_PUBLIC`) y adaptar textos (quitar «paga tu anticipo»): decisión suya, no implementada.

## 8. Estrategia en dos etapas
**Etapa A — despliegue técnico (checkout público cerrado).** Publica este código con las banderas en `false`: producción no cambia de comportamiento visible (pagos apagados). Valor: dejar en producción las mejoras de auditoría/comprobante y probarlas. Procedimiento: `docs/DESPLIEGUE-WEBPAY-UBUNTU.md` §1–2 (status → fetch → preflight → compose-diff → build → job-status → up → verify → status), con el SHA indicado abajo; rollback con `sudo bd-run rollback`. Verificaciones esperadas: `/` 200, `/contratar` 307, `/terminos` 404, `/vista-previa` 404, POST solicitudes 503; `payments-config-set --show` con `enabled:false`, `adminRefunds:false`.
Después, con el servicio sano: `node scripts/admin-remote.mjs audit --config-file /data/config/payments.json` (vía el contenedor efímero de §2 del runbook) debe responder sin hallazgos graves; la orden histórica `3SJR79AE5RX8` **no se modifica**.

**Etapa B — activación comercial (solo tras su aprobación expresa y cerrados los requisitos del §6).**
1. En el código: eliminar los `[PENDIENTE]`, publicar los textos aprobados, `TERMS_VERSION` nueva, `LEGAL_PAGES_PUBLISHED=true`, `ONLINE_CHECKOUT_UI=true`; ajustar `verify-prod-lockdown`/`verify-prod-pilot` (hoy comprueban que el borrador **no** se publica) y las pruebas L1–L3; pruebas, build, commit, push, despliegue con `bd-run` (Etapa A repetida).
2. Con el sitio nuevo ya desplegado y verificado: `payments-config-set.mjs /data/config/payments.json enabled=true access=public` (efecto en ≤ 5 s). Si prefiere ensayar primero: `access=pilot` y compra con enlace de piloto.
3. Prueba expresamente autorizada: una compra real mínima por el flujo público, y `audit` + `show` de la orden.
4. Vigilancia las primeras 48 h: `audit` y `reconcile` periódicos.
**Reversión inmediata (sin redeploy):** `payments-config-set.mjs … enabled=false` (o `access=pilot`). Reversión de código: `sudo bd-run rollback`. Nunca `down -v` ni borrar el volumen.

## 9. Operación recomendada
Programar en el servidor (cron/systemd del titular, usando el contenedor efímero del runbook) cada 10 min `admin-remote.mjs reconcile` y cada hora `audit`, con alerta si `findings` trae severidad `alta`. No está instalado; es decisión suya. Respaldo de la base: `orders-admin.mjs backup` (runbook §6.7) antes y después de la activación.

## 10. Riesgos residuales
Sin correos (el cliente debe guardar el código de orden); limitador en memoria y una sola instancia; devoluciones deshabilitadas por decisión (gestión por Transbank/administrador); conciliación manual hasta programar tareas; textos legales y titularidad sin resolver; anuncio ligado a la apertura pública (§7).

## 11. SHA del release
Ver `docs/ESTADO_ACTUAL.md` y el informe de entrega (el código de este documento va en el commit local indicado allí; un commit posterior solo de documentación registra el SHA).
