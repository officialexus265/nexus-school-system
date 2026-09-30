
alter table schools add column if not exists status_reason text;
alter table schools add column if not exists subscription_period text;
alter table schools add column if not exists subscription_started_at timestamptz;
-- PAUSED is soft-stop by platform owner (with reason); distinct from SUSPENDED
