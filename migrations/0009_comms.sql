-- D: Communication — school ↔ parent messaging, push tokens (prep)

create table if not exists messages (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  thread_id text not null,
  sender_type text not null, -- SCHOOL | PARENT
  sender_user_id text,
  sender_parent_id text,
  recipient_parent_id text,
  recipient_user_id text,
  student_id text,
  subject text,
  body text not null,
  channel text not null default 'IN_APP', -- IN_APP | SMS | EMAIL
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_school_thread_idx on messages (school_id, thread_id, created_at);
create index if not exists messages_parent_idx on messages (recipient_parent_id, created_at desc);

create table if not exists push_tokens (
  id text primary key,
  school_id text,
  parent_id text,
  user_id text,
  token text not null,
  platform text, -- web | android | ios
  created_at timestamptz not null default now(),
  unique (token)
);

-- Prefer email for parents when available
alter table parents add column if not exists notify_email boolean not null default true;
alter table parents add column if not exists notify_sms boolean not null default true;
alter table parents add column if not exists notify_push boolean not null default true;
