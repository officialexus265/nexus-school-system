/**
 * The upstream identity providers this app offers for sign-in.
 *
 * Source of truth for the client's sign-in buttons. Each entry needs a
 * matching OAuth app registered directly with the provider (Google Cloud
 * Console, GitHub OAuth Apps, etc.) — set its server-side client id/secret
 * (see `server.ts`) AND the matching `VITE_*_AUTH_ENABLED="true"` flag below
 * so the client knows to render the button (server secrets never reach the
 * browser bundle, so this is how the client learns a provider is wired up).
 *
 * To add an upstream: add one entry here (guarded by its own `VITE_*` flag),
 * plus the matching block under `socialProviders` in `server.ts`. `id` must
 * be a Better Auth social provider id (e.g. "google", "github", "twitter").
 */
export type AuthProvider = {
  /** Better Auth's id for this upstream; also the OAuth callback path segment. */
  id: string;
  /** Human label for the sign-in button. */
  label: string;
};

const providers: AuthProvider[] = [];
if (import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true") {
  providers.push({ id: "google", label: "Google" });
}
if (import.meta.env.VITE_GITHUB_AUTH_ENABLED === "true") {
  providers.push({ id: "github", label: "GitHub" });
}

export const AUTH_PROVIDERS: readonly AuthProvider[] = providers;
