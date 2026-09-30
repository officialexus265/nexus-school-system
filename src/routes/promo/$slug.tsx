
import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";

/** Loader-safe public promo fetch (no auth). */
const loadPromo = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql`
      select title, description, og_image_url, kind, discount_pct
      from platform_promotions
      where public_slug = ${data.slug.trim()} and active = true
      limit 1
    `.catch(() => []);
    const p = rows[0] as
      | {
          title: string;
          description: string | null;
          og_image_url: string | null;
          kind: string;
          discount_pct: number | null;
        }
      | undefined;
    if (!p) throw new Error("Promotion not found");
    return {
      title: p.title,
      description: p.description,
      ogImageUrl: p.og_image_url,
      kind: p.kind,
      discountPct: p.discount_pct != null ? Number(p.discount_pct) : null,
    };
  });

export const Route = createFileRoute("/promo/$slug")({
  loader: async ({ params }) => {
    return loadPromo({ data: { slug: params.slug } });
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title || "NEXUS";
    const description =
      loaderData?.description ||
      "NEXUS school management — academics, finance, results and parent app.";
    const image = loaderData?.ogImageUrl || "/og.jpg";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: PromoPage,
});

function PromoPage() {
  const data = Route.useLoaderData();

  useEffect(() => {
    if (!data) return;
    document.title = data.title;
  }, [data]);

  return (
    <div className="min-h-dvh bg-ink px-4 py-12 text-foam">
      <div className="mx-auto max-w-lg space-y-6 text-center">
        {data.ogImageUrl && (
          <img
            src={data.ogImageUrl}
            alt=""
            className="mx-auto max-h-56 w-full rounded-2xl object-cover"
          />
        )}
        <h1 className="font-display text-3xl tracking-tight">{data.title}</h1>
        {data.discountPct != null && (
          <p className="text-lg text-emerald-300">{data.discountPct}% off</p>
        )}
        {data.description && (
          <p className="text-sm text-mist whitespace-pre-wrap">{data.description}</p>
        )}
        <Button asChild className="bg-white text-slate-900 hover:bg-white/90">
          <Link to="/login">Request a school account</Link>
        </Button>
      </div>
    </div>
  );
}
