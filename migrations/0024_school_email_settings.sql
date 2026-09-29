-- Per-school outbound email (SMTP). Platform mail remains fallback.

create table if not exists school_email_settings (
  school_id text primary key references schools(id) on delete cascade,
  -- Display / reply
  from_name text,
  from_email text,
  reply_to text,
  -- smtp | platform (use global NEXUS mail)
  mode text not null default 'platform',
  smtp_host text,
  smtp_port int default 587,
  smtp_user text,
  -- store app password / SMTP secret (treat as secret in ops)
  smtp_pass text,
  smtp_secure boolean not null default false,
  verified_at timestamptz,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz not null default now()
);
