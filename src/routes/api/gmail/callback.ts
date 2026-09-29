import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { exchangeGmailCode } from "@/lib/nexus/gmail-oauth";

/**
 * Google redirects here after school owner consents to gmail.send.
 * state = base64(JSON { schoolId })
 */
export const Route = createFileRoute("/api/gmail/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const stateRaw = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const appBase =
          process.env.BETTER_AUTH_URL ||
          process.env.VITE_APP_URL ||
          `${url.protocol}//${url.host}`;

        const fail = (msg: string) =>
          Response.redirect(
            `${appBase.replace(/\/$/, "")}/app/settings?gmail=error&msg=${encodeURIComponent(msg)}`,
            302,
          );

        if (err) return fail(err);
        if (!code || !stateRaw) return fail("Missing code or state");

        let schoolId: string;
        try {
          const json = JSON.parse(
            Buffer.from(stateRaw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
              "utf8",
            ),
          ) as { schoolId?: string };
          if (!json.schoolId) return fail("Invalid state");
          schoolId = json.schoolId;
        } catch {
          return fail("Invalid state");
        }

        try {
          const tokens = await exchangeGmailCode(code);
          const sql = await getSql();
          const expires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const existing = await sql<{ gmail_refresh_token: string | null }>`
            select gmail_refresh_token from school_email_settings where school_id = ${schoolId} limit 1
          `.catch(() => [] as { gmail_refresh_token: string | null }[]);
          const refresh =
            tokens.refresh_token || existing[0]?.gmail_refresh_token || null;
          if (!refresh) {
            return fail(
              "No refresh token returned. In Google Account → Security → Third-party access, remove NEXUS and connect again.",
            );
          }

          await sql.query(
            `insert into school_email_settings (
               school_id, mode, from_name, from_email, reply_to,
               gmail_refresh_token, gmail_access_token, gmail_token_expires_at,
               gmail_address, gmail_connected_at, updated_at
             ) values (
               $1, 'gmail_oauth', $2, $3, $3,
               $4, $5, $6::timestamptz, $3, now(), now()
             )
             on conflict (school_id) do update set
               mode = 'gmail_oauth',
               from_email = coalesce($3, school_email_settings.from_email),
               reply_to = coalesce($3, school_email_settings.reply_to),
               gmail_refresh_token = $4,
               gmail_access_token = $5,
               gmail_token_expires_at = $6::timestamptz,
               gmail_address = $3,
               gmail_connected_at = now(),
               updated_at = now()`,
            [
              schoolId,
              tokens.email || "School",
              tokens.email || null,
              refresh,
              tokens.access_token,
              expires,
            ],
          );

          if (tokens.email) {
            await sql.query(`update schools set email = $1 where id = $2`, [
              tokens.email,
              schoolId,
            ]);
          }

          return Response.redirect(
            `${appBase.replace(/\/$/, "")}/app/settings?gmail=connected`,
            302,
          );
        } catch (e) {
          return fail(e instanceof Error ? e.message : "OAuth failed");
        }
      },
    },
  },
});
