/**
 * Local email/password sign-in (this app's own Better Auth DB).
 *
 * On by default so the app has a working sign-in method with zero external
 * setup (no OAuth app to register). Build sign-up / sign-in forms with
 * `authClient.signUp.email` / `authClient.signIn.email` from
 * `@/lib/auth/client`. Set to `false` to require only the social providers
 * configured in `server.ts`.
 */
export const emailAndPasswordEnabled = true;
