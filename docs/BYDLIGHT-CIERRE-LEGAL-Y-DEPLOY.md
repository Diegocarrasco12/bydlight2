# Cierre legal, comercial y preparación de producción (2026-11-06)

Estado: **todo implementado en local, sin push, sin despliegue y sin activar cobros públicos.** Producción sigue con `enabled=false`, `access=pilot`, `adminRefunds=false`. La habilitación de Transbank no se trata como pendiente: hay confirmación escrita y una compra real de $50 aprobada (orden `3SJR79AE5RX8`, no modificada).

**Alcance honesto:** esto es implementación técnica y redacción preparatoria. **No es asesoría jurídica ni certificación de cumplimiento.** Las páginas legales siguen ocultas en producción (`LEGAL_PAGES_PUBLISHED=false`) y muestran un aviso de borrador en la vista previa hasta que usted las apruebe.

## 1. Datos comerciales utilizados (`src/lib/company.ts`)
Razón social Bydlight Solutions SpA · RUT 78.161.844-6 (de la sociedad) · SpA · giro: consultoría y desarrollo de software y sitios web · domicilio S Guerra 326, Buin, Región Metropolitana, Chile · afecto a IVA (primera categoría). Teléfono +56 9 8324 9135 (ya existente en el sitio). **No se publican:** RUT personal del solicitante, su nombre, ni la calidad de representante legal (no verificada); código de comercio Transbank; credenciales. Una prueba automática impide que el RUT personal o el código de comercio aparezcan en `src/`.

## 2. Documentos creados o actualizados
| Documento | Cambio |
|---|---|
| Términos de contratación | Reescrito: identificación, consumidores vs. empresas, cotización, aceptación expresa y registro, precios/IVA, anticipo/saldo, comprobantes y documentos tributarios, plazos, propiedad intelectual y licencias, terceros, garantías, ley aplicable y reclamos. Sin porcentajes, plazos ni penalizaciones inventados: lo específico remite a la cotización. |
| Cancelación, retracto y devoluciones | Reescrito sobre art. 3 bis y 12 A de la Ley 19.496; no excluye el retracto ni declara irreembolsables los anticipos; devoluciones por Transbank, sin devoluciones automáticas (`adminRefunds=false`). |
| Privacidad | Reescrito con lo que el sistema realmente guarda (incluye los últimos 4 dígitos), proveedores reales (Transbank, EmailJS, Cloudflare), cookies, conservación y derechos (Ley 19.628 y 21.719 prevista 01-12-2026). |
| Información comercial, servicios digitales, soporte | Completados con datos oficiales; sin marcadores. |
| Pie de página, `/contacto`, comprobante, resumen previo al pago | Identificación del proveedor (pie y contacto solo cuando las páginas legales son visibles; comprobante y resumen siempre). Comprobante: «RUT del comercio»; razón social oficial. |
| `TERMS_VERSION` | `borrador-2026-11-06-r2` (cambió el texto). **Al aprobar, fijar la versión definitiva** (fecha de aprobación, sin «borrador»). |
Sin cambios: lógica financiera, montos, Transbank, credenciales, `payments.json`, diseño Signature (D).

## 3. Requisitos revisados (fuentes, consultadas el 2026-11-06)
- **Ley 19.496 (BCN, `idNorma=61438`), arts. 3 bis y 12 A:** retracto en contratos por medios electrónicos: 10 días desde la contratación del servicio y antes de su prestación; **90 días si el proveedor no envía la confirmación escrita del art. 12 A**; devolución sin retención de gastos y antes de 45 días; en servicios, solo se devuelven las sumas que no correspondan a servicios ya prestados. *Limitación:* se leyó el texto vía la API de la BCN solo en parte (≈100.000 de 299.330 caracteres) y con citas acotadas; un abogado debe confirmar el texto vigente, en especial si procede alguna excepción para servicios a medida (no se asumió exclusión).
- **SERNAC** (portal, retracto): 10 días en compras electrónicas; no detalla excepciones. **SII** (voucher como boleta): el comprobante de pago electrónico vale como boleta según el modelo de emisión que el contribuyente declare («no emito boleta con pago electrónico» o «siempre emito boleta»); pagos por transferencia/efectivo siempre requieren boleta; la página no fija reglas de facturas.
- **Ley 21.719 (ficha BCN):** publicada el 13-12-2024, vigencia prevista el **01-12-2026**; derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo. Se encontró una referencia no verificada a un proyecto de postergación (boletín 18.623-07): **confirmar su estado antes de publicar**.
- **Transbank Developers:** no se volvió a consultar (no hay hechos nuevos); la autorización de logos y la habilitación productiva constan por escrito.

