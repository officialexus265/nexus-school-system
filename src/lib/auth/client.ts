import { createAuthClient } from "better-auth/react";
import { AUTH_PROVIDERS } from "./providers";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's own Better Auth at same-origin `/api/auth/*` via a
 * normal session cookie — no iframe/popup/bearer-token plumbing needed once
 * this runs as a normal deployed site.
 */
export const authClient = createAuthClient();

/**
 * True when sign-in UI should be shown — i.e. whenever `VITE_AUTH_ENABLED` is
 * not `"false"`. When disabled, the app uses a single shared dev user (see
 * `use-current-user.ts`) — fine for local prototyping, never for a deployment
 * with a real database.
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for. */
export { AUTH_PROVIDERS };

/**
 * Start sign-in with one upstream provider (`id` from `AUTH_PROVIDERS`) via a
 * normal full-page OAuth redirect.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";
  const { data, error } = await authClient.signIn.social({
    provider: providerId as never,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/** Sign out of this app's session, then redirect. */
export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    const { clearOfflineAuthCache } = await import("./use-current-user");
    clearOfflineAuthCache();
  } catch {
    /* */
  }
  try {
    localStorage.removeItem("nexus-auth-user-v1");
  } catch {
    /* */
  }
  const { error } = await authClient.signOut();
  if (error && typeof navigator !== "undefined" && navigator.onLine) {
    throw new Error(error.message ?? "Sign-out failed");
  }
  window.location.href = redirectTo;
}
