/**
 * Transactional email for NEXUS (invite, password, notices).
 *
 * EMAIL_PROVIDER=demo (default) → log to console
 * EMAIL_PROVIDER=resend → Resend API (set RESEND_API_KEY, EMAIL_FROM)
 */

export type EmailResult = { ok: boolean; provider: string; id?: string; error?: string };

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const provider = (env("EMAIL_PROVIDER") || "demo").toLowerCase();
  try {
    if (provider === "resend") {
      return await sendResend(opts);
    }
    console.log(`[NEXUS EMAIL:demo] to=${opts.to} subject=${opts.subject}`);
    console.log(opts.text || opts.html.replace(/<[^>]+>/g, " ").slice(0, 500));
    return { ok: true, provider: "demo", id: `demo-${Date.now()}` };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Email failed";
    console.error("[NEXUS EMAIL]", error);
    return { ok: false, provider, error };
  }
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM") || "NEXUS <onboarding@resend.dev>";
  if (!apiKey) throw new Error("RESEND_API_KEY required");

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

This link expires in 7 days.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px">${platform}</h1>
      <p>Hi ${escapeHtml(opts.ownerName)},</p>
      <p>A school account has been opened for <strong>${escapeHtml(opts.schoolName)}</strong>.</p>
      <p><a href="${opts.inviteLink}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Set your password</a></p>
      <p style="color:#666;font-size:13px">Or open: ${escapeHtml(opts.inviteLink)}</p>
      <p style="color:#666;font-size:13px">This link expires in 7 days.</p>
    </div>`;
  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
