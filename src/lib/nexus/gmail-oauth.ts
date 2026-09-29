/**
 * School Gmail OAuth for outbound mail (gmail.send scope).
 * Uses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as login when set.
 */

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function gmailOAuthConfigured(): boolean {
  return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

export function gmailOAuthRedirectUri(): string {
  const base =
    env("BETTER_AUTH_URL") ||
    env("VITE_APP_URL") ||
    env("APP_URL") ||
    "http://localhost:8080";
  return `${base.replace(/\/$/, "")}/api/gmail/callback`;
}

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function buildGmailAuthUrl(state: string): string {
  const clientId = env("GOOGLE_CLIENT_ID");
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: gmailOAuthRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  email?: string;
}> {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: gmailOAuthRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Token exchange failed");
  }

  let email: string | undefined;
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    const uj = (await u.json()) as { email?: string };
    email = uj.email;
  } catch {
    /* optional */
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in || 3600,
    email,
  };
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Refresh failed");
  }
  return { access_token: json.access_token, expires_in: json.expires_in || 3600 };
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Send a simple HTML email via Gmail API. */
export async function sendViaGmailApi(opts: {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<{ id?: string }> {
  const boundary = `nexus_${Date.now()}`;
  const replyLine = opts.replyTo ? `Reply-To: ${opts.replyTo}\r\n` : "";
  const mime =
    `From: ${opts.from}\r\n` +
    `To: ${opts.to}\r\n` +
    replyLine +
    `Subject: ${opts.subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/alternative; boundary="${boundary}"\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    `${opts.text || opts.html.replace(/<[^>]+>/g, " ")}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
    `${opts.html}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64Url(mime) }),
    },
  );
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Gmail API HTTP ${res.status}`);
  }
  return { id: json.id };
}
