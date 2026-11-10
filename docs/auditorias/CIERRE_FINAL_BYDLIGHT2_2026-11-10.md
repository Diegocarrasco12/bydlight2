# Cierre final Bydlight2 (2026-11-10)

Base: auditoría E2E del 2026-11-10. Rama `etapa-b/checkout-publico`, SHA base `466c6b491d19feee2db831a42b9e735428760eb9`. **Candidato: cambios locales sin commit** (ver §E). Producción: `b28448196fb89f9814621a709475029ae086dd21`. Nada de lo descrito aquí está desplegado ni validado en producción.

## A. Resumen ejecutivo
- **Corregido en el código (local):** los dos formularios públicos podían enviar datos personales por GET en la URL si el JavaScript fallaba; ahora son POST. Se añadieron HSTS (vigencia 1 día) y una CSP en modo solo informe. Se eliminaron del lint los 7 errores que venían de código ajeno minificado.
- **Intermitencia (P1):** se separó en dos causas. (1) HTML antiguo servido desde la caché del navegador de pruebas: **demostrado**. (2) Cortes breves 502/timeouts del origen o el túnel: **reproducidos otra vez el mismo día, causa no demostrable sin logs del servidor**; queda como acción de TI.
- **HTTP→HTTPS:** no se resuelve en el código; requiere Cloudflare. Instrucciones exactas en §F.
- **Sitemap:** el hallazgo se descarta. Las páginas legales y el checkout son `noindex` y no deben figurar.
- **Pruebas:** 190/190 (182 anteriores + 8 nuevas), tipos, lint y build correctos.

## B. Matriz de hallazgos
| ID | Problema | Causa | Corrección | Evidencia | Estado |
|---|---|---|---|---|---|
| P1-a | Portada con estilos rotos y chunks 404 (`text/plain`), videos 404 | HTML de una versión antigua (anterior al 2026-10-27, con `hero2/3.mp4` que ya no existen) servido desde la **caché del navegador** automatizado | Ninguna necesaria: la política vigente (`max-age=0, must-revalidate`) ya evita HTML viejo | `performance.getEntriesByType('navigation')`: `transferSize 0`, `encodedBodySize 20764`, título antiguo; sin service worker ni Cache Storage; `/?auditoria=2` y 14 chunks vigentes responden 200 | **Demostrado; no es defecto del servidor.** Usuarios que visitaron la versión antigua podrían tener HTML en caché de forma residual (mitigado por la política actual) |
| P1-b | 502, timeouts, `ERR_HTTP2_PROTOCOL_ERROR`, TTFB de 9–17 s | Origen o túnel con cortes breves. **No demostrada** | Ninguna en el código | Episodios 14:50–14:55 UTC y 16:11–16:12 UTC: de 5 peticiones a `/`, una agotó 25 s, una tardó 17 s y una dio 502. Un `fetch` desde el navegador devolvió la página «502: Bad gateway» de Cloudflare. Control (`cloudflare.com`) y `/cdn-cgi/trace` normales; 20 peticiones posteriores a `/` y `/servicios` en 200 con TTFB estable de 0,34–0,39 s | **ABIERTO.** Hipótesis: reinicio o límite del contenedor (`mem_limit 512m`, `cpus 1.0`) o reconexión del túnel. Comprobación pendiente en §F |
| P2-a | `http://` responde 200 sin redirigir | «Always Use HTTPS» no activo en Cloudflare | Ninguna en el código a propósito (evita bucles; el origen recibe HTTP desde el túnel) | `curl -sI http://bydlightsolutions.com/` → 200 | **Acción de TI** (§F) |
| P2-b | Formularios con GET implícito | `<form>` sin `method`: antes de hidratar, el navegador envía por GET (nombre, correo y mensaje en la URL) | `method="post"` en `ContractForm.tsx` (con `action="/api/solicitudes"`) y `ContactForm.tsx`. Sin JS, la API solo acepta JSON: responde error y no crea nada | Pruebas CS1/CS2; el formulario renderizado del build local declara `post`; POST urlencoded local → 503 sin crear orden. Con JS el envío no cambia (`fetch` POST JSON, `disabled={busy}`) | **Corregido en local; pendiente de despliegue** |
| P2-c | Sin HSTS ni CSP | No existían | `src/lib/securityHeaders.ts`: HSTS `max-age=86400` sin preload ni subdominios; CSP **Report-Only** | CS3–CS5. Build local: cabeceras presentes. 0 violaciones CSP en `/` y `/contacto` (build de producción local). En `/contratar` (servidor de desarrollo) solo aparecen avisos de `unsafe-eval`, propios de React en desarrollo | **Corregido en local (CSP sin bloquear).** Aplicar la CSP queda pendiente (§D) |
| P2-d | Sitemap sin `/terminos`, `/privacidad`, `/devoluciones` | Son `noindex`; listarlas sería incoherente | Ninguna; prueba CS6 fija el criterio | `index: false` en las 4 páginas | **Descartado** |
| P3-a | 7 errores de lint | `bydlightredes/upstream/static/js/{alpine,cropper}.min.js` (3 + 4): JS minificado de terceros, no versionado | `eslint.config.mjs` ignora `bydlightredes/`, `assets-fuente/`, `demos/`, `.playwright-mcp/` | `eslint` por archivo; ahora 0 errores | **Corregido** |
| P3-b | Barra flotante sobre el selector en móvil | Artefacto de la captura a página completa | Ninguna | A 360 px, con scroll al final, la barra no se superpone al botón de envío; sin desborde horizontal | **Descartado** |

