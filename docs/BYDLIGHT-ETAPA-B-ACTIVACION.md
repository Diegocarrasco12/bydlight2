# Etapa B: activación comercial de Webpay Plus (preparada, NO ejecutada)

Preparado el 2026-11-09 en la rama local `etapa-b/checkout-publico` (sin push). **No se modificó producción ni se abrió ningún pago público.** La Etapa A (`13aaf17`) está desplegada y con una compra real de $50 exitosa. Este documento es autocontenido: el procedimiento de la sección 6 se pega en Ubuntu sin otros documentos.

> **Decisiones definitivas del titular (2026-11-10), vigentes sobre cualquier texto posterior de este documento:** (1) la publicidad de Webpay Plus publicada **se mantiene**; (2) las páginas y textos legales publicados **se mantienen**; (3) las gestiones legales y tributarias ya fueron realizadas la semana anterior y **no se repiten**; (4) la compra controlada de $50 ya fue realizada y **no se repite**. Por eso `ONLINE_CHECKOUT_UI=true` y `LEGAL_PAGES_PUBLISHED=true` quedan como están. Evidencia en el repositorio: el encabezado de este documento registra la compra real de $50 exitosa en la Etapa A y la verificación del 2026-11-09 mostró 1 orden y 1 pago autorizado de $50 en la base de producción; **los comprobantes legales/tributarios y la aprobación de D1–D10 no están en el repositorio** (se registran por declaración del titular, no como verificados aquí). Las secciones 4 y las listas de «pendiente» que siguen son histórico de preparación, no tareas abiertas.

## 1. Qué cambia en el código (mínimo, 3 constantes)
| Archivo | Cambio | Efecto |
|---|---|---|
| `src/lib/plans.ts` | `ONLINE_CHECKOUT_UI = true` | Los botones de plan llevan a `/contratar`; se anuncia Webpay Plus (llave 1 de código). |
| `src/lib/legal.ts` | `LEGAL_PAGES_PUBLISHED = true` | Se publican las 6 páginas legales + `/legal`; correos incluyen enlaces; pie con datos de la sociedad (llave 2). Si quedara un marcador de dato pendiente, `next build` falla. |
| `src/lib/terms.ts` | `TERMS_VERSION = "2026-11-09-r5"` | Versión definitiva (sin «borrador»); cada aceptación queda ligada a ese texto. **Ajustar a la fecha de aprobación real** si difiere (una línea + recompilar). |

**Tres llaves, abrir en orden y cerrar en cualquier momento:** (1) código con las dos constantes (despliegue), (2) `payments.json` con `enabled=true` y `access=public` (efecto en ≤ 5 s, sin redeploy), (3) cada cotización la aprueba el titular a mano (`approve`): nadie paga sin cotización aprobada. Con `access=pilot` o `enabled=false` el checkout se cierra al público al instante, aunque el código ya esté desplegado.

Pruebas y verificaciones adaptadas al nuevo estado (L3, G6/G7, P1/P8, H12 y las 5 pruebas que fijaban la versión «borrador»; `verify:prod` y `verify:pilot`) y una verificación nueva `npm run verify:public` (28 comprobaciones sobre el artefacto de producción: formulario público, términos obligatorios, origen ajeno, límite por IP, monto no manipulable, devoluciones apagadas, interruptores `access=pilot` y `enabled=false`). Prueba nueva `tests/migracion4-datos.test.mjs` (migración sobre una base v3 con datos).

### 1a. Textos legales (2026-11-09)
Seis documentos coherentes y listos para su aprobación (**no aprobados**; no es asesoría jurídica): modalidades, estados de pago, tratamiento tributario sin afirmaciones incorrectas, privacidad y cookies. `TERMS_VERSION = "2026-11-09-r5"` (etiqueta de edición). Revisión, contraste con la ley y decisiones humanas: `docs/LEGAL-REVISION-ETAPA-B.md`; pruebas `tests/legal-coherencia.test.mjs` (LG1 a LG13).

