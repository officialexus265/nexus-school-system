
-- Pending student links carried on OTP challenge for self-service parent linking
alter table parent_otp_challenges add column if not exists pending_student_ids text;
alter table parent_otp_challenges add column if not exists parent_id text;
alter table parent_otp_challenges add column if not exists purpose text default 'login';
