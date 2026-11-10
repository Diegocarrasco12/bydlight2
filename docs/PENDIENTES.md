# Pendientes para futuras jornadas

Actualizados al cierre del 2026-10-28 (Fase 3 desplegada). **Ninguno debe ejecutarse sin que el titular lo pida**; los que tocan producción, Cloudflare o envían datos reales requieren autorización.

## Etapa B: estado y pendientes reales (actualizado 2026-11-10)
**Decisiones del titular (2026-11-10, definitivas):** la publicidad de Webpay Plus y las páginas y textos legales publicados **se mantienen** (`ONLINE_CHECKOUT_UI=true`, `LEGAL_PAGES_PUBLISHED=true`); las gestiones legales y tributarias ya se hicieron y **no se repiten**; la compra controlada de $50 ya se hizo y **no se repite**. Evidencia en el repo: compra real de $50 de la Etapa A (`BYDLIGHT-ETAPA-B-ACTIVACION.md`) y 1 orden con 1 pago autorizado de $50 en la base migrada (2026-11-09). Los comprobantes legales/tributarios no están en el repo: constan por declaración del titular. Las listas D1–D10, validación SII y compra de $50 de documentos anteriores son histórico, no tareas.

**Completado:** Etapa B desplegada (`b28448196fb`), base v5 verificada, correo Brevo implementado y probado (cola persistente, deduplicación, reintentos, 17 pruebas) con diagnóstico `mail-check`, modo piloto, lockdown/pilot verificados.

**Pendientes reales (todos dependen de una persona):**
1. **Brevo (titular):** crear clave API, autorizar la IP del servidor, `--init` con entrada oculta, `mail-check` (si el código nuevo está desplegado), `enabled=true`, `mail-test`, revisar bandeja y Spam, y confirmar el destino de EmailJS (D8). Guía: `docs/BREVO-CLAVE-API-PASOS.md`. Hoy `mail.json` no existe: no se envía ningún correo.
2. **Pagos públicos en el servidor (titular):** `payments.json` sigue con `enabled:false` (último dato, 2026-11-09); abrir `enabled=true` y `access=public` (`payments-config-set.mjs`, efecto en ≤ 5 s) cuando el titular decida; devoluciones (`adminRefunds`) apagadas.
3. **Despliegue del código nuevo (administrador, con autorización):** producción corre `b28448196fb`. Rama publicada en `origin/etapa-b/checkout-publico` (2026-11-10, `main` sin tocar). Verificado con `git diff b28448196fb..HEAD`: lo único con efecto en ejecución son `src/lib/mail/transport.ts`, `src/app/api/admin/route.ts` y `scripts/admin-remote.mjs` (`mail-check`); no cambian Dockerfile, Compose, `package.json`, `next.config.ts` ni migraciones (el resto es documentación, `docs/deploy/` y pruebas), por lo que `compose-diff` debe dar «línea base igual» y los datos de `/data` se conservan. No es necesario para operar; solo si se quiere `mail-check` en producción: `fetch → preflight → compose-diff → build → up → verify` con el SHA completo de la punta de la rama (`git ls-remote origin etapa-b/checkout-publico`). Requiere autorización del titular.
4. **Administración:** restaurar `bd-deploy.ps1` desde `deploy/executor/claude-code/` (ausente a 2026-11-10; sin él Claude no consulta el servidor); conservar el respaldo v3 de `/srv/bydlight-prod/backups/`; depuración de datos personales (`05-caducidad-respaldos.sh`, 90 días propuestos).

Rollback: `sudo bd-run rollback` basta (el código anterior ignora las migraciones 4 y 5); restaurar el respaldo v3 es el último recurso y perdería lo escrito después de él.

## Habilitación para clientes reales (preparada 2026-11-06, ver `WEBPAY-HABILITACION-PRODUCCION.md`)
Código listo en el commit local `52e11dd` (sin push). Bloqueos de la activación pública: datos legales y titularidad, marcas de tarjeta, correos transaccionales, documento tributario. Etapa A (despliegue técnico, checkout cerrado) y Etapa B (activación) con su aprobación expresa.

## Webpay Plus: del despliegue a la activación (2026-11-06)
1. **Titular:** desplegar con `docs/DESPLIEGUE-WEBPAY-UBUNTU.md` (solo `bd-run`, cobros apagados) y verificar. 2. **Titular:** modo piloto + cotización de prueba ($100, anticipo $50) + **compra real de $50**, y verificar el comprobante. 3. **Información externa:** marcas de tarjeta habilitadas (área comercial de Transbank), datos legales y titularidad del comercio (persona natural vs SpA): `LEGAL-DATOS-PENDIENTES.md`. 4. **Después, con aprobación:** publicar legales, `ONLINE_CHECKOUT_UI=true`, `LEGAL_PAGES_PUBLISHED=true`, despliegue y `access=public`. Devoluciones (`adminRefunds`) siguen apagadas.