## C. Resultados de pruebas (local, sin credenciales ni red)
- `npm test`: **190 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas.**
- `npx tsc --noEmit`: sin errores.
- `npm run lint`: 0 errores.
- `npm run build`: correcto.
- Pruebas nuevas `tests/cierre-seguridad.test.mjs` CS1–CS8: método POST de los formularios, protección de doble clic, API solo JSON, HSTS, CSP compatible con Webpay/Next/EmailJS/Cloudflare, sitemap y lint.
- **Cobertura funcional ya existente** (punto 9): solicitud y validación, términos, monto solo desde el servidor, aprobado, rechazado, cancelado, retorno duplicado, monto manipulado, pago interrumpido, timeout, pagos simultáneos, idempotencia, reinicio y persistencia, comprobante e IVA/CLP (`tests/payments.test.mjs`, `webpay-fase2.test.mjs`), correo, reintentos y recuperación (`tests/brevo.test.mjs`, 17 pruebas). **No añadí pruebas nuevas ahí.** La UI no se ejercita de extremo a extremo con un navegador y mocks.
- **Visual** (local, vista previa de `/contratar`): 360, 390, 768 y 1440 px reales, sin desborde horizontal (`scrollWidth = clientWidth`). Menú móvil y barra visibles. Capturas en `docs/auditorias/capturas-2026-11-10/`. El `/contratar` público no se probó de nuevo en esta ronda.
- No ejecutado: envío real del formulario, pago, correo y CSP en `/contratar` con el build de producción, porque requieren producción o el checkout abierto.

## D. Seguridad
**Implementado en el código (sin efecto hasta desplegar):** formularios sin GET, HSTS de 1 día, CSP en modo informe, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `no-store` y `noindex` en `/orden` y `/api`.

**CSP:** `form-action` permite `webpay3g.transbank.cl` y `webpay3gint.transbank.cl` porque la página de redirección (`redirect-page.ts`) envía `token_ws` por POST con un script en línea. `script-src` lleva `'unsafe-inline'` por los scripts de Next. Para aplicarla: desplegar, revisar la consola en `/`, `/contratar`, `/orden/<id>` y la redirección real a Webpay, y solo entonces renombrar la cabecera a `Content-Security-Policy`. **No recomendada todavía**: la compra real no se repite, así que la redirección a Webpay no se verificó con CSP.

**HSTS:** vigencia de 1 día. Subir a 6–12 meses tras 1–2 semanas con HTTPS forzado. `preload` e `includeSubDomains` no se activan sin aprobación.

**Requieren intervención manual:** HTTPS forzado (Cloudflare) y revisión del origen (P1-b).

