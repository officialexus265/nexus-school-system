-- Per-school httpSMS credentials + platform subscription invoices

alter table schools add column if not exists billing_tier text;
-- primary | secondary | both  (derived from school_type / sections)

alter table schools add column if not exists billing_period text default 'monthly';
-- monthly | term | annual

alter table schools add column if not exists billing_contact_phone text;
alter table schools add column if not exists billing_contact_email text;

-- School's own httpSMS account (used for parent OTP, fee reminders, etc.)
create table if not exists school_sms_settings (
  school_id text primary key references schools(id) on delete cascade,
  provider text not null default 'httpsms',
  api_key text,
  from_number text, -- Android phone number registered in httpSMS
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Platform owner httpSMS (for invoice SMS to schools) uses env:
-- PLATFORM_HTTPSMS_API_KEY, PLATFORM_HTTPSMS_FROM

create table if not exists platform_invoices (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  invoice_number text not null unique,
  billing_tier text not null, -- primary | secondary | both
  billing_period text not null, -- monthly | term | annual
  period_start date not null,
  period_end date not null,
  amount numeric not null,
  currency text not null default 'MWK',
  status text not null default 'DRAFT', -- DRAFT | SENT | PAID | OVERDUE | VOID
  due_date date not null,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists platform_invoices_school_idx on platform_invoices (school_id, created_at desc);
create index if not exists platform_invoices_status_idx on platform_invoices (status, due_date);

create table if not exists platform_invoice_events (
  id text primary key,
  invoice_id text not null references platform_invoices(id) on delete cascade,
  action text not null, -- GENERATED | SENT_EMAIL | SENT_SMS | REMINDED | PAID | VOID
  detail text,
  actor text,
  created_at timestamptz not null default now()
);
