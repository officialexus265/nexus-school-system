import { getSql } from "@/lib/db";

export type Membership = {
  id: string;
  user_id: string;
  school_id: string;
  role: string;
  status: string;
  role_id: string | null;
};

/** Whether this user is a platform owner (global). */
export async function isPlatformOwner(userId: string): Promise<boolean> {
  const sql = await getSql();
  try {
    const rows = await sql<{ is_platform_owner: boolean }>`
      select is_platform_owner from "user" where id = ${userId} limit 1
    `;
    return Boolean(rows[0]?.is_platform_owner);
  } catch {
    // Column may not exist yet in very old DBs
    return false;
  }
}

export async function getMemberships(userId: string): Promise<Membership[]> {
  const sql = await getSql();
  try {
    return await sql<Membership>`
      select id, user_id, school_id, role, status, role_id
      from user_school_memberships
      where user_id = ${userId} and status = 'ACTIVE'
    `;
  } catch {
    return [];
  }
}

export async function getMembershipForSchool(
  userId: string,
  schoolId: string,
): Promise<Membership | null> {
  const list = await getMemberships(userId);
  return list.find((m) => m.school_id === schoolId) ?? null;
}

/**
 * Resolve which school IDs this user may access.
 * Platform owners: all schools (or empty list meaning "unrestricted").
 * Others: membership school_ids, plus legacy schools.user_id = userId.
 */
export async function accessibleSchoolIds(userId: string): Promise<{
  platform: boolean;
  schoolIds: string[];
}> {
  const sql = await getSql();
  const platform = await isPlatformOwner(userId);
  if (platform) {
    const all = await sql<{ id: string }>`select id from schools`;
    return { platform: true, schoolIds: all.map((s) => s.id) };
  }

  const memberships = await getMemberships(userId);
  const fromMembership = memberships.map((m) => m.school_id);

  // Legacy: schools still owned via user_id column
  const legacy = await sql<{ id: string }>`
    select id from schools where user_id = ${userId} or owner_user_id = ${userId}
  `;
  const set = new Set([...fromMembership, ...legacy.map((s) => s.id)]);
  return { platform: false, schoolIds: [...set] };
}

/** Throw if user cannot access this school. */
export async function requireSchoolAccess(
  userId: string,
  schoolId: string,
): Promise<{ platform: boolean; membership: Membership | null }> {
  const platform = await isPlatformOwner(userId);
  if (platform) return { platform: true, membership: null };

  const membership = await getMembershipForSchool(userId, schoolId);
  if (membership) return { platform: false, membership };

  const sql = await getSql();
  const legacy = await sql<{ id: string }>`
    select id from schools
    where id = ${schoolId}
      and (user_id = ${userId} or owner_user_id = ${userId})
    limit 1
  `;
  if (legacy[0]) return { platform: false, membership: null };

  throw new Error("You do not have access to this school");
}

/** Permission codes the user has for a school (via role or owner/platform). */
export async function getPermissionCodes(
  userId: string,
  schoolId: string,
): Promise<string[]> {
  const { platform, membership } = await requireSchoolAccess(userId, schoolId);
  if (platform) return ["*"]; // all

  const role = membership?.role || "owner";
  if (role === "owner") {
    return [
      "school.settings.manage",
      "school.branding.manage",
      "school.roles.manage",
      "students.manage",
      "students.view",
      "parents.manage",
      "teachers.manage",
      "results.view",
      "results.review",
      "results.approve",
      "results.publish",
      "finance.view",
      "finance.manage",
      "attendance.manage",
      "behaviour.manage",
      "notifications.manage",
      "audit_logs.view",
    ];
  }

  // Custom role from role_permissions
  if (membership?.role_id) {
    try {
      const sql = await getSql();
      const codes = await sql<{ code: string }>`
        select p.code from role_permissions rp
        inner join permissions p on p.id = rp.permission_id
        where rp.role_id = ${membership.role_id}
      `;
      if (codes.length) return codes.map((c) => c.code);
    } catch {
      /* fall through to defaults */
    }
  }

  const defaults: Record<string, string[]> = {
    head: [
      "students.view",
      "results.view",
      "results.review",
      "results.approve",
      "results.publish",
      "attendance.manage",
      "behaviour.manage",
      "audit_logs.view",
    ],
    exam: ["results.view", "results.review", "students.view"],
    bursar: ["finance.view", "finance.manage", "students.view", "parents.manage"],
    teacher: ["students.view", "results.view", "attendance.manage", "behaviour.manage"],
    parent: ["results.view"],
  };
  return defaults[role] || ["students.view"];
}

export async function requirePermission(
  userId: string,
  schoolId: string,
  code: string,
): Promise<void> {
  const codes = await getPermissionCodes(userId, schoolId);
  if (codes.includes("*") || codes.includes(code)) return;
  throw new Error(`Missing permission: ${code}`);
}
