/**
 * SMS sending for NEXUS.
 * Providers: httpsms | africastalking | twilio
 * Missing credentials → hard failure (no silent demo success).
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
  return process.env[key]?.trim() || undefined;
}

export function platformSmsCredentials(): SmsCredentials {
  return {
    provider: env("SMS_PROVIDER") || "httpsms",
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
    "httpsms"
  ).toLowerCase();

  try {
    if (provider === "httpsms") {
      const apiKey = creds?.apiKey || env("HTTPSMS_API_KEY") || env("PLATFORM_HTTPSMS_API_KEY");
      const from = creds?.fromNumber || env("HTTPSMS_FROM") || env("PLATFORM_HTTPSMS_FROM");
      if (!apiKey || !from) {
        return {
          ok: false,
          provider: "httpsms",
          error:
            "httpSMS credentials missing. Set school SMS settings or PLATFORM_HTTPSMS_API_KEY / PLATFORM_HTTPSMS_FROM.",
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
    return {
      ok: false,
      provider,
      error: `Unknown SMS provider "${provider}". Use httpsms, africastalking, or twilio.`,
    };
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
  if (!username || !apiKey) {
    return { ok: false, provider: "africastalking", error: "AT_USERNAME and AT_API_KEY required" };
  }
  const phone = to.startsWith("+") ? to : `+${to}`;
  const body = new URLSearchParams({
    username,
    to: phone,
    message,
    from,
  });
  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Africa's Talking HTTP ${res.status}: ${text.slice(0, 200)}`);
  return { ok: true, provider: "africastalking", providerReference: `at-${Date.now()}` };
}

async function sendTwilio(to: string, message: string): Promise<SmsResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM");
  if (!sid || !token || !from) {
    return {
      ok: false,
      provider: "twilio",
      error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM required",
    };
  }
  const phone = to.startsWith("+") ? to : `+${to}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({ To: phone, From: from, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Twilio HTTP ${res.status}`);
  return { ok: true, provider: "twilio", providerReference: json.sid };
}
