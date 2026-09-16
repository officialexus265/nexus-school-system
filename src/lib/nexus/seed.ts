import type { Sql } from "@/lib/db";

/** Stable id namespaced by user (legacy isolation). Prefer school-scoped ids for new data. */
export function nid(userId: string, key: string): string {
  return `${userId}:${key}`;
}

/**
 * Mark workspace as ready. Does NOT seed any demo schools or students.
 * Platform owner creates schools; school owners join via invite.
 */
export async function ensureWorkspace(sql: Sql, userId: string) {
  const existing = await sql<{ user_id: string }>`
    select user_id from nexus_workspaces where user_id = ${userId}
  `;
  if (existing.length) return;
  await sql.query(
    `insert into nexus_workspaces (user_id, seeded_at) values ($1, now())
     on conflict (user_id) do nothing`,
    [userId],
  );
}

/** No-op kept so any leftover imports do not crash. */
export async function seedWorkspace(_sql: Sql, _userId: string) {
  console.warn(
    "[nexus] seedWorkspace is disabled — demo data has been removed from the product.",
  );
}
