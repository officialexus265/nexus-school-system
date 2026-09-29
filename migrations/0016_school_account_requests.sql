-- Public school account proposals / requests from the login page

create table if not exists school_account_requests (
  id text primary key,
  school_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  city text,
  location_notes text,
  sections text not null, -- e.g. nursery,primary or all
  billing_tier text not null,
  billing_period text not null default 'monthly',
  quoted_amount int not null default 0,
  message text,
  status text not null default 'PENDING', -- PENDING | CONTACTED | APPROVED | REJECTED
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  notes text
);

create index if not exists school_account_requests_status_idx
  on school_account_requests (status, created_at desc);
