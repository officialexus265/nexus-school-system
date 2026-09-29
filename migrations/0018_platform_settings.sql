-- Editable platform / system-owner public contact info (login page, etc.)

create table if not exists platform_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into platform_settings (key, value) values
  ('contact_phone_display', '0980697476'),
  ('contact_phone_e164', '+265980697476'),
  ('contact_whatsapp', '265980697476'),
  ('contact_label', 'system owner'),
  ('support_email', '')
on conflict (key) do nothing;