### 1b. Consolidación comercial (2026-11-09, además de las 3 constantes)
| Tema | Cambio | Prueba |
|---|---|---|
| Modalidades | Cada plan tiene `modality`: **directa** (Emprendedor, Profesional, Empresa, Ecommerce: precio «desde», solicitud en línea, cotización confirmada y anticipo con Webpay) o **a-medida** (Software a medida: se cotiza por contacto y **no entra al checkout**; el servidor lo rechaza aunque el navegador lo envíe). | E1, E2 |
| Consistencia de precio | `approve` rechaza un monto **menor al precio publicado** del plan (evita un error de digitación) salvo `--allow-below-plan` explícito. El cliente nunca envía montos. | E3, verify:public |
| Duplicados | Una solicitud igual (mismo correo, plan y mensaje) en 30 min, aún sin cotizar, devuelve la orden existente: sin orden ni correos repetidos. | E4, E5 |
| Pago pendiente | Nuevo correo «Estamos verificando tu pago» solo cuando el intento queda PENDIENTE: dice expresamente que **no es una confirmación de pago**, no promete ausencia de cargo y no se repite. El comprobante sale solo al autorizarse. | E6, E7 |
| Documentos tributarios | **Migración 5** (aditiva, tabla `tax_documents`): registra boleta, factura nacional, factura de exportación y nota de crédito por pago. **Solo registra; no emite ni habla con el SII.** Importe tomado del pago; un solo documento vigente por pago y folio único por tipo, impuestos por la base; acciones `taxdoc-*` en `admin-remote.mjs`. Detalle: `docs/DOCUMENTOS-TRIBUTARIOS.md`. | E8 a E13 |

## 2. Resultado de las pruebas locales (rama `etapa-b/checkout-publico`)
`npm test` **158/158** (105 previas + 14 de Brevo + 14 de consolidación + 13 de coherencia legal + 9 de privacidad PV1-PV9: `tests/brevo.test.mjs`, `consolidacion.test.mjs`, `legal-coherencia.test.mjs`) · `tsc` y `eslint src scripts tests` limpios · build correcto · `verify:prod` 36/36 · `verify:pilot` 33/33 · `verify:public` 28/28. Sin transacciones reales ni correos reales (Brevo se probó con `fetch` falso).

## 3. Estado por tema (lo implementado frente a lo pendiente)
**Textos legales.** Los 6 textos están completos y sin marcadores (términos, devoluciones/retracto, privacidad, información comercial, servicios digitales, soporte) con los datos oficiales de la sociedad. Basados en la Ley 19.496 (arts. 3 bis y 12 A) sin plazos ni porcentajes inventados. **Son redacción técnica, no asesoría jurídica**; requieren su aprobación expresa (decisión D1). Cláusulas redactadas por Claude que debe aprobar: aprobaciones por vencimiento del plazo de revisión, propiedad intelectual (uso de entregables tras el pago, Bydlight conserva sus componentes), dominios y cuentas a nombre del cliente, soporte/mantenimiento no incluidos, retracto y evaluación del trabajo ejecutado (devuelve lo abonado no correspondiente a servicios prestados; no declara irreembolsables los anticipos).

**Boleta/factura (SII).** *Implementado:* comprobante de pago (voucher Transbank) con desglose informativo de IVA, correo de pago y datos de empresa (razón social y RUT validado módulo 11) para facturar. *No implementado ni verificado:* la emisión de documentos tributarios (el sitio no emite boleta ni factura y lo dice en términos, comprobante y correos). *Pendiente con el contador:* modelo de emisión declarado (¿el voucher vale como boleta?), certificado/sistema de facturación, documento y momento para anticipo y saldo, factura a empresas y notas de crédito (`SII-PROCEDIMIENTO-PROPUESTO.md`). Hasta tener la respuesta, cada pago debe documentarse **manualmente** por el titular.

**Correos transaccionales (Brevo).** Decisión del titular (2026-11-09): Gmail OAuth se reemplaza por **Brevo** (API transaccional; remitente `notificaciones@bydlightsolutions.com`, Reply-To `contacto@bydlightsolutions.com`, dominio autenticado, plan gratuito de 300 correos/día). *Implementado y probado con `fetch` falso:* formato de la petición, clasificación de errores (400 permanente; 429/cuota y 401/403 se aplazan sin gastar intentos; 5xx/red con reintentos 1/5/30/120/720 min, máx. 6), no duplicación (`dedupe_key`), y la clave nunca aparece en cola, registros ni errores. *Pendiente (lo hace usted):* generar la clave, autorizar la IP del servidor en Brevo e instalar la clave **después de desplegar** (Paso 6b). Sin eso el cliente no recibe la confirmación escrita del contrato (art. 12 A, Ley 19.496) ni el comprobante, y el titular no recibe avisos: **requisito de apertura (D4)**. Detalle: `docs/CORREOS-TRANSACCIONALES.md`, `docs/BREVO-CLAVE-API-PASOS.md`.

