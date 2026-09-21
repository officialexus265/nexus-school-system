import { useEffect, useState } from "react";
import { loadQueue, removeOfflineJob, type OfflineJob } from "@/lib/offline/queue";
import { flushOfflineQueue, startOfflineFlushListener } from "@/lib/offline/flush";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Connectivity-aware banner.
 * navigator.onLine alone is unreliable (can stay false after reconnect).
 * We treat "offline" only when the browser says offline AND/OR a probe fails.
 * When the browser says online, we re-probe and clear the banner quickly.
 */
async function probeOnline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }
  try {
    // Same-origin lightweight request; cache-bust so SW/network is exercised
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`/manifest.webmanifest?_=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok || res.type === "opaque";
  } catch {
    // If browser claims online but probe fails, still prefer online for UI
    // unless navigator explicitly says offline (avoids sticky false offline)
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<OfflineJob[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshQueue = () => setQueue(loadQueue());

    const sync = async (forceOnline = false) => {
      refreshQueue();
      if (forceOnline) {
        if (!cancelled) {
          setOffline(false);
          setChecked(true);
        }
        return;
      }
      // Explicit browser offline event
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelled) {
          setOffline(true);
          setChecked(true);
        }
        return;
      }
      // Browser says online — clear banner immediately, then confirm
      if (!cancelled) setOffline(false);
      const ok = await probeOnline();
      if (!cancelled) {
        setOffline(!ok && !navigator.onLine);
        setChecked(true);
      }
    };

    void sync();
    const stopFlush = startOfflineFlushListener();

    const onOnline = () => {
      void sync(true);
      void flushOfflineQueue().then((r) => {
        if (r.ok > 0) toast.success(`Synced ${r.ok} offline change(s)`);
        refreshQueue();
      });
    };
    const onOffline = () => {
      setOffline(true);
      setChecked(true);
      refreshQueue();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("storage", refreshQueue);
    window.addEventListener("nexus-queue-changed", refreshQueue);
    // Re-check occasionally; always prefer clearing sticky offline when onLine
    const t = setInterval(() => {
      if (navigator.onLine) void sync(true);
      else void sync();
    }, 8000);

    return () => {
      cancelled = true;
      stopFlush();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("storage", refreshQueue);
      window.removeEventListener("nexus-queue-changed", refreshQueue);
      clearInterval(t);
    };
  }, []);

  // Don't flash offline before first check
  if (!checked) return null;
  if (!offline && queue.length === 0) return null;

  return (
    <div
      className={
        offline
          ? "border-b border-amber-600/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-950 dark:text-amber-100"
          : "border-b border-border bg-muted/50 px-4 py-2 text-sm"
      }
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div>
          {offline ? (
            <p>
              <strong>You appear to be offline.</strong> Cached screens may still work. Changes
              you queue will sync when the connection returns.
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
        <div className="flex gap-2">
          {offline && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (navigator.onLine) {
                  setOffline(false);
                  void flushOfflineQueue();
                } else {
                  toast.message("Browser still reports offline — check Wi‑Fi or mobile data");
                }
              }}
            >
              I&apos;m back online
            </Button>
          )}
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
    </div>
  );
}
