import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSnapshot } from "@/lib/nexus/server";
import { useNexusSession } from "@/stores/session";

export const SNAPSHOT_KEY = ["nexus-snapshot"] as const;

export function useSnapshot() {
  const schoolSlug = useNexusSession((s) => s.schoolSlug);
  return useQuery({
    queryKey: [...SNAPSHOT_KEY, schoolSlug],
    queryFn: () => getSnapshot({ data: { schoolSlug } }),
  });
}

export function useInvalidateSnapshot() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: SNAPSHOT_KEY });
}
