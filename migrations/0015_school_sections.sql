-- Three academic sections: Nursery, Primary, Secondary
-- Staff can belong to a section and optionally be section head.

alter table staff add column if not exists section text;
alter table staff add column if not exists is_section_head boolean not null default false;

comment on column staff.section is 'NURSERY | PRIMARY | SECONDARY | null (whole school)';
comment on column staff.is_section_head is 'Head teacher / headmaster for this section';

-- Soft helpers: ensure section values on classes/subjects stay conventional
-- (Nursery | Primary | Secondary) — enforced in app layer
