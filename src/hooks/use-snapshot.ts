import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSnapshot } from "@/lib/nexus/server";
import { useNexusSession } from "@/stores/session";
import { idbGet, idbSet } from "@/lib/offline/idb";

export const SNAPSHOT_KEY = ["nexus-snapshot"] as const;

export function useSnapshot() {
  const schoolSlug = useNexusSession((s) => s.schoolSlug);
  return useQuery({
    queryKey: [...SNAPSHOT_KEY, schoolSlug],
    queryFn: async () => {
      const cacheKey = `snapshot:${schoolSlug || "default"}`;
      try {
        const data = await getSnapshot({ data: { schoolSlug } });
        void idbSet(cacheKey, { at: Date.now(), data });
        return data;
      } catch (e) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const cached = await idbGet<{ data: Awaited<ReturnType<typeof getSnapshot>> }>(
            cacheKey,
          );
          if (cached?.data) return cached.data;
        }
        throw e;
      }
    },
  });
}

export function useInvalidateSnapshot() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
}
