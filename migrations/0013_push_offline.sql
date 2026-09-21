-- Device tokens for FCM / Web Push
create table if not exists device_tokens (
  id text primary key,
  school_id text,
  user_id text,
  parent_id text,
  token text not null,
  platform text not null default 'web', -- web | android | ios
  provider text not null default 'fcm', -- fcm | webpush
  label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token)
);
create index if not exists device_tokens_school_idx on device_tokens (school_id);
create index if not exists device_tokens_parent_idx on device_tokens (parent_id);
create index if not exists device_tokens_user_idx on device_tokens (user_id);

-- Optional offline mutation log (server-side audit of synced items)
create table if not exists offline_sync_log (
  id text primary key,
  school_id text,
  user_id text,
  client_id text,
  action text not null,
  payload jsonb,
  status text not null default 'APPLIED',
  created_at timestamptz not null default now()
);
