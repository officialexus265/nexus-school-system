/**
 * Transactional email for NEXUS.
 *
 * Order:
 *  1. SMTP (if SMTP_HOST + SMTP_USER + SMTP_PASS are set)
 *  2. Resend (if RESEND_API_KEY is set)
 *  3. Fail — no silent "demo" success
 *
 * Optional EMAIL_PROVIDER=smtp|resend forces a single path.
 */

export type EmailResult = { ok: boolean; provider: string; id?: string; error?: string };

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function smtpReady(): boolean {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

function resendReady(): boolean {
  return Boolean(env("RESEND_API_KEY"));
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const forced = (env("EMAIL_PROVIDER") || "").toLowerCase();

  try {
    if (forced === "resend") {
      if (!resendReady()) throw new Error("RESEND_API_KEY required");
      return await sendResend(opts);
    }
    if (forced === "smtp") {
      if (!smtpReady()) throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASS required");
      return await sendSmtp(opts);
    }

    // Default: SMTP first, Resend fallback
    if (smtpReady()) {
      try {
        return await sendSmtp(opts);
      } catch (smtpErr) {
        const msg = smtpErr instanceof Error ? smtpErr.message : "SMTP failed";
        console.error("[NEXUS EMAIL] SMTP failed, trying Resend:", msg);
        if (resendReady()) return await sendResend(opts);
        return { ok: false, provider: "smtp", error: msg };
      }
    }
    if (resendReady()) return await sendResend(opts);

    return {
      ok: false,
      provider: "none",
      error:
        "No email provider configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS and/or RESEND_API_KEY.",
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Email failed";
    console.error("[NEXUS EMAIL]", error);
    return { ok: false, provider: forced || "none", error };
  }
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const apiKey = env("RESEND_API_KEY")!;
  const from = env("EMAIL_FROM") || "NEXUS <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Resend HTTP ${res.status}`);
  return { ok: true, provider: "resend", id: json.id };
}

async function sendSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const host = env("SMTP_HOST")!;
  const port = Number(env("SMTP_PORT") || "587");
  const user = env("SMTP_USER")!;
  const pass = env("SMTP_PASS")!;
  const from = env("EMAIL_FROM") || user;
  const secure =
    env("SMTP_SECURE") === "true" || env("SMTP_SECURE") === "1" || port === 465;

  let nodemailer: typeof import("nodemailer");
  try {
    nodemailer = await import("nodemailer");
  } catch {
    throw new Error("nodemailer is not installed. Run: npm i nodemailer");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text || opts.html.replace(/<[^>]+>/g, " ").slice(0, 2000),
  });

  return {
    ok: true,
    provider: "smtp",
    id: typeof info.messageId === "string" ? info.messageId : `smtp-${Date.now()}`,
  };
}

export function schoolInviteEmail(opts: {
  ownerName: string;
  schoolName: string;
  inviteLink: string;
  platformName?: string;
}): { subject: string; html: string; text: string } {
  const platform = opts.platformName || "NEXUS";
  const subject = `Your ${platform} school account is ready — ${opts.schoolName}`;
  const text = `Hi ${opts.ownerName},

${platform} has opened a school account for ${opts.schoolName}.

Set your password and start configuring your school:
${opts.inviteLink}

This link expires in 7 days. If the button does not work, copy and paste the URL into your browser.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px">Welcome to ${platform}</h1>
      <p>Hi ${opts.ownerName},</p>
      <p>A school account for <strong>${opts.schoolName}</strong> is ready.</p>
      <p><a href="${opts.inviteLink}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Set your password</a></p>
      <p style="font-size:13px;color:#666">Or copy this link:<br/><code>${opts.inviteLink}</code></p>
      <p style="font-size:12px;color:#999">Link expires in 7 days.</p>
    </div>`;
  return { subject, html, text };
}
