-- C: Finance engine extensions

alter table fee_structures add column if not exists late_fee_amount numeric default 0;
alter table fee_structures add column if not exists late_fee_after_days int default 0;
alter table fee_structures add column if not exists academic_year_id text;
alter table fee_structures add column if not exists description text;

alter table payments add column if not exists voided_at timestamptz;
alter table payments add column if not exists void_reason text;
alter table payments add column if not exists voided_by text;

create table if not exists financial_adjustments (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text,
  payment_id text,
  student_charge_id text,
  adjustment_type text not null, -- VOID | REFUND | REVERSE | DISCOUNT | WRITE_OFF
  amount numeric not null,
  reason text not null,
  approved_by text,
  created_at timestamptz not null default now()
);

create table if not exists receipts (
  id text primary key,
  payment_id text not null unique,
  school_id text not null,
  receipt_number text not null,
  issued_at timestamptz not null default now(),
  issued_by text,
  html_snapshot text
);
