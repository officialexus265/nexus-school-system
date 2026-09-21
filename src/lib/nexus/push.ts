/**
 * Push notifications via FCM HTTP legacy API (server key)
 * or no-op demo when FCM_SERVER_KEY is unset.
 *
 * Client obtains a token with Firebase JS SDK when VITE_FIREBASE_* is set,
 * then registers it via registerDeviceToken.
 */

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function fcmConfigured(): boolean {
  return Boolean(env("FCM_SERVER_KEY") || env("FIREBASE_SERVER_KEY"));
}

export async function sendFcmToToken(
  token: string,
  notification: { title: string; body: string; url?: string },
): Promise<{ ok: boolean; error?: string }> {
  const key = env("FCM_SERVER_KEY") || env("FIREBASE_SERVER_KEY");
  if (!key) {
    console.log(
      `[NEXUS PUSH:demo] → ${token.slice(0, 12)}… ${notification.title}: ${notification.body}`,
    );
    return { ok: true };
  }

  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      notification: {
        title: notification.title,
        body: notification.body,
        click_action: notification.url || "/app",
      },
      data: {
        title: notification.title,
        body: notification.body,
        url: notification.url || "/app",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text.slice(0, 300) };
  }
  return { ok: true };
}

export async function sendFcmToTokens(
  tokens: string[],
  notification: { title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const token of tokens) {
    const r = await sendFcmToToken(token, notification);
    if (r.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
