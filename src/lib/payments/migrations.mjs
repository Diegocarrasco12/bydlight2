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
]
