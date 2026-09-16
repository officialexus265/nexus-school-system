/**
 * PayChangu integration (Malawi) — Standard Checkout.
 * Supports mobile money (Airtel / TNM), bank transfer, and card via hosted checkout.
 *
 * Docs: https://developer.paychangu.com/docs/standard-checkout
 * Verify: GET https://api.paychangu.com/verify-payment/{tx_ref}
 * Webhook: HMAC-SHA256 of raw body with webhook secret → Signature header
 */

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function paychanguConfigured(): boolean {
  return Boolean(env("PAYCHANGU_SECRET_KEY"));
}

export function paychanguSecretKey(): string {
  const k = env("PAYCHANGU_SECRET_KEY");
  if (!k) throw new Error("PAYCHANGU_SECRET_KEY is not set");
  return k;
}

export function paychanguWebhookSecret(): string {
  return env("PAYCHANGU_WEBHOOK_SECRET") || paychanguSecretKey();
}

export type InitiateCheckoutInput = {
  amount: number;
  currency?: string;
  txRef: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  callbackUrl: string;
  returnUrl: string;
  title: string;
  description?: string;
  meta?: Record<string, string>;
};

export type InitiateCheckoutResult = {
  ok: boolean;
  checkoutUrl?: string;
  txRef: string;
  status?: string;
  error?: string;
  raw?: unknown;
};

export async function initiateCheckout(
  input: InitiateCheckoutInput,
): Promise<InitiateCheckoutResult> {
  if (!paychanguConfigured()) {
    // Demo mode: return a mock checkout URL
    return {
      ok: true,
      checkoutUrl: `${input.returnUrl}?tx_ref=${encodeURIComponent(input.txRef)}&demo=1`,
      txRef: input.txRef,
      status: "demo",
    };
  }

  const secret = paychanguSecretKey();
  const body = {
    amount: String(Math.round(input.amount)),
    currency: input.currency || "MWK",
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    callback_url: input.callbackUrl,
    return_url: input.returnUrl,
    tx_ref: input.txRef,
    customization: {
      title: input.title,
      description: input.description || input.title,
    },
    meta: input.meta || {},
  };

  const res = await fetch("https://api.paychangu.com/payment", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { checkout_url?: string; data?: { tx_ref?: string; status?: string } };
  };

  if (!res.ok || json.status !== "success") {
    return {
      ok: false,
      txRef: input.txRef,
      error: json.message || `PayChangu HTTP ${res.status}`,
      raw: json,
    };
  }

  return {
    ok: true,
    checkoutUrl: json.data?.checkout_url,
    txRef: json.data?.data?.tx_ref || input.txRef,
    status: json.data?.data?.status || "pending",
    raw: json,
  };
}

export async function verifyPayment(txRef: string): Promise<{
  ok: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  reference?: string;
  raw?: unknown;
  error?: string;
}> {
  if (!paychanguConfigured()) {
    return { ok: true, status: "success", amount: 0, currency: "MWK", channel: "demo" };
  }

  const res = await fetch(
    `https://api.paychangu.com/verify-payment/${encodeURIComponent(txRef)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${paychanguSecretKey()}`,
      },
    },
  );
  const json = (await res.json()) as {
    status?: string;
    message?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      authorization?: { channel?: string };
    };
  };

  if (!res.ok) {
    return { ok: false, error: json.message || `HTTP ${res.status}`, raw: json };
  }

  const paid =
    json.data?.status === "success" ||
    json.data?.status === "successful" ||
    json.status === "success";

  return {
    ok: paid,
    status: json.data?.status,
    amount: json.data?.amount,
    currency: json.data?.currency,
    channel: json.data?.authorization?.channel,
    reference: json.data?.reference,
    raw: json,
  };
}

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const secret = paychanguWebhookSecret();
  const crypto = await import("node:crypto");
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signatureHeader),
    );
  } catch {
    return computed === signatureHeader;
  }
}
