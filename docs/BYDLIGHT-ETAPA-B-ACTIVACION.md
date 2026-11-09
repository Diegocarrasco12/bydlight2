# Etapa B: activación comercial de Webpay Plus (preparada, NO ejecutada)

Preparado el 2026-11-09 en la rama local `etapa-b/checkout-publico` (sin push). **No se modificó producción ni se abrió ningún pago público.** La Etapa A (`13aaf17`) está desplegada y con una compra real de $50 exitosa. Este documento es autocontenido: el procedimiento de la sección 6 se pega en Ubuntu sin otros documentos.

## 1. Qué cambia en el código (mínimo, 3 constantes)
| Archivo | Cambio | Efecto |
|---|---|---|
| `src/lib/plans.ts` | `ONLINE_CHECKOUT_UI = true` | Los botones de plan llevan a `/contratar`; se anuncia Webpay Plus (llave 1 de código). |
| `src/lib/legal.ts` | `LEGAL_PAGES_PUBLISHED = true` | Se publican las 6 páginas legales + `/legal`; correos incluyen enlaces; pie con datos de la sociedad (llave 2). Si quedara un marcador de dato pendiente, `next build` falla. |
| `src/lib/terms.ts` | `TERMS_VERSION = "2026-11-09-r1"` | Versión definitiva (sin «borrador»); cada aceptación queda ligada a ese texto. **Ajustar a la fecha de aprobación real** si difiere (una línea + recompilar). |

**Tres llaves, abrir en orden y cerrar en cualquier momento:** (1) código con las dos constantes (despliegue), (2) `payments.json` con `enabled=true` y `access=public` (efecto en ≤ 5 s, sin redeploy), (3) cada cotización la aprueba el titular a mano (`approve`): nadie paga sin cotización aprobada. Con `access=pilot` o `enabled=false` el checkout se cierra al público al instante, aunque el código ya esté desplegado.

Pruebas y verificaciones adaptadas al nuevo estado (L3, G6/G7, P1/P8, H12 y las 5 pruebas que fijaban la versión «borrador»; `verify:prod` y `verify:pilot`) y una verificación nueva `npm run verify:public` (27 comprobaciones sobre el artefacto de producción: formulario público, términos obligatorios, origen ajeno, límite por IP, monto no manipulable, devoluciones apagadas, interruptores `access=pilot` y `enabled=false`). Prueba nueva `tests/migracion4-datos.test.mjs` (migración sobre una base v3 con datos).

## 2. Resultado de las pruebas locales (rama `etapa-b/checkout-publico`)
`npm test` **105/105** · `tsc` y `eslint src scripts tests` limpios · build correcto · `verify:prod` 36/36 · `verify:pilot` 33/33 · `verify:public` 27/27. Sin transacciones reales ni correos reales.

## 3. Estado por tema (lo implementado frente a lo pendiente)
**Textos legales.** Los 6 textos están completos y sin marcadores (términos, devoluciones/retracto, privacidad, información comercial, servicios digitales, soporte) con los datos oficiales de la sociedad. Basados en la Ley 19.496 (arts. 3 bis y 12 A) sin plazos ni porcentajes inventados. **Son redacción técnica, no asesoría jurídica**; requieren su aprobación expresa (decisión D1). Cláusulas redactadas por Claude que debe aprobar: aprobaciones por vencimiento del plazo de revisión, propiedad intelectual (uso de entregables tras el pago, Bydlight conserva sus componentes), dominios y cuentas a nombre del cliente, soporte/mantenimiento no incluidos, retracto y evaluación del trabajo ejecutado (devuelve lo abonado no correspondiente a servicios prestados; no declara irreembolsables los anticipos).

**Boleta/factura (SII).** *Implementado:* comprobante de pago (voucher Transbank) con desglose informativo de IVA, correo de pago y datos de empresa (razón social y RUT validado módulo 11) para facturar. *No implementado ni verificado:* la emisión de documentos tributarios (el sitio no emite boleta ni factura y lo dice en términos, comprobante y correos). *Pendiente con el contador:* modelo de emisión declarado (¿el voucher vale como boleta?), certificado/sistema de facturación, documento y momento para anticipo y saldo, factura a empresas y notas de crédito (`SII-PROCEDIMIENTO-PROPUESTO.md`). Hasta tener la respuesta, cada pago debe documentarse **manualmente** por el titular.