**Migración 4.** Compatible con los datos: prueba M2 (base v3 con orden, cotización, pago autorizado y eventos → v4) conserva todas las filas idénticas, deja las órdenes previas como `persona` sin datos tributarios, no crea correos retroactivos, mantiene el índice anti doble pago y el código anterior (sin columnas nuevas) sigue insertando (M5), por lo que el rollback de código es seguro. Verificación segura sobre la base real: `docs/deploy/02-verificar-migracion-4.sh` (solo lectura).

**Conciliación, idempotencia y recuperación (revisión del código y de las 105 pruebas).** Cubierto: doble clic = una sola transacción; retorno repetido o token reutilizado no reconfirma; monto manipulado rechazado y monto siempre del servidor; pago interrumpido recuperado consultando a Transbank; `PENDIENTE` nunca se rechaza a ciegas (solo a `ERROR` de revisión manual tras 7 días); abandono respeta la ventana (6 min en producción); índice único anti doble pago en la base; comprobante sin tarjeta completa ni tokens; devoluciones apagadas; auditoría `audit`/`monitor` de solo lectura con 12 tipos de hallazgo; `reconcile` manual. **Pendiente operativo (no de código):** `monitor` no está programado; durante las primeras 48 h se ejecuta a mano (sección 6, paso 8).

**Operación comercial a tener en cuenta.** Cada solicitud pública requiere que usted la apruebe con `approve` (monto total con IVA incluido; anticipo 50 % y vigencia 7 días por defecto, decisión D5). El cliente paga desde `/orden/<código>`. El aviso de nuevas solicitudes llega por correo (si está configurado) o con `admin-remote.mjs list`.

## 4. Decisiones que necesito aprobadas
| # | Decisión | Recomendación | ¿Bloquea abrir al público? |
|---|---|---|---|
| D1 | Aprobar los textos legales (6 páginas) y las cláusulas de la sección 3 | Revisión de un abogado (Ley 19.496, retracto, privacidad) antes de abrir; si decide asumir el riesgo, aprobación suya expresa | **Sí** (publicar textos propios sin aprobar) |
| D2 | **Resuelta del todo (2026-11-09):** contrato a nombre de la SpA y Transbank autorizó y validó la cuenta de abonos; no hay pendiente. La SpA sigue como vendedora en todos los documentos; no se toca el titular ni las credenciales | Ninguna | No afecta el código |
| D3 | Modelo tributario con el contador (boleta/factura, anticipo, voucher) y registro de los abonos que Transbank deposita en una cuenta personal siendo ingresos de la SpA | Obtener respuesta escrita; mientras tanto emitir documento manual por cada pago | Riesgo tributario del titular; no lo bloquea el código |
| D4 | Correo por Brevo: preparar la clave (Paso 1) e instalarla y probar el envío tras desplegar (Paso 6b) antes de abrir | Sí: confirmación escrita del contrato y comprobante dependen de él | Requisito de apertura |
| D5 | Anticipo por defecto (50 %) y vigencia de cotización (7 días) | Mantener los valores actuales | No |
| D6 | Etiqueta de versión de términos (`2026-11-09-r5`) = fecha de aprobación | Cambiarla a la fecha real si no es hoy | No |
| D7 | Verificar la Ley 21.719 (vigente el 01-12-2026 salvo postergación) y reconfirmar la política de privacidad | Confirmar con el abogado | No (riesgo normativo) |
| D8 | EmailJS (formulario de contacto): confirmar en su panel que el destino es `contacto@bydlightsolutions.com` (el sitio ya publica ese correo) | Revisar el panel | No |
| D10 | **Retracto:** opción provisional más favorable al consumidor: no se excluye el retracto en servicios y el inicio del proyecto no lo extingue (la ley permite excluirlo si se informa antes de contratar y pagar, y su reglamento lo entiende ejercible antes de iniciar la prestación). Se informa antes de contratar y de pagar y en el correo de confirmación | Mantener, o decidir otra opción con abogado **antes** de abrir (cambiaría `RETRACTO_NOTICE`, devoluciones y términos) | Sí (decisión legal) |
| D11 | **Privacidad:** plazos propuestos (consultas sin contratación: 24 meses; respaldos: 90 días; tributario: 6 años) y operación manual de la depuración (`docs/PRIVACIDAD-PROCEDIMIENTO.md`) | Aprobar o ajustar plazos | No (pero el texto público los menciona) |
| D12 | **Cotización:** lo no indicado expresamente en la nota no se entiende incluido (código fuente, cesión de derechos, licencias); mantenimiento aparte | Aprobar; cada cotización de la nota debe indicar lo acordado | Sí (cláusula comercial) |
| D9 | Autorización para subir la Etapa B a `main` (fast-forward desde `13aaf17`, sin force) | Autorizar cuando D1 esté resuelta | Sí (el ejecutor solo descarga `main`) |
Marcas de tarjeta (Visa, Mastercard, etc.): siguen sin anunciarse hasta que el área comercial de Transbank las confirme por escrito; no bloquea.

