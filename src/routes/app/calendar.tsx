import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
} from "@/lib/nexus/server";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/app/calendar")({ component: CalendarPage });

function CalendarPage() {
  const q = useSnapshot();
  const [events, setEvents] = useState<
    {
      id: string;
      title: string;
      event_type: string | null;
      event_date: string;
      end_date: string | null;
      description: string | null;
    }[]
  >([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("General");
  const [description, setDescription] = useState("");

  async function refresh(schoolId: string) {
    const r = await listCalendarEvents({ data: { schoolId } });
    setEvents(r.events);
  }

  useEffect(() => {
    if (q.data?.school?.id) void refresh(q.data.school.id).catch(() => {});
  }, [q.data?.school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const schoolId = q.data.school.id;

  return (
    <div>
      <PageHeader
        kicker="School life"
        title="Calendar"
        description="Term dates, exams, sports days and holidays."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Add event</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {["General", "Exam", "Holiday", "Sports", "Meeting", "Deadline"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button
              onClick={async () => {
                if (!title || !date) {
                  toast.error("Title and date required");
                  return;
                }
                try {
                  await createCalendarEvent({
                    data: {
                      schoolId,
                      title,
                      eventDate: date,
                      eventType: type,
                      description: description || undefined,
                    },
                  });
                  toast.success("Event added");
                  setTitle("");
                  setDescription("");
                  await refresh(schoolId);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Save event
            </Button>
          </div>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Upcoming</h2>
          <ul className="mt-3 divide-y divide-border">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ev.event_date)}
                    {ev.event_type ? ` · ${ev.event_type}` : ""}
                  </p>
                  {ev.description && (
                    <p className="mt-1 text-muted-foreground">{ev.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await deleteCalendarEvent({ data: { schoolId, eventId: ev.id } });
                      await refresh(schoolId);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
            {events.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">No events yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
