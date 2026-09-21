/**
 * Automatic flush of queued mutations when back online.
 * Maps action names → server functions.
 */
import {
  loadQueue,
  removeOfflineJob,
  updateOfflineJob,
  type OfflineJob,
} from "./queue";

type Runner = (payload: Record<string, unknown>) => Promise<unknown>;

async function handlers(): Promise<Record<string, Runner>> {
  const s = await import("@/lib/nexus/server");
  const wrap =
    (fn: (args: { data: Record<string, unknown> }) => Promise<unknown>): Runner =>
    (payload) =>
      fn({ data: payload });

  return {
    markAttendance: wrap(s.markAttendance as Runner extends never ? never : any),
    recordPayment: wrap(s.recordPayment as any),
    createAssessment: wrap(s.createAssessment as any),
    sendSchoolMessage: wrap(s.sendSchoolMessage as any),
    createFeeStructure: wrap(s.createFeeStructure as any),
    applyFeeStructure: wrap(s.applyFeeStructure as any),
    voidPayment: wrap(s.voidPayment as any),
    promoteStudents: wrap(s.promoteStudents as any),
    updateSchool: wrap(s.updateSchool as any),
    publishParentApp: wrap(s.publishParentApp as any),
    saveSchoolSmsSettings: wrap(s.saveSchoolSmsSettings as any),
    createExamination: wrap(s.createExamination as any),
    // generic passthrough for any future action registered the same way
  };
}

let flushing = false;

export async function flushOfflineQueue(): Promise<{
  ok: number;
  failed: number;
  remaining: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: 0, failed: 0, remaining: loadQueue().length };
  }
  if (flushing) return { ok: 0, failed: 0, remaining: loadQueue().length };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const map = await handlers();
    const jobs = [...loadQueue()];
    for (const job of jobs) {
      const run = map[job.action];
      if (!run) {
        updateOfflineJob(job.id, {
          lastError: `No handler for action: ${job.action}`,
          attempts: (job.attempts || 0) + 1,
        });
        failed += 1;
        continue;
      }
      try {
        await run(job.payload);
        removeOfflineJob(job.id);
        ok += 1;
      } catch (e) {
        updateOfflineJob(job.id, {
          lastError: e instanceof Error ? e.message : "failed",
          attempts: (job.attempts || 0) + 1,
        });
        failed += 1;
      }
    }
  } finally {
    flushing = false;
  }
  return { ok, failed, remaining: loadQueue().length };
}

export function startOfflineFlushListener() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => {
    void flushOfflineQueue().then((r) => {
      if (r.ok > 0) {
        console.info(`[nexus offline] flushed ${r.ok} job(s), ${r.remaining} left`);
      }
    });
  };
  window.addEventListener("online", onOnline);
  // Also try shortly after load if online
  if (navigator.onLine) setTimeout(onOnline, 1500);
  return () => window.removeEventListener("online", onOnline);
}