## 5. Qué no cambia
Docker Compose, Dockerfile, dependencias y `next.config.ts`: sin cambios (no hay `accept-compose`). Devoluciones (`adminRefunds=false`), credenciales y base: intactas. Contenedores ajenos: ningún comando los toca.

## 6. Procedimiento en Ubuntu (cada bloque en un subshell: si falla, no ve «OK» y se detiene; no ejecute el siguiente)
> **Procedimiento corregido (2026-11-09, preparado y probado SOLO en local; no validado en producción).** Estado real de partida: release `13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7` con esquema SQLite **v3**. Release objetivo: `b28448196fb89f9814621a709475029ae086dd21` (esquema v5). Los Pasos 2 y 4 anteriores (verificador de la migración 4 y respaldo que exigía v4) no sirven para partir de v3 y quedan reemplazados por los Pasos A–H de más abajo.

### 6.0 Por qué la base está en v3 y cómo se migra
- Las migraciones se aplican **al abrir la base** con el código que las contiene (`openDb()` → `migrate()`), **no** al arrancar el contenedor. Con pagos y correo apagados nadie abre la base: `13aaf17` ya contenía la migración 4 y la base siguió en v3.
- Por eso la migración **no se deja a una petición HTTP**: el Paso F la ejecuta de forma explícita (`07-aplicar-migraciones.sh`) en un momento conocido, con respaldo y ensayo previos.
- Las migraciones 4 y 5 son aditivas (columnas con valor por defecto, `mail_outbox`, `tax_documents`); las 1–3 no cambian. El código anterior ignora versiones superiores: **`bd-run rollback` basta; no hace falta restaurar la base**.
- `03-backup-etapa-b.sh` acepta esquema **v3 o v4** (v3 = nadie abrió la base con código nuevo; v4 = alguien ejecutó `orders-admin check`) y **rechaza v5 o superior** (no sería un respaldo previo a la Etapa B). El respaldo es de solo lectura (`VACUUM INTO` desde una conexión de solo lectura).

### 6.1 Qué se ejecuta dónde
| Dónde | Qué |
|---|---|
| **WINDOWS** (PowerShell/Git Bash en el repositorio) | Calcular SHA256 de los scripts y copiarlos al servidor con `scp bydlight` (Paso A). |
| **UBUNTU** (sesión del administrador, `sudo`) | Todo lo demás (Pasos B–H): `sudo bash`, `sudo bd-run …`, `docker ps`. Claude **no** ejecuta nada de esto. |

### 6.2 SHA256 esperados de los scripts (LF; en Windows: `tr -d '\r' < archivo | sha256sum`; en Ubuntu: `sha256sum archivo`)
Deben coincidir en ambos lados. La tabla vigente está en `docs/deploy/SHA256SUMS-etapa-b.txt` (se genera con la sección «Paso A»); si un hash no coincide, **no ejecute ese script**.

### Paso A (WINDOWS): copiar los scripts y comparar huellas
```
cd <carpeta del repositorio>/docs/deploy
for f in 00-admin.sh 01-backup-etapa-a.sh 03-backup-etapa-b.sh 04-verificar-migracion-5.sh 05-caducidad-respaldos.sh 06-ensayo-migracion.sh 07-aplicar-migraciones.sh; do tr -d '\r' < $f | sha256sum; done
scp 00-admin.sh 03-backup-etapa-b.sh 04-verificar-migracion-5.sh 05-caducidad-respaldos.sh 06-ensayo-migracion.sh 07-aplicar-migraciones.sh bydlight:~/
```
Luego, en **UBUNTU**: `cd ~ && sha256sum 00-admin.sh 03-backup-etapa-b.sh 04-verificar-migracion-5.sh 05-caducidad-respaldos.sh 06-ensayo-migracion.sh 07-aplicar-migraciones.sh` y compare cada línea con la de Windows. Si el archivo llegó con CRLF (`file 03-backup-etapa-b.sh` dice «CRLF»), corríjalo con `sed -i 's/\r$//' <archivo>` y vuelva a comparar. **`02-verificar-migracion-4.sh` NO se usa** (exige v4).
Requisitos previos: **D1 resuelta, Paso 1 (Brevo) hecho**. El SHA objetivo ya está en `origin/main`; no hace falta ningún push más porque los scripts de `docs/deploy/` se copian aparte y no forman parte de la imagen.

