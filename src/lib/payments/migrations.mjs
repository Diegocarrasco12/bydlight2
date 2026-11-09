// Migraciones de esquema. Reglas: solo se agregan al final, nunca se editan las ya aplicadas
// (se guarda su checksum y la app se niega a arrancar si cambian).

/** @typedef {{ version: number, name: string, sql: string }} Migration */

/** @type {Migration[]} */
export const MIGRATIONS = [
  {
    version: 1,
    name: "ordenes-cotizaciones-pagos",
    sql: `
CREATE TABLE orders (
  id          TEXT PRIMARY KEY CHECK (length(id) = 12),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  stage       TEXT NOT NULL CHECK (stage IN ('SOLICITADA','COTIZADA','ANTICIPO_PAGADO','SALDO_HABILITADO','PAGADA','CERRADA')),
  plan_id     TEXT NOT NULL,
  plan_name   TEXT NOT NULL,
  cust_name   TEXT NOT NULL,
  cust_email  TEXT NOT NULL,
  cust_phone  TEXT,
  cust_company TEXT,
  message     TEXT NOT NULL
) STRICT;

CREATE TABLE quotes (
  order_id        TEXT PRIMARY KEY REFERENCES orders(id),
  amount          INTEGER NOT NULL CHECK (amount > 0),
  deposit_percent INTEGER NOT NULL CHECK (deposit_percent BETWEEN 1 AND 100),
  deposit_amount  INTEGER NOT NULL CHECK (deposit_amount > 0 AND deposit_amount <= amount),
  balance_amount  INTEGER NOT NULL CHECK (balance_amount >= 0 AND balance_amount = amount - deposit_amount),
  approved_at     TEXT NOT NULL,
  valid_until     TEXT NOT NULL,
  note            TEXT
) STRICT;

CREATE TABLE attempts (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id),
  kind               TEXT NOT NULL CHECK (kind IN ('anticipo','saldo')),
  buy_order          TEXT NOT NULL UNIQUE CHECK (length(buy_order) <= 26),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  token              TEXT,
  status             TEXT NOT NULL CHECK (status IN ('INICIADO','AUTORIZADO','RECHAZADO','CANCELADO','EXPIRADO','ERROR')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  authorization_code TEXT,
  card_last4         TEXT CHECK (card_last4 IS NULL OR length(card_last4) = 4),
  payment_type       TEXT,
  installments       INTEGER,
  response_code      INTEGER,
  tbk_status         TEXT,
  note               TEXT
) STRICT;

CREATE INDEX attempts_by_order ON attempts(order_id);
CREATE UNIQUE INDEX attempts_token ON attempts(token) WHERE token IS NOT NULL;
-- Un anticipo y un saldo autorizados por orden, como maximo: la base impide el doble cobro aunque falle la logica.
CREATE UNIQUE INDEX attempts_one_authorized ON attempts(order_id, kind) WHERE status = 'AUTORIZADO';

CREATE TABLE events (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  at       TEXT NOT NULL,
  type     TEXT NOT NULL,
  detail   TEXT
) STRICT;
CREATE INDEX events_by_order ON events(order_id, seq);
`,
  },
  {
    version: 2,
    name: "admin-nonces",
    sql: `
-- Nonces de la API administrativa firmada: cada peticion solo se acepta una vez (anti-repeticion).
CREATE TABLE admin_nonces (
  nonce   TEXT PRIMARY KEY CHECK (length(nonce) BETWEEN 16 AND 64),
  used_at INTEGER NOT NULL
) STRICT;
CREATE INDEX admin_nonces_by_time ON admin_nonces(used_at);
`,
  },
  {
    version: 3,
    name: "estado-pendiente-y-devoluciones",
    sql: `
-- Estado PENDIENTE (confirmacion incierta), fecha y monto de cuota informados por Transbank, y tabla de devoluciones.
CREATE TABLE attempts_new (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id),
  kind               TEXT NOT NULL CHECK (kind IN ('anticipo','saldo')),
  buy_order          TEXT NOT NULL UNIQUE CHECK (length(buy_order) <= 26),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  token              TEXT,
  status             TEXT NOT NULL CHECK (status IN ('INICIADO','AUTORIZADO','RECHAZADO','CANCELADO','EXPIRADO','ERROR','PENDIENTE')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  authorization_code TEXT,
  card_last4         TEXT CHECK (card_last4 IS NULL OR length(card_last4) = 4),
  payment_type       TEXT,
  installments       INTEGER,
  response_code      INTEGER,
  tbk_status         TEXT,
  note               TEXT,
  transaction_date   TEXT,
  installments_amount INTEGER
) STRICT;
INSERT INTO attempts_new (id, order_id, kind, buy_order, amount, token, status, created_at, updated_at, authorization_code,
  card_last4, payment_type, installments, response_code, tbk_status, note)
  SELECT id, order_id, kind, buy_order, amount, token, status, created_at, updated_at, authorization_code,
  card_last4, payment_type, installments, response_code, tbk_status, note FROM attempts;
DROP TABLE attempts;
ALTER TABLE attempts_new RENAME TO attempts;
CREATE INDEX attempts_by_order ON attempts(order_id);
CREATE UNIQUE INDEX attempts_token ON attempts(token) WHERE token IS NOT NULL;
CREATE UNIQUE INDEX attempts_one_authorized ON attempts(order_id, kind) WHERE status = 'AUTORIZADO';

CREATE TABLE refunds (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id),
  attempt_id         TEXT NOT NULL REFERENCES attempts(id),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  status             TEXT NOT NULL CHECK (status IN ('SOLICITADA','COMPLETADA','FALLIDA','INCIERTA')),
  type               TEXT,
  nullified_amount   INTEGER,
  balance            INTEGER,
  authorization_code TEXT,
  authorization_date TEXT,
  response_code      INTEGER,
  idempotency_key    TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 16 AND 64),
  requested_by       TEXT NOT NULL,
  reason             TEXT,
  error              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
) STRICT;
CREATE INDEX refunds_by_order ON refunds(order_id);
-- A lo sumo una devolucion abierta (solicitada o incierta) por pago: impide devoluciones simultaneas o duplicadas.
CREATE UNIQUE INDEX refunds_one_open ON refunds(attempt_id) WHERE status IN ('SOLICITADA','INCIERTA');
`,
  },
  {
    version: 4,
    name: "tipo-de-cliente-y-cola-de-correos",
    sql: `
-- Persona natural o empresa (datos tributarios solo para empresas). Las ordenes existentes quedan como 'persona' sin alterar nada mas.
ALTER TABLE orders ADD COLUMN cust_type TEXT NOT NULL DEFAULT 'persona' CHECK (cust_type IN ('persona','empresa'));
ALTER TABLE orders ADD COLUMN cust_tax_id TEXT;
ALTER TABLE orders ADD COLUMN cust_giro TEXT;
ALTER TABLE orders ADD COLUMN cust_address TEXT;

-- Cola persistente de correos transaccionales. dedupe_key UNIQUE = idempotencia (un correo por hecho, aunque se repita el callback).
-- Al enviarse, el cuerpo se vacia (se conserva solo el registro del envio) para no guardar datos personales de mas.
CREATE TABLE mail_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key      TEXT NOT NULL UNIQUE,
  order_id        TEXT,
  template        TEXT NOT NULL,
  to_addr         TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  body_text       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('PENDIENTE','ENVIANDO','ENVIADO','FALLIDO')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error      TEXT,
  created_at      TEXT NOT NULL,
  sent_at         TEXT
) STRICT;
CREATE INDEX mail_outbox_due ON mail_outbox(status, next_attempt_at);
`,
  },
  {
    version: 5,
    name: "documentos-tributarios",
    sql: `
-- Registro de documentos tributarios por pago (boleta, factura nacional, factura de exportacion, nota de credito). SOLO REGISTRA: el sistema
-- no emite ni envia nada al SII; el titular registra aqui el folio del documento que emitio por los canales autorizados.
-- Aditiva: no modifica tablas existentes; el codigo anterior la ignora.
CREATE TABLE tax_documents (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         TEXT NOT NULL REFERENCES orders(id),
  attempt_id       TEXT REFERENCES attempts(id),
  kind             TEXT NOT NULL CHECK (kind IN ('boleta','factura','factura_exportacion','nota_credito','voucher_pago')),
  status           TEXT NOT NULL CHECK (status IN ('PENDIENTE','EMITIDO','ANULADO','NO_REQUERIDO')),
  folio            TEXT,
  issued_at        TEXT,
  currency         TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP')),
  total_amount     INTEGER NOT NULL CHECK (total_amount > 0),
  net_amount       INTEGER,
  vat_amount       INTEGER,
  receiver_tax_id  TEXT,
  receiver_name    TEXT,
  ref_doc_id       INTEGER REFERENCES tax_documents(id),
  note             TEXT,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  CHECK (status <> 'EMITIDO' OR (folio IS NOT NULL AND issued_at IS NOT NULL)),
  CHECK (kind <> 'nota_credito' OR ref_doc_id IS NOT NULL),
  -- voucher_pago: el voucher electronico del medio de pago es el documento tributario valido; no se emite documento adicional (NO_REQUERIDO).
  CHECK (status <> 'NO_REQUERIDO' OR kind = 'voucher_pago'),
  CHECK (kind <> 'voucher_pago' OR status IN ('NO_REQUERIDO','ANULADO')),
  CHECK (kind = 'nota_credito' OR attempt_id IS NOT NULL)
) STRICT;
CREATE INDEX tax_documents_by_order ON tax_documents(order_id);
-- Un folio no se repite dentro de un mismo tipo de documento.
CREATE UNIQUE INDEX tax_documents_folio ON tax_documents(kind, folio) WHERE folio IS NOT NULL;
-- A lo sumo un documento vigente (no anulado) de venta por pago: impide emision duplicada.
CREATE UNIQUE INDEX tax_documents_one_per_payment ON tax_documents(attempt_id) WHERE kind <> 'nota_credito' AND status <> 'ANULADO';
`,
  },
]