## SEO tras la Fase 6 (revisión 2026-11-04, ver `SEO_REVISION_2026-11-04.md`)
Titular: Search Console + Bing Webmaster + analítica sin cookies; perfiles externos «Byd Light Solutions SpA»; «Always Use HTTPS»/HSTS en Cloudflare. Código (con aprobación): ampliar `desarrollo-web`, `ecommerce`, `mantenimiento-web` y casos de proyectos; acortar 3 títulos y 2 descripciones; `lastmod` real; `sameAs`; blog (SAP Business One primero). Posicionamiento real no verificado.

## Fase 6.1 — antes de publicar (a cargo del equipo; ver `ENTREGA-FASE6.md`)
(1) Verificar `status`/`list-releases` (desplegado, anterior distinto, salud OK) y respaldar el estado del ejecutor; (2) push y publicación con el procedimiento de la entrega; (3) verificaciones posteriores y rollback si hace falta. Decidido: el temporizador del 3D se mantiene en 3,5 s y el rendimiento queda cerrado. El cliente `bd-deploy.ps1` falta en el equipo de Claude Code; no bloquea (publica el equipo).

## Fase 6 — publicación visual (preparada, sin ejecutar)

Autorizar `status`/`list-releases`; aprobar los 4 commits y el push; autorizar fetch→build→up ([plan](FASE6-PLAN-DESPLIEGUE.md)); completar datos legales ([propuestas](WEBPAY-PROPUESTAS-LEGALES.md)); decidir logos sin uso, logo oficial de Webpay, correos transaccionales y carpetas de evidencia pesadas. Activación de Webpay: [checklist](FASE6-CHECKLIST-ACTIVACION-WEBPAY.md), bloqueada hasta Transbank.

## Webpay Plus (Fase 5 hecha en local 2026-11-04; nada desplegado ni en commit)

Estado y evidencias: `docs/WEBPAY-EXPEDIENTE-CERTIFICACION.md`, `docs/WEBPAY-CHECKLIST-CERTIFICACION.md`, `docs/WEBPAY-REQUISITOS-OFICIALES.md`. **Hecho en Fase 5:** casos reales en integración (AMEX, Redcompra ×2, prepago, cuotas, cancelación y reintento, devoluciones, `REVERSED`, timeout, expiración) y borrador de correo. **Pendiente, en este orden:** (a) confirmar con Transbank la afiliación `1-12087316724` y el **código de comercio productivo** (sin él no validan); (b) enviar el correo `docs/WEBPAY-CORREO-CERTIFICACION.md` (borrador, **no enviado**) tras completar los datos y la pregunta de la cuenta de abono; (c) decidir D1–D13 de `docs/WEBPAY-PROPUESTAS-LEGALES.md` (22 campos legales, privacidad, retracto) con un asesor; (d) aprobar el logo `docs/evidencias-webpay/logo-130x59.png`; (e) abrir y completar el formulario de validación (`https://form.typeform.com/to/ibXdg6Av`; el titular, no Claude); (f) HTTPS público forzado (Cloudflare); (g) infraestructura (volumen `/data`, política del ejecutor, `accept-compose`), llave de producción y compra real de $50 solo tras la conformidad; (h) opcional: consultar `status` con `TBK_TOKEN` en el flujo abortado y programar `reconcile` periódico. No se declara certificado hasta la conformidad escrita de Transbank.

## Prioridad de la siguiente jornada

**SEO (publicado 2026-10-28, `5fef157`):** (a) verificar el dominio en Google Search Console (TXT en Cloudflare), enviar `sitemap.xml`, pedir indexación de las páginas prioritarias y anotar la línea base (guía en `docs/SEO_ESTRATEGIA_GOOGLE.md` §6); (b) aprobar los temas del plan editorial y crear la sección de blog (SEO Fase 4); (c) perfiles externos coherentes («Byd Light Solutions SpA») por la confusión con BYD; (d) Cloudflare «Always Use HTTPS» (`http://` responde 200), con autorización; (e) comprobar con `-Op status` / `list-releases` en PowerShell que `anterior` sea distinto de `desplegado` (rollback); (f) medir a 30/60/90 días clics, impresiones, CTR y solicitudes de cotización.

