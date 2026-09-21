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
