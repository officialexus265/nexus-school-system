import { useEffect, useState } from "react";
import { authClient, authEnabled } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
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

function readCachedUser(): AppUser | null {
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

function writeCachedUser(user: AppUser | null) {
  try {
    if (!user || user.isDevFallback) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch {
    /* private mode / quota */
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Current user + loading state.
 * When offline, keeps the last successful session from localStorage so a refresh
 * does not force a “logged out” state (login still requires network).
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };

  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const session = authClient.useSession();
  const data = session.data;
  const isPending = session.isPending;
  const error = (session as { error?: unknown }).error;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [cached, setCached] = useState<AppUser | null>(() =>
    typeof window !== "undefined" ? readCachedUser() : null,
  );

  const sessionUser = data?.user
    ? {
        id: data.user.id,
        displayName: data.user.name ?? null,
        primaryEmail: data.user.email ?? null,
        profileImageUrl: data.user.image ?? null,
        isDevFallback: false as const,
      }
    : null;

  // Persist successful sessions for offline hard-refresh
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (sessionUser) {
      writeCachedUser(sessionUser);
      setCached(sessionUser);
    }
  }, [sessionUser?.id, sessionUser?.primaryEmail, sessionUser?.displayName]);

  // Signed out online → clear cache
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isPending && !sessionUser && !isOffline()) {
      writeCachedUser(null);
      setCached(null);
    }
  }, [isPending, sessionUser]);

  if (sessionUser) {
    return { user: sessionUser, isPending: false };
  }

  // Offline (or session fetch failed while offline): use cache
  if (isOffline() || (error && isOffline())) {
    const offlineUser = cached || readCachedUser();
    if (offlineUser) {
      return { user: offlineUser, isPending: false };
    }
  }

  // Still loading session online
  if (isPending) {
    // Brief offline flash on reload: prefer cache so we don't redirect to login
    if (isOffline()) {
      const offlineUser = cached || readCachedUser();
      if (offlineUser) return { user: offlineUser, isPending: false };
    }
    return { user: null, isPending: true };
  }

  return { user: null, isPending: false };
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}

/** Clear offline auth cache (call after explicit sign-out). */
export function clearOfflineAuthCache() {
  writeCachedUser(null);
}
