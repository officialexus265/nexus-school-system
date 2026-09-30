
-- Support tickets (school ↔ platform)
create table if not exists support_tickets (
  id text primary key,
  school_id text references schools(id) on delete cascade,
  created_by_user_id text,
  created_by_name text,
  subject text not null,
  body text not null,
  status text not null default 'OPEN',
  priority text default 'NORMAL',
  platform_reply text,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists support_tickets_school_idx on support_tickets (school_id, status);
create index if not exists support_tickets_status_idx on support_tickets (status, created_at desc);

-- Optional campuses under one school
create table if not exists school_campuses (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  name text not null,
  area text,
  city text,
  is_main boolean default false,
  created_at timestamptz default now()
);
create index if not exists school_campuses_school_idx on school_campuses (school_id);

alter table students add column if not exists campus_id text;
alter table schools add column if not exists billing_contact_name text;
