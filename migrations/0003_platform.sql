-- Platform-level multi-tenant foundations
-- Adds invite flow, memberships, and platform-owner flag.
-- Existing per-user isolation continues to work during transition.

-- Platform owner flag on Better Auth user table
alter table "user" add column if not exists is_platform_owner boolean not null default false;

-- Extra columns on schools for invite + ownership
alter table schools add column if not exists owner_user_id text;
alter table schools add column if not exists created_by text;
alter table schools add column if not exists owner_name text;
alter table schools add column if not exists owner_email text;
alter table schools add column if not exists invite_token text;
alter table schools add column if not exists invite_expires_at timestamptz;
alter table schools add column if not exists password_set_at timestamptz;
alter table schools add column if not exists parent_app_name text;
alter table schools add column if not exists parent_app_icon_url text;
alter table schools add column if not exists parent_app_slug text;

create unique index if not exists schools_invite_token_idx on schools (invite_token) where invite_token is not null;
create unique index if not exists schools_parent_app_slug_idx on schools (parent_app_slug) where parent_app_slug is not null;

-- Memberships: a user can belong to one or more schools with a role
create table if not exists user_school_memberships (
  id text primary key,
  user_id text not null references "user"("id") on delete cascade,
  school_id text not null references schools(id) on delete cascade,
  role text not null, -- owner | head | teacher | bursar | exam | parent | staff
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  unique (user_id, school_id)
);
create index if not exists memberships_user_idx on user_school_memberships (user_id);
create index if not exists memberships_school_idx on user_school_memberships (school_id);

-- Parent app configuration (one row per school)
create table if not exists parent_app_settings (
  id text primary key,
  school_id text not null unique references schools(id) on delete cascade,
  app_name text,
  app_icon_url text,
  splash_color text,
  primary_color text,
  secondary_color text,
  results_enabled boolean not null default true,
  attendance_enabled boolean not null default true,
  behaviour_enabled boolean not null default true,
  fees_enabled boolean not null default true,
  assignments_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  documents_enabled boolean not null default true,
  calendar_enabled boolean not null default true,
  published_at timestamptz,
  install_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simple invite / password-reset tokens (also usable for set-password)
create table if not exists school_invites (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  email text not null,
  token text not null unique,
  role text not null default 'owner',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists school_invites_token_idx on school_invites (token);
