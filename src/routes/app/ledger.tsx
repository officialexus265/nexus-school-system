import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/app/ledger")({
  component: LedgerPage,
});

function LedgerPage() {
  const q = useSnapshot();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const rows = useMemo(() => {
    const audit = q.data?.audit || [];
    const qText = search.trim().toLowerCase();
    return audit.filter((a) => {
      if (actionFilter !== "all" && a.action !== actionFilter) return false;
      if (!qText) return true;
      const hay = `${a.action} ${a.actor} ${a.detail} ${a.entity_type || ""}`.toLowerCase();
      return hay.includes(qText);
    });
  }, [q.data?.audit, search, actionFilter]);

  const actions = useMemo(() => {
    const set = new Set((q.data?.audit || []).map((a) => a.action));
    return ["all", ...[...set].sort()];
  }, [q.data?.audit]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data?.school || q.data.school.id === "none") {
    return (
      <p className="text-sm text-muted-foreground">No school linked — ledger is empty.</p>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Activity"
        title="Ledger"
        description="School activity log: parent registrations, parent app publish, fees, results, and staff actions."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor, detail…"
          />
        </div>
        <div className="space-y-1.5 sm:w-56">
          <label className="text-xs text-muted-foreground">Action type</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "All actions" : a.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
          {rows.length} entr{rows.length === 1 ? "y" : "ies"}
          {q.data.audit.length !== rows.length
            ? ` (filtered from ${q.data.audit.length})`
            : ""}
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No ledger entries match.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    {a.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(a as { created_at?: string }).created_at
                      ? formatDate(String((a as { created_at?: string }).created_at))
                      : ""}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/80">{a.actor}</span>
                  {a.detail ? ` · ${a.detail}` : ""}
                </p>
                {(a.entity_type || a.entity_id) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[a.entity_type, a.entity_id].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
