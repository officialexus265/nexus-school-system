import { useEffect, useState } from "react";
import { authClient, authEnabled } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

export type CurrentUserState = {
  user: AppUser | null;
  isPending: boolean;
};

const CACHE_KEY = "nexus-auth-user-v1";

export function readCachedUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    if (!parsed?.id) return null;
    return { ...parsed, isDevFallback: false };
  } catch {
    return null;
  }
}

export function writeCachedUser(user: AppUser | null) {
  try {
    if (!user || user.isDevFallback) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        id: user.id,
        displayName: user.displayName,
        primaryEmail: user.primaryEmail,
        profileImageUrl: user.profileImageUrl,
        isDevFallback: false,
      }),
    );
  } catch {
    /* private mode */
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Session + offline cache.
 * Cache is only cleared on explicit sign-out (or confirmed online session=null).
 * Network blips must NOT wipe the cache or users get bounced to /login offline.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const session = authClient.useSession();
  const data = session.data;
  const isPending = Boolean(session.isPending);
  const isError = Boolean((session as { isError?: boolean }).isError);
  const error = (session as { error?: unknown }).error;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [cached, setCached] = useState<AppUser | null>(() =>
    typeof window !== "undefined" ? readCachedUser() : null,
  );

  const sessionUser: AppUser | null = data?.user
    ? {
        id: data.user.id,
        displayName: data.user.name ?? null,
        primaryEmail: data.user.email ?? null,
        profileImageUrl: data.user.image ?? null,
        isDevFallback: false,
      }
    : null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (sessionUser) {
      writeCachedUser(sessionUser);
      setCached(sessionUser);
    }
  }, [sessionUser?.id, sessionUser?.primaryEmail, sessionUser?.displayName]);

  // Confirmed signed-out while online (successful empty session, no error)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isPending) return;
    if (sessionUser) return;
    if (isOffline()) return;
    if (isError || error) return; // keep cache on network/API failure
    // Only clear when we got a clean "no session" while online
    // (Better Auth returned successfully with no user)
    if (data === null || data === undefined) {
      // data undefined while error-prone; only clear if status is success-like
      const status = (session as { status?: string }).status;
      if (status === "success" || data === null) {
        // soft: do not clear on undefined
        if (data === null) {
          writeCachedUser(null);
          setCached(null);
        }
      }
    }
  }, [isPending, sessionUser, data, isError, error]);

  if (sessionUser) {
    return { user: sessionUser, isPending: false };
  }

  const offlineUser = cached || (typeof window !== "undefined" ? readCachedUser() : null);

  // Prefer cache when offline, pending, or session request failed
  if (offlineUser && (isOffline() || isPending || isError || error)) {
    return { user: offlineUser, isPending: false };
  }

  // Still resolving online with no cache yet
  if (isPending) {
    return { user: offlineUser, isPending: !offlineUser };
  }

  // Online, session resolved empty, no usable cache
  if (!isOffline() && !isError && !error && data === null) {
    return { user: null, isPending: false };
  }

  // Ambiguous network: keep cache if any
  if (offlineUser) {
    return { user: offlineUser, isPending: false };
  }

  return { user: null, isPending: false };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}

export function clearOfflineAuthCache() {
  writeCachedUser(null);
}
