alter table school_email_settings add column if not exists gmail_refresh_token text;
alter table school_email_settings add column if not exists gmail_access_token text;
alter table school_email_settings add column if not exists gmail_token_expires_at timestamptz;
alter table school_email_settings add column if not exists gmail_address text;
alter table school_email_settings add column if not exists gmail_connected_at timestamptz;
-- mode can be: platform | smtp | gmail_oauth