**Correos transaccionales.** Código listo y probado con transporte falso (idempotencia, reintentos 1/5/30/120/720 min, máximo 6, cuerpo vaciado tras enviar; el fallo del correo nunca afecta al pago). **No hay evidencia de que `mail.json` esté configurado en el servidor**: la verificación `02-verificar-migracion-4.sh` informa si existe y si tiene las 3 credenciales, sin mostrarlas. Sin él, el cliente no recibe la confirmación escrita del contrato (art. 12 A, Ley 19.496), el enlace de cotización ni el comprobante, y el titular no recibe aviso de nuevas solicitudes. **Recomendado como requisito de apertura (D4).**

**Migración 4.** Compatible con los datos: prueba M2 (base v3 con orden, cotización, pago autorizado y eventos → v4) conserva todas las filas idénticas, deja las órdenes previas como `persona` sin datos tributarios, no crea correos retroactivos, mantiene el índice anti doble pago y el código anterior (sin columnas nuevas) sigue insertando (M5), por lo que el rollback de código es seguro. Verificación segura sobre la base real: `docs/deploy/02-verificar-migracion-4.sh` (solo lectura).

**Conciliación, idempotencia y recuperación (revisión del código y de las 105 pruebas).** Cubierto: doble clic = una sola transacción; retorno repetido o token reutilizado no reconfirma; monto manipulado rechazado y monto siempre del servidor; pago interrumpido recuperado consultando a Transbank; `PENDIENTE` nunca se rechaza a ciegas (solo a `ERROR` de revisión manual tras 7 días); abandono respeta la ventana (6 min en producción); índice único anti doble pago en la base; comprobante sin tarjeta completa ni tokens; devoluciones apagadas; auditoría `audit`/`monitor` de solo lectura con 12 tipos de hallazgo; `reconcile` manual. **Pendiente operativo (no de código):** `monitor` no está programado; durante las primeras 48 h se ejecuta a mano (sección 6, paso 8).

**Operación comercial a tener en cuenta.** Cada solicitud pública requiere que usted la apruebe con `approve` (monto total con IVA incluido; anticipo 50 % y vigencia 7 días por defecto, decisión D5). El cliente paga desde `/orden/<código>`. El aviso de nuevas solicitudes llega por correo (si está configurado) o con `admin-remote.mjs list`.

## 4. Decisiones que necesito aprobadas
| # | Decisión | Recomendación | ¿Bloquea abrir al público? |
|---|---|---|---|
| D1 | Aprobar los textos legales (6 páginas) y las cláusulas de la sección 3 | Revisión de un abogado (Ley 19.496, retracto, privacidad) antes de abrir; si decide asumir el riesgo, aprobación suya expresa | **Sí** (publicar textos propios sin aprobar) |
| D2 | Titularidad del comercio Transbank: según `LEGAL-DATOS-PENDIENTES.md` está a nombre de una persona natural y los textos presentan a la SpA (RUT 78.161.844-6) como vendedora | Regularizar con Transbank a nombre de la SpA, o redactar los textos para quien cobra | **Sí** (los textos deben coincidir con quien cobra y emite el documento) |
| D3 | Modelo tributario con el contador (boleta/factura, anticipo, voucher) | Obtener respuesta escrita; mientras tanto emitir documento manual por cada pago | Riesgo tributario del titular; no lo bloquea el código |
| D4 | Configurar el correo (Gmail OAuth, `mail.json`) antes de abrir | Sí: confirmación escrita del contrato y comprobante dependen de él | Recomendado como requisito |
| D5 | Anticipo por defecto (50 %) y vigencia de cotización (7 días) | Mantener los valores actuales | No |
| D6 | Etiqueta de versión de términos (`2026-11-09-r1`) = fecha de aprobación | Cambiarla a la fecha real si no es hoy | No |
| D7 | Verificar la Ley 21.719 (vigente el 01-12-2026 salvo postergación) y reconfirmar la política de privacidad | Confirmar con el abogado | No (riesgo normativo) |
| D8 | EmailJS (formulario de contacto): confirmar en su panel que el destino es `bydlightsolutions@gmail.com` | Revisar el panel | No |
| D9 | Autorización para subir la Etapa B a `main` (fast-forward desde `13aaf17`, sin force) | Autorizar cuando D1, D2 y D4 estén resueltas | Sí (el ejecutor solo descarga `main`) |
Marcas de tarjeta (Visa, Mastercard, etc.): siguen sin anunciarse hasta que el área comercial de Transbank las confirme por escrito; no bloquea.

## 5. Qué no cambia
Docker Compose, Dockerfile, dependencias y `next.config.ts`: sin cambios (no hay `accept-compose`). Devoluciones (`adminRefunds=false`), credenciales y base: intactas. Contenedores ajenos: ningún comando los toca.

