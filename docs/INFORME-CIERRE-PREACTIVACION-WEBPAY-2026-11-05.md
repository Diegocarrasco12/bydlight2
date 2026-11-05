# Cierre previo a la activación de Webpay Plus — 2026-11-05

Producción no se tocó. Webpay sigue apagado (`ONLINE_CHECKOUT_UI=false`, `LEGAL_PAGES_PUBLISHED=false`). No se enviaron correos ni formularios, no se usaron credenciales productivas y no se hicieron transacciones.

## A. Trabajo realizado
Los hallazgos de la auditoría están en la sección C. Casi todo lo técnico y visual ya estaba hecho en las Fases 2 a 6. Esta jornada se verificó el estado real y se cerraron los vacíos que sí se podían cerrar:

| Cambio | Archivo |
|---|---|
| Política de privacidad (borrador). Describe solo lo que el sitio hace hoy; lo legal queda como `[PENDIENTE]`. | `src/app/privacidad/page.tsx` (nuevo) |
| Información comercial y medios de pago (borrador). | `src/app/informacion-comercial/page.tsx` (nuevo) |
| Los términos enlazan a la privacidad en lugar de "redactar y aprobar". | `src/app/terminos/page.tsx` |
| El verificador de producción exige que las dos páginas nuevas respondan 404 mientras no se publiquen. | `scripts/verify-prod-lockdown.mjs` |

Las páginas legales siguen con el aviso "BORRADOR", `noindex`, fuera del sitemap y con 404 en producción.

## B. Validaciones (ejecutadas hoy)
- `npm test`: 41/41.
- `npx tsc --noEmit`: sin errores.
- `npm run lint`: sin errores.
- `npm run build`: OK (`next-env.d.ts` restaurado).
- `npm run verify:prod`: 31/31 sobre el artefacto, incluidos los 404 de las 6 páginas legales.
- **No ejecutado:**
  - Pruebas contra el sandbox real de Transbank: la evidencia de integración es de la Fase 5 (`EVIDENCIAS-INTEGRACION-WEBPAY.md`) y no se repitió hoy.
  - E2E y responsive en navegador: la comprobación visual de las pantallas de pago es de la Fase 6; las dos páginas nuevas usan el mismo componente `LegalPage` y no se capturaron.
  - Accesibilidad automatizada.
  - Estado de HTTPS en Cloudflare: no se consultó el dominio público hoy.

## C. Pendientes
| Pendiente | Clasificación |
|---|---|
| Código de comercio productivo y API Key | Depende de Transbank (asuntos comerciales; llamar al 600 638 6380) |
| Cuenta de abono: persona natural frente a SpA | Depende de Transbank (consulta incluida en el borrador de correo) |
| Formulario de validación (SDK/desarrollo propio, con tokens) | Depende de Diego, solo con código productivo |
| Decisiones D1–D13 y 22 campos legales; revisión de privacidad por abogado | Requiere aprobación de Diego y asesor |
| D10: casilla de aceptación de términos en el pago | Requiere aprobación (cambio funcional, no hecho) |
| Aprobar logo 130×59 (`docs/evidencias-webpay/logo-130x59.png`) | Requiere aprobación de Diego |
| "Always Use HTTPS" en Cloudflare | Requiere a Diego (configuración externa) |
| Volumen `/data`, política del ejecutor y `accept-compose` | Requiere al administrador |
| Respaldos programados y reconciliación periódica | Requiere al administrador |
| Consultar `status` con `TBK_TOKEN` en el flujo abortado | Implementable; se dejó sin tocar para no alterar la lógica certificada |
| Prueba real de $50 | Posterior a la validación |

## D. Decisiones para Diego
1. ¿Apruebas el logo 130×59 generado desde `logo2.png`?
2. D10: ¿casilla de aceptación de términos en la orden, o aceptación en la cotización fuera del sitio?
3. ¿Contratas un asesor legal para D1–D13 y la privacidad? Mientras no haya revisión, las páginas no se publican.
4. IVA (D2): ¿precios + IVA o IVA incluido?
5. ¿Autorizas implementar la consulta `status` con `TBK_TOKEN` al abortar (bajo riesgo, con prueba)?
6. ¿Autorizas activar "Always Use HTTPS" en Cloudflare?

## E. Cercanía a la activación
Lo técnico está listo, probado en integración y apagado. La preparación sigue **NO LISTA** por causas externas: código productivo, textos legales aprobados, HTTPS forzado e infraestructura del volumen. Cuando Transbank entregue el código, el procedimiento es el de `ACTIVACION-WEBPAY.md` §0 y §4 y `FASE6-CHECKLIST-ACTIVACION-WEBPAY.md`:
1. Respaldar y verificar variables.
2. Aplicar el volumen `/data` y `accept-compose` (administrador).
3. Crear `payments.json` con `enabled:false`.
4. Completar el formulario y esperar la API Key.
5. Hacer la compra de $50 con `enabled:true` solo durante la prueba.
6. Cambiar `ONLINE_CHECKOUT_UI=true` y `LEGAL_PAGES_PUBLISHED=true` (con aprobación).
7. `fetch → build → up → verify → status` y monitoreo.
8. Rollback disponible con el SHA anterior.

## F. Git
- Rama `feature/rediseno-2026`, sin commits nuevos ni push (esperan tu autorización).
- Modificados: `src/app/terminos/page.tsx`, `scripts/verify-prod-lockdown.mjs`, `docs/PENDIENTES.md` (previo).
- Nuevos: `src/app/privacidad/`, `src/app/informacion-comercial/` y este informe.
- Sin versionar y sin tocar: `r-og.png`, `demos/windows-inventory/obj/` y las carpetas de evidencias.

## G. Próxima acción
Diego llama a Transbank (600 638 6380) para saber qué asunto comercial bloquea el código de comercio y si abonan a cuenta personal. Mientras tanto, responde las decisiones de la sección D.