## E. Release
- **Archivos modificados:** `next.config.ts`, `src/components/checkout/ContractForm.tsx`, `src/components/contact/ContactForm.tsx`, `eslint.config.mjs`. **Nuevos:** `src/lib/securityHeaders.ts`, `tests/cierre-seguridad.test.mjs`, este informe y `docs/auditorias/capturas-2026-11-10/`. Excluido por estar fuera del alcance: `tests/hooks.mjs` (solo saltos de línea).
- **Sin cambios** en `docker-compose.prod.yml`, `Dockerfile`, `package.json` ni `package-lock.json` respecto de `b28448196fb`: no hace falta `accept-compose`. No se tocan Webpay, Brevo ni la base de datos.
- **Qué entraría respecto de producción:** los 4 archivos de arriba, más el diagnóstico `mail-check` ya publicado en la rama (`transport.ts`, `admin/route.ts`).
- **SHA candidato:** pendiente. Existirá al hacer el commit, que requiere autorización. Base: `466c6b4`.
- **Despliegue (administrador, Ubuntu, solo `bd-run`):**
```
sudo bd-run status                        # anote la versión actual: es el rollback
sudo bash ~/03-backup-etapa-b.sh          # respaldo previo de la base
SHA=<SHA_DE_40_CARACTERES_DEL_INFORME>
sudo bd-run fetch $SHA
sudo bd-run preflight
sudo bd-run compose-diff                  # debe decir que no hay cambios; si los hay, DETENERSE
sudo bd-run build $SHA                    # anote el id; sudo bd-run job-status <ID> hasta OK
sudo bd-run up $SHA
sudo bd-run verify
sudo bd-run status
```
- **Verificación posterior:**
```
curl -sI https://bydlightsolutions.com/contratar | grep -iE 'strict-transport|content-security-policy-report-only'
curl -s https://bydlightsolutions.com/contratar | grep -o '<form[^>]*>' | head -1     # debe incluir method="post"
for i in 1 2 3 4 5; do curl -s -o /dev/null -w '%{http_code} %{time_starttransfer}s\n' "https://bydlightsolutions.com/?v=$i"; done
```
  Todas las respuestas deben ser 200 y el formulario debe declarar `method="post"`.
- **Rollback:** `sudo bd-run rollback` (vuelve a la imagen anterior; el volumen y la base no se tocan), luego `sudo bd-run verify` y `sudo bd-run status`. Nunca `down -v`. No se afectan otros contenedores.

## F. Pendientes externos
1. **HTTPS forzado (TI, Cloudflare), sin hacer nada más:** panel de Cloudflare → dominio `bydlightsolutions.com` → *SSL/TLS → Edge Certificates → Always Use HTTPS* = **On**. Equivalente: *Rules → Redirect Rules* con «Si el esquema es http → redirigir a https, 301». Comprobar:
   `curl -sI http://bydlightsolutions.com/contratar | head -3` → `301` con `Location: https://…`. No hay bucle porque el origen no redirige. Transbank no se ve afectado, porque el retorno ya es `https://` (prueba 16). Rollback: Off. No activar HSTS desde Cloudflare ni `preload`.
2. **Diagnóstico del origen (TI, solo lectura), ventanas 14:50–14:56 UTC (11:50–11:56 Chile) y 16:11–16:13 UTC (13:11–13:13 Chile):**
```
sudo bd-run status
docker inspect bydlight-prod-web-1 -f '{{.RestartCount}} {{.State.OOMKilled}} {{.State.StartedAt}} {{.State.Health.Status}}'
docker logs --since 2h bydlight-prod-web-1 2>&1 | tail -100
sudo journalctl -u cloudflared --since "2026-11-10 11:40" --until "2026-11-10 13:30" --no-pager | tail -80
docker stats --no-stream bydlight-prod-web-1
```
   Además: en Cloudflare, *Analytics → Traffic* (errores 5xx en esas horas) y *Zero Trust → Networks → Tunnels* (estado y reconexiones del conector). Interpretación: `RestartCount` alto u `OOMKilled=true` apuntan a memoria; reconexiones del túnel apuntan a red; sin ninguno de los dos, enviar la salida. No modificar `mem_limit` ni Compose sin revisar la política.
3. **Aplicar la CSP** tras la revisión de §D (decisión posterior).
4. **Subir HSTS** a 6–12 meses tras 1–2 semanas con HTTPS forzado.

## G. Veredicto: **LISTO CON ACCIONES EXTERNAS PENDIENTES**
Las correcciones de código están hechas y probadas en local, pero **no desplegadas ni validadas en producción**. El P1-b sigue abierto: no puedo afirmar que el origen sea estable. Las acciones externas (HTTPS forzado y diagnóstico del origen) no bloquean el despliegue de este código, pero el diagnóstico del origen conviene resolverlo antes de promocionar el sitio.

## H. Próximo paso exacto
1. Autorizar el commit local (y, aparte, el push de la rama) de los 4 archivos modificados, los 2 nuevos, este informe y las capturas; entonces informo el SHA completo.
2. TI aplica §F.1 y ejecuta §F.2, y envía la salida de §F.2.
3. Con el SHA, el administrador ejecuta el despliegue de §E y la verificación posterior.
4. Informar los resultados; solo entonces se aplica la CSP y se sube HSTS.
