-- Staff TOTP 2FA
create table if not exists user_totp (
  user_id text primary key,
  secret text not null,
  enabled boolean not null default false,
  backup_codes text, -- comma-separated hashed or plain one-time codes
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Pending 2FA challenges after password sign-in
create table if not exists totp_challenges (
  id text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
