import { useEffect, useState } from "react";
import { loadQueue, removeOfflineJob, type OfflineJob } from "@/lib/offline/queue";
import { flushOfflineQueue, startOfflineFlushListener } from "@/lib/offline/flush";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Shows when offline and lists queued actions.
 * Flush is best-effort: jobs are labeled; handlers can be extended per action.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [queue, setQueue] = useState<OfflineJob[]>([]);

  useEffect(() => {
    const sync = () => {
      setOffline(!navigator.onLine);
      setQueue(loadQueue());
    };
    sync();
    const stopFlush = startOfflineFlushListener();
    const onOnline = () => {
      sync();
      void flushOfflineQueue().then((r) => {
        if (r.ok) toast.success(`Synced ${r.ok} offline change(s)`);
        sync();
      });
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("nexus-queue-changed", sync);
    const t = setInterval(sync, 4000);
    return () => {
      stopFlush();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("nexus-queue-changed", sync);
      clearInterval(t);
    };
  }, []);

  if (!offline && queue.length === 0) return null;

  return (
    <div
      className={
        offline
          ? "border-b border-amber-600/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-950 dark:text-amber-100"
          : "border-b border-border bg-muted/50 px-4 py-2 text-sm"
      }
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div>
          {offline ? (
            <p>
              <strong>You are offline.</strong> The app shell still works. Changes you queue
              will sync when the connection returns.
            </p>
          ) : (
            <p>
              Back online. {queue.length} queued action{queue.length === 1 ? "" : "s"} waiting to
              sync.
            </p>
          )}
          {queue.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs opacity-90">
              {queue.slice(0, 5).map((j) => (
                <li key={j.id}>
                  {j.label}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      removeOfflineJob(j.id);
                      setQueue(loadQueue());
                    }}
                  >
                    dismiss
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!offline && queue.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void flushOfflineQueue().then((r) => {
                if (r.ok) toast.success(`Synced ${r.ok}`);
                if (r.failed) toast.error(`${r.failed} failed — see queue`);
                setQueue(loadQueue());
              });
            }}
          >
            Sync now
          </Button>
        )}
      </div>
    </div>
  );
}