### Paso B (UBUNTU): estado inicial, sin cambios
```
export SHA=b28448196fb89f9814621a709475029ae086dd21
export PREV=13aaf17507d5a0c08f8c8e4d8ff44d260c6a0fa7
(
set -euo pipefail
T=$(mktemp)
sudo bd-run status | tee "$T"
grep -q "desplegado: $PREV" "$T"; grep -q "salud: OK" "$T"; grep -q "linea base de compose: aceptada" "$T"
sudo bd-run preflight
sudo bd-run compose-diff | tee "$T"
grep -q "politica: CUMPLE" "$T"; grep -q "linea base: igual" "$T"
rm -f "$T"; echo "BLOQUE B OK"
)
sudo docker ps -a --format '{{.Names}} {{.Image}} {{.CreatedAt}} {{.Status}}' | grep -v '^bydlight-prod-web-1 ' | sort > ~/contenedores-antes.txt; wc -l ~/contenedores-antes.txt
```
Éxito: «BLOQUE B OK» y 18 contenedores ajenos listados. Compruebe que `$SHA` sea **exactamente** `b28448196fb89f9814621a709475029ae086dd21` (40 caracteres; no `b28448196f1`).

### Paso C (UBUNTU): respaldo ANTES de cualquier migración (con la base en v3)
```
sudo bash ~/03-backup-etapa-b.sh "$SHA"
```
Éxito: «RESPALDO ETAPA B OK», línea `integrity_check=ok schema_v=3 …` con 1 orden y 1 pago autorizado de 50, y SHA-256 del respaldo. Detenerse en cualquier `ERROR` (el script no borra respaldos). Debe ejecutarse **antes** del fetch (exige que el clon siga en `$PREV`).

### Paso D (UBUNTU): fetch y build (aún NO se publica)
Es el Paso 5a de más abajo (bloque «BLOQUE 5a OK»). No ejecute `up` todavía.

### Paso E (UBUNTU): ensayo de la migración sobre una COPIA aislada
```
sudo bash ~/06-ensayo-migracion.sh "$SHA"
```
Usa la imagen nueva ya construida, copia el respaldo a un área temporal sin red, aplica 4 y 5, y comprueba integridad, claves foráneas, conservación de datos y compatibilidad con el código anterior. No toca la base real. Éxito: «ENSAYO SOBRE COPIA: todas las comprobaciones pasaron» y «ENSAYO DE MIGRACION OK» (deja un marcador que el Paso F exige). Cualquier `FALLAS`: **no haga `up`**; envíe la salida.

### Paso F (UBUNTU): publicar y aplicar las migraciones de forma explícita
1. `up` (Paso 5b de más abajo, «BLOQUE 5b OK»). El checkout sigue cerrado (`payments.json` sin `access=public`).
2. Inmediatamente:
```
sudo bash ~/07-aplicar-migraciones.sh "$SHA"
sudo bash ~/04-verificar-migracion-5.sh
```
Éxito: «MIGRACIONES APLICADAS OK (esquema v5)» y «MIGRACION 5 VERIFICADA OK» (`schema_v=5`, 5 migraciones, `tax_documents` con sus índices, órdenes y pagos **no menores** que en el respaldo, el pago autorizado de 50 intacto). El script 07 se niega si falta el respaldo, el ensayo, si `access=public` o si las devoluciones están activas. Si falla: no repita; el código anterior ignora las migraciones, **`sudo bd-run rollback`** basta (ver «Recuperación»).

### Paso G (UBUNTU): comprobar que los 18 contenedores ajenos no cambiaron
Paso 5c de más abajo. Sin diferencias de nombre, imagen ni fecha de creación.

### Paso H (UBUNTU): estado final, sin operaciones reales
Compruebe: `sudo bd-run status` con `desplegado: $SHA` y `anterior: $PREV`; `sudo bd-run verify` sin `AVISO`; verificación pública (Paso 6); `sudo bash ~/00-admin.sh node /s/payments-config-set.mjs /data/config/payments.json --show` con `enabled: false` o `access: pilot`, nunca `public`, y `adminRefunds: false`. **No se realiza ningún pago real ni se abre el checkout público en estos pasos.** Después siguen Brevo (6b), privacidad en simulación (6e) y el resto, cada uno con su propia autorización.

