
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Crawler-friendly HTML with Open Graph tags (WhatsApp, Facebook, etc.).
 * GET /api/promo-preview?slug=...
 */
export const Route = createFileRoute("/api/promo-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug")?.trim() || "";
        if (!slug) {
          return new Response("Missing slug", { status: 400 });
        }
        const sql = await getSql();
        const rows = await sql`
          select title, description, og_image_url, kind, discount_pct, public_slug
          from platform_promotions
          where public_slug = ${slug} and active = true
          limit 1
        `.catch(() => []);
        const p = rows[0] as
          | {
              title: string;
              description: string | null;
              og_image_url: string | null;
              public_slug: string;
            }
          | undefined;
        if (!p) return new Response("Not found", { status: 404 });

        const base =
          process.env.BETTER_AUTH_URL ||
          process.env.VITE_APP_URL ||
          `${url.protocol}//${url.host}`;
        const pageUrl = `${base.replace(/\/$/, "")}/promo/${p.public_slug}`;
        const title = escapeHtml(p.title);
        const desc = escapeHtml(p.description || "NEXUS school management system");
        const image = escapeHtml(p.og_image_url || `${base.replace(/\/$/, "")}/og.jpg`);

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <meta name="description" content="${desc}"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${desc}"/>
  <meta property="og:image" content="${image}"/>
  <meta property="og:url" content="${escapeHtml(pageUrl)}"/>
  <meta property="og:type" content="website"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${desc}"/>
  <meta name="twitter:image" content="${image}"/>
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}"/>
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${title}</a></p>
</body>
</html>`;
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
