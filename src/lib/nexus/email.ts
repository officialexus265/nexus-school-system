/**
 * Transactional email for NEXUS.
 *
 * Order:
 *  1. SMTP (if SMTP_HOST + SMTP_USER + SMTP_PASS are set)
 *  2. Resend (if RESEND_API_KEY is set)
 *  3. Fail — no silent "demo" success
 *
 * Optional EMAIL_PROVIDER=smtp|resend forces a single path.
 *
 * School-branded mail:
 *  - fromName + replyTo: show school name and reply to school contact
 *  - fromAddress: only works if that address is authorised on SMTP/Resend
 *    (verified domain). Otherwise the platform envelope address is kept
 *    and replyTo carries the school email.
 */

export type EmailResult = { ok: boolean; provider: string; id?: string; error?: string };

export type SendEmailOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Display name, e.g. school name */
  fromName?: string;
  /** Reply-To (school contact) — always preferred for school mail */
  replyTo?: string;
  /**
   * Optional true From address when the provider allows it
   * (Resend verified domain / SMTP send-as). Ignored if not safe.
   */
  fromAddress?: string;
};

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function smtpReady(): boolean {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

function resendReady(): boolean {
  return Boolean(env("RESEND_API_KEY"));
}

/** Parse "Name <email@x.com>" or bare email from EMAIL_FROM */
function parseFrom(raw: string): { name: string; email: string } {
  const m = /^(.*?)\s*<([^>]+)>$/.exec(raw.trim());
  if (m) return { name: (m[1] || "").trim().replace(/^"|"$/g, ""), email: m[2]!.trim() };
  return { name: "NEXUS", email: raw.trim() };
}

function buildFromHeader(opts: SendEmailOpts): string {
  const base = env("EMAIL_FROM") || env("SMTP_USER") || "NEXUS <onboarding@resend.dev>";
  const parsed = parseFrom(base);
  const envelopeEmail =
    opts.fromAddress && opts.fromAddress.includes("@")
      ? opts.fromAddress.trim()
      : parsed.email;
  const name = (opts.fromName || parsed.name || "NEXUS").replace(/[<>\n\r]/g, "").trim();
  return `${name} <${envelopeEmail}>`;
}

export async function sendEmail(opts: SendEmailOpts): Promise<EmailResult> {
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

async function sendResend(opts: SendEmailOpts): Promise<EmailResult> {
  const apiKey = env("RESEND_API_KEY")!;
  const from = buildFromHeader(opts);
  const body: Record<string, unknown> = {
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };
  if (opts.replyTo?.includes("@")) body.reply_to = opts.replyTo.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Resend HTTP ${res.status}`);
  return { ok: true, provider: "resend", id: json.id };
}

async function sendSmtp(opts: SendEmailOpts): Promise<EmailResult> {
  const host = env("SMTP_HOST")!;
  const port = Number(env("SMTP_PORT") || "587");
  const user = env("SMTP_USER")!;
  const pass = env("SMTP_PASS")!;
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

  // Gmail/SMTP often rejects arbitrary From. Prefer display name + Reply-To.
  // Only use fromAddress if it matches SMTP user domain or is explicitly set.
  const smtpUserEmail = user.includes("@") ? user : parseFrom(env("EMAIL_FROM") || user).email;
  let from = buildFromHeader({
    ...opts,
    // Only swap envelope if same account or platform explicitly allows
    fromAddress:
      opts.fromAddress &&
      opts.fromAddress.toLowerCase() === smtpUserEmail.toLowerCase()
        ? opts.fromAddress
        : undefined,
  });

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text || opts.html.replace(/<[^>]+>/g, " ").slice(0, 2000),
    replyTo: opts.replyTo?.includes("@") ? opts.replyTo.trim() : undefined,
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


export type SchoolSmtpConfig = {
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  mode?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpSecure?: boolean | null;
  gmailRefreshToken?: string | null;
  gmailAccessToken?: string | null;
  gmailTokenExpiresAt?: string | null;
  gmailAddress?: string | null;
  schoolId?: string | null;
};

/** Send using school SMTP when mode=smtp and credentials exist; else platform. */
export async function sendEmailForSchool(
  school: SchoolSmtpConfig | null | undefined,
  opts: SendEmailOpts,
): Promise<EmailResult> {
  const replyTo = opts.replyTo || school?.replyTo || school?.fromEmail || undefined;
  const fromName = opts.fromName || school?.fromName || undefined;

  if (school && (school.mode || "").toLowerCase() === "gmail_oauth" && school.gmailRefreshToken) {
    try {
      const { refreshGmailAccessToken, sendViaGmailApi } = await import("./gmail-oauth");
      let access = school.gmailAccessToken || "";
      const exp = school.gmailTokenExpiresAt
        ? new Date(school.gmailTokenExpiresAt).getTime()
        : 0;
      if (!access || exp < Date.now() + 60_000) {
        const refreshed = await refreshGmailAccessToken(school.gmailRefreshToken);
        access = refreshed.access_token;
      }
      const addr = school.gmailAddress || school.fromEmail || "me";
      const display = (fromName || school.fromName || "School").replace(/[<>\n\r]/g, "");
      const fromHeader = `${display} <${addr}>`;
      const sent = await sendViaGmailApi({
        accessToken: access,
        from: fromHeader,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo: replyTo,
      });
      return { ok: true, provider: "gmail-oauth", id: sent.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gmail OAuth send failed";
      console.error("[NEXUS EMAIL] gmail oauth failed, platform fallback:", msg);
    }
  }

  if (
    school &&
    (school.mode || "").toLowerCase() === "smtp" &&
    school.smtpHost &&
    school.smtpUser &&
    school.smtpPass
  ) {
    try {
      return await sendSmtpDirect({
        host: school.smtpHost,
        port: Number(school.smtpPort || 587),
        user: school.smtpUser,
        pass: school.smtpPass,
        secure: Boolean(school.smtpSecure),
        from:
          school.fromEmail && school.fromEmail.includes("@")
            ? `${(fromName || school.fromName || "School").replace(/[<>\n\r]/g, "")} <${school.fromEmail}>`
            : `${(fromName || "School").replace(/[<>\n\r]/g, "")} <${school.smtpUser}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "School SMTP failed";
      console.error("[NEXUS EMAIL] school SMTP failed, platform fallback:", msg);
      // fall through to platform
    }
  }

  return sendEmail({
    ...opts,
    fromName,
    replyTo,
    fromAddress: school?.fromEmail || opts.fromAddress,
  });
}

async function sendSmtpDirect(cfg: {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<EmailResult> {
  let nodemailer: typeof import("nodemailer");
  try {
    nodemailer = await import("nodemailer");
  } catch {
    throw new Error("nodemailer is not installed");
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure || cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const info = await transporter.sendMail({
    from: cfg.from,
    to: cfg.to,
    subject: cfg.subject,
    html: cfg.html,
    text: cfg.text || cfg.html.replace(/<[^>]+>/g, " ").slice(0, 2000),
    replyTo: cfg.replyTo,
  });
  return {
    ok: true,
    provider: "school-smtp",
    id: typeof info.messageId === "string" ? info.messageId : `school-smtp-${Date.now()}`,
  };
}