### Recuperación ante fallos (distinga siempre código de datos)
| Situación | Acción |
|---|---|
| `up` dice «no sano» | El ejecutor vuelve solo a `13aaf17`. No repita; envíe la salida. La base no se tocó. |
| Falla 06 (ensayo) | No haga `up`. La base real sigue en v3. Envíe la salida. |
| Falla 07 o 04 tras `up` | `sudo bd-run rollback`, `sudo bd-run verify`, `sudo bd-run status` (**rollback de CÓDIGO**). Si una migración llegó a aplicarse, `13aaf17` la ignora: no se revierte la base. |
| Corrupción comprobada de la base (`integrity_check` distinto de ok) | **Restauración de DATOS** solo con decisión expresa: detener el servicio web de Bydlight, conservar la base dañada aparte, restaurar el respaldo verificado por SHA-256 (`/srv/bydlight-prod/backups/bydlight-pre-etapa-b-*.db`) y avisar. Nunca restaurar sobre pagos nuevos sin decisión. |
| Cualquier cambio en los otros contenedores | Detenerse y avisar; no tocar nada. |
Nunca: `down -v`, `docker system prune`, borrar volúmenes, tocar otros contenedores.

### Condiciones que obligan a detener el procedimiento
`desplegado` distinto de `$PREV` antes del Paso C o del SHA objetivo antes del Paso F; esquema del respaldo distinto de 3 o 4; hash de un script distinto del de Windows; cualquier `ERROR`/`FALLAS`/falta del «OK» esperado; `access=public` o `adminRefunds=true`; diferencias en los 18 contenedores; `bd-run` con código 21 o `compose-diff` sin «politica: CUMPLE». No continúe «para ver qué pasa».

> Desde aquí, los pasos 1–8 originales se conservan para Brevo, apertura y vigilancia. **Salvo los Pasos 2 y 4 (reemplazados por A–C) y la nota del 6c (la migración 5 ya no se aplica «sola»: la aplica el Paso F), siguen vigentes.** En el 6b, 6e, 6d y 7 puede usar `$RUN` = `"sudo bash $HOME/00-admin.sh"` (y `$RUNTTY` = `"sudo bash $HOME/00-admin.sh --tty"` para `mail-config-set.mjs --init`) en lugar de armar el `docker run` a mano: evita los errores de pegado.

**Paso 1: preparar Brevo — HECHO por el titular (2026-11-09):** dominio y remitente verificados, DKIM/DMARC correctos, clave `BYDLIGHT2-PRODUCCION` creada, IP del servidor autorizada y restricción de IP activa. Solo recomprobar que la IP autorizada siga siendo la de salida: `curl -s https://api.ipify.org` debe coincidir con la autorizada en Brevo. Referencia (no repetir):
Siga las partes A y B de `docs/BREVO-CLAVE-API-PASOS.md`: (A) crear una clave API dedicada `bydlight-prod-servidor` y guardarla en su gestor de contraseñas; (B) autorizar en Brevo (Security → Authorised IPs) la IP pública de salida del servidor (`curl -s https://api.ipify.org`), porque con el control de IPs activo Brevo responde 401 aun con clave válida. **La clave se instala en el Paso 6b**, cuando el código nuevo ya está desplegado (el `mail-config-set.mjs` que hoy hay en el servidor todavía es el de Gmail).

**Paso 2: OBSOLETO.** La base real está en v3, no en v4: `02-verificar-migracion-4.sh` fallaría y no se usa. Sustituido por los Pasos B, C, E y F de la sección 6.1–6.2.

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
**Paso 3b: foto de los demás contenedores (solo lectura; guarda el estado previo para compararlo en el Paso 5c)**
```
sudo docker ps -a --format '{{.Names}} {{.Image}} {{.CreatedAt}} {{.Status}}' | grep -v '^bydlight-prod-web-1 ' | sort > ~/contenedores-antes.txt; wc -l ~/contenedores-antes.txt
```
Debe listar los demás contenedores (18 informados). No los modifique.

**Paso 4: el respaldo se hace en el Paso C (ANTES del fetch, con la base en v3).** Si ya hizo el fetch sin respaldo, el script 03 se niega (exige el clon en `$PREV`): no lo fuerce, avise.

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
**Paso 5c: comprobar que los otros contenedores no cambiaron**
```
sudo docker ps -a --format '{{.Names}} {{.Image}} {{.CreatedAt}} {{.Status}}' | grep -v '^bydlight-prod-web-1 ' | sort > ~/contenedores-despues.txt
diff <(sed 's/ Up .*//' ~/contenedores-antes.txt) <(sed 's/ Up .*//' ~/contenedores-despues.txt) && echo "OTROS CONTENEDORES SIN CAMBIOS"
```
Éxito: sin diferencias de nombre, imagen ni fecha de creación (el tiempo «Up» puede variar y se ignora). Cualquier diferencia: detenerse y enviar la salida; no tocar nada.

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

