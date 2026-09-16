-- F: Job queue + object storage metadata

create table if not exists background_jobs (
  id text primary key,
  school_id text,
  job_type text not null, -- FEE_REMINDERS | GENERATE_INVOICES | BULK_SMS | EXPORT
  payload jsonb,
  status text not null default 'PENDING', -- PENDING | RUNNING | DONE | FAILED
  attempts int not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists background_jobs_status_idx on background_jobs (status, scheduled_for);

create table if not exists stored_files (
  id text primary key,
  school_id text,
  key text not null unique,
  url text not null,
  content_type text,
  size_bytes int,
  purpose text, -- logo | document | receipt | report_card
  created_by text,
  created_at timestamptz not null default now()
);
