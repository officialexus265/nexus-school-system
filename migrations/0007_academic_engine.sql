-- B: Academic engine — grading, ranking, exams, promotions

create table if not exists grading_scales (
  id text primary key,
  school_id text not null references schools(id) on delete cascade,
  name text not null default 'Default',
  is_default boolean not null default true,
  -- weight percentages for overall calculation
  continuous_weight numeric not null default 40,
  exam_weight numeric not null default 60,
  created_at timestamptz not null default now()
);

create table if not exists grading_bands (
  id text primary key,
  scale_id text not null references grading_scales(id) on delete cascade,
  grade text not null, -- A+, A, B, ...
  min_score numeric not null,
  max_score numeric not null,
  points numeric,
  remark text,
  sort_order int not null default 0
);

create table if not exists ranking_settings (
  school_id text primary key references schools(id) on delete cascade,
  enabled boolean not null default true,
  show_to_parents boolean not null default true,
  rank_by text not null default 'overall_score' -- overall_score | grade_points
);

create table if not exists examinations (
  id text primary key,
  user_id text not null,
  school_id text not null references schools(id) on delete cascade,
  academic_year_id text,
  term_id text,
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'DRAFT', -- DRAFT | OPEN | CLOSED | PUBLISHED
  created_at timestamptz not null default now()
);

create table if not exists examination_subjects (
  id text primary key,
  examination_id text not null references examinations(id) on delete cascade,
  subject_id text not null,
  class_id text,
  maximum_marks numeric not null default 100
);

create table if not exists student_promotions (
  id text primary key,
  user_id text not null,
  school_id text not null,
  student_id text not null,
  from_class_id text,
  to_class_id text,
  academic_year_id text,
  action text not null, -- PROMOTED | REPEATED | TRANSFERRED | GRADUATED | WITHDRAWN
  notes text,
  effective_date date,
  created_by text,
  created_at timestamptz not null default now()
);

-- Optional subject rank cache
create table if not exists subject_rankings (
  id text primary key,
  school_id text not null,
  term_id text not null,
  class_id text not null,
  subject_id text not null,
  student_id text not null,
  score numeric,
  position int not null,
  unique (term_id, class_id, subject_id, student_id)
);
