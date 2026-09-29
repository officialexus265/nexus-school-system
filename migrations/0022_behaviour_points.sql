-- School-configurable behaviour points (module off by default)

create table if not exists behaviour_settings (
  school_id text primary key references schools(id) on delete cascade,
  enabled boolean not null default false,
  starting_points int not null default 10,
  weed_threshold int not null default -50,
  default_positive_points int not null default 1,
  default_negative_points int not null default -1,
  -- JSON array of { id, label, min_points?, max_points? } e.g. parent meeting, dismissal
  interventions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table students add column if not exists behaviour_points int;
-- null = use starting_points from settings when enabled
