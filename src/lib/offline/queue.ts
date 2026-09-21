/**
 * Offline mutation queue + IndexedDB-backed persistence.
 */

export type OfflineJob = {
  id: string;
  createdAt: string;
  action: string;
  payload: Record<string, unknown>;
  label: string;
  attempts?: number;
  lastError?: string;
};

const KEY = "nexus-offline-queue-v1";

export function loadQueue(): OfflineJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineJob[];
  } catch {
    return [];
  }
}

function saveQueue(jobs: OfflineJob[]) {
  localStorage.setItem(KEY, JSON.stringify(jobs));
  try {
    window.dispatchEvent(new Event("nexus-queue-changed"));
  } catch {
    /* */
  }
}

export function enqueueOffline(job: Omit<OfflineJob, "id" | "createdAt">): OfflineJob {
  const full: OfflineJob = {
    ...job,
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const q = loadQueue();
  q.push(full);
  saveQueue(q);
  return full;
}

export function updateOfflineJob(id: string, patch: Partial<OfflineJob>) {
  saveQueue(loadQueue().map((j) => (j.id === id ? { ...j, ...patch } : j)));
}

export function removeOfflineJob(id: string) {
  saveQueue(loadQueue().filter((j) => j.id !== id));
}

export function clearOfflineQueue() {
  saveQueue([]);
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
