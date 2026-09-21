# NEXUS — Client readiness & owner FAQ

## What the product is

NEXUS is a **multi-school** management platform for Malawi (and similar markets):

| Layer | Who | What they use |
|-------|-----|----------------|
| **Platform owner (you)** | System vendor | `/app/platform` — open schools, invoices, wipe/delete |
| **School owner / staff** | Head, teachers, bursar | `/app` after invite — students, fees, results, notices |
| **Parents** | Guardians | School-branded **PWA** at `/p/{slug}` + SMS if no smartphone |

Schools **do not self-register**. You create the school, invite the owner by email; they set a password and configure the school.

---

## End-to-end flows (verified design)

1. **You create a school** → invite link + email (Resend when configured).  
2. **Owner opens** `/set-password?token=…` → account + membership + setup wizard.  
3. **Owner configures** branding, classes, fees, httpSMS, parent app publish.  
4. **Staff** invited/managed under People (sign in at `/login`).  
5. **Parents** install PWA or receive SMS (OTP login by phone).  
6. **Fees** recorded in cash/MoMo or **PayChangu** (card / MoMo / bank).  
7. **You invoice** schools monthly/termly/yearly; PayChangu or mark paid.

---

## Questions school owners ask — and answers

### “Can parents see only our school?”
**Yes.** Parent app is locked to `parent_app_slug`. OTP is for parents registered under that school only.

### “How do parents without smartphones get updates?”
**SMS** via the school’s **httpSMS** account (credentials in School settings). Fee reminders and notices can go out as SMS. OTP codes also SMS.

### “Can we take Airtel Money / TNM / card?”
**Yes**, through **PayChangu** hosted checkout (staff Finance → Pay online). Configure `PAYCHANGU_SECRET_KEY` + webhook.

### “Who can change marks / publish results?”
Draft → review → publish workflow with roles (owner, head, exam, teacher). Permissions are enforced on the server for key finance and results actions.

### “Is our data mixed with another school?”
**No by design.** Data is loaded by **school_id** + membership. Platform owner sees all schools; school users only their memberships.

### “Can we brand the parent app?”
**Yes** — name, colours, logo mark, install link (`/p/{slug}`). Share on WhatsApp. Install as PWA (Add to Home Screen).

### “What about report cards and ID cards?”
**Yes** — print-friendly report card and student ID from the student file (browser Print / Save PDF).

### “Can staff use phones?”
**Yes** — staff use the same `/app` UI; site is installable as a **PWA** (standalone). Not a separate App Store binary yet.

### “How do we get charged by NEXUS?”
Platform **invoices** (Primary / Secondary / Both pricing tiers). Reminders by email + optional platform httpSMS.

### “What if we stop paying?”
School status can move to grace / suspended (platform controls). Data is retained for non-payment; delete is a separate explicit action.

### “Is this live production-grade security?”
**Solid foundation, not bank-grade yet.** See gaps below for honest sales conversations.

---

## Honest gaps (do not oversell)

| Gap | Client wording |
|-----|----------------|
| Native App Store apps | “Installable web app (PWA) now; native wrappers later if needed.” |
| Full RBAC UI for custom roles | “Standard roles (owner, teacher, bursar, exam) with server checks; fine-grained role editor later.” |
| Push notifications (FCM) | “Supported when Firebase/FCM keys are configured; otherwise SMS + in-app.” |
| Automatic payroll / HR / library / transport | “Not in this release — focus is academics, fees, parents, attendance.” |
| Offline | “PWA shell cache + offline banner + local action queue; full offline DB not included.” |
| Rate limits / 2FA on staff login | “Password + invite flow; 2FA can be added.” |
| Multi-currency beyond MWK | “Built around MWK; other currencies need config.” |

---

## Ops checklist before a client demo

1. Neon `DATABASE_URL` + migrations applied  
2. `BETTER_AUTH_URL` / `VITE_APP_URL` = public HTTPS URL  
3. Resend for invite emails  
4. PayChangu keys + webhook `https://YOUR_DOMAIN/api/paychangu/webhook`  
5. Platform owner account (`is_platform_owner = true`)  
6. Create one demo school → invite → set password → setup → publish parent app  
7. One parent phone + OTP (SMS or console log in demo)  
8. One fee charge + optional PayChangu test payment  

---

## Security notes (for technical stakeholders)

- Auth: Better Auth (email/password).  
- Platform vs school: `is_platform_owner` + `user_school_memberships`.  
- Mutations: many use `requirePermission` / `requireSchoolAccess`; snapshot is **school_id** scoped.  
- PayChangu webhooks: HMAC signature when secret configured.  
- Parent OTP: time-limited challenges; codes not stored long-term in clear in production SMS path.  
- Always use HTTPS in production.

---

*This document is the source of truth for “what can we say to clients today.”*


## Offline & push (this release)

- **Service worker** (`/sw.js`) caches app shell; API calls stay network-only.
- **Offline banner** when the browser is offline; queue list in `localStorage`.
- **FCM**: register device in School → settings; server sends via `FCM_SERVER_KEY`.
- Install `firebase` and set `VITE_FIREBASE_*` for real web tokens.


## Offline, 2FA, roles (extended)

| Feature | Behaviour |
|---------|-----------|
| **Offline reads** | Last school snapshot cached in IndexedDB; served when offline |
| **Offline writes** | Queued in localStorage; **auto-flush** on `online` + manual Sync |
| **Flush coverage** | Attendance, payments, assessments, messages, fees, school settings, parent app, SMS settings, exams, promote… |
| **Staff 2FA** | TOTP in School settings; required at login when enabled |
| **Custom roles** | `/app/roles` visual editor; permissions applied via `role_permissions` |