## 4. Los 22 pendientes legales anteriores y su resolución
(En el código había 33 apariciones de `<Pend>`; se agrupan en 23 ítems.)
| # | Pendiente | Resolución |
|---|---|---|
| 1–2 | RUT y domicilio de la sociedad | **Resuelto** con la declaración del SII. |
| 3 | Régimen tributario/IVA | **Parcial:** afecto a IVA (1ª categoría); planes «más IVA» ya existente. **Decisión C (§5).** |
| 4–5 | Plazo de respuesta y horario | Sin cifras (no se inventan). Texto neutro. Decisión G. |
| 6 | Alcance de soporte posterior | Remite a la cotización. |
| 7 | Cuotas | No se menciona ni promete. Pendiente de Transbank si se ofrecerán. |
| 8 | Plazo de anulación | Remite a Transbank y al banco emisor, sin plazo. |
| 9 | Habilitar texto de Webpay | **Resuelto** (confirmación escrita de Transbank). |
| 10 | Quién contrata terceros | Remite a la cotización. |
| 11–12 | Retrasos y atraso del saldo | Retrasos: nuevo calendario por escrito; saldo: condiciones de la cotización. |
| 13 | Garantía | Garantías legales + lo que ofrezca la cotización. |
| 14 | Propiedad intelectual | Remite a la cotización; decisión G. |
| 15–17 | Entrega/aceptación, revisiones, disponibilidad | Remiten a la cotización/plan; sin garantía de terceros. |
| 18 | Confidencialidad y datos | Redactado y alineado con privacidad. |
| 19–20 | Devolución antes de iniciar / con trabajo en curso | Retracto legal + evaluación del trabajo ejecutado, sin porcentajes. **Decisión F.** |
| 21 | Retracto | Implementado según art. 3 bis; **revisión de abogado recomendada.** |
| 22 | Privacidad (finalidades, proveedores, cookies, conservación, derechos) | Implementado; **plazos de conservación sin cifras (decisión H).** |
| 23 | Ley aplicable y reclamos | Redactado genérico (ley chilena, SERNAC, tribunales competentes); revisión legal. |

## 5. Decisiones que requieren su aprobación (preguntas concretas)
- **A. Correo público:** el sitio usa `contacto@bydlightsolutions.com`; usted indicó `bydlightsolutions@gmail.com`. ¿Cuál se publica? (No se cambió.)
- **B. Nombre:** en documentos legales y comprobante se usa la razón social «Bydlight Solutions SpA» (antes «Byd Light Solutions SpA»); la marca del pie sigue «Byd Light Solutions». ¿Conforme?
- **C. IVA de las cotizaciones:** los planes dicen «+ IVA», pero la cotización guarda un único monto que es lo que se cobra en Webpay. ¿El monto que se aprueba incluye IVA? Recomendado: que el total cobrado sea el valor con IVA y que la nota de la cotización lo diga.
- **D. SII (contador):** ¿qué modelo de emisión declaró (voucher válido como boleta, o siempre boleta)? ¿Cómo se emiten facturas a empresas? ¿Cómo se trata tributariamente el anticipo? Hasta saberlo, el sitio solo dice que el comprobante **no** reemplaza el documento tributario.
- **E. Confirmación escrita del contrato (art. 12 A):** el sitio **no envía correos**. Sin confirmación escrita el plazo de retracto sube a 90 días. ¿Implementamos correo transaccional (proveedor/remitente) o se acuerda un proceso manual (usted envía la confirmación tras cada pago)?
- **F. Cancelación:** ¿aprueba el texto («no se consideran irreembolsables todos los anticipos; se evalúa el trabajo ejecutado») o prefiere fijar reglas con un abogado?
- **G. Comerciales:** propiedad intelectual (cesión o licencia estándar), garantía adicional, horario y plazo de respuesta: ¿se definen ahora o quedan «según cotización»?
- **H. Conservación de datos:** plazos concretos por tipo de dato (órdenes y pagos, contacto).
- **I. Clientes empresa vs. consumidor:** ¿venderá también a empresas con condiciones propias? (el texto lo distingue).
- **J. Indexación:** al publicar, ¿se permite que Google indexe las páginas legales? (hoy `noindex`).
- **K. Representación legal:** no se declara; si debe constar, indique la persona y la fuente.

