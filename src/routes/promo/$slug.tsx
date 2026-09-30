import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicPromotion } from "@/lib/nexus/server";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/promo/$slug")({
  component: PromoPage,
});

function PromoPage() {
  const { slug } = Route.useParams();
  const [data, setData] = useState<{
    title: string;
    description: string | null;
    ogImageUrl: string | null;
    kind: string;
    discountPct: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicPromotion({ data: { slug } })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    document.title = data.title;
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("og:title", data.title);
    if (data.description) setMeta("og:description", data.description);
    if (data.ogImageUrl) setMeta("og:image", data.ogImageUrl);
  }, [data]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

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
