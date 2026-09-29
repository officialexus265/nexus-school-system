-- Subjects apply only to selected classes (not whole section blindly)
create table if not exists subject_classes (
  subject_id text not null references subjects(id) on delete cascade,
  class_id text not null references classes(id) on delete cascade,
  primary key (subject_id, class_id)
);
create index if not exists subject_classes_class_idx on subject_classes (class_id);

-- Multiple grading scales per school (primary letters, secondary points, etc.)
alter table grading_scales add column if not exists section text;
alter table grading_scales add column if not exists system text default 'letter';
-- letter | points_1_9 | custom
alter table grading_scales add column if not exists applies_to text;
-- free text e.g. "Primary" | "Secondary Form 1-2" | "Secondary Form 3-4"
