-- PayChangu payment intents (school fees + platform invoices)

create table if not exists payment_intents (
  id text primary key,
  school_id text not null,
  purpose text not null, -- STUDENT_FEE | PLATFORM_INVOICE
  student_id text,
  charge_id text, -- student_charges.id
  platform_invoice_id text,
  amount numeric not null,
  currency text not null default 'MWK',
  tx_ref text not null unique,
  provider text not null default 'paychangu',
  status text not null default 'PENDING', -- PENDING | SUCCESS | FAILED | CANCELLED
  checkout_url text,
  provider_reference text,
  channel text, -- Card | Mobile Money | Bank Transfer
  payer_email text,
  payer_phone text,
  meta jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists payment_intents_tx_ref_idx on payment_intents (tx_ref);
create index if not exists payment_intents_school_idx on payment_intents (school_id, status);
