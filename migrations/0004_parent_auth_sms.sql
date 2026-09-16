-- Parent phone OTP auth + SMS foundation for non-smartphone parents

alter table parents add column if not exists sms_only boolean not null default false;
alter table parents add column if not exists app_installed_at timestamptz;
alter table parents add column if not exists last_login_at timestamptz;

-- OTP challenges for parent app login
create table if not exists parent_otp_challenges (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists parent_otp_phone_idx on parent_otp_challenges (school_id, phone);

-- Parent sessions (simple token after OTP success)
create table if not exists parent_sessions (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  parent_id text not null references parents(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists parent_sessions_token_idx on parent_sessions (token);

-- SMS delivery log (fee reminders, OTP, results, etc.)
create table if not exists sms_logs (
  id text primary key,
  school_id text not null,
  recipient text not null,
  message text not null,
  event_type text not null, -- OTP | FEE_REMINDER | RESULT_PUBLISHED | ABSENCE | BEHAVIOUR | ANNOUNCEMENT
  provider text,
  provider_reference text,
  status text not null default 'QUEUED', -- QUEUED | SENT | DELIVERED | FAILED
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sms_logs_school_idx on sms_logs (school_id, created_at desc);
