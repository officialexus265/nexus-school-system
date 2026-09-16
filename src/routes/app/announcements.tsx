import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { addAnnouncement } from "@/lib/nexus/server";
import { formatDate } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/announcements")({ component: NoticesPage });

function NoticesPage() {
  const q = useSnapshot();
  const persona = useNexusSession((s) => s.persona);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  const dark = persona === "parent";
  return (
    <div>
      {dark ? (
        <>
          <h1 className="font-display text-3xl text-foam">Notices</h1>
          <p className="mt-1 text-sm text-mist">School-wide, class and individual messages.</p>
        </>
      ) : (
        <PageHeader
          kicker="Communication"
          title="Notices"
          description="Announcements, fee reminders and result alerts share the same engine."
          actions={<Compose schoolId={snap.school.id} />}
        />
      )}
      <ul className="mt-6 space-y-3">
        {snap.announcements.map((a) => (
          <li
            key={a.id}
            className={
              dark
                ? "rounded-xl border border-foam/10 bg-ink-2 p-4"
                : "rounded-xl bg-card p-5 shadow-[var(--shadow-border)]"
            }
          >
            <p className={`text-[11px] uppercase tracking-[0.14em] ${dark ? "text-mist" : "text-muted-foreground"}`}>
              {a.audience} · {a.author} · {formatDate(a.created_at)}
            </p>
            <h2 className={`mt-1 font-display text-xl ${dark ? "text-foam" : ""}`}>{a.title}</h2>
            <p className={`mt-2 text-sm leading-relaxed ${dark ? "text-mist" : "text-muted-foreground"}`}>{a.body}</p>
          </li>
        ))}
      </ul>
      {!dark ? (
        <section className="mt-8 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Notification log</h2>
          <ul className="mt-3 space-y-2">
            {snap.notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between text-sm">
                <span>
                  {n.title} · {n.channel}
                </span>
                <span className="text-xs text-muted-foreground">{n.is_read ? "Read" : "Unread"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Compose({ schoolId }: { schoolId: string }) {
  const invalidate = useInvalidateSnapshot();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New notice</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New notice</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !title.trim() || !body.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await addAnnouncement({
                  data: { schoolId, title, body, audience: "ALL" },
                });
                toast.success("Posted");
                setOpen(false);
                setTitle("");
                setBody("");
                await invalidate();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Publish notice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