0. **Fase 3 (hero «red de nodos», ERP/SaaS):** (a) medir fps/GPU/batería del 3D en un teléfono real (el navegador automatizado limita `requestAnimationFrame`); (b) en teléfonos de ~640 px de alto el CTA principal del hero queda tras la barra inferior fija al cargar (la barra ofrece la misma acción): decidir si se ajusta; (c) retirar el código legado del átomo (`HeroStage.tsx`, `scene.ts`, reglas `.hx*` de `design.css`) tras comprobar que nada lo importa; (d) varias metadescripciones existentes superan 160 caracteres; (e) confirmar con el titular el alcance comercial de ERP/SaaS y la redacción de SAP Business One como capacidad; (f) revisar `logs` del contenedor tras el despliegue (no se pudo ejecutar el ejecutor en esta sesión después de que desapareciera el cliente).

1. **Lighthouse/PageSpeed sobre `https://bydlightsolutions.com/`** (móvil y escritorio) con HTTPS y caché reales, idealmente desde un equipo sin la inyección de Kaspersky. Comparar con
   `docs/CALIDAD_Y_PRUEBAS.md` (home móvil local 80–85, escritorio 98) y no presentar la medición local como dato de usuarios.
2. **Revisión de HSTS y CSP.** El origen no envía `Strict-Transport-Security` ni `Content-Security-Policy`. Comprobar primero si Cloudflare los agrega en el dominio público;
   evaluar dónde ponerlos (Cloudflare o `next.config.ts`). Una CSP debe permitir EmailJS, fuentes propias y los estilos/scripts en línea de Next. **No aplicar sin evaluación.**
3. **Confirmación comercial del texto «13+ años en operaciones reales»** (página Nosotros; heredado del sitio anterior). Ajustar o respaldar.
4. **Material real del portafolio:** capturas móviles de CFT Magallanes, GINFET y Angel & Eva; casos con necesidad/solución/resultado documentados por el cliente; permiso de los
   clientes para mostrar capturas (hoy no documentado en el repo). No inventar cifras, testimonios ni clientes.
5. **Prueba real del formulario de contacto** (EmailJS) con autorización del titular: hoy solo se probó interceptando la red.
6. **Diagnosticar definitivamente el código 21 del ejecutor en Claude Code** (`docs/DESPLIEGUE.md` §9). Primer paso propuesto: capturar stderr con `Start-Process -RedirectStandardError`
   desde PowerShell normal (administrador). No eludir controles de seguridad.
7. **Mejoras de rendimiento móvil** (opcional): reducir CSS/JS bloqueante de la ruta crítica, evaluar el peso del runtime en la carga inicial, revisar el coste de arranque de la escena 3D.

## Otros pendientes conocidos

- `/planes` (pre-existente): Lighthouse reportó `heading-order` (accesibilidad 98). Corregir el orden de encabezados.
- `public/og-image.png`: regenerar con la identidad nueva (no se verificó su contenido actual).
- Régimen tributario/IVA de los precios «Desde $X + IVA» (`IVA_LABEL`, `PRICE_NOTE` en `src/lib/plans.ts`).
- Videos: solo si se aporta material propio o con licencia verificable (la licencia «Restricted» de Mixkit no se pudo comprobar).
- Evidencia de proyectos para tecnologías declaradas (Python, Java/Spring Boot, PHP, Flutter, SQL Server, PostgreSQL, MySQL, Windows Server/IIS, SAP Business One Service Layer): hoy son
  **capacidades**, no casos demostrables; añadir casos solo con respaldo y permiso del cliente.
- Transbank/Webpay: integración técnica avanzada en local (Fase 2); falta validación/certificación de Transbank, infraestructura (volumen + configuración) y `accept-compose` (`docs/ACTIVACION-WEBPAY.md`, `docs/WEBPAY-CERTIFICACION.md`).
- Proyectos excluidos del portafolio por decisión previa: Logistic Control Center, Tu Farmacia Digital (dominio sin resolver al momento) y Constructora MYD (503 al momento). Reevaluar.
- Revisión visual manual de todas las páginas internas en todos los anchos (hoy solo comprobación automática de desbordes más capturas selectivas).
- Pruebas del ejecutor (`cd deploy/executor && python -B -m unittest discover -s tests`): reejecutar si cambia algo en `deploy/`.
- `DEPLOY.md` §8 describía pasos ya completados; se actualizó el 2026-10-27, pero revisar el resto de la guía si se reinstala el ejecutor.
- Limpieza opcional: `tsconfig.tsbuildinfo` ahora en `.gitignore`; `public/img/logos/logo1,3,4,5,6.png` parecen sin uso (no verificado).

## No son pendientes (decisiones cerradas)

Webpay seguirá apagado; WordPress no vuelve; no se purga Cloudflare; no se modifican el túnel ni el DNS desde aquí.