## 6. Procedimiento en Ubuntu (cada bloque en un subshell: si falla, no ve «OK» y se detiene; no ejecute el siguiente)
Antes: subir los scripts de `docs/deploy/` por `scp` (`02-verificar-migracion-4.sh`, `03-backup-etapa-b.sh`), comprobar su huella con `sha256sum` y tener **D1, D2, D4 resueltas y D9 autorizada** (esto último: Claude hace el push a `main` y entrega el SHA).

**Paso 1: correo (solo si aún no está; lo hace usted, sin pegar secretos en el chat)**
Crear el cliente OAuth y el refresh token según `docs/CORREOS-TRANSACCIONALES.md` (pasar la app a «En producción» o el token caduca a los 7 días). Luego:
```
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
RUN="docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/s:ro -e BYDLIGHT_URL=https://bydlightsolutions.com bydlight-web:$TAG"
docker run --rm -it --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/s:ro bydlight-web:$TAG node /s/mail-config-set.mjs /data/config/mail.json --init
$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=true
$RUN node /s/admin-remote.mjs mail-test --config-file /data/config/payments.json
```
Éxito: llega **un** correo de prueba a `bydlightsolutions@gmail.com` (revise Spam). Si no llega: `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false` y detenerse.

**Paso 2: verificación de la migración 4 (solo lectura; antes de cualquier cambio)**
```
sudo bash ~/02-verificar-migracion-4.sh
```
Éxito: `schema_v=4`, columnas y `mail_outbox` presentes, órdenes y pagos **no menores** que en el respaldo de la Etapa A (se debe ver el pago real de $50), y «MIGRACION 4 VERIFICADA OK». Detenerse con cualquier `FALLAS`.

**Paso 3: variables y estado mínimo**
```
export SHA=<SHA_DE_40_CARACTERES_QUE_ENTREGA_CLAUDE>
export PREV=13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7
(
set -euo pipefail
T=$(mktemp)
sudo bd-run status | tee "$T"
grep -q "desplegado: $PREV" "$T"; grep -q "salud: OK" "$T"; grep -q "linea base de compose: aceptada" "$T"
sudo bd-run preflight
sudo bd-run compose-diff | tee "$T"
grep -q "politica: CUMPLE" "$T"; grep -q "linea base: igual" "$T"
rm -f "$T"; echo "BLOQUE 3 OK"
)
```
**Paso 4: respaldo** (consistente, fuera del volumen, sin migrar)
```
sudo bash ~/03-backup-etapa-b.sh "$SHA"
```
Éxito: «RESPALDO ETAPA B OK». Detenerse en cualquier ERROR (ver el mensaje; no borra ningún respaldo).

**Paso 5: fetch, build, up (código con las dos llaves; el checkout sigue cerrado al público mientras `payments.json` no diga `access=public`)**
```
(
set -euo pipefail
T=$(mktemp)
sudo bd-run fetch "$SHA" | tee "$T"; ! grep -q "ATENCION" "$T"
sudo bd-run status | tee "$T"; grep -q "clon en: $SHA" "$T"
sudo bd-run preflight
sudo bd-run compose-diff | tee "$T"; grep -q "politica: CUMPLE" "$T"; grep -q "linea base: igual" "$T"
sudo bd-run build "$SHA" | tee "$T"
JOB=$(sed -n 's/.*job-status //p' "$T"); [ -n "$JOB" ]
for i in $(seq 1 90); do
  O=$(sudo bd-run job-status "$JOB" || true); echo "$(date +%T) $(echo "$O" | head -1)"
  case "$O" in *"estado: done"*) break ;; *"estado: failed"*) echo "$O"; exit 1 ;; esac
  sleep 20
  [ "$i" = 90 ] && { echo "build sin terminar"; exit 1; }
done
rm -f "$T"; echo "BLOQUE 5a OK (build terminado; aun NO se publico)"
)
```
Si dice «BLOQUE 5a OK»:
```
(
set -euo pipefail
T=$(mktemp)
sudo bd-run up "$SHA" | tee "$T"; grep -q "desplegado" "$T"
sudo bd-run verify | tee "$T"; ! grep -q "AVISO" "$T"
sudo bd-run status
rm -f "$T"; echo "BLOQUE 5b OK"
)
```
Éxito: `desplegado: <SHA>`, `anterior: 13aaf1750…`, `verify OK` sin líneas AVISO. Corte breve solo del servicio web de Bydlight. Si `up` dice «no sano», el ejecutor vuelve solo a `13aaf17`: no repita, envíe la salida.

