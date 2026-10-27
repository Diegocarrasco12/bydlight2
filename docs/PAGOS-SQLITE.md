# Pagos con SQLite — diseño y propuesta de infraestructura

Estado: el código está listo, **los pagos siguen apagados en producción** (`PAYMENTS_ENABLED` no definido ⇒ desactivado).
Nada de lo descrito en "Cambios de infraestructura" está aplicado; requiere aprobación administrativa.

## Qué hay implementado
- `src/lib/payments/db.ts`: apertura de SQLite (`node:sqlite`, integrado en Node ≥ 22.13; sin dependencias nativas), WAL, `synchronous=FULL`, claves foráneas, `busy_timeout`.
- `src/lib/payments/migrations.mjs`: migraciones versionadas con checksum; la app se niega a arrancar si una migración ya aplicada fue alterada.
- Tablas `orders`, `quotes`, `attempts`, `events` (STRICT) con restricciones en la propia base:
  - montos > 0, anticipo ≤ total, saldo = total − anticipo;
  - estados válidos por `CHECK`;
  - `buy_order` y `token` únicos;
  - **un solo pago autorizado por orden y tipo** (índice único parcial): la base impide un doble cobro aunque falle la lógica;
  - eventos solo-agregar, ligados a la orden.
- Escritura de cada orden en una transacción (`BEGIN IMMEDIATE`), más exclusión mutua por orden en el proceso.
- No se guarda número de tarjeta ni CVV; solo últimos 4 dígitos, código de autorización y estado informados por Transbank.
- Con pagos apagados nunca se abre ni se crea la base (en producción el disco es de solo lectura).

## Administración, respaldo y restauración (`scripts/orders-admin.mjs`)
`list | show | approve | release-balance | close | check | backup <archivo> | restore <archivo> --yes`
- `backup` usa `VACUUM INTO` (copia consistente con la app en marcha), verifica integridad y no sobrescribe.
- `restore` exige `--yes`, verifica el respaldo, guarda una copia previa de la base actual y aplica migraciones pendientes. Requiere detener la app.
- Verificado localmente: respaldo → cambio → restauración devuelve el estado anterior; reinicio y contenedor nuevo con el mismo volumen conservan las órdenes.

## Seguridad de los datos
- Archivo `0600`, directorio `0700`, usuario `node` (uid 1000), sin endpoint web que exponga la base; el CLI no imprime tokens.
- El volumen debe vivir fuera de `public/` y del contexto de build (`.dockerignore` ya excluye `.data`).
- Los respaldos contienen datos personales de clientes: guardarlos cifrados y con acceso restringido.

## Cambios de infraestructura necesarios (NO aplicados)
1. **Volumen persistente** montado en `/data` (propiedad uid/gid 1000), p. ej. volumen nombrado `bydlight_data`. El contenedor sigue con `read_only: true`.
   - Un volumen nombrado nuevo nace como `root`; hay que fijar el dueño (`chown 1000:1000`) una vez, o crear `/data` con dueño `node` en el Dockerfile para que Docker lo copie al volumen vacío.
2. **Variables** (hoy la política del ejecutor rechaza `environment`): `PAYMENTS_ENABLED=true`, `PUBLIC_BASE_URL=https://bydlightsolutions.com`; en producción real además `TBK_ENV=production`, `TBK_COMMERCE_CODE`, `TBK_API_KEY` (secreto: `env_file` fuera del repositorio o Docker secrets, nunca en Git).
   - La ruta de la base ya tiene valor fijo `/data/bydlight.db` en producción, por lo que no necesita variable.
3. **Aprobación administrativa** de los cambios de Compose (`accept-compose`), a cargo del titular.
4. **Respaldos programados** de `/data` (copia diaria con `backup`, retención definida, fuera del servidor si es posible).
5. **Una sola réplica** del servicio (SQLite con un único escritor).

## Riesgos conocidos
- `node:sqlite` está marcado como experimental en Node 22 (emite un aviso al abrir). La API usada es mínima y estable; se verificó con Node 22.23.4. Alternativa si se prefiere: `better-sqlite3` (agrega dependencia nativa y compilación en la imagen).
- El tiempo de expiración por abandono depende de que alguien consulte la orden (`verificar`); no hay tarea en segundo plano.
- La aprobación de cotizaciones es por CLI en la máquina del administrador; con la base en el servidor habrá que definir cómo se opera (ejecutor con operación específica o panel autenticado).

## Plan de recuperación
- Falla de la app: `rollback` del ejecutor a la versión anterior (con autorización); la base no se toca.
- Corrupción o pérdida: detener, `restore` del último respaldo, `check`, iniciar.
- Migración defectuosa: cada migración corre en transacción; si falla, no se aplica y la app no abre la base (los pagos quedan fuera de servicio, el sitio sigue).
