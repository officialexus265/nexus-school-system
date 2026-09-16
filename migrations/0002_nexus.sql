-- NEXUS school operating platform — per-user isolated tenants
create table if not exists nexus_workspaces (
  user_id text primary key,
  seeded_at timestamptz not null default now()
);

create table if not exists schools (
  id text primary key,
  user_id text not null,
  slug text not null,
  name text not null,
  registration_number text,
  address text,
  district text,
  city text,
  country text,
  phone text,
  email text,
  website text,
  motto text,
  school_type text,
  boarding_status text,
  status text not null default 'ACTIVE',
  logo_mark text,
  primary_color text,
  secondary_color text,
  timezone text default 'Africa/Blantyre',
  currency text default 'MWK',
  subscription_plan text,
  activation_fee numeric,
  student_capacity int,
  created_at timestamptz not null default now()
);
create index if not exists schools_user_idx on schools (user_id);

create table if not exists staff (
  id text primary key,
  user_id text not null,
  school_id text not null,
  full_name text not null,
  email text,
  phone text,
  role text not null,
  title text,
  status text not null default 'ACTIVE',
  initials text
);
create index if not exists staff_school_idx on staff (user_id, school_id);

create table if not exists classes (
  id text primary key,
  user_id text not null,
  school_id text not null,
  section text not null,
  name text not null,
  stream text,
  level_order int not null default 0
);

create table if not exists subjects (
  id text primary key,
  user_id text not null,
  school_id text not null,
  name text not null,
  code text,
  section text
);

create table if not exists teacher_assignments (
  id text primary key,
  user_id text not null,
  school_id text not null,
  staff_id text not null,
  class_id text not null,
  subject_id text not null,
  is_class_teacher boolean not null default false
);

create table if not exists students (
  id text primary key,
  user_id text not null,
  school_id text not null,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  gender text,
  date_of_birth date,
  class_id text,
  status text not null default 'ACTIVE',
  admission_date date,
  address text
);
create index if not exists students_school_idx on students (user_id, school_id);

create table if not exists parents (
  id text primary key,
  user_id text not null,
  school_id text not null,
  full_name text not null,
  phone text,
  email text,
  verification_status text not null default 'VERIFIED'
);

create table if not exists parent_students (
  id text primary key,
  user_id text not null,
  parent_id text not null,
  student_id text not null,
  relationship text,
  is_primary boolean not null default true
);

create table if not exists academic_years (
  id text primary key,
  user_id text not null,
  school_id text not null,
  name text not null,
  is_current boolean not null default false
);

create table if not exists terms (
  id text primary key,
  user_id text not null,
  school_id text not null,
  academic_year_id text not null,
  name text not null,
  term_number int not null,
  is_current boolean not null default false,
  start_date date,
  end_date date
);

create table if not exists assessments (
  id text primary key,
  user_id text not null,
  school_id text not null,
  class_id text,
  subject_id text,
  staff_id text,
  term_id text,
  name text not null,
  assessment_type text,
  maximum_marks int not null default 100,
  weight int,
  due_date date,
  status text not null default 'OPEN'
);

create table if not exists assessment_scores (
  id text primary key,
  user_id text not null,
  assessment_id text not null,
  student_id text not null,
  score numeric,
  comment text
);

create table if not exists result_submissions (
  id text primary key,
  user_id text not null,
  school_id text not null,
  class_id text not null,
  subject_id text not null,
  term_id text not null,
  staff_id text,
  status text not null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  published_by text
);

create table if not exists student_results (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text not null,
  term_id text not null,
  subject_id text not null,
  continuous_score numeric,
  exam_score numeric,
  overall_score numeric,
  grade text,
  position int,
  status text not null,
  teacher_comment text
);

create table if not exists attendance (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text not null,
  class_id text,
  date date not null,
  status text not null,
  recorded_by text
);
create index if not exists attendance_lookup_idx on attendance (user_id, school_id, date);

create table if not exists behaviour_records (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text not null,
  category text not null,
  kind text not null,
  severity text,
  points int not null default 0,
  description text,
  date date not null,
  status text not null default 'OPEN',
  recorded_by text
);

create table if not exists fee_structures (
  id text primary key,
  user_id text not null,
  school_id text not null,
  name text not null,
  class_id text,
  term_id text,
  amount numeric not null,
  due_date date,
  mandatory boolean not null default true
);

create table if not exists student_charges (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text not null,
  fee_structure_id text,
  description text not null,
  amount numeric not null,
  paid numeric not null default 0,
  due_date date,
  status text not null
);

create table if not exists payments (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text not null,
  parent_id text,
  amount numeric not null,
  method text not null,
  reference text,
  payment_date date not null,
  status text not null default 'VERIFIED',
  recorded_by text,
  receipt_number text
);

create table if not exists announcements (
  id text primary key,
  user_id text not null,
  school_id text not null,
  title text not null,
  body text not null,
  audience text not null default 'ALL',
  class_id text,
  created_at timestamptz not null default now(),
  author text
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  school_id text not null,
  title text not null,
  message text not null,
  channel text not null,
  event_type text,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

create table if not exists audit_logs (
  id text primary key,
  user_id text not null,
  school_id text,
  actor text not null,
  action text not null,
  entity_type text,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id text primary key,
  user_id text not null,
  school_id text not null,
  title text not null,
  event_type text,
  event_date date not null
);
