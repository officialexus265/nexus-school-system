import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  addAnnouncement,
  listMessageThreads,
  listThreadMessages,
  sendSchoolMessage,
} from "@/lib/nexus/server";
import { formatDate } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/announcements")({ component: NoticesPage });

function NoticesPage() {
  const q = useSnapshot();
  const persona = useNexusSession((s) => s.persona);
  const [threads, setThreads] = useState<
    { threadId: string; parentId: string | null | undefined; parentName: string | undefined; lastBody: string; lastAt: string }[]
  >([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { id: string; sender_type: string; body: string; created_at: string }[]
  >([]);
  const [reply, setReply] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [newBody, setNewBody] = useState("");

  useEffect(() => {
    if (!q.data?.school?.id || persona === "parent") return;
    listMessageThreads({ data: { schoolId: q.data.school.id } })
      .then((r) => setThreads(r.threads))
      .catch(() => {});
  }, [q.data?.school?.id, persona]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  const dark = persona === "parent";

  async function openThread(threadId: string) {
    setActiveThread(threadId);
    try {
      const r = await listThreadMessages({
        data: { schoolId: snap.school.id, threadId },
      });
      setMessages(r.messages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      {dark ? (
        <>
          <h1 className="font-display text-3xl text-foam">Notices</h1>
          <p className="mt-1 text-sm text-mist">School-wide messages and announcements.</p>
        </>
      ) : (
        <PageHeader
          kicker="Communication"
          title="Notices & messages"
          description="Announcements (SMS + email to parents) and direct parent messaging."
          actions={<Compose schoolId={snap.school.id} />}
        />
      )}

      <Tabs defaultValue="announcements" className="mt-6">
        <TabsList>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          {!dark && <TabsTrigger value="messages">Parent messages</TabsTrigger>}
        </TabsList>

        <TabsContent value="announcements" className="mt-4">
          <ul className="space-y-3">
            {snap.announcements.map((a) => (
              <li
                key={a.id}
                className={
                  dark
                    ? "rounded-xl border border-foam/10 bg-ink-2 p-4"
                    : "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
                }
              >
                <p className={`font-medium ${dark ? "text-foam" : ""}`}>{a.title}</p>
                <p className={`mt-1 text-sm ${dark ? "text-mist" : "text-muted-foreground"}`}>
                  {a.body}
                </p>
                <p className={`mt-2 text-xs ${dark ? "text-mist/60" : "text-muted-foreground"}`}>
                  {formatDate(a.created_at)} · {a.audience}
                </p>
              </li>
            ))}
            {snap.announcements.length === 0 && (
              <li className="text-sm text-muted-foreground">No announcements yet.</li>
            )}
          </ul>
        </TabsContent>

        {!dark && (
          <TabsContent value="messages" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                <h2 className="font-display text-lg">Threads</h2>
                <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                  {threads.map((t) => (
                    <button
                      key={t.threadId}
                      type="button"
                      onClick={() => openThread(t.threadId)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${
                        activeThread === t.threadId ? "bg-secondary" : ""
                      }`}
                    >
                      <span className="font-medium">{t.parentName}</span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                        {t.lastBody}
                      </span>
                    </button>
                  ))}
                  {threads.length === 0 && (
                    <li className="text-sm text-muted-foreground">No messages yet.</li>
                  )}
                </ul>

                <h3 className="mt-4 text-sm font-medium">New message</h3>
                <div className="mt-2 space-y-2">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={newParentId}
                    onChange={(e) => setNewParentId(e.target.value)}
                  >
                    <option value="">Select parent…</option>
                    {snap.parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} · {p.phone}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    placeholder="Message (also sent by SMS/email when possible)"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    disabled={!newParentId || !newBody.trim()}
                    onClick={async () => {
                      try {
                        await sendSchoolMessage({
                          data: {
                            schoolId: snap.school.id,
                            parentId: newParentId,
                            body: newBody,
                            alsoSms: true,
                            alsoEmail: true,
                          },
                        });
                        toast.success("Message sent");
                        setNewBody("");
                        const r = await listMessageThreads({
                          data: { schoolId: snap.school.id },
                        });
                        setThreads(r.threads);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Send
                  </Button>
                </div>
              </section>

              <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                <h2 className="font-display text-lg">Conversation</h2>
                {activeThread ? (
                  <>
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className={`rounded-lg px-3 py-2 ${
                            m.sender_type === "SCHOOL" ? "bg-primary/10" : "bg-secondary"
                          }`}
                        >
                          <span className="text-xs text-muted-foreground">
                            {m.sender_type} · {formatDate(m.created_at)}
                          </span>
                          <p className="mt-0.5">{m.body}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Reply…"
                      />
                      <Button
                        onClick={async () => {
                          const t = threads.find((x) => x.threadId === activeThread);
                          if (!t?.parentId || !reply.trim()) return;
                          try {
                            await sendSchoolMessage({
                              data: {
                                schoolId: snap.school.id,
                                parentId: t.parentId,
                                body: reply,
                              },
                            });
                            setReply("");
                            await openThread(activeThread);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Reply
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Select a thread</p>
                )}
              </section>
            </div>
          </TabsContent>
        )}
      </Tabs>
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
        <Button>New announcement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Announcement</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Parents receive this in-app and by SMS/email when contact details exist.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !title.trim() || !body.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await addAnnouncement({
                  data: { schoolId, title, body, audience: "ALL" },
                });
                toast.success("Published & queued notifications");
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
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
