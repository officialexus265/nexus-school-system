# NEXUS — School Management System

A multi-tenant school operating system: academics, attendance, behaviour,
finance, exam results and a branded parent portal. Built with TanStack Start
(React 19), Postgres, and Better Auth.

This is a **standalone** build with no dependency on any third-party sandbox
platform — it runs anywhere Node.js and Postgres run, and deploys cleanly to
Vercel.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR)
- Postgres via [`pg`](https://node-postgres.com/), with [PGLite](https://pglite.dev/) as a local-only fallback (no setup needed for `npm run dev`)
- [Better Auth](https://www.better-auth.com/) for sessions/OAuth/email-password
- Tailwind CSS v4, Radix UI
- [Nitro](https://nitro.build/) (`vercel` preset) for the production server

## Local development

```bash
npm install
npm run dev
```

Opens on `http://localhost:8080`. With no `.env.local`, the app runs with:
- an in-memory PGLite database (schema auto-applied from `migrations/*.sql`,
  wiped on restart)
- email/password sign-in enabled out of the box (no OAuth app needed)

To use a real database locally, copy `.env.example` to `.env.local` and set
`DATABASE_URL`.

## Deploying to Vercel

1. **Push this repo to GitHub** (or GitLab/Bitbucket) and import it in the
   [Vercel dashboard](https://vercel.com/new), or deploy from the CLI:
   ```bash
   npm i -g vercel
   vercel
   ```
   Vercel auto-detects the Nitro/Vite build; no extra config needed
   (`npm run build` already targets the `vercel` preset).

2. **Provision Postgres.** Any provider works — the quickest is
   [Neon](https://neon.tech) (has a native Vercel integration) or
   [Vercel Postgres](https://vercel.com/storage/postgres). Grab the
   connection string.

3. **Set environment variables** in Project Settings → Environment Variables
   (see `.env.example` for the full list):
   - `DATABASE_URL` — your Postgres connection string
   - `BETTER_AUTH_SECRET` — a long random string (`openssl rand -hex 32`)
   - `BETTER_AUTH_URL` — your deployed URL, e.g. `https://your-app.vercel.app`
   - `VITE_AUTH_ENABLED=true`
   - Optionally `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` +
     `VITE_GOOGLE_AUTH_ENABLED=true`, and/or the GitHub equivalents, if you
     want social sign-in as well as email/password.

4. **Deploy.** On every build, `npm run build` runs `vite build` and then
   `scripts/migrate.mjs`, which applies any new files in `migrations/*.sql`
   to `DATABASE_URL` (idempotent — tracked in a `_migrations` table, safe to
   redeploy).

5. Redeploy after changing env vars so the new build picks them up.

### Adding a social sign-in provider

1. Register an OAuth app with the provider (Google Cloud Console, GitHub
   OAuth Apps, …) using redirect URI
   `<BETTER_AUTH_URL>/api/auth/callback/<provider>`.
2. Set that provider's client id/secret env vars.
3. Set the matching `VITE_<PROVIDER>_AUTH_ENABLED=true` flag so the client
   renders the button (server secrets never reach the browser bundle, so this
   flag is how the UI knows the provider is wired up).
4. To support another provider entirely, add it to `socialProviders` in
   `src/lib/auth/server.ts` and to the list in `src/lib/auth/providers.ts`.

## Project structure

```
src/
  routes/            file-based routes (TanStack Router)
    app/              the signed-in workspace (academics, finance, results, …)
  lib/
    nexus/            the domain layer — all school data reads/writes
    auth/             Better Auth server + client wiring
    db.ts             Postgres/PGLite connection
  components/         UI (shadcn/Radix based)
migrations/           SQL schema, applied automatically on build/boot
scripts/
  migrate.mjs          deploy-time migrator (runs in `npm run build`)
  migration-plan.mjs   shared migration bookkeeping
```

## Scripts

- `npm run dev` — local dev server (port 8080)
- `npm run build` — production build + migrate database
- `npm run preview` — serve the production build locally
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` / `npm run format`
- `npm test` — unit tests

## Notes

- Without `DATABASE_URL`, the app **always** falls back to the in-memory
  PGLite database — do not deploy to production without setting it, or all
  data will be lost on every cold start.
- `VITE_AUTH_ENABLED=false` is for local prototyping only: it throws on boot
  if `DATABASE_URL` is also set, to stop you from accidentally shipping a
  deployment where every visitor shares one user's data.