**Paso 6b: instalar la clave de Brevo y probar el correo (después de `up`; el checkout sigue cerrado)**
```
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
RUN="sudo bash $HOME/00-admin.sh"   # ver docs/deploy/00-admin.sh: prepara una copia legible de los scripts (el clon es privado de root)
sudo bash $HOME/00-admin.sh --tty node /s/mail-config-set.mjs /data/config/mail.json --init
$RUN node /s/mail-config-set.mjs /data/config/mail.json --show
$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=true
$RUN node /s/admin-remote.mjs mail-test --config-file /data/config/payments.json
$RUN node /s/admin-remote.mjs mail-status --config-file /data/config/payments.json
```
El primer `docker run` pide la clave con entrada oculta (no se ve ni queda en el historial). Éxito: `--show` indica `claveApiBrevo: true`; `mail-test` responde `"sent": 1`; llega **un** correo a `contacto@bydlightsolutions.com` (revise Spam) desde `notificaciones@bydlightsolutions.com`; `mail-status` sin `FALLIDO`; en Brevo (Transactional → Logs) figura «Delivered». Si falla: `$RUN node /s/mail-config-set.mjs /data/config/mail.json enabled=false` y detenerse (errores típicos: `BREVO-CLAVE-API-PASOS.md`). Con 401 casi siempre es la IP sin autorizar (Paso 1, B).

**Paso 6c: verificar la migración 5 (solo lectura; después del 6b)**
Las migraciones 4 y 5 ya las aplicó el Paso F (`07-aplicar-migraciones.sh`) y las comprobó `04-verificar-migracion-5.sh`; **no dependen de que una petición abra la base**. Este paso solo repite la verificación de solo lectura si pasó tiempo. Si `payments.json` está en `enabled=false` el Paso 6b no puede funcionar: use antes `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=pilot` (el público sigue cerrado) y vuelva a `enabled=false` al terminar si así estaba.
```
sudo bash ~/04-verificar-migracion-5.sh
```
Éxito: `schema_v=5`, 5 migraciones, `tax_documents` presente con sus 2 índices, órdenes y pagos **no menores** que en el respaldo del Paso 4, y «MIGRACION 5 VERIFICADA OK». Detenerse con cualquier `FALLAS`.

**Paso 6e: privacidad, solo SIMULACIÓN (no modifica datos; escribe una línea en `/data/privacy-audit.log`)**
```
$RUN node /s/admin-remote.mjs privacy-scan --config-file /data/config/payments.json
```
Es la comprobación de que la función responde. Debe decir `"mode":"simulacion"` y `anonymized: []`. **No use `--execute` en el despliegue.** Procedimiento completo: `docs/PRIVACIDAD-PROCEDIMIENTO.md`. La caducidad de respaldos (`docs/deploy/05-caducidad-respaldos.sh`) también es opcional y se ejecuta siempre primero en simulación; no forma parte del despliegue.

**Paso 6d: prueba de Webpay con acceso piloto (checkout aún cerrado al público; sin abrir `access=public`)**
1. Con `payments.json` en `enabled=true access=pilot`, genere el enlace piloto: `$RUN node /s/admin-remote.mjs pilot-link --config-file /data/config/payments.json` (use el patrón `$RUN` del Paso 6b).
2. Ábralo en su navegador, solicite un plan con datos propios, apruebe la cotización con `approve-test` y pague los $50 por Webpay; verifique comprobante, correo y que `/contratar` sin el enlace siga redirigiendo a `/contacto`.
3. Concilie lo cobrado con documentos: `$RUN node /s/admin-remote.mjs taxdoc-pending --config-file /data/config/payments.json` (lista los pagos sin documento y un resumen por tipo de cliente/pago; **no emite nada**). Decida a mano por pago (`voucher_pago`, boleta o factura) según `docs/DOCUMENTOS-TRIBUTARIOS.md`.
Este paso puede unirse con el 8.2; la compra real de $50 es decisión suya.

