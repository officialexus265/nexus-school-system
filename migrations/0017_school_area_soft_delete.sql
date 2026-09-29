-- Location hierarchy: city + area (e.g. Lilongwe / Area 10)
alter table schools add column if not exists area text;

-- Soft-delete + 14-day export window before hard purge
alter table schools add column if not exists deleted_at timestamptz;
alter table schools add column if not exists purge_after timestamptz;
alter table schools add column if not exists deleted_by text;

comment on column schools.area is 'Neighbourhood / area within city (e.g. Area 10, Ndirande)';
comment on column schools.purge_after is 'After this time platform may hard-delete all school data';
