
alter table schools add column if not exists activation_paid_at timestamptz;
alter table schools add column if not exists activation_discount_pct numeric default 0;
alter table schools add column if not exists is_lucky_school boolean default false;
alter table schools add column if not exists first_sub_discount_pct numeric default 0;

create table if not exists platform_promotions (
  id text primary key,
  kind text not null, -- DISCOUNT | SIGNUP
  title text not null,
  description text,
  og_image_url text,
  discount_pct numeric,
  target text default 'first_subscription', -- first_subscription | activation | all
  public_slug text unique,
  active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);