**Paso 6f: verificación final de HTTPS y de que los cobros públicos siguen cerrados**
```
(
set -u; f=0; U=https://bydlightsolutions.com
curl -sS -o /dev/null -w 'tls_verify=%{ssl_verify_result} http=%{http_code}
' "$U/" | tee /dev/stderr | grep -q 'tls_verify=0 http=200' || f=1
g=$(curl -s -o /dev/null -w '%{http_code}' "$U/contratar"); echo "/contratar -> $g (esperado 307: cerrado)"; [ "$g" = 307 ] || f=1
g=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "$U/api/solicitudes"); echo "POST /api/solicitudes sin acceso -> $g (esperado 4xx/503)"; case "$g" in 4*|503) ;; *) f=1;; esac
$RUN node /s/payments-config-set.mjs /data/config/payments.json --show | grep -Eq '"access": "pilot"|por defecto: pilot|"enabled": false' || f=1
[ $f = 0 ] && echo "BLOQUE 6f OK: HTTPS valido y cobros publicos cerrados" || echo "BLOQUE 6f: HAY FALLAS"
)
```
Si `/contratar` no devuelve 307 con el modo piloto, ciérrelo YA: `$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=false` y avise.

**Lista de comprobación antes del Paso 7 (todas deben cumplirse)**
1. Paso 2: «MIGRACION 4 VERIFICADA OK». Paso 4: «RESPALDO ETAPA B OK». Paso 5: `verify` y `status` con el SHA del release candidato y `salud: OK`.
2. Paso 6: todo `OK` (páginas legales 200, retorno inerte, checkout aún cerrado). Paso 6c: «MIGRACION 5 VERIFICADA OK». Paso 6e: simulación de privacidad sin errores. Paso 6f: «BLOQUE 6f OK». D10 y D12 resueltas.
3. Paso 6b: correo de prueba recibido en `contacto@`, `mail-status` sin `FALLIDO`.
4. `$RUN node /s/payments-config-set.mjs /data/config/payments.json --show` sigue en `access: pilot` o `enabled: false` y `adminRefunds: false`.
5. D1 aprobada por usted y su autorización final expresa y escrita.

**Paso 7: abrir al público (llave 2; reversible en ≤ 5 s)**
```
TAG=$(docker inspect -f '{{.Config.Image}}' bydlight-prod-web-1 | cut -d: -f2)
RUN="sudo bash $HOME/00-admin.sh"   # ver docs/deploy/00-admin.sh: prepara una copia legible de los scripts (el clon es privado de root)
$RUN node /s/payments-config-set.mjs /data/config/payments.json enabled=true access=public
sleep 6
$RUN node /s/payments-config-set.mjs /data/config/payments.json --show
curl -s -o /dev/null -w '/contratar: %{http_code} (esperado 200)\n' https://bydlightsolutions.com/contratar
```
Éxito: `--show` indica `enabled: true`, `access: public`, `adminRefunds: false`; `/contratar` 200. Solo ejecute este paso con D1 resuelta, el Paso 6b en «éxito» (D4) y la autorización final expresa del titular.

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
| Código anterior | `sudo bd-run rollback` → `sudo bd-run verify` → `sudo bd-run status` | Vuelve a `13aaf17` (legales ocultos, sin anuncio de pagos). Las migraciones 4 y 5 (aditivas) quedan en la base y el código anterior las ignora: la base no se revierte (ver «Recuperación» en 6.2 para el caso de corrupción) |
Con el interruptor en `enabled=false` el sitio sigue anunciando Webpay (el anuncio es de código) pero los botones llevan a contacto: es un degradado seguro. Para ocultar el anuncio hay que hacer rollback de código. **Nunca** `down -v`, borrar volúmenes ni restaurar un respaldo sobre pagos nuevos sin decisión expresa.

## 8. Riesgos conocidos
1. Si se abre `access=public` sin haber probado el correo (Paso 6b), el cliente puede no recibir sus confirmaciones.
2. Documento tributario: manual hasta la respuesta del contador (D3).
3. `monitor` y `reconcile` no están programados; dependen de la ejecución manual las primeras 48 h.
4. Plan gratuito de Brevo: 300 correos/día (≈ 40 órdenes completas). Al superarlo los correos se aplazan y se envían después, sin pérdida; si el volumen crece, subir de plan. Si cambia la IP de salida del servidor, Brevo dará 401 hasta autorizar la nueva (los correos se conservan hasta 72 h).
5. Correo unificado en `contacto@bydlightsolutions.com` (público, Reply-To y avisos internos); vigile que Zoho reciba y revise Spam. La política de privacidad ahora nombra a Brevo y Zoho Mail como proveedores: forma parte de los textos que D1 debe aprobar.
5. Los textos legales no han sido revisados por un abogado.
6. Entre el despliegue (Paso 5) y la apertura (Paso 7) el sitio anuncia Webpay y los botones de plan llevan a `/contratar`, que redirige a `/contacto`: haga ambos pasos seguidos.
7. `CLAUDE.md` del repositorio todavía dice «Webpay apagado e invisible»; actualizarlo tras la activación (no se modificó).
