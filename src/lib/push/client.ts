/**
 * Client helpers for push notification permission.
 *
 * Firebase Messaging is OPTIONAL. We intentionally do not import `firebase/*`
 * here so production builds succeed without the firebase package.
 * When you are ready for FCM: `npm i firebase` and extend this file (or a
 * separate fcm.ts that is only loaded from Settings when configured).
 */

export function firebaseWebConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID &&
      import.meta.env.VITE_FIREBASE_VAPID_KEY,
  );
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/**
 * Web push token. Returns null until Firebase is installed and wired.
 * Browser notification permission still works for local UX messaging.
 */
export async function getFcmToken(): Promise<string | null> {
  if (!firebaseWebConfigured()) return null;
  const perm = await requestNotificationPermission();
  if (perm !== "granted") return null;

  // Avoid static/dynamic import of `firebase/*` (breaks Vite/Rolldown when
  // the package is not installed). Enable FCM by adding firebase and a
  // dedicated loader module later.
  console.info(
    "[nexus] FCM env is set but the firebase SDK is not bundled. " +
      "SMS + in-app notifications remain available. Run: npm i firebase",
  );
  return null;
}
