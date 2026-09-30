
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { createSupportTicket, listSupportTickets } from "@/lib/nexus/server";
import { StatusPill } from "@/components/status-pill";

export const Route = createFileRoute("/app/support")({ component: SupportPage });

function SupportPage() {
  const q = useSnapshot();
  const [tickets, setTickets] = useState<
    {
      id: string;
      subject: string;
      body: string;
      status: string;
      platform_reply: string | null;
      created_at: string;
      school_name?: string;
    }[]
  >([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const isPlatform = Boolean(q.data?.isPlatformOwner);

  async function load() {
    try {
      if (isPlatform) {
        const r = await listSupportTickets({ data: { platformAll: true } });
        setTickets((r.tickets || []) as typeof tickets);
      } else if (q.data?.school?.id && q.data.school.id !== "none") {
        const r = await listSupportTickets({
          data: { schoolId: q.data.school.id },
        });
        setTickets((r.tickets || []) as typeof tickets);
      }
    } catch {
      setTickets([]);
    }
  }

  useEffect(() => {
    void load();
  }, [q.data?.school?.id, isPlatform]);

  if (q.isPending) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader
        kicker={isPlatform ? "Platform" : "Help"}
        title="Support"
        description={
          isPlatform
            ? "Tickets from schools. Reply from your email or mark resolved after handling."
            : "Message the NEXUS system owner. You will also get answers on the email linked to your school."
        }
      />

      {!isPlatform && q.data?.school?.id && q.data.school.id !== "none" && (
        <section className="mb-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg">New ticket</h2>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Details</Label>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <Button
              disabled={busy || !subject.trim() || !body.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await createSupportTicket({
                    data: {
                      schoolId: q.data!.school.id,
                      subject: subject.trim(),
                      body: body.trim(),
                    },
                  });
                  toast.success("Ticket sent");
                  setSubject("");
                  setBody("");
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending…" : "Submit ticket"}
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl bg-card shadow-[var(--shadow-border)]">
        <ul className="divide-y divide-border">
          {tickets.length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">No tickets yet.</li>
          )}
          {tickets.map((t) => (
            <li key={t.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {t.subject}
                  {t.school_name ? (
                    <span className="text-muted-foreground"> · {t.school_name}</span>
                  ) : null}
                </p>
                <StatusPill value={t.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
              {t.platform_reply && (
                <p className="mt-2 rounded-lg bg-secondary/50 p-3 text-sm">
                  <span className="font-medium">Reply: </span>
                  {t.platform_reply}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {String(t.created_at).slice(0, 19).replace("T", " ")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