**Paso 6: verificación pública (el checkout aún está cerrado al público si `payments.json` no dice `access=public`)**
```
(
set -u; f=0; U=https://bydlightsolutions.com
chk(){ l=$1; e=$2; shift 2; g=$(curl -s -o /dev/null -w '%{http_code}' "$@"); if echo "$g" | grep -Eq "^($e)$"; then s=OK; else s=FALLA; f=1; fi; printf '%-30s esperado %-8s obtuvo %s  %s\n' "$l" "$e" "$g" "$s"; }
for p in / /terminos /devoluciones /privacidad /soporte /servicios-digitales /informacion-comercial /legal; do chk "$p" 200 "$U$p"; done
chk "/orden/XXXXXXXXXXXX" 404 "$U/orden/ABCDEFGHJKMN"
chk "/vista-previa" 404 "$U/vista-previa"
chk "retorno Webpay inerte" "30[1238]" "$U/api/pagos/retorno/ABCDEFGHJKMN"
[ $f = 0 ] && echo "BLOQUE 6 OK" || echo "BLOQUE 6: HAY FALLAS"
)
```
Éxito: todo `OK`. Detenerse ante cualquier `FALLA` (si fuera una página legal en 404, el despliegue no incluye la Etapa B: revise `status`).

**Paso 7: abrir al público (llave 2; reversible en ≤ 5 s)**
```
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
RUN="docker run --rm --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true -v bydlight-prod_bydlight_data:/data -v /srv/bydlight-prod/app/scripts:/s:ro -e BYDLIGHT_URL=https://bydlightsolutions.com bydlight-web:$TAG"
$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=public
sleep 6
$RUN node /s/payments-config-set.mjs /data/config/payments.json --show
curl -s -o /dev/null -w '/contratar: %{http_code} (esperado 200)\n' https://bydlightsolutions.com/contratar
```
Éxito: `--show` indica `enabled: true`, `access: public`, `adminRefunds: false`; `/contratar` 200. Solo ejecute este paso con D1, D2 y D4 resueltas.

**Paso 8: prueba final y vigilancia (48 h)**
1. Desde un navegador sin enlace piloto, solicite un plan con datos propios y anote el código de la orden `ID`. Debe llegar el correo de «Recibimos tu solicitud» (y el aviso interno).
2. `$RUN node /s/admin-remote.mjs approve-test $ID --config-file /data/config/payments.json` ($100, anticipo $50) y pague los $50 desde `/orden/$ID` con su tarjeta; revise el comprobante, el correo de «contratación confirmada»/«pago autorizado» y su panel de Transbank.
3. `$RUN node /s/admin-remote.mjs audit --config-file /data/config/payments.json` debe responder sin hallazgos graves; `... mail-status --config-file ...` sin correos fallidos.
4. Durante 48 h, al menos cada día: `... monitor`, `... audit` y `... reconcile` (con `--config-file /data/config/payments.json`). Para ver nuevas solicitudes: `... list`.

## 7. Cierre y rollback (de más rápido a más lento; ninguno toca la base ni otros contenedores)
| Qué | Comando | Efecto |
|---|---|---|
| Cerrar cobros YA (≤ 5 s) | `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false` | `/contratar` redirige a `/contacto`; solicitudes y pagos 503 |
| Volver al modo piloto | `... payments-config-set.mjs /data/config/payments.json access=pilot` | Solo el enlace firmado del titular abre el checkout |
| Apagar correos | `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false` | No se envía ni encola |
| Código anterior | `sudo bd-run rollback` → `sudo bd-run verify` → `sudo bd-run status` | Vuelve a `13aaf17` (legales ocultos, sin anuncio de pagos). La migración 4 ya existía en `13aaf17`; la base no cambia |
Con el interruptor en `enabled=false` el sitio sigue anunciando Webpay (el anuncio es de código) pero los botones llevan a contacto: es un degradado seguro. Para ocultar el anuncio hay que hacer rollback de código. **Nunca** `down -v`, borrar volúmenes ni restaurar un respaldo sobre pagos nuevos sin decisión expresa.

## 8. Riesgos conocidos
1. Si se abre `access=public` antes de resolver D2/D4, los textos y los avisos pueden no coincidir con quien cobra o no llegar al cliente.
2. Documento tributario: manual hasta la respuesta del contador (D3).
3. `monitor` y `reconcile` no están programados; dependen de la ejecución manual las primeras 48 h.
4. Los límites de envío de Gmail y el remitente `@gmail.com` pueden afectar la entregabilidad; considerar un proveedor transaccional con dominio propio si el volumen crece.
5. Los textos legales no han sido revisados por un abogado.
6. Entre el despliegue (Paso 5) y la apertura (Paso 7) el sitio anuncia Webpay y los botones de plan llevan a `/contratar`, que redirige a `/contacto`: haga ambos pasos seguidos.
7. `CLAUDE.md` del repositorio todavía dice «Webpay apagado e invisible»; actualizarlo tras la activación (no se modificó).
