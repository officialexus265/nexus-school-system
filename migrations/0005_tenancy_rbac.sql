-- A: True tenancy helpers, RBAC, parent verification, subscription events

-- Permissions catalog
create table if not exists permissions (
  id text primary key,
  code text not null unique,
  description text
);

create table if not exists roles (
  id text primary key,
  school_id text references schools(id) on delete cascade, -- null = platform-level role
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id text not null references roles(id) on delete cascade,
  permission_id text not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Membership can reference a role
alter table user_school_memberships add column if not exists role_id text references roles(id);
alter table user_school_memberships add column if not exists title text;

-- Subscription / billing events
create table if not exists subscription_events (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  actor_user_id text,
  created_at timestamptz not null default now()
);

alter table schools add column if not exists subscription_expires_at timestamptz;
alter table schools add column if not exists grace_ends_at timestamptz;
alter table schools add column if not exists activated_at timestamptz;

-- Parent verification requests (parent-initiated)
create table if not exists parent_verification_requests (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  parent_phone text not null,
  parent_name text,
  student_id text,
  student_number text,
  student_name_guess text,
  status text not null default 'PENDING', -- PENDING | APPROVED | REJECTED
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pvr_school_status_idx on parent_verification_requests (school_id, status);

-- Setup wizard progress
create table if not exists school_setup_progress (
  school_id text primary key references schools(id) on delete cascade,
  profile_done boolean not null default false,
  branding_done boolean not null default false,
  academics_done boolean not null default false,
  grading_done boolean not null default false,
  fees_done boolean not null default false,
  behaviour_done boolean not null default false,
  parent_app_done boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Seed default permission codes (idempotent)
insert into permissions (id, code, description) values
  ('perm-school-settings', 'school.settings.manage', 'Manage school profile and settings'),
  ('perm-school-branding', 'school.branding.manage', 'Manage branding and parent app'),
  ('perm-school-roles', 'school.roles.manage', 'Manage roles and permissions'),
  ('perm-students-manage', 'students.manage', 'Create and edit students'),
  ('perm-students-view', 'students.view', 'View students'),
  ('perm-parents-manage', 'parents.manage', 'Manage parents'),
  ('perm-teachers-manage', 'teachers.manage', 'Manage teachers'),
  ('perm-results-view', 'results.view', 'View results'),
  ('perm-results-review', 'results.review', 'Review submitted results'),
  ('perm-results-approve', 'results.approve', 'Approve results'),
  ('perm-results-publish', 'results.publish', 'Publish results'),
  ('perm-finance-view', 'finance.view', 'View finance'),
  ('perm-finance-manage', 'finance.manage', 'Manage fees and payments'),
  ('perm-attendance-manage', 'attendance.manage', 'Manage attendance'),
  ('perm-behaviour-manage', 'behaviour.manage', 'Manage behaviour'),
  ('perm-notifications-manage', 'notifications.manage', 'Manage notifications and SMS'),
  ('perm-audit-view', 'audit_logs.view', 'View audit logs'),
  ('perm-platform-schools', 'platform.schools.manage', 'Platform: manage all schools')
on conflict (id) do nothing;
