import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * Hands-off ops endpoint.
 * Protect with header: Authorization: Bearer $CRON_SECRET
 * or query ?secret=
 *
 * Examples:
 *   GET/POST /api/cron?job=all
 *   GET/POST /api/cron?job=invoices
 *   GET/POST /api/cron?job=fee_reminders
 *   GET/POST /api/cron?job=overdue
 *   GET/POST /api/cron?job=process_queue
 */
export const Route = createFileRoute("/api/cron")({
  server: {
    handlers: {
      GET: (ctx) => handleCron(ctx.request),
      POST: (ctx) => handleCron(ctx.request),
    },
  },
});

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Allow in non-production only when unset
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret") || "";
  return bearer === secret || q === secret;
}

async function handleCron(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const job = (url.searchParams.get("job") || "all").toLowerCase();
  const results: Record<string, unknown> = { job, at: new Date().toISOString() };

  try {
    const { runFeeReminders, generatePlatformInvoices } = await import(
      "@/lib/nexus/server"
    );
    const { claimNextJobs, completeJob, enqueueJob } = await import("@/lib/nexus/jobs");
    const sql = await getSql();

    if (job === "all" || job === "overdue") {
      await sql.query(
        `update platform_invoices set status = 'OVERDUE'
         where status in ('SENT','DRAFT') and due_date is not null and due_date < current_date`,
      );
      results.overdue = { ok: true };
      // Auto-suspend schools with overdue invoices older than 14 days beyond due
      try {
        await sql.query(`
          update schools set status = 'SUSPENDED'
          where id in (
            select distinct school_id from platform_invoices
            where status = 'OVERDUE'
              and due_date < current_date - interval '14 days'
          )
          and status in ('ACTIVE','GRACE_PERIOD','PENDING_PAYMENT')
        `);
        results.auto_suspend = { ok: true };
      } catch (e) {
        results.auto_suspend = {
          ok: false,
          error: e instanceof Error ? e.message : "failed",
        };
      }
    }

    if (job === "all" || job === "invoices") {
      // Enqueue then process, or run directly
      const period = url.searchParams.get("period") || "monthly";
      const inv = await generatePlatformInvoices({ data: { period: period as "monthly" } });
      results.invoices = inv;
    }

    if (job === "all" || job === "fee_reminders") {
      const schools = await sql<{ id: string }>`
        select id from schools where status in ('ACTIVE','GRACE_PERIOD','PENDING_PAYMENT')
      `;
      const perSchool: { schoolId: string; sent?: number; error?: string }[] = [];
      for (const s of schools) {
        try {
          const r = await runFeeReminders({
            data: { schoolId: s.id, dryRun: false },
          });
          perSchool.push({ schoolId: s.id, sent: r.sent });
        } catch (e) {
          perSchool.push({
            schoolId: s.id,
            error: e instanceof Error ? e.message : "failed",
          });
        }
      }
      results.fee_reminders = { schools: perSchool.length, details: perSchool };
    }

    if (job === "all" || job === "process_queue") {
      const jobs = await claimNextJobs(20);
      const processed: { id: string; type: string; ok: boolean; detail?: string }[] = [];
      for (const j of jobs) {
        try {
          if (j.job_type === "FEE_REMINDERS" && j.school_id) {
            const r = await runFeeReminders({
              data: { schoolId: j.school_id, dryRun: false },
            });
            await completeJob(j.id);
            processed.push({ id: j.id, type: j.job_type, ok: true, detail: `sent ${r.sent}` });
          } else if (j.job_type === "GENERATE_INVOICES") {
            const r = await generatePlatformInvoices({ data: { period: "monthly" } });
            await completeJob(j.id);
            processed.push({
              id: j.id,
              type: j.job_type,
              ok: true,
              detail: `created ${r.count}`,
            });
          } else if (j.job_type === "MARK_OVERDUE_INVOICES") {
            await sql.query(
              `update platform_invoices set status = 'OVERDUE'
               where status in ('SENT','DRAFT') and due_date is not null and due_date < current_date`,
            );
            await completeJob(j.id);
            processed.push({ id: j.id, type: j.job_type, ok: true });
          } else {
            await completeJob(j.id, `Unhandled: ${j.job_type}`);
            processed.push({ id: j.id, type: j.job_type, ok: false, detail: "unhandled" });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "failed";
          await completeJob(j.id, msg);
          processed.push({ id: j.id, type: j.job_type, ok: false, detail: msg });
        }
      }
      results.process_queue = { processed: processed.length, items: processed };
    }

    // Optional: schedule next daily jobs when job=schedule
    if (job === "schedule") {
      await enqueueJob({ jobType: "GENERATE_INVOICES", payload: { source: "cron" } });
      await enqueueJob({ jobType: "MARK_OVERDUE_INVOICES", payload: { source: "cron" } });
      results.scheduled = true;
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error("[cron]", e);
    return json(
      { ok: false, error: e instanceof Error ? e.message : "cron failed" },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
