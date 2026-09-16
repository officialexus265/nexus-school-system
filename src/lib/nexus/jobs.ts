/**
 * Lightweight background job helpers.
 * Jobs are rows in background_jobs; processJobs() can be called from:
 *   - a platform "Run jobs" button
 *   - an external cron hitting a server function
 *   - future worker process
 */

import { getSql } from "@/lib/db";

export type JobType =
  | "FEE_REMINDERS"
  | "GENERATE_INVOICES"
  | "BULK_SMS"
  | "EXPORT"
  | "MARK_OVERDUE_INVOICES";

export async function enqueueJob(opts: {
  jobType: JobType;
  schoolId?: string;
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
  id?: string;
}): Promise<string> {
  const sql = await getSql();
  const id = opts.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await sql.query(
    `insert into background_jobs (id, school_id, job_type, payload, status, scheduled_for)
     values ($1,$2,$3,$4::jsonb,'PENDING',$5)`,
    [
      id,
      opts.schoolId || null,
      opts.jobType,
      JSON.stringify(opts.payload || {}),
      (opts.scheduledFor || new Date()).toISOString(),
    ],
  );
  return id;
}

export async function claimNextJobs(limit = 5): Promise<
  {
    id: string;
    school_id: string | null;
    job_type: string;
    payload: Record<string, unknown>;
    attempts: number;
  }[]
> {
  const sql = await getSql();
  // Simple claim: mark RUNNING for pending due jobs
  const pending = await sql<{
    id: string;
    school_id: string | null;
    job_type: string;
    payload: unknown;
    attempts: number;
  }>`
    select id, school_id, job_type, payload, attempts
    from background_jobs
    where status = 'PENDING' and scheduled_for <= now()
    order by scheduled_for asc
    limit ${limit}
  `;
  const claimed = [];
  for (const j of pending) {
    await sql.query(
      `update background_jobs set status = 'RUNNING', started_at = now(), attempts = attempts + 1
       where id = $1 and status = 'PENDING'`,
      [j.id],
    );
    claimed.push({
      ...j,
      payload:
        typeof j.payload === "string"
          ? JSON.parse(j.payload)
          : (j.payload as Record<string, unknown>) || {},
    });
  }
  return claimed;
}

export async function completeJob(id: string, error?: string) {
  const sql = await getSql();
  if (error) {
    await sql.query(
      `update background_jobs set status = 'FAILED', last_error = $1, finished_at = now() where id = $2`,
      [error.slice(0, 500), id],
    );
  } else {
    await sql.query(
      `update background_jobs set status = 'DONE', finished_at = now() where id = $1`,
      [id],
    );
  }
}
