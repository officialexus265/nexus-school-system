/**
 * SMS for NEXUS — httpSMS first (per-school + platform).
 *
 * School messages (OTP, fee reminders to parents):
 *   school_sms_settings.api_key + from_number
 *
 * Platform messages (invoice SMS to schools):
 *   PLATFORM_HTTPSMS_API_KEY + PLATFORM_HTTPSMS_FROM
 *
 * httpSMS: POST https://api.httpsms.com/v1/messages/send  (header x-api-key)
 */

export type SmsResult = {
  ok: boolean;
  provider: string;
  providerReference?: string;
  error?: string;
};

export type SmsCredentials = {
  provider?: string;
  apiKey?: string | null;
  fromNumber?: string | null;
};

function env(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[key]?.trim() || undefined;
}

export function platformSmsCredentials(): SmsCredentials {
  return {
    provider: "httpsms",
    apiKey: env("PLATFORM_HTTPSMS_API_KEY") || env("HTTPSMS_API_KEY"),
    fromNumber: env("PLATFORM_HTTPSMS_FROM") || env("HTTPSMS_FROM"),
  };
}

export async function sendSmsWithCredentials(
  to: string,
  message: string,
  creds?: SmsCredentials | null,
): Promise<SmsResult> {
  const normalized = to.replace(/\s+/g, "");
  const provider = (
    creds?.provider ||
    env("SMS_PROVIDER") ||
    (creds?.apiKey ? "httpsms" : "demo")
  ).toLowerCase();

  try {
    if (provider === "httpsms") {
      const apiKey = creds?.apiKey || env("HTTPSMS_API_KEY");
      const from = creds?.fromNumber || env("HTTPSMS_FROM");
      if (!apiKey || !from) {
        console.log(
          `[NEXUS SMS:httpsms-missing-creds → demo] → ${normalized}: ${message}`,
        );
        return {
          ok: true,
          provider: "demo",
          providerReference: `demo-no-httpsms-creds-${Date.now()}`,
        };
      }
      return await sendHttpSms(normalized, message, apiKey, from);
    }
    if (provider === "africastalking") {
      return await sendAfricasTalking(normalized, message);
    }
    if (provider === "twilio") {
      return await sendTwilio(normalized, message);
    }
    console.log(`[NEXUS SMS:demo] → ${normalized}: ${message}`);
    return { ok: true, provider: "demo", providerReference: `demo-${Date.now()}` };
  } catch (e) {
    const err = e instanceof Error ? e.message : "SMS send failed";
    console.error(`[NEXUS SMS] ${provider} error:`, err);
    return { ok: false, provider, error: err };
  }
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  return sendSmsWithCredentials(to, message, platformSmsCredentials());
}

async function sendHttpSms(
  to: string,
  message: string,
  apiKey: string,
  from: string,
): Promise<SmsResult> {
  const phoneTo = to.startsWith("+") ? to : `+${to}`;
  const phoneFrom = from.startsWith("+") ? from : `+${from}`;

  const res = await fetch("https://api.httpsms.com/v1/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      content: message,
      from: phoneFrom,
      to: phoneTo,
      encrypted: false,
    }),
  });

  const text = await res.text();
  let json: { data?: { id?: string }; message?: string } = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(json.message || `httpSMS HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return {
    ok: true,
    provider: "httpsms",
    providerReference: json.data?.id || `httpsms-${Date.now()}`,
  };
}

async function sendAfricasTalking(to: string, message: string): Promise<SmsResult> {
  const username = env("AT_USERNAME");
  const apiKey = env("AT_API_KEY");
  const from = env("AT_FROM") || "NEXUS";
  if (!username || !apiKey) throw new Error("AT credentials required");
  const phone = to.startsWith("+") ? to : `+${to}`;
  const body = new URLSearchParams({ username, to: phone, message, from });
  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey,
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Africa's Talking HTTP ${res.status}`);
  return { ok: true, provider: "africastalking", providerReference: `at-${Date.now()}` };
}

async function sendTwilio(to: string, message: string): Promise<SmsResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM");
  if (!sid || !token || !from) throw new Error("Twilio credentials required");
  const phone = to.startsWith("+") ? to : `+${to}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({ To: phone, From: from, Body: message });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    },
  );
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Twilio HTTP ${res.status}`);
  return { ok: true, provider: "twilio", providerReference: json.sid };
}
