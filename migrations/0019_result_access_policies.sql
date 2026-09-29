-- Who may view published results (all parents vs fee-clear on selected fee types)

create table if not exists result_access_policies (
  id text primary key,
  school_id text not null,
  class_id text not null,
  term_id text not null,
  -- ALL = every linked parent; FEE_CRITERIA = must have zero balance on each required fee type
  access_mode text not null default 'ALL',
  -- JSON array of fee_structures.id that must be fully paid (no outstanding balance)
  required_fee_structure_ids jsonb not null default '[]'::jsonb,
  notes text,
  published_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, class_id, term_id)
);

create index if not exists result_access_policies_school_idx
  on result_access_policies (school_id, term_id);

-- Optional flag: fee type can appear as a publish criterion checkbox
alter table fee_structures add column if not exists gates_results boolean not null default true;
