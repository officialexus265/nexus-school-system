/**
 * Self-hosted Better Auth for this app (server-only).
 *
 * Standalone setup: this app owns its own Better Auth instance at
 * `/api/auth/*`, backed directly by whichever OAuth apps you register
 * (Google, GitHub, …) plus optional email/password. There is no external
 * broker — every credential below comes from your own env vars.
 *
 * Modes:
 *   - `DATABASE_URL` set -> sessions/users persist in real Postgres (e.g.
 *     Neon, Supabase, Vercel Postgres).
 *   - `DATABASE_URL` unset -> falls back to an embedded PGLite database for
 *     local development only. Do NOT rely on this in production — set
 *     `DATABASE_URL` before deploying.
 *   - `VITE_AUTH_ENABLED=false` -> auth is off entirely; `requireUserId`
 *     resolves a single shared dev user (see `verify.server.ts`). This is
 *     fine for local prototyping but must never be set on a deployment that
 *     has a real database, since every visitor would share one user's data.
 *
 * NEVER import this from client code — it pulls in `pg` + server-only Better
 * Auth internals. The client uses `@/lib/auth/client`; components read the
 * user via `@/lib/auth/use-current-user`; server functions get a verified id
 * via `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { pgliteDialect } from "./pglite-dialect";
import { env } from "../env.server";

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

// Explicit off-switch. Set VITE_AUTH_ENABLED="false" to force auth off
// everywhere and use the shared dev user instead (see verify.server.ts).
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

// One social provider entry per upstream that has credentials configured.
// Register the OAuth app yourself with each provider and set these env vars;
// a provider with no client id/secret is simply left out of `socialProviders`
// (and its sign-in button won't be offered — see `client.ts` / `providers.ts`).
const googleClientId = env("GOOGLE_CLIENT_ID");
const googleClientSecret = env("GOOGLE_CLIENT_SECRET");
const githubClientId = env("GITHUB_CLIENT_ID");
const githubClientSecret = env("GITHUB_CLIENT_SECRET");

const socialProviders = {
  ...(googleClientId && googleClientSecret
    ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
    : {}),
  ...(githubClientId && githubClientSecret
    ? { github: { clientId: githubClientId, clientSecret: githubClientSecret } }
    : {}),
};

/** True when at least one sign-in method is actually usable. */
export const authConfigured =
  !authDisabled &&
  (emailAndPasswordEnabled || Object.keys(socialProviders).length > 0);

// This app's own public origin. REQUIRED in production (Vercel etc.) — set it
// to your deployed URL, e.g. https://your-app.vercel.app. Local dev falls
// back to localhost.
const explicitBaseURL = env("BETTER_AUTH_URL");
const baseURL = explicitBaseURL ?? "http://localhost:8080";

if (!explicitBaseURL && env("VERCEL")) {
  console.error(
    "[auth] BETTER_AUTH_URL is not set. Set it to this deployment's public " +
      "URL (e.g. https://your-app.vercel.app) or OAuth callbacks will fail.",
  );
}

// Origins allowed on credentialed POSTs (sign-up/sign-in, etc.). Add any
// extra domain (custom domain, preview deployments, …) you serve this app
// from.
const trustedOrigins: string[] = [
  baseURL,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const databaseUrl = env("DATABASE_URL");

// Real Postgres when DATABASE_URL is set, else the app's embedded PGLite
// (local dev only) via a Kysely dialect — so Better Auth persists to the SAME
// DB as app data. Both use the Better Auth schema from
// `migrations/auth/0001_auth.sql` (already copied into `migrations/`).
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

export const auth = betterAuth({
  baseURL,
  // REQUIRED in production — a long random string, stable across restarts and
  // deploys (e.g. `openssl rand -hex 32`). Without it every deploy invalidates
  // every session. Falls back to an insecure fixed value for local dev only.
  secret: env("BETTER_AUTH_SECRET") ?? "dev-only-insecure-secret-change-me",
  database,
  trustedOrigins,

  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // Local email/password — toggle in `./email-password`.
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),

  // Only included when at least one provider has credentials configured.
  ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),

  advanced: {
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
  },

  plugins: [
    // Bridges Better Auth's Set-Cookie into TanStack Start responses.
    tanstackStartCookies(),
  ],
});
