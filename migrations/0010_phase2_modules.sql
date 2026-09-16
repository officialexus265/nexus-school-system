-- E: Calendar, documents, admissions

alter table calendar_events add column if not exists description text;
alter table calendar_events add column if not exists end_date date;
alter table calendar_events add column if not exists audience text default 'ALL';
alter table calendar_events add column if not exists class_id text;

create table if not exists documents (
  id text primary key,
  user_id text not null,
  school_id text not null,
  title text not null,
  category text, -- POLICY | REPORT | FORM | CIRCULAR | OTHER
  description text,
  file_url text, -- external URL or object storage path
  audience text not null default 'STAFF', -- STAFF | PARENTS | ALL
  class_id text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists documents_school_idx on documents (school_id, created_at desc);

create table if not exists admission_applications (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  applicant_name text not null,
  date_of_birth date,
  gender text,
  guardian_name text not null,
  guardian_phone text not null,
  guardian_email text,
  applying_class text,
  previous_school text,
  notes text,
  status text not null default 'SUBMITTED', -- SUBMITTED | UNDER_REVIEW | ACCEPTED | REJECTED | ENROLLED
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admission_school_status_idx on admission_applications (school_id, status);