## 6. Resultado de pruebas (2026-11-06)
`tsc` limpio · ESLint `src scripts tests` limpio · `npm test` **81/81** (73 + 8 nuevas de cierre legal) · build correcto · `verify:prod` 36/36 · `verify:pilot` 32/32 (se actualizó la versión de términos del script) · 8 páginas × 4 anchos (1440/768/390/320) sin desbordes, sin `[PENDIENTE]`, con RUT de la sociedad y todos los enlaces internos en 200 · Sin secretos en el diff. Pruebas de Webpay/pagos sin cambios (73 previas verdes). El lint completo (`npm run lint`) sigue fallando por la carpeta ajena `bydlightredes/` (no es de este proyecto).

## 7. SHA del release
Commit local de código: `a44f90186cb88239b0e77ebd30c61df570952ca8` (rama `feature/rediseno-2026`, **sin push**). Parte de `dfc7fbd0e7a0084532fd24cb2370004c8c8891ee`. El SHA a desplegar será el del commit final que usted autorice publicar (un commit posterior de documentación no cambia el código). Producción actual: `530b95c645fff70b3a2385fbc1ca4c41fe09d423`; anterior estable `df19553c28e0c0c24d3d725e7eae373fa366a00c`.

## 8. Comandos de despliegue (del runbook `docs/DESPLIEGUE-WEBPAY-UBUNTU.md`, sin cambios; Compose no cambia → sin `accept-compose`)
```
SHA=<SHA_DE_40_CARACTERES>
sudo bd-run status ; sudo bd-run list-releases
sudo bd-run fetch $SHA ; git -C /srv/bydlight-prod/app rev-parse HEAD   # debe ser $SHA
sudo bd-run preflight ; sudo bd-run compose-diff                        # sin cambios de Compose
sudo bd-run build $SHA ; sudo bd-run job-status <ID>                    # repetir hasta OK
sudo bd-run up $SHA ; sudo bd-run verify ; sudo bd-run status
```
Etapa A deja los pagos cerrados: esperado `/` 200, `/contratar` 307, `/terminos` 404 (aún sin publicar), `/vista-previa` 404, POST solicitudes 503.

## 9. Activación de Webpay (Etapa B; solo con su autorización)
Prerrequisitos: decisiones A–F aprobadas, **E resuelta** (confirmación escrita), revisión legal de los textos y D respondida. Entonces: (1) en código: `TERMS_VERSION` definitiva, `LEGAL_PAGES_PUBLISHED=true`, `ONLINE_CHECKOUT_UI=true`, decidir indexación (J); actualizar `verify-prod-lockdown`/`verify-prod-pilot` y pruebas L3/G7 (hoy exigen páginas ocultas); pruebas, build, commit, push y despliegue con el §8. (2) `payments-config-set.mjs /data/config/payments.json enabled=true access=public` (efecto ≤ 5 s). (3) Compra mínima autorizada por usted + `audit`. (4) Vigilancia 48 h con `audit`/`reconcile`.

## 10. Rollback
Inmediato (sin redeploy): `payments-config-set.mjs … enabled=false` o `access=pilot`. De código: `sudo bd-run rollback`, `verify`, `status`. Nunca `down -v` ni borrar el volumen. Antes de Etapa B: respaldo con `orders-admin.mjs backup` (runbook §6.7).

## 11. Riesgos pendientes
Plazo de retracto de 90 días mientras no exista confirmación escrita (E); textos sin revisión de abogado (art. 3 bis leído parcialmente); IVA y modelo SII sin confirmar (C, D); posible postergación de la Ley 21.719 sin verificar; conciliación sin programar; el limitador de peticiones es en memoria; carpeta ajena `bydlightredes/` y `CLAUDE.md` modificados por terceros en el árbol (no incluidos).
