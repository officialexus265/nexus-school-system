-- Teachers linked to classes they teach; attendance is shared per class for all assigned teachers

create table if not exists staff_class_assignments (
  staff_id text not null,
  class_id text not null,
  school_id text not null,
  created_at timestamptz not null default now(),
  primary key (staff_id, class_id)
);
create index if not exists staff_class_assignments_staff_idx on staff_class_assignments (staff_id);
create index if not exists staff_class_assignments_class_idx on staff_class_assignments (class_id, school_id);
