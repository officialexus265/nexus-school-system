# Data loss & recovery (NEXUS)

## What protects school data?

| Layer | What it does |
|--------|----------------|
| **Neon Postgres** | Primary store. Enable **point-in-time recovery (PITR)** on your Neon plan for “rewind” after mistakes. |
| **School JSON backup** | School Health → **Download full backup (JSON)**. Full tenant export (students, fees, results, etc.). |
| **Platform delete** | Explicit only (Delete / Wipe). Not automatic on non-payment. |
| **Suspension** | Blocks changes; does **not** delete data. |

## “What if the school data is lost?”

1. **Preferred:** restore the Neon database from backup / PITR (platform owner + Neon dashboard).  
2. **Secondary:** school owner provides the latest **JSON backup** file; support re-imports via a controlled procedure (contact system owner).  
3. **Prevention:** schedule weekly JSON downloads for critical schools; keep Neon PITR on.

## What is *not* automatic

- JSON files are **not** uploaded to NEXUS cloud by default — the school/operator stores them.  
- Re-import of a full JSON into a live tenant is a **support operation**, not a one-click button (avoids accidental overwrite).

## Non-payment

Data is **retained**. Status moves to grace / suspended; parent/staff writes may be blocked until payment. Delete is a separate platform action.


## Subscription pause policy

1. **15 days before** `subscription_expires_at` — email platform (`PLATFORM_ALERT_EMAIL`) + school owner/billing contact.
2. **On expiry** — status `GRACE_PERIOD` for **15 days** (school still works); emails sent.
3. **After grace** — status `PAUSED`; operations locked until pay / Grant access / Resume.

Cron: Vercel daily `GET /api/cron?job=all` (requires `CRON_SECRET`). Also call `subscription_lifecycle` via `job=all`.

## Data loss recovery

1. **School owner**: Settings / Health → download JSON backup while account is open.
2. **Soft-delete**: 14-day grace → export → then purge.
3. **Neon**: enable PITR on the Neon project; restore branch from a point in time if the DB is damaged.
4. **Platform**: keep `PLATFORM_ALERT_EMAIL` and working SMTP/Resend so pause warnings are received.

## Environment checklist

- `CRON_SECRET` — required in production for `/api/cron`
- `PLATFORM_ALERT_EMAIL` — your inbox for subscription alerts
- `PAYCHANGU_SECRET_KEY` + webhook URL
- `EMAIL_PROVIDER` + SMTP or Resend
