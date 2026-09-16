import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { gradeFromScore, num } from "@/lib/utils";
import { ensureWorkspace, nid } from "./seed";
import { platformSmsCredentials, sendSms, sendSmsWithCredentials } from "./sms";
import {
  formatMwk,
  inferBillingTier,
  periodBounds,
  priceFor,
  toDateStr,
  type BillingPeriod,
  type BillingTier,
} from "./billing";
import { schoolInviteEmail, sendEmail } from "./email";
import {
  accessibleSchoolIds,
  isPlatformOwner,
  requirePermission,
  requireSchoolAccess,
} from "./tenancy";
import type {
  AcademicYear,
  Announcement,
  Assessment,
  AssessmentScore,
  Attendance,
  AuditLog,
  BehaviourRecord,
  CalendarEvent,
  ClassRow,
  FeeStructure,
  Notification,
  Parent,
  ParentAppSettings,
  ParentStudent,
  Payment,
  ResultStatus,
  ResultSubmission,
  School,
  Snapshot,
  Staff,
  Student,
  StudentCharge,
  StudentResult,
  Subject,
  TeacherAssignment,
  Term,
} from "./types";

async function loadSnapshot(userId: string, schoolSlug: string): Promise<Snapshot> {
  const sql = await getSql();
  await ensureWorkspace(sql, userId);

  // Prefer memberships + platform access over legacy user_id isolation
  let schools = await sql<School>`
    select * from schools where user_id = ${userId} order by name
  `;
  try {
    const { accessibleSchoolIds, isPlatformOwner } = await import("./tenancy");
    const access = await accessibleSchoolIds(userId);
    if (access.platform || access.schoolIds.length) {
      const ids = access.schoolIds.length
        ? access.schoolIds
        : (await sql<{ id: string }>`select id from schools`).map((r) => r.id);
      if (ids.length) {
        schools = await sql<School>`
          select * from schools where id = any(${ids}::text[]) order by name
        `;
      }
    }
  } catch {
    /* tenancy helpers / columns may be missing on first boot */
  }

  const school =
    schools.find((s) => s.slug === schoolSlug) ??
    schools.find((s) => s.slug === "sunrise") ??
    schools[0];
  if (!school) {
    // Empty workspace: return a minimal placeholder so Platform UI can open schools
    const placeholder: School = {
      id: "none",
      user_id: userId,
      slug: "none",
      name: "No school yet",
      registration_number: null,
      address: null,
      district: null,
      city: null,
      country: "Malawi",
      phone: null,
      email: null,
      website: null,
      motto: null,
      school_type: null,
      boarding_status: null,
      status: "DORMANT",
      logo_mark: "N",
      primary_color: "#0f766e",
      secondary_color: "#f3f0e8",
      timezone: "Africa/Blantyre",
      currency: "MWK",
      subscription_plan: null,
      activation_fee: null,
      student_capacity: null,
      parent_app_name: null,
      parent_app_slug: null,
      owner_name: null,
      owner_email: null,
      owner_user_id: null,
    } as School;
    return {
      school: placeholder,
      schools: [],
      staff: [],
      classes: [],
      subjects: [],
      assignments: [],
      students: [],
      parents: [],
      parentLinks: [],
      years: [],
      terms: [],
      assessments: [],
      scores: [],
      submissions: [],
      results: [],
      attendance: [],
      behaviour: [],
      fees: [],
      charges: [],
      payments: [],
      announcements: [],
      notifications: [],
      audit: [],
      events: [],
    } as Snapshot;
  }
  const sid = school.id;

  const [
    staff,
    classes,
    subjects,
    assignments,
    students,
    parents,
    parentLinks,
    years,
    terms,
    assessments,
    scores,
    submissions,
    results,
    attendance,
    behaviour,
    fees,
    charges,
    payments,
    announcements,
    notifications,
    audit,
    events,
  ] = await Promise.all([
    sql<Staff>`select * from staff where user_id = ${userId} and school_id = ${sid} order by full_name`,
    sql<ClassRow>`select * from classes where user_id = ${userId} and school_id = ${sid} order by level_order desc, stream`,
    sql<Subject>`select * from subjects where user_id = ${userId} and school_id = ${sid} order by name`,
    sql<TeacherAssignment>`select * from teacher_assignments where user_id = ${userId} and school_id = ${sid}`,
    sql<Student>`select * from students where user_id = ${userId} and school_id = ${sid} order by last_name, first_name`,
    sql<Parent>`select * from parents where user_id = ${userId} and school_id = ${sid} order by full_name`,
    sql<ParentStudent>`select * from parent_students where user_id = ${userId}`,
    sql<AcademicYear>`select * from academic_years where user_id = ${userId} and school_id = ${sid}`,
    sql<Term>`select * from terms where user_id = ${userId} and school_id = ${sid} order by term_number`,
    sql<Assessment>`select * from assessments where user_id = ${userId} and school_id = ${sid} order by due_date`,
    sql<AssessmentScore>`select * from assessment_scores where user_id = ${userId}`,
    sql<ResultSubmission>`select * from result_submissions where user_id = ${userId} and school_id = ${sid}`,
    sql<StudentResult>`select * from student_results where user_id = ${userId} and school_id = ${sid}`,
    sql<Attendance>`select * from attendance where user_id = ${userId} and school_id = ${sid} order by date desc`,
    sql<BehaviourRecord>`select * from behaviour_records where user_id = ${userId} and school_id = ${sid} order by date desc`,
    sql<FeeStructure>`select * from fee_structures where user_id = ${userId} and school_id = ${sid}`,
    sql<StudentCharge>`select * from student_charges where user_id = ${userId} and school_id = ${sid}`,
    sql<Payment>`select * from payments where user_id = ${userId} and school_id = ${sid} order by payment_date desc`,
    sql<Announcement>`select * from announcements where user_id = ${userId} and school_id = ${sid} order by created_at desc`,
    sql<Notification>`select * from notifications where user_id = ${userId} and school_id = ${sid} order by created_at desc`,
    sql<AuditLog>`select * from audit_logs where user_id = ${userId} order by created_at desc limit 40`,
    sql<CalendarEvent>`select * from calendar_events where user_id = ${userId} and school_id = ${sid} order by event_date`,
  ]);

  return {
    schools,
    school,
    staff,
    classes,
    subjects,
    assignments,
    students,
    parents,
    parentLinks,
    years,
    terms,
    assessments,
    scores,
    submissions,
    results,
    attendance,
    behaviour,
    fees,
    charges,
    payments,
    announcements,
    notifications,
    audit,
    events,
  };
}

export const getSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolSlug?: string }) => data ?? {})
  .handler(async ({ context, data }) => {
    return loadSnapshot(context.userId, data.schoolSlug ?? "sunrise");
  });

async function audit(
  userId: string,
  schoolId: string,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  detail: string,
) {
  const sql = await getSql();
  await sql.query(
    `insert into audit_logs (id, user_id, school_id, actor, action, entity_type, entity_id, detail)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [nid(userId, `au-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`), userId, schoolId, actor, action, entityType, entityId, detail],
  );
}

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { studentId: string; date: string; status: string; classId?: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureWorkspace(sql, context.userId);
    const existing = await sql<{ id: string }>`
      select id from attendance
      where user_id = ${context.userId} and student_id = ${data.studentId} and date = ${data.date}
    `;
    if (existing[0]) {
      await sql.query(
        `update attendance set status = $1 where id = $2 and user_id = $3`,
        [data.status, existing[0].id, context.userId],
      );
    } else {
      const stu = await sql<{ school_id: string; class_id: string | null }>`
        select school_id, class_id from students where id = ${data.studentId} and user_id = ${context.userId}
      `;
      if (!stu[0]) throw new Error("Student not found");
      await sql.query(
        `insert into attendance (id, user_id, school_id, student_id, class_id, date, status, recorded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          nid(context.userId, `att-${data.studentId}-${data.date}`),
          context.userId,
          stu[0].school_id,
          data.studentId,
          data.classId ?? stu[0].class_id,
          data.date,
          data.status,
          "Register",
        ],
      );
    }
    return { ok: true };
  });

export const saveMarks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      resultId: string;
      continuous: number;
      exam: number;
      comment?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const overall = Math.round(data.continuous * 0.4 + data.exam * 0.6);
    await sql.query(
      `update student_results
       set continuous_score = $1, exam_score = $2, overall_score = $3, grade = $4, teacher_comment = $5
       where id = $6 and user_id = $7 and status in ('DRAFT','RETURNED')`,
      [
        data.continuous,
        data.exam,
        overall,
        gradeFromScore(overall),
        data.comment ?? null,
        data.resultId,
        context.userId,
      ],
    );
    return { ok: true, overall, grade: gradeFromScore(overall) };
  });

const NEXT: Record<string, ResultStatus> = {
  DRAFT: "SUBMITTED",
  SUBMITTED: "UNDER_REVIEW",
  UNDER_REVIEW: "VERIFIED",
  VERIFIED: "APPROVED",
  APPROVED: "READY_TO_PUBLISH",
  READY_TO_PUBLISH: "PUBLISHED",
  RETURNED: "SUBMITTED",
};

export const advanceSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: { submissionId: string; action: "submit" | "review" | "verify" | "approve" | "ready" | "return"; note?: string }) =>
      data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<ResultSubmission>`
      select * from result_submissions where id = ${data.submissionId} and user_id = ${context.userId}
    `;
    const sub = rows[0];
    if (!sub) throw new Error("Submission not found");

    let next: ResultStatus = sub.status;
    const now = new Date().toISOString();
    if (data.action === "return") next = "RETURNED";
    else if (data.action === "submit") next = sub.status === "RETURNED" ? "SUBMITTED" : NEXT[sub.status] ?? sub.status;
    else if (data.action === "review") next = "UNDER_REVIEW";
    else if (data.action === "verify") next = "VERIFIED";
    else if (data.action === "approve") next = "APPROVED";
    else if (data.action === "ready") next = "READY_TO_PUBLISH";

    await sql.query(
      `update result_submissions
       set status = $1,
           submitted_at = coalesce(submitted_at, case when $1 in ('SUBMITTED','UNDER_REVIEW','VERIFIED','APPROVED','READY_TO_PUBLISH','PUBLISHED') then $2::timestamptz else null end),
           reviewed_at = case when $1 in ('VERIFIED','APPROVED','READY_TO_PUBLISH','PUBLISHED') then coalesce(reviewed_at, $2::timestamptz) else reviewed_at end,
           approved_at = case when $1 in ('APPROVED','READY_TO_PUBLISH','PUBLISHED') then coalesce(approved_at, $2::timestamptz) else approved_at end
       where id = $3 and user_id = $4`,
      [next, now, data.submissionId, context.userId],
    );
    await sql.query(
      `update student_results set status = $1
       where user_id = $2 and term_id = $3 and subject_id = $4
         and student_id in (select id from students where class_id = $5 and user_id = $2)`,
      [next, context.userId, sub.term_id, sub.subject_id, sub.class_id],
    );
    await audit(
      context.userId,
      sub.school_id,
      "Staff",
      data.action.toUpperCase() + "_MARKS",
      "result_submissions",
      sub.id,
      `Moved ${sub.id} from ${sub.status} to ${next}`,
    );
    return { ok: true, status: next };
  });

export const publishResults = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { classId: string; termId: string; actor?: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const now = new Date().toISOString();
    const subs = await sql<ResultSubmission>`
      select * from result_submissions
      where user_id = ${context.userId} and class_id = ${data.classId} and term_id = ${data.termId}
    `;
    if (subs.length === 0) throw new Error("No submissions for this class and term");
    const blocked = subs.filter((s) => s.status !== "APPROVED" && s.status !== "READY_TO_PUBLISH" && s.status !== "PUBLISHED");
    if (blocked.length) {
      throw new Error(
        `Cannot publish until every subject is approved. Still pending: ${blocked.length}.`,
      );
    }

    const students = await sql<Student>`
      select * from students where user_id = ${context.userId} and class_id = ${data.classId}
    `;
    const results = await sql<StudentResult>`
      select * from student_results
      where user_id = ${context.userId} and term_id = ${data.termId}
        and student_id in (select id from students where class_id = ${data.classId} and user_id = ${context.userId})
    `;

    const averages = students.map((st) => {
      const mine = results.filter((r) => r.student_id === st.id);
      const avg =
        mine.length === 0
          ? 0
          : mine.reduce((a, r) => a + num(r.overall_score), 0) / mine.length;
      return { id: st.id, avg };
    });
    averages.sort((a, b) => b.avg - a.avg);

    for (let i = 0; i < averages.length; i++) {
      await sql.query(
        `update student_results set status = 'PUBLISHED', position = $1
         where user_id = $2 and student_id = $3 and term_id = $4`,
        [i + 1, context.userId, averages[i]!.id, data.termId],
      );
    }

    await sql.query(
      `update result_submissions
       set status = 'PUBLISHED', published_at = $1::timestamptz, published_by = $2
       where user_id = $3 and class_id = $4 and term_id = $5`,
      [now, data.actor ?? "Authorized publisher", context.userId, data.classId, data.termId],
    );

    const schoolId = subs[0]!.school_id;
    const cls = await sql<ClassRow>`select * from classes where id = ${data.classId} and user_id = ${context.userId}`;
    const classLabel = cls[0] ? `${cls[0].name}${cls[0].stream ? " " + cls[0].stream : ""}` : "class";

    await sql.query(
      `insert into notifications (id, user_id, school_id, title, message, channel, event_type)
       values ($1,$2,$3,$4,$5,'IN_APP','RESULT_PUBLISHED'),
              ($6,$2,$3,$4,$5,'SMS','RESULT_PUBLISHED'),
              ($7,$2,$3,$4,$5,'PUSH','RESULT_PUBLISHED')`,
      [
        nid(context.userId, `nt-pub-${Date.now()}-a`),
        context.userId,
        schoolId,
        "Results published",
        `${classLabel} results are now visible to verified parents.`,
        nid(context.userId, `nt-pub-${Date.now()}-b`),
        nid(context.userId, `nt-pub-${Date.now()}-c`),
      ],
    );

    await audit(
      context.userId,
      schoolId,
      data.actor ?? "Authorized publisher",
      "PUBLISH_RESULTS",
      "result_submissions",
      data.classId,
      `Published ${classLabel} results for ${students.length} students.`,
    );

    // Notify parents (SMS + email) for each student in class
    try {
      await notifyLinkedParents(sql, schoolId, students.map((s) => s.id), {
        event: "RESULT_PUBLISHED",
        sms: (name) =>
          `Results for ${name} (${classLabel}) are now available in the parent app.`,
        emailSubject: `Results published — ${classLabel}`,
        emailBody: (name) =>
          `Results for ${name} in ${classLabel} have been published. Open the parent app to view them.`,
      });
    } catch (e) {
      console.error("[notify] publish results", e);
    }

    return { ok: true, students: students.length };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      chargeId: string;
      amount: number;
      method: string;
      reference?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const charges = await sql<StudentCharge>`
      select * from student_charges where id = ${data.chargeId}
    `;
    const ch = charges[0];
    if (!ch) throw new Error("Charge not found");
    await requirePermission(context.userId, ch.school_id, "finance.manage");
    const paid = num(ch.paid) + data.amount;
    const amount = num(ch.amount);
    const status = paid >= amount - 0.5 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    await sql.query(
      `update student_charges set paid = $1, status = $2 where id = $3 and user_id = $4`,
      [paid, status, ch.id, context.userId],
    );
    const receipt = `SA-2026-${String(4000 + Math.floor(Math.random() * 900)).padStart(4, "0")}`;
    const payId = nid(context.userId, `pay-${Date.now()}`);
    await sql.query(
      `insert into payments (id, user_id, school_id, student_id, amount, method, reference, payment_date, status, recorded_by, receipt_number)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'VERIFIED',$9,$10)`,
      [
        payId,
        context.userId,
        ch.school_id,
        ch.student_id,
        data.amount,
        data.method,
        data.reference ?? null,
        new Date().toISOString().slice(0, 10),
        "Bursar",
        receipt,
      ],
    );
    try {
      await sql.query(
        `insert into receipts (id, payment_id, school_id, receipt_number, issued_by)
         values ($1,$2,$3,$4,$5)`,
        [nid(context.userId, `rcpt-${Date.now()}`), payId, ch.school_id, receipt, context.userId],
      );
    } catch { /* receipts table may be new */ }

    await audit(
      context.userId,
      ch.school_id,
      "Bursar",
      "RECORD_PAYMENT",
      "payments",
      payId,
      `Recorded ${data.method} ${data.amount} receipt ${receipt}.`,
    );
    return { ok: true, receipt, status, paymentId: payId };
  });

export const addStudent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      firstName: string;
      lastName: string;
      gender: string;
      classId: string;
      admissionNumber: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureWorkspace(sql, context.userId);
    const school = await sql<School>`
      select * from schools where id = ${data.schoolId} and user_id = ${context.userId}
    `;
    if (!school[0]) throw new Error("School not found");
    const sid = nid(context.userId, `stu-${Date.now()}`);
    await sql.query(
      `insert into students (id, user_id, school_id, admission_number, first_name, last_name, gender, class_id, status, admission_date)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9)`,
      [
        sid,
        context.userId,
        data.schoolId,
        data.admissionNumber,
        data.firstName.trim(),
        data.lastName.trim(),
        data.gender,
        data.classId,
        new Date().toISOString().slice(0, 10),
      ],
    );
    await audit(
      context.userId,
      data.schoolId,
      "Registrar",
      "CREATE_STUDENT",
      "students",
      sid,
      `Enrolled ${data.firstName} ${data.lastName} (${data.admissionNumber}).`,
    );
    return { ok: true, id: sid };
  });

export const addBehaviour = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      studentId: string;
      category: string;
      kind: "POSITIVE" | "NEGATIVE";
      description: string;
      points: number;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const stu = await sql<Student>`
      select * from students where id = ${data.studentId} and user_id = ${context.userId}
    `;
    if (!stu[0]) throw new Error("Student not found");
    const bid = nid(context.userId, `beh-${Date.now()}`);
    await sql.query(
      `insert into behaviour_records (id, user_id, school_id, student_id, category, kind, severity, points, description, date, status, recorded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'OPEN',$11)`,
      [
        bid,
        context.userId,
        stu[0].school_id,
        data.studentId,
        data.category,
        data.kind,
        Math.abs(data.points) >= 8 ? "High" : Math.abs(data.points) >= 4 ? "Medium" : "Low",
        data.points,
        data.description,
        new Date().toISOString().slice(0, 10),
        "Staff",
      ],
    );
    try {
      const school = await sql<School>`select * from schools where id = ${stu[0].school_id} limit 1`;
      await notifyLinkedParents(sql, stu[0].school_id, [data.studentId], {
        event: "BEHAVIOUR",
        sms: (name) =>
          `${school[0]?.name || "School"}: Behaviour note for ${name} (${data.kind}). ${data.description.slice(0, 80)}`,
        emailSubject: `Behaviour note — ${data.kind}`,
        emailBody: (name) =>
          `A behaviour record was added for ${name}: ${data.category} (${data.kind}). ${data.description}`,
      });
    } catch (e) {
      console.error("[notify] behaviour", e);
    }
    return { ok: true };
  });

export const addAnnouncement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; title: string; body: string; audience: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const school = await sql<School>`
      select id from schools where id = ${data.schoolId} and user_id = ${context.userId}
    `;
    if (!school[0]) throw new Error("School not found");
    await sql.query(
      `insert into announcements (id, user_id, school_id, title, body, audience, author)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        nid(context.userId, `an-${Date.now()}`),
        context.userId,
        data.schoolId,
        data.title.trim(),
        data.body.trim(),
        data.audience,
        "School office",
      ],
    );
    try {
      // Broadcast to all parents of school (SMS/email)
      const parents = await sql<Parent>`
        select * from parents where school_id = ${data.schoolId}
      `;
      const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
      for (const p of parents) {
        if (p.phone && (p as { notify_sms?: boolean }).notify_sms !== false) {
          await logSms(
            sql,
            data.schoolId,
            p.phone,
            `${school[0]?.name || "School"}: ${data.title.trim()}`,
            "ANNOUNCEMENT",
          );
        }
        if (p.email && (p as { notify_email?: boolean }).notify_email !== false) {
          await sendEmail({
            to: p.email,
            subject: data.title.trim(),
            text: data.body.trim(),
            html: `<p>${data.body.trim().replace(/\n/g, "<br/>")}</p>`,
          });
        }
      }
    } catch (e) {
      console.error("[notify] announcement", e);
    }
    return { ok: true };
  });

export const updateSchool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: { schoolId: string; motto?: string; phone?: string; email?: string; status?: string }) =>
      data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.motto !== undefined) {
      await sql.query(`update schools set motto = $1 where id = $2 and user_id = $3`, [
        data.motto,
        data.schoolId,
        context.userId,
      ]);
    }
    if (data.phone !== undefined) {
      await sql.query(`update schools set phone = $1 where id = $2 and user_id = $3`, [
        data.phone,
        data.schoolId,
        context.userId,
      ]);
    }
    if (data.email !== undefined) {
      await sql.query(`update schools set email = $1 where id = $2 and user_id = $3`, [
        data.email,
        data.schoolId,
        context.userId,
      ]);
    }
    if (data.status !== undefined) {
      await sql.query(`update schools set status = $1 where id = $2 and user_id = $3`, [
        data.status,
        data.schoolId,
        context.userId,
      ]);
    }
    return { ok: true };
  });

export const activateSchool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update schools set status = 'ACTIVE' where id = $1 and user_id = $2`,
      [data.schoolId, context.userId],
    );
    await audit(
      context.userId,
      data.schoolId,
      "Platform owner",
      "ACTIVATE_SCHOOL",
      "schools",
      data.schoolId,
      "Activation payment verified. School set to ACTIVE.",
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Platform Owner: create school + invite owner
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "school";
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createSchoolInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolName: string;
      ownerName: string;
      ownerEmail: string;
      city?: string;
      activationFee?: number;
      plan?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const name = data.schoolName.trim();
    const ownerEmail = data.ownerEmail.trim().toLowerCase();
    const ownerName = data.ownerName.trim();
    if (!name || !ownerEmail || !ownerName) {
      throw new Error("School name, owner name and owner email are required");
    }

    // Unique slug
    let base = slugify(name);
    let slug = base;
    let n = 1;
    while (true) {
      const existing = await sql<{ id: string }>`
        select id from schools where slug = ${slug} limit 1
      `;
      if (!existing[0]) break;
      n += 1;
      slug = `${base}-${n}`;
    }

    const schoolId = nid(context.userId, `sch-${Date.now()}`);
    const inviteToken = randomToken(32);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const parentAppSlug = slug;

    await sql.query(
      `insert into schools (
        id, user_id, slug, name, city, country, status,
        subscription_plan, activation_fee, logo_mark,
        primary_color, secondary_color, timezone, currency,
        owner_name, owner_email, invite_token, invite_expires_at,
        created_by, parent_app_slug, parent_app_name
      ) values (
        $1,$2,$3,$4,$5,'Malawi','PENDING_PAYMENT',
        $6,$7,$8,
        '#0f766e','#134e4a','Africa/Blantyre','MWK',
        $9,$10,$11,$12,
        $13,$14,$15
      )`,
      [
        schoolId,
        context.userId, // temporary: still owned by platform user for isolation compat
        slug,
        name,
        data.city?.trim() || null,
        data.plan || "Standard",
        data.activationFee ?? 150000,
        name.slice(0, 2).toUpperCase(),
        ownerName,
        ownerEmail,
        inviteToken,
        expires.toISOString(),
        context.userId,
        parentAppSlug,
        `${name} Parent`,
      ],
    );

    // Also record in school_invites for cleaner lookup
    const inviteId = nid(context.userId, `inv-${Date.now()}`);
    await sql.query(
      `insert into school_invites (id, school_id, email, token, role, expires_at, created_by)
       values ($1,$2,$3,$4,'owner',$5,$6)`,
      [inviteId, schoolId, ownerEmail, inviteToken, expires.toISOString(), context.userId],
    );

    await audit(
      context.userId,
      schoolId,
      "Platform owner",
      "CREATE_SCHOOL_INVITE",
      "schools",
      schoolId,
      `Invited ${ownerName} <${ownerEmail}> as school owner`,
    );

    // In production this would send a real email (Resend / Postmark / SMTP).
    // For now we return the link so the Platform Owner can copy & send it.
    const baseUrl =
      (typeof process !== "undefined" && process.env.BETTER_AUTH_URL) ||
      (typeof process !== "undefined" && process.env.VITE_APP_URL) ||
      "http://localhost:8080";
    const inviteLink = `${baseUrl.replace(/\/$/, "")}/set-password?token=${inviteToken}`;

    console.log("[NEXUS] School invite created:", {
      school: name,
      ownerEmail,
      inviteLink,
    });

    const mail = schoolInviteEmail({
      ownerName,
      schoolName: name,
      inviteLink,
    });
    const emailResult = await sendEmail({
      to: ownerEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    return {
      ok: true,
      schoolId,
      slug,
      inviteToken,
      inviteLink,
      expiresAt: expires.toISOString(),
      ownerEmail,
      ownerName,
      schoolName: name,
      emailSent: emailResult.ok,
      emailProvider: emailResult.provider,
      emailError: emailResult.error,
    };
  });

export const getInviteByToken = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const token = data.token?.trim();
    if (!token) throw new Error("Token required");

    const rows = await sql<{
      id: string;
      name: string;
      owner_name: string | null;
      owner_email: string | null;
      invite_token: string | null;
      invite_expires_at: string | null;
      password_set_at: string | null;
      status: string;
    }>`
      select id, name, owner_name, owner_email, invite_token, invite_expires_at, password_set_at, status
      from schools
      where invite_token = ${token}
      limit 1
    `;
    const school = rows[0];
    if (!school) throw new Error("Invalid or expired invite link");

    if (school.password_set_at) {
      throw new Error("This invite has already been used. Please sign in instead.");
    }
    if (school.invite_expires_at && new Date(school.invite_expires_at) < new Date()) {
      throw new Error("This invite link has expired. Contact the platform owner for a new one.");
    }

    return {
      schoolId: school.id,
      schoolName: school.name,
      ownerName: school.owner_name,
      ownerEmail: school.owner_email,
      status: school.status,
    };
  });

export const completeSchoolOwnerSetup = createServerFn({ method: "POST" })
  .validator(
    (data: { token: string; password: string; name?: string }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const token = data.token?.trim();
    const password = data.password;
    if (!token || !password || password.length < 8) {
      throw new Error("Token and a password of at least 8 characters are required");
    }

    const rows = await sql<{
      id: string;
      name: string;
      owner_name: string | null;
      owner_email: string | null;
      invite_token: string | null;
      invite_expires_at: string | null;
      password_set_at: string | null;
      user_id: string;
    }>`
      select id, name, owner_name, owner_email, invite_token, invite_expires_at, password_set_at, user_id
      from schools
      where invite_token = ${token}
      limit 1
    `;
    const school = rows[0];
    if (!school) throw new Error("Invalid or expired invite link");
    if (school.password_set_at) {
      throw new Error("This invite has already been used");
    }
    if (school.invite_expires_at && new Date(school.invite_expires_at) < new Date()) {
      throw new Error("This invite link has expired");
    }
    if (!school.owner_email) throw new Error("School has no owner email");

    // Mark password set + clear token so it cannot be reused
    await sql.query(
      `update schools
       set password_set_at = now(),
           invite_token = null,
           status = case when status = 'PENDING_PAYMENT' then 'PENDING_PAYMENT' else status end
       where id = $1`,
      [school.id],
    );

    // Mark invite used
    await sql.query(
      `update school_invites set used_at = now() where token = $1`,
      [token],
    );

    // Membership will be linked once Better Auth user exists; client passes nothing here.
    // We store owner intent; linkMembershipAfterSignup handles post-signup binding.
    try {
      await sql.query(
        `insert into school_setup_progress (school_id) values ($1)
         on conflict (school_id) do nothing`,
        [school.id],
      );
    } catch { /* table may be fresh */ }

    await audit(
      school.user_id,
      school.id,
      school.owner_name || "School owner",
      "OWNER_PASSWORD_SET",
      "schools",
      school.id,
      "School owner set password via invite link",
    );

    // Return info so the client can sign the user up / in via Better Auth
    return {
      ok: true,
      schoolId: school.id,
      schoolName: school.name,
      ownerEmail: school.owner_email,
      ownerName: data.name?.trim() || school.owner_name,
      // Client will call Better Auth signUp / set password using this email
    };
  });

// ---------------------------------------------------------------------------
// Parent App: branding + publish install link
// ---------------------------------------------------------------------------

export const publishParentApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      appName: string;
      primaryColor?: string;
      secondaryColor?: string;
      logoMark?: string;
      resultsEnabled?: boolean;
      attendanceEnabled?: boolean;
      behaviourEnabled?: boolean;
      feesEnabled?: boolean;
      assignmentsEnabled?: boolean;
      messagesEnabled?: boolean;
      documentsEnabled?: boolean;
      calendarEnabled?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where id = ${data.schoolId} and user_id = ${context.userId} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    const appName = data.appName.trim() || `${school.name} Parent`;
    let parentAppSlug = school.parent_app_slug || school.slug;
    if (!parentAppSlug) {
      parentAppSlug = slugify(school.name);
    }

    // Ensure unique parent_app_slug
    let slug = parentAppSlug;
    let n = 1;
    while (true) {
      const clash = await sql<{ id: string }>`
        select id from schools where parent_app_slug = ${slug} and id <> ${school.id} limit 1
      `;
      if (!clash[0]) break;
      n += 1;
      slug = `${parentAppSlug}-${n}`;
    }

    const primary = data.primaryColor || school.primary_color || "#0f766e";
    const secondary = data.secondaryColor || school.secondary_color || "#134e4a";
    const logoMark = data.logoMark || school.logo_mark || school.name.slice(0, 2).toUpperCase();

    const baseUrl =
      (typeof process !== "undefined" && process.env.BETTER_AUTH_URL) ||
      (typeof process !== "undefined" && process.env.VITE_APP_URL) ||
      "http://localhost:8080";
    const installUrl = `${baseUrl.replace(/\/$/, "")}/p/${slug}`;

    await sql.query(
      `update schools set
         parent_app_name = $1,
         parent_app_slug = $2,
         primary_color = $3,
         secondary_color = $4,
         logo_mark = $5
       where id = $6`,
      [appName, slug, primary, secondary, logoMark, school.id],
    );

    // Upsert parent_app_settings
    const existing = await sql<{ id: string }>`
      select id from parent_app_settings where school_id = ${school.id} limit 1
    `;
    const settingsId = existing[0]?.id || nid(context.userId, `pas-${Date.now()}`);
    if (existing[0]) {
      await sql.query(
        `update parent_app_settings set
           app_name = $1,
           primary_color = $2,
           secondary_color = $3,
           splash_color = $2,
           results_enabled = $4,
           attendance_enabled = $5,
           behaviour_enabled = $6,
           fees_enabled = $7,
           assignments_enabled = $8,
           messages_enabled = $9,
           documents_enabled = $10,
           calendar_enabled = $11,
           published_at = now(),
           install_url = $12,
           updated_at = now()
         where school_id = $13`,
        [
          appName,
          primary,
          secondary,
          data.resultsEnabled ?? true,
          data.attendanceEnabled ?? true,
          data.behaviourEnabled ?? true,
          data.feesEnabled ?? true,
          data.assignmentsEnabled ?? true,
          data.messagesEnabled ?? true,
          data.documentsEnabled ?? true,
          data.calendarEnabled ?? true,
          installUrl,
          school.id,
        ],
      );
    } else {
      await sql.query(
        `insert into parent_app_settings (
           id, school_id, app_name, primary_color, secondary_color, splash_color,
           results_enabled, attendance_enabled, behaviour_enabled, fees_enabled,
           assignments_enabled, messages_enabled, documents_enabled, calendar_enabled,
           published_at, install_url
         ) values (
           $1,$2,$3,$4,$5,$4,
           $6,$7,$8,$9,
           $10,$11,$12,$13,
           now(),$14
         )`,
        [
          settingsId,
          school.id,
          appName,
          primary,
          secondary,
          data.resultsEnabled ?? true,
          data.attendanceEnabled ?? true,
          data.behaviourEnabled ?? true,
          data.feesEnabled ?? true,
          data.assignmentsEnabled ?? true,
          data.messagesEnabled ?? true,
          data.documentsEnabled ?? true,
          data.calendarEnabled ?? true,
          installUrl,
        ],
      );
    }

    await audit(
      context.userId,
      school.id,
      "School owner",
      "PUBLISH_PARENT_APP",
      "parent_app_settings",
      settingsId,
      `Published parent app “${appName}” at ${installUrl}`,
    );

    return {
      ok: true,
      installUrl,
      slug,
      appName,
      primaryColor: primary,
      secondaryColor: secondary,
      logoMark,
    };
  });

/** Public: load school branding + public parent snapshot by parent_app_slug */
export const getParentPortal = createServerFn({ method: "POST" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = data.slug?.trim();
    if (!slug) throw new Error("School slug required");

    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${slug} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("Parent app not found. Check the link from your school.");

    if (school.status === "SUSPENDED" || school.status === "CANCELLED") {
      throw new Error("This school’s parent app is currently unavailable.");
    }

    const settingsRows = await sql<ParentAppSettings>`
      select * from parent_app_settings where school_id = ${school.id} limit 1
    `;
    const settings = settingsRows[0] || null;

    // Load a limited public-ish snapshot scoped to this school only.
    // For the demo we still use the workspace user_id that owns the school.
    const userId = school.user_id;
    const sid = school.id;

    const [students, parents, parentLinks, results, attendance, behaviour, charges, payments, announcements] =
      await Promise.all([
        sql<Student>`select * from students where user_id = ${userId} and school_id = ${sid} and status = 'ACTIVE' order by last_name, first_name`,
        sql<Parent>`select * from parents where user_id = ${userId} and school_id = ${sid} order by full_name`,
        sql<ParentStudent>`select * from parent_students where user_id = ${userId}`,
        sql<StudentResult>`select * from student_results where user_id = ${userId} and school_id = ${sid} and status = 'PUBLISHED'`,
        sql<Attendance>`select * from attendance where user_id = ${userId} and school_id = ${sid} order by date desc limit 200`,
        sql<BehaviourRecord>`select * from behaviour_records where user_id = ${userId} and school_id = ${sid} order by date desc limit 100`,
        sql<StudentCharge>`select * from student_charges where user_id = ${userId} and school_id = ${sid}`,
        sql<Payment>`select * from payments where user_id = ${userId} and school_id = ${sid} order by payment_date desc limit 50`,
        sql<Announcement>`select * from announcements where user_id = ${userId} and school_id = ${sid} order by created_at desc limit 20`,
      ]);

    const classes = await sql<ClassRow>`
      select * from classes where user_id = ${userId} and school_id = ${sid} order by level_order desc
    `;

    return {
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        parent_app_slug: school.parent_app_slug,
        parent_app_name: school.parent_app_name || settings?.app_name || `${school.name} Parent`,
        logo_mark: school.logo_mark,
        primary_color: school.primary_color || settings?.primary_color || "#0f766e",
        secondary_color: school.secondary_color || settings?.secondary_color || "#134e4a",
        motto: school.motto,
        phone: school.phone,
        email: school.email,
        city: school.city,
        status: school.status,
      },
      settings: settings
        ? {
            results_enabled: settings.results_enabled,
            attendance_enabled: settings.attendance_enabled,
            behaviour_enabled: settings.behaviour_enabled,
            fees_enabled: settings.fees_enabled,
            assignments_enabled: settings.assignments_enabled,
            messages_enabled: settings.messages_enabled,
            documents_enabled: settings.documents_enabled,
            calendar_enabled: settings.calendar_enabled,
            install_url: settings.install_url,
            published_at: settings.published_at,
          }
        : {
            results_enabled: true,
            attendance_enabled: true,
            behaviour_enabled: true,
            fees_enabled: true,
            assignments_enabled: true,
            messages_enabled: true,
            documents_enabled: true,
            calendar_enabled: true,
            install_url: null,
            published_at: null,
          },
      students,
      parents,
      parentLinks,
      results,
      attendance,
      behaviour,
      charges,
      payments,
      announcements,
      classes,
    };
  });

// ---------------------------------------------------------------------------
// Parent phone OTP + SMS foundation
// ---------------------------------------------------------------------------

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  // Accept local Malawi-style and international
  if (digits.startsWith("0") && digits.length >= 9) {
    return "+265" + digits.slice(1);
  }
  if (digits.startsWith("265") && !digits.startsWith("+")) {
    return "+" + digits;
  }
  return digits.startsWith("+") ? digits : digits;
}

function hashCode(code: string): string {
  // Lightweight non-crypto hash for demo; replace with bcrypt/argon in production
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (Math.imul(31, h) + code.charCodeAt(i)) | 0;
  return `h${Math.abs(h).toString(16)}`;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function logSms(
  sql: Awaited<ReturnType<typeof getSql>>,
  schoolId: string,
  recipient: string,
  message: string,
  eventType: string,
  opts?: { usePlatformSms?: boolean },
) {
  const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let result;
  if (opts?.usePlatformSms) {
    result = await sendSmsWithCredentials(recipient, message, platformSmsCredentials());
  } else {
    // Prefer school httpSMS account
    let creds = null;
    try {
      const rows = await sql<{ api_key: string | null; from_number: string | null; enabled: boolean; provider: string }>`
        select api_key, from_number, enabled, provider from school_sms_settings where school_id = ${schoolId} limit 1
      `;
      if (rows[0]?.enabled && rows[0].api_key) {
        creds = {
          provider: rows[0].provider || "httpsms",
          apiKey: rows[0].api_key,
          fromNumber: rows[0].from_number,
        };
      }
    } catch { /* table may not exist yet */ }
    result = await sendSmsWithCredentials(recipient, message, creds);
  }
  const status = result.ok ? "SENT" : "FAILED";
  await sql.query(
    `insert into sms_logs (id, school_id, recipient, message, event_type, provider, provider_reference, status, error_message, sent_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
    [
      id,
      schoolId,
      recipient,
      message,
      eventType,
      result.provider,
      result.providerReference || null,
      status,
      result.error || null,
    ],
  );
  return { id, ...result };
}


/** Notify parents linked to the given students via SMS and email. */
async function notifyLinkedParents(
  sql: Awaited<ReturnType<typeof getSql>>,
  schoolId: string,
  studentIds: string[],
  opts: {
    event: string;
    sms: (studentName: string) => string;
    emailSubject: string;
    emailBody: (studentName: string) => string;
  },
) {
  if (!studentIds.length) return;
  const links = await sql<{ parent_id: string; student_id: string }>`
    select parent_id, student_id from parent_students
    where student_id = any(${studentIds}::text[])
  `;
  const parentIds = [...new Set(links.map((l) => l.parent_id))];
  if (!parentIds.length) return;
  const parents = await sql<Parent>`
    select * from parents where id = any(${parentIds}::text[])
  `;
  const students = await sql<Student>`
    select * from students where id = any(${studentIds}::text[])
  `;
  const studentById = new Map(students.map((s) => [s.id, s]));
  const parentStudents = new Map<string, string[]>();
  for (const l of links) {
    const arr = parentStudents.get(l.parent_id) || [];
    arr.push(l.student_id);
    parentStudents.set(l.parent_id, arr);
  }

  for (const p of parents) {
    const sids = parentStudents.get(p.id) || [];
    for (const sid of sids) {
      const st = studentById.get(sid);
      const name = st ? `${st.first_name} ${st.last_name}` : "your child";
      if (p.phone) {
        try {
          await logSms(sql, schoolId, p.phone, opts.sms(name), opts.event);
        } catch (e) {
          console.error("SMS notify fail", e);
        }
      }
      if (p.email) {
        try {
          await sendEmail({
            to: p.email,
            subject: opts.emailSubject,
            text: opts.emailBody(name),
            html: `<p>${opts.emailBody(name)}</p>`,
          });
        } catch (e) {
          console.error("Email notify fail", e);
        }
      }
    }
  }
}


/** Request OTP for parent app login. Phone must match a registered parent for this school. */
export const requestParentOtp = createServerFn({ method: "POST" })
  .validator((data: { slug: string; phone: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = data.slug?.trim();
    const phone = normalizePhone(data.phone || "");
    if (!slug || phone.length < 8) throw new Error("School and a valid phone number are required");

    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${slug} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("Parent app not found");

    // Find parent by phone within this school (flexible match on last 9 digits)
    const last9 = phone.replace(/\D/g, "").slice(-9);
    const parents = await sql<Parent>`
      select * from parents
      where user_id = ${school.user_id}
        and school_id = ${school.id}
        and (
          replace(replace(coalesce(phone,''), ' ', ''), '-', '') like ${"%" + last9}
          or phone = ${phone}
          or phone = ${data.phone.trim()}
        )
      limit 5
    `;
    if (!parents[0]) {
      throw new Error(
        "No parent registered with this phone for this school. Contact the school office.",
      );
    }

    const code = generateOtp();
    const challengeId = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await sql.query(
      `insert into parent_otp_challenges (id, school_id, phone, code_hash, expires_at)
       values ($1,$2,$3,$4,$5)`,
      [challengeId, school.id, phone, hashCode(code), expires.toISOString()],
    );

    const msg = `${school.parent_app_name || school.name}: Your login code is ${code}. Valid 10 minutes.`;
    await logSms(sql, school.id, phone, msg, "OTP");

    // In production never return the code. For local/demo we include it so testing is easy.
    const isDev =
      !process.env.DATABASE_URL ||
      process.env.NODE_ENV !== "production" ||
      process.env.VITE_AUTH_ENABLED === "false";

    return {
      ok: true,
      challengeId,
      phone,
      expiresAt: expires.toISOString(),
      // Demo only:
      demoCode: isDev ? code : undefined,
      message: isDev
        ? `Demo OTP: ${code} (also logged to server console / SMS log)`
        : "OTP sent by SMS",
    };
  });

/** Verify OTP and create a parent session token */
export const verifyParentOtp = createServerFn({ method: "POST" })
  .validator((data: { slug: string; phone: string; code: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = data.slug?.trim();
    const phone = normalizePhone(data.phone || "");
    const code = (data.code || "").trim();
    if (!slug || !phone || code.length < 4) throw new Error("Phone and code are required");

    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${slug} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("Parent app not found");

    const challenges = await sql<{
      id: string;
      code_hash: string;
      expires_at: string;
      attempts: number;
      consumed_at: string | null;
    }>`
      select id, code_hash, expires_at, attempts, consumed_at
      from parent_otp_challenges
      where school_id = ${school.id}
        and phone = ${phone}
        and consumed_at is null
      order by created_at desc
      limit 1
    `;
    const challenge = challenges[0];
    if (!challenge) throw new Error("No active code. Request a new one.");
    if (new Date(challenge.expires_at) < new Date()) {
      throw new Error("Code expired. Request a new one.");
    }
    if (challenge.attempts >= 5) {
      throw new Error("Too many attempts. Request a new code.");
    }

    if (challenge.code_hash !== hashCode(code)) {
      await sql.query(
        `update parent_otp_challenges set attempts = attempts + 1 where id = $1`,
        [challenge.id],
      );
      throw new Error("Incorrect code");
    }

    await sql.query(
      `update parent_otp_challenges set consumed_at = now() where id = $1`,
      [challenge.id],
    );

    const last9 = phone.replace(/\D/g, "").slice(-9);
    const parents = await sql<Parent>`
      select * from parents
      where user_id = ${school.user_id}
        and school_id = ${school.id}
        and (
          replace(replace(coalesce(phone,''), ' ', ''), '-', '') like ${"%" + last9}
          or phone = ${phone}
        )
      limit 1
    `;
    const parent = parents[0];
    if (!parent) throw new Error("Parent not found");

    const token = randomToken(32);
    const sessionId = `psess-${Date.now()}`;
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await sql.query(
      `insert into parent_sessions (id, school_id, parent_id, token, expires_at)
       values ($1,$2,$3,$4,$5)`,
      [sessionId, school.id, parent.id, token, expires.toISOString()],
    );

    await sql.query(
      `update parents set last_login_at = now(), app_installed_at = coalesce(app_installed_at, now()), sms_only = false
       where id = $1`,
      [parent.id],
    );

    return {
      ok: true,
      token,
      expiresAt: expires.toISOString(),
      parent: {
        id: parent.id,
        full_name: parent.full_name,
        phone: parent.phone,
      },
    };
  });

/** Load portal data scoped to the authenticated parent (via session token) */
export const getParentPortalSession = createServerFn({ method: "POST" })
  .validator((data: { slug: string; token: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const slug = data.slug?.trim();
    const token = data.token?.trim();
    if (!slug || !token) throw new Error("Missing session");

    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${slug} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("Parent app not found");

    const sessions = await sql<{
      id: string;
      parent_id: string;
      expires_at: string;
    }>`
      select id, parent_id, expires_at from parent_sessions
      where token = ${token} and school_id = ${school.id}
      limit 1
    `;
    const session = sessions[0];
    if (!session) throw new Error("Session expired. Please sign in again.");
    if (new Date(session.expires_at) < new Date()) {
      throw new Error("Session expired. Please sign in again.");
    }

    // Reuse getParentPortal data shape but filter to this parent's children
    const portal = await getParentPortal({ data: { slug } });
    const links = portal.parentLinks.filter((l) => l.parent_id === session.parent_id);
    const childIds = new Set(links.map((l) => l.student_id));
    const students = portal.students.filter((s) => childIds.has(s.id));
    const parent = portal.parents.find((p) => p.id === session.parent_id);

    return {
      ...portal,
      parent,
      students,
      parentLinks: links,
      results: portal.results.filter((r) => childIds.has(r.student_id)),
      attendance: portal.attendance.filter((a) => childIds.has(a.student_id)),
      behaviour: portal.behaviour.filter((b) => childIds.has(b.student_id)),
      charges: portal.charges.filter((c) => childIds.has(c.student_id)),
      payments: portal.payments.filter((p) => childIds.has(p.student_id)),
    };
  });

// ---------------------------------------------------------------------------
// Register SMS-only parent + fee reminder engine
// ---------------------------------------------------------------------------

export const registerSmsParent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      fullName: string;
      phone: string;
      studentIds: string[];
      relationship?: string;
      smsOnly?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const fullName = data.fullName.trim();
    const phoneRaw = data.phone.trim();
    if (!fullName || !phoneRaw) throw new Error("Name and phone are required");
    if (!data.studentIds?.length) throw new Error("Link at least one student");

    const schools = await sql<School>`
      select * from schools where id = ${data.schoolId} and user_id = ${context.userId} limit 1
    `;
    if (!schools[0]) throw new Error("School not found");

    const phone = normalizePhone(phoneRaw);
    const parentId = nid(context.userId, `par-${Date.now()}`);

    await sql.query(
      `insert into parents (id, user_id, school_id, full_name, phone, email, verification_status, sms_only)
       values ($1,$2,$3,$4,$5,null,'VERIFIED',$6)`,
      [
        parentId,
        context.userId,
        data.schoolId,
        fullName,
        phone,
        data.smsOnly !== false, // default true for this form
      ],
    );

    for (const studentId of data.studentIds) {
      const linkId = nid(context.userId, `ps-${Date.now()}-${studentId.slice(-4)}`);
      await sql.query(
        `insert into parent_students (id, user_id, parent_id, student_id, relationship, is_primary)
         values ($1,$2,$3,$4,$5,true)`,
        [
          linkId,
          context.userId,
          parentId,
          studentId,
          data.relationship || "Guardian",
        ],
      );
    }

    // Welcome SMS
    const schoolName = schools[0].name;
    const msg = data.smsOnly !== false
      ? `${schoolName}: You are registered for SMS updates about your child's school. Reply HELP for support.`
      : `${schoolName}: Parent account created. Install the school app: ${(schools[0].parent_app_slug && `open /p/${schools[0].parent_app_slug}`) || "contact the school"}.`;

    await logSms(sql, data.schoolId, phone, msg, "PARENT_REGISTERED");

    await audit(
      context.userId,
      data.schoolId,
      "School staff",
      "REGISTER_PARENT",
      "parents",
      parentId,
      `Registered ${fullName} (${phone}) sms_only=${data.smsOnly !== false}`,
    );

    return { ok: true, parentId, phone };
  });

/**
 * Run fee reminders for a school.
 * Sends SMS to primary parent phones for students with outstanding balances
 * when due date is within the configured windows (30/7/3/1/0 days or overdue).
 * Skips if the same event_type was already sent for that phone today.
 */
export const runFeeReminders = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; dryRun?: boolean }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where id = ${data.schoolId} and user_id = ${context.userId} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    const charges = await sql<{
      id: string;
      student_id: string;
      description: string;
      amount: string | number;
      paid: string | number;
      due_date: string | null;
      status: string;
    }>`
      select id, student_id, description, amount, paid, due_date, status
      from student_charges
      where user_id = ${context.userId}
        and school_id = ${data.schoolId}
        and status <> 'PAID'
        and (amount - paid) > 0
    `;

    const students = await sql<Student>`
      select * from students where user_id = ${context.userId} and school_id = ${data.schoolId}
    `;
    const studentById = new Map(students.map((s) => [s.id, s]));

    const links = await sql<ParentStudent>`
      select * from parent_students where user_id = ${context.userId}
    `;
    const parents = await sql<Parent>`
      select * from parents where user_id = ${context.userId} and school_id = ${data.schoolId}
    `;
    const parentById = new Map(parents.map((p) => [p.id, p]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windows: { days: number; label: string; event: string }[] = [
      { days: 30, label: "30 days before due", event: "FEE_DUE_IN_30_DAYS" },
      { days: 14, label: "14 days before due", event: "FEE_DUE_IN_14_DAYS" },
      { days: 7, label: "7 days before due", event: "FEE_DUE_IN_7_DAYS" },
      { days: 3, label: "3 days before due", event: "FEE_DUE_IN_3_DAYS" },
      { days: 1, label: "1 day before due", event: "FEE_DUE_IN_1_DAY" },
      { days: 0, label: "due today", event: "FEE_DUE_TODAY" },
      { days: -1, label: "overdue", event: "FEE_OVERDUE" },
    ];

    type ReminderItem = {
      studentName: string;
      phone: string;
      balance: number;
      dueDate: string | null;
      event: string;
      message: string;
    };
    const toSend: ReminderItem[] = [];

    for (const charge of charges) {
      if (!charge.due_date) continue;
      const due = new Date(charge.due_date);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      let matched = windows.find((w) => w.days === diffDays);
      if (!matched && diffDays < 0) {
        // overdue: send at most once per day via FEE_OVERDUE
        matched = windows.find((w) => w.event === "FEE_OVERDUE");
      }
      if (!matched) continue;

      const balance = Number(charge.amount) - Number(charge.paid);
      if (balance <= 0) continue;

      const student = studentById.get(charge.student_id);
      if (!student) continue;

      const parentLinks = links.filter((l) => l.student_id === charge.student_id);
      for (const link of parentLinks) {
        const parent = parentById.get(link.parent_id);
        if (!parent?.phone) continue;

        const studentLabel = `${student.first_name} ${student.last_name}`;
        const dueStr = charge.due_date;
        const balStr = `MWK ${Math.round(balance).toLocaleString()}`;
        let message: string;
        if (matched.event === "FEE_OVERDUE") {
          message = `${school.name}: Fee overdue for ${studentLabel}. Balance ${balStr} (due ${dueStr}). Please pay at the office or via the parent app.`;
        } else if (matched.event === "FEE_DUE_TODAY") {
          message = `${school.name}: Fee due today for ${studentLabel}. Balance ${balStr}. Please pay today.`;
        } else {
          message = `${school.name}: Fee reminder for ${studentLabel}. Balance ${balStr}, due ${dueStr} (${matched.label}).`;
        }

        toSend.push({
          studentName: studentLabel,
          phone: parent.phone,
          balance,
          dueDate: charge.due_date,
          event: matched.event,
          message,
        });
      }
    }

    // Dedupe by phone+event for today
    const sentToday = await sql<{ recipient: string; event_type: string }>`
      select recipient, event_type from sms_logs
      where school_id = ${data.schoolId}
        and event_type like 'FEE_%'
        and created_at::date = current_date
    `;
    const already = new Set(sentToday.map((r) => `${r.recipient}|${r.event_type}`));

    const unique: ReminderItem[] = [];
    const seen = new Set<string>();
    for (const item of toSend) {
      const key = `${item.phone}|${item.event}`;
      if (already.has(key) || seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    let sent = 0;
    let failed = 0;
    if (!data.dryRun) {
      for (const item of unique) {
        const result = await logSms(sql, data.schoolId, item.phone, item.message, item.event);
        if (result.ok) sent += 1;
        else failed += 1;
      }
      await audit(
        context.userId,
        data.schoolId,
        "Finance",
        "RUN_FEE_REMINDERS",
        "sms_logs",
        data.schoolId,
        `Reminders: ${sent} sent, ${failed} failed, ${unique.length} candidates`,
      );
    }

    return {
      ok: true,
      dryRun: !!data.dryRun,
      candidates: unique.length,
      sent,
      failed,
      samples: unique.slice(0, 8).map((u) => ({
        phone: u.phone,
        event: u.event,
        studentName: u.studentName,
        balance: u.balance,
        message: u.message,
      })),
    };
  });

export const listSmsLogs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; limit?: number }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const limit = Math.min(data.limit ?? 40, 100);
    const rows = await sql<{
      id: string;
      recipient: string;
      message: string;
      event_type: string;
      provider: string | null;
      status: string;
      error_message: string | null;
      sent_at: string | null;
      created_at: string;
    }>`
      select id, recipient, message, event_type, provider, status, error_message, sent_at, created_at
      from sms_logs
      where school_id = ${data.schoolId}
      order by created_at desc
      limit ${limit}
    `;
    // Tenant check via school ownership
    const school = await sql<{ id: string }>`
      select id from schools where id = ${data.schoolId} and user_id = ${context.userId} limit 1
    `;
    if (!school[0]) throw new Error("School not found");
    return { logs: rows };
  });

// ---------------------------------------------------------------------------
// A: Tenancy, membership, subscription, setup wizard, parent verification
// ---------------------------------------------------------------------------

/** After school owner signs up, bind membership + owner_user_id */
export const linkOwnerMembership = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where id = ${data.schoolId} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    // Allow if invite was completed (password_set) and email matches, or platform
    await sql.query(
      `update schools set owner_user_id = $1 where id = $2`,
      [context.userId, school.id],
    );

    const mid = nid(context.userId, `mem-${school.id}`);
    await sql.query(
      `insert into user_school_memberships (id, user_id, school_id, role, status)
       values ($1,$2,$3,'owner','ACTIVE')
       on conflict (user_id, school_id) do update set role = 'owner', status = 'ACTIVE'`,
      [mid, context.userId, school.id],
    );

    try {
      await sql.query(
        `insert into school_setup_progress (school_id) values ($1)
         on conflict (school_id) do nothing`,
        [school.id],
      );
    } catch { /* ignore */ }

    return { ok: true };
  });


/** First-run only: promote the signed-in user (or email) to platform owner. */
export const bootstrapPlatformOwner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { email?: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const any = await sql<{ c: number }>`
      select count(*)::int as c from "user" where is_platform_owner = true
    `;
    if ((any[0]?.c ?? 0) > 0) {
      throw new Error(
        "A platform owner already exists. Sign in with that account, or ask them to grant access.",
      );
    }
    const email = (data.email || "").trim().toLowerCase();
    if (email) {
      await sql.query(
        `update "user" set is_platform_owner = true where lower(email) = $1`,
        [email],
      );
    } else {
      await sql.query(
        `update "user" set is_platform_owner = true where id = $1`,
        [context.userId],
      );
    }
    return { ok: true };
  });

export const setPlatformOwner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { email: string; enabled?: boolean }) => data)
  .handler(async ({ context, data }) => {
    // Only existing platform owner or first-run (no platform owners yet)
    const sql = await getSql();
    const already = await isPlatformOwner(context.userId);
    const any = await sql<{ c: number }>`
      select count(*)::int as c from "user" where is_platform_owner = true
    `;
    if (!already && (any[0]?.c ?? 0) > 0) {
      throw new Error("Only a platform owner can grant platform access");
    }
    await sql.query(
      `update "user" set is_platform_owner = $1 where email = $2`,
      [data.enabled !== false, data.email.trim().toLowerCase()],
    );
    return { ok: true };
  });

export const transitionSchoolStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      toStatus: School["status"];
      reason?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // Platform owner or school owner
    const platform = await isPlatformOwner(context.userId);
    if (!platform) {
      await requireSchoolAccess(context.userId, data.schoolId);
    }

    const schools = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    const from = school.status;
    const to = data.toStatus;

    await sql.query(`update schools set status = $1 where id = $2`, [to, data.schoolId]);

    if (to === "ACTIVE") {
      await sql.query(
        `update schools set activated_at = coalesce(activated_at, now()),
          subscription_expires_at = now() + interval '1 year',
          grace_ends_at = null
         where id = $1`,
        [data.schoolId],
      );
    }
    if (to === "GRACE_PERIOD") {
      await sql.query(
        `update schools set grace_ends_at = now() + interval '14 days' where id = $1`,
        [data.schoolId],
      );
    }

    const eid = nid(context.userId, `sub-${Date.now()}`);
    await sql.query(
      `insert into subscription_events (id, school_id, from_status, to_status, reason, actor_user_id)
       values ($1,$2,$3,$4,$5,$6)`,
      [eid, data.schoolId, from, to, data.reason || null, context.userId],
    );

    await audit(
      context.userId,
      data.schoolId,
      platform ? "Platform owner" : "School owner",
      "SUBSCRIPTION_TRANSITION",
      "schools",
      data.schoolId,
      `${from} → ${to}${data.reason ? `: ${data.reason}` : ""}`,
    );

    return { ok: true, from, to };
  });

export const getSetupProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const rows = await sql<{
      school_id: string;
      profile_done: boolean;
      branding_done: boolean;
      academics_done: boolean;
      grading_done: boolean;
      fees_done: boolean;
      behaviour_done: boolean;
      parent_app_done: boolean;
      completed_at: string | null;
    }>`
      select * from school_setup_progress where school_id = ${data.schoolId} limit 1
    `;
    if (rows[0]) return rows[0];
    await sql.query(
      `insert into school_setup_progress (school_id) values ($1) on conflict do nothing`,
      [data.schoolId],
    );
    return {
      school_id: data.schoolId,
      profile_done: false,
      branding_done: false,
      academics_done: false,
      grading_done: false,
      fees_done: false,
      behaviour_done: false,
      parent_app_done: false,
      completed_at: null,
    };
  });

export const updateSetupProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      step:
        | "profile_done"
        | "branding_done"
        | "academics_done"
        | "grading_done"
        | "fees_done"
        | "behaviour_done"
        | "parent_app_done";
      done?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "school.settings.manage");
    const sql = await getSql();
    const col = data.step;
    const done = data.done !== false;
    await sql.query(
      `insert into school_setup_progress (school_id, ${col}, updated_at)
       values ($1, $2, now())
       on conflict (school_id) do update set ${col} = $2, updated_at = now()`,
      [data.schoolId, done],
    );

    // Auto-complete if all steps done
    const rows = await sql<Record<string, boolean | string | null>>`
      select * from school_setup_progress where school_id = ${data.schoolId} limit 1
    `;
    const p = rows[0];
    if (
      p &&
      p.profile_done &&
      p.branding_done &&
      p.academics_done &&
      p.grading_done &&
      p.fees_done &&
      p.behaviour_done &&
      p.parent_app_done
    ) {
      await sql.query(
        `update school_setup_progress set completed_at = now() where school_id = $1`,
        [data.schoolId],
      );
    }
    return { ok: true };
  });

export const saveWizardAcademics = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      classes: { section: string; name: string; stream?: string }[];
      subjects: { name: string; code?: string; section?: string }[];
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "school.settings.manage");
    const sql = await getSql();
    const school = await sql<School>`
      select * from schools where id = ${data.schoolId} limit 1
    `;
    if (!school[0]) throw new Error("School not found");
    const uid = school[0].user_id;

    for (const [i, c] of data.classes.entries()) {
      const id = nid(context.userId, `wiz-cl-${Date.now()}-${i}`);
      await sql.query(
        `insert into classes (id, user_id, school_id, section, name, stream, level_order)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [id, uid, data.schoolId, c.section, c.name, c.stream || null, i],
      );
    }
    for (const [i, s] of data.subjects.entries()) {
      const id = nid(context.userId, `wiz-sub-${Date.now()}-${i}`);
      await sql.query(
        `insert into subjects (id, user_id, school_id, name, code, section)
         values ($1,$2,$3,$4,$5,$6)`,
        [id, uid, data.schoolId, s.name, s.code || null, s.section || null],
      );
    }
    await sql.query(
      `insert into school_setup_progress (school_id, academics_done, updated_at)
       values ($1, true, now())
       on conflict (school_id) do update set academics_done = true, updated_at = now()`,
      [data.schoolId],
    );
    return { ok: true };
  });

/** Parent requests to link a child (verification) */
export const requestParentChildLink = createServerFn({ method: "POST" })
  .validator(
    (data: {
      slug: string;
      parentPhone: string;
      parentName?: string;
      studentNumber?: string;
      studentNameGuess?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${data.slug.trim()} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    let studentId: string | null = null;
    if (data.studentNumber) {
      const st = await sql<Student>`
        select * from students
        where school_id = ${school.id}
          and admission_number = ${data.studentNumber.trim()}
        limit 1
      `;
      studentId = st[0]?.id ?? null;
    }

    const id = `pvr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await sql.query(
      `insert into parent_verification_requests
        (id, school_id, parent_phone, parent_name, student_id, student_number, student_name_guess, status)
       values ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
      [
        id,
        school.id,
        normalizePhone(data.parentPhone),
        data.parentName?.trim() || null,
        studentId,
        data.studentNumber?.trim() || null,
        data.studentNameGuess?.trim() || null,
      ],
    );

    return {
      ok: true,
      requestId: id,
      message: studentId
        ? "Request submitted. The school will verify and link your child."
        : "Request submitted. The school will match and verify the student.",
    };
  });

export const listParentVerificationRequests = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "parents.manage");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      parent_phone: string;
      parent_name: string | null;
      student_id: string | null;
      student_number: string | null;
      student_name_guess: string | null;
      status: string;
      created_at: string;
    }>`
      select id, parent_phone, parent_name, student_id, student_number, student_name_guess, status, created_at
      from parent_verification_requests
      where school_id = ${data.schoolId}
      order by created_at desc
      limit 50
    `;
    return { requests: rows };
  });

export const reviewParentVerification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      requestId: string;
      action: "APPROVE" | "REJECT";
      studentId?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "parents.manage");
    const sql = await getSql();
    const reqs = await sql<{
      id: string;
      parent_phone: string;
      parent_name: string | null;
      student_id: string | null;
      status: string;
    }>`
      select id, parent_phone, parent_name, student_id, status
      from parent_verification_requests
      where id = ${data.requestId} and school_id = ${data.schoolId}
      limit 1
    `;
    const req = reqs[0];
    if (!req) throw new Error("Request not found");
    if (req.status !== "PENDING") throw new Error("Already reviewed");

    if (data.action === "REJECT") {
      await sql.query(
        `update parent_verification_requests
         set status = 'REJECTED', reviewed_by = $1, reviewed_at = now()
         where id = $2`,
        [context.userId, data.requestId],
      );
      return { ok: true, status: "REJECTED" };
    }

    const studentId = data.studentId || req.student_id;
    if (!studentId) throw new Error("Select a student to link");

    // Find or create parent
    const last9 = req.parent_phone.replace(/\D/g, "").slice(-9);
    let parents = await sql<Parent>`
      select * from parents
      where school_id = ${data.schoolId}
        and replace(replace(coalesce(phone,''), ' ', ''), '-', '') like ${"%" + last9}
      limit 1
    `;
    let parentId = parents[0]?.id;
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;

    if (!parentId) {
      parentId = nid(context.userId, `par-v-${Date.now()}`);
      await sql.query(
        `insert into parents (id, user_id, school_id, full_name, phone, verification_status, sms_only)
         values ($1,$2,$3,$4,$5,'VERIFIED',false)`,
        [
          parentId,
          uid,
          data.schoolId,
          req.parent_name || "Parent",
          req.parent_phone,
        ],
      );
    }

    const linkId = nid(context.userId, `ps-v-${Date.now()}`);
    await sql.query(
      `insert into parent_students (id, user_id, parent_id, student_id, relationship, is_primary)
       values ($1,$2,$3,$4,'Guardian',true)`,
      [linkId, uid, parentId, studentId],
    );

    await sql.query(
      `update parent_verification_requests
       set status = 'APPROVED', student_id = $1, reviewed_by = $2, reviewed_at = now()
       where id = $3`,
      [studentId, context.userId, data.requestId],
    );

    await logSms(
      sql,
      data.schoolId,
      req.parent_phone,
      `${school[0]?.name || "School"}: Your child link was approved. Open the parent app to sign in.`,
      "PARENT_VERIFIED",
    );

    return { ok: true, status: "APPROVED", parentId };
  });

// ---------------------------------------------------------------------------
// Platform billing invoices + school httpSMS settings
// ---------------------------------------------------------------------------

export const saveSchoolSmsSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      apiKey: string;
      fromNumber: string;
      enabled?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "notifications.manage");
    const sql = await getSql();
    const key = data.apiKey.trim();
    const keepKey = !key || key === "keep-existing-placeholder";
    if (keepKey) {
      await sql.query(
        `update school_sms_settings set from_number = $1, enabled = $2, updated_at = now()
         where school_id = $3`,
        [data.fromNumber.trim(), data.enabled !== false, data.schoolId],
      );
      // if no row, require a real key
      const check = await sql<{ c: number }>`
        select count(*)::int as c from school_sms_settings where school_id = ${data.schoolId}
      `;
      if (!(check[0]?.c)) {
        throw new Error("API key is required the first time you connect httpSMS");
      }
    } else {
      await sql.query(
        `insert into school_sms_settings (school_id, provider, api_key, from_number, enabled, updated_at)
         values ($1,'httpsms',$2,$3,$4,now())
         on conflict (school_id) do update set
           api_key = $2, from_number = $3, enabled = $4, provider = 'httpsms', updated_at = now()`,
        [data.schoolId, key, data.fromNumber.trim(), data.enabled !== false],
      );
    }
    await audit(
      context.userId,
      data.schoolId,
      "School admin",
      "UPDATE_SMS_SETTINGS",
      "school_sms_settings",
      data.schoolId,
      "httpSMS credentials updated",
    );
    return { ok: true };
  });

export const getSchoolSmsSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const rows = await sql<{
      api_key: string | null;
      from_number: string | null;
      enabled: boolean;
      provider: string;
    }>`
      select api_key, from_number, enabled, provider
      from school_sms_settings where school_id = ${data.schoolId} limit 1
    `;
    const row = rows[0];
    return {
      configured: Boolean(row?.api_key),
      fromNumber: row?.from_number || null,
      enabled: row?.enabled ?? false,
      provider: row?.provider || "httpsms",
      // Never return full API key to client — only masked
      apiKeyMasked: row?.api_key
        ? `${row.api_key.slice(0, 4)}…${row.api_key.slice(-4)}`
        : null,
    };
  });

export const updateSchoolBillingPrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      billingTier?: BillingTier;
      billingPeriod?: BillingPeriod;
      billingContactPhone?: string;
      billingContactEmail?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const platform = await isPlatformOwner(context.userId);
    if (!platform) {
      await requirePermission(context.userId, data.schoolId, "school.settings.manage");
    }
    const sql = await getSql();
    if (data.billingTier) {
      await sql.query(`update schools set billing_tier = $1 where id = $2`, [
        data.billingTier,
        data.schoolId,
      ]);
    }
    if (data.billingPeriod) {
      await sql.query(`update schools set billing_period = $1 where id = $2`, [
        data.billingPeriod,
        data.schoolId,
      ]);
    }
    if (data.billingContactPhone !== undefined) {
      await sql.query(`update schools set billing_contact_phone = $1 where id = $2`, [
        data.billingContactPhone,
        data.schoolId,
      ]);
    }
    if (data.billingContactEmail !== undefined) {
      await sql.query(`update schools set billing_contact_email = $1 where id = $2`, [
        data.billingContactEmail,
        data.schoolId,
      ]);
    }
    return { ok: true };
  });

function invoiceNumber(schoolSlug: string, period: string, start: string): string {
  const stamp = start.replace(/-/g, "").slice(0, 6);
  return `NEX-${(schoolSlug || "SCH").toUpperCase().slice(0, 8)}-${period.slice(0, 3).toUpperCase()}-${stamp}`;
}

/** Generate invoices for all active schools for the current period (month-end job). */
export const generatePlatformInvoices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { period?: BillingPeriod; dryRun?: boolean } | undefined) => data ?? {})
  .handler(async ({ context, data }) => {
    const platform = await isPlatformOwner(context.userId);
    // Allow demo: any user in workspace if no platform flag yet
    const sql = await getSql();
    if (!platform) {
      // First platform user bootstrap: allow if user has platform persona school list
      const any = await sql<{ c: number }>`
        select count(*)::int as c from "user" where is_platform_owner = true
      `;
      if ((any[0]?.c ?? 0) > 0) {
        throw new Error("Only platform owner can generate invoices");
      }
    }

    const defaultPeriod = (data.period || "monthly") as BillingPeriod;
    const schools = await sql<School>`
      select * from schools where status in ('ACTIVE','GRACE_PERIOD','PENDING_PAYMENT')
    `;

    const created: {
      schoolId: string;
      schoolName: string;
      invoiceNumber: string;
      amount: number;
      tier: string;
      period: string;
    }[] = [];

    for (const school of schools) {
      const tier =
        (school as { billing_tier?: string }).billing_tier as BillingTier ||
        inferBillingTier(school.school_type);
      const period =
        ((school as { billing_period?: string }).billing_period as BillingPeriod) ||
        defaultPeriod;
      const amount = priceFor(tier, period);
      const bounds = periodBounds(period);
      const start = toDateStr(bounds.start);
      const end = toDateStr(bounds.end);
      const due = toDateStr(bounds.due);

      // Skip if invoice already exists for this school+period_start
      const existing = await sql<{ id: string }>`
        select id from platform_invoices
        where school_id = ${school.id}
          and billing_period = ${period}
          and period_start = ${start}::date
          and status <> 'VOID'
        limit 1
      `;
      if (existing[0]) continue;

      if (data.dryRun) {
        created.push({
          schoolId: school.id,
          schoolName: school.name,
          invoiceNumber: "(dry-run)",
          amount,
          tier,
          period,
        });
        continue;
      }

      const invId = nid(context.userId, `pinv-${Date.now()}-${school.id.slice(-6)}`);
      const num = invoiceNumber(school.slug, period, start);
      await sql.query(
        `insert into platform_invoices (
           id, school_id, invoice_number, billing_tier, billing_period,
           period_start, period_end, amount, currency, status, due_date
         ) values ($1,$2,$3,$4,$5,$6::date,$7::date,$8,'MWK','DRAFT',$9::date)`,
        [invId, school.id, num, tier, period, start, end, amount, due],
      );
      await sql.query(
        `insert into platform_invoice_events (id, invoice_id, action, detail, actor)
         values ($1,$2,'GENERATED',$3,$4)`,
        [
          nid(context.userId, `pie-${Date.now()}`),
          invId,
          `${tier} / ${period} / ${formatMwk(amount)}`,
          context.userId,
        ],
      );
      created.push({
        schoolId: school.id,
        schoolName: school.name,
        invoiceNumber: num,
        amount,
        tier,
        period,
      });
    }

    return { ok: true, dryRun: !!data.dryRun, count: created.length, invoices: created };
  });

export const listPlatformInvoices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const invoices = await sql<{
      id: string;
      school_id: string;
      invoice_number: string;
      billing_tier: string;
      billing_period: string;
      period_start: string;
      period_end: string;
      amount: string | number;
      status: string;
      due_date: string;
      paid_at: string | null;
      sent_at: string | null;
      created_at: string;
    }>`
      select * from platform_invoices order by created_at desc limit 200
    `;
    const schools = await sql<School>`select * from schools`;
    const byId = new Map(schools.map((s) => [s.id, s]));

    const dueSoon = invoices.filter((i) => {
      if (i.status === "PAID" || i.status === "VOID") return false;
      const due = new Date(i.due_date);
      const days = (due.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      return days <= 7;
    });

    return {
      invoices: invoices.map((i) => ({
        ...i,
        schoolName: byId.get(i.school_id)?.name || "—",
        schoolEmail:
          (byId.get(i.school_id) as { billing_contact_email?: string })?.billing_contact_email ||
          byId.get(i.school_id)?.email ||
          byId.get(i.school_id)?.owner_email,
        schoolPhone:
          (byId.get(i.school_id) as { billing_contact_phone?: string })?.billing_contact_phone ||
          byId.get(i.school_id)?.phone ||
          null,
      })),
      dueSoonCount: dueSoon.length,
      unpaidCount: invoices.filter((i) => i.status !== "PAID" && i.status !== "VOID").length,
    };
  });

export const sendPlatformInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { invoiceId: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      school_id: string;
      invoice_number: string;
      amount: string | number;
      due_date: string;
      billing_period: string;
      billing_tier: string;
      status: string;
    }>`
      select * from platform_invoices where id = ${data.invoiceId} limit 1
    `;
    const inv = rows[0];
    if (!inv) throw new Error("Invoice not found");

    const schools = await sql<School>`select * from schools where id = ${inv.school_id} limit 1`;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    const baseUrl =
      process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL || "http://localhost:8080";
    const payLink = `${baseUrl.replace(/\/$/, "")}/app/platform?invoice=${inv.invoice_number}`;
    const amount = formatMwk(Number(inv.amount));
    const emailTo =
      (school as { billing_contact_email?: string }).billing_contact_email ||
      school.owner_email ||
      school.email;
    const phoneTo =
      (school as { billing_contact_phone?: string }).billing_contact_phone || school.phone;

    const subject = `NEXUS subscription invoice ${inv.invoice_number}`;
    const text = `Dear ${school.name},

Your NEXUS subscription invoice is ready.

Invoice: ${inv.invoice_number}
Plan: ${inv.billing_tier} / ${inv.billing_period}
Amount: ${amount}
Due: ${inv.due_date}

View / pay: ${payLink}

Thank you.`;
    const html = `<p>Dear <strong>${school.name}</strong>,</p>
<p>Your NEXUS subscription invoice is ready.</p>
<ul>
<li>Invoice: <strong>${inv.invoice_number}</strong></li>
<li>Plan: ${inv.billing_tier} / ${inv.billing_period}</li>
<li>Amount: <strong>${amount}</strong></li>
<li>Due: ${inv.due_date}</li>
</ul>
<p><a href="${payLink}">View invoice</a></p>`;

    let emailOk = false;
    if (emailTo) {
      const er = await sendEmail({ to: emailTo, subject, html, text });
      emailOk = er.ok;
      await sql.query(
        `insert into platform_invoice_events (id, invoice_id, action, detail, actor)
         values ($1,$2,'SENT_EMAIL',$3,$4)`,
        [
          nid(context.userId, `pie-e-${Date.now()}`),
          inv.id,
          emailTo + (er.ok ? "" : ` error:${er.error}`),
          context.userId,
        ],
      );
    }

    let smsOk = false;
    if (phoneTo) {
      const smsMsg = `NEXUS: Invoice ${inv.invoice_number} for ${school.name}. Amount ${amount}, due ${inv.due_date}. ${payLink}`;
      // Platform owner httpSMS
      const result = await logSms(sql, inv.school_id, phoneTo, smsMsg, "PLATFORM_INVOICE", {
        usePlatformSms: true,
      });
      smsOk = result.ok;
      await sql.query(
        `insert into platform_invoice_events (id, invoice_id, action, detail, actor)
         values ($1,$2,'SENT_SMS',$3,$4)`,
        [
          nid(context.userId, `pie-s-${Date.now()}`),
          inv.id,
          phoneTo,
          context.userId,
        ],
      );
    }

    await sql.query(
      `update platform_invoices set status = case when status = 'DRAFT' then 'SENT' else status end, sent_at = now() where id = $1`,
      [inv.id],
    );

    return { ok: true, emailOk, smsOk, emailTo, phoneTo, payLink };
  });

export const markPlatformInvoicePaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { invoiceId: string; paymentReference?: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update platform_invoices
       set status = 'PAID', paid_at = now(), payment_reference = $1
       where id = $2`,
      [data.paymentReference || null, data.invoiceId],
    );
    await sql.query(
      `insert into platform_invoice_events (id, invoice_id, action, detail, actor)
       values ($1,$2,'PAID',$3,$4)`,
      [
        nid(context.userId, `pie-p-${Date.now()}`),
        data.invoiceId,
        data.paymentReference || "marked paid",
        context.userId,
      ],
    );
    // Ensure school stays ACTIVE
    const inv = await sql<{ school_id: string }>`
      select school_id from platform_invoices where id = ${data.invoiceId} limit 1
    `;
    if (inv[0]) {
      await sql.query(
        `update schools set status = 'ACTIVE',
           subscription_expires_at = now() + interval '32 days'
         where id = $1`,
        [inv[0].school_id],
      );
    }
    return { ok: true };
  });

/** Schools that need to pay — reminder list for platform owner */
export const getSubscriptionDueAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const unpaid = await sql<{
      id: string;
      school_id: string;
      invoice_number: string;
      amount: string | number;
      due_date: string;
      status: string;
    }>`
      select id, school_id, invoice_number, amount, due_date, status
      from platform_invoices
      where status in ('DRAFT','SENT','OVERDUE')
      order by due_date asc
    `;
    const schools = await sql<School>`select * from schools`;
    const byId = new Map(schools.map((s) => [s.id, s]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      alerts: unpaid.map((i) => {
        const due = new Date(i.due_date);
        due.setHours(0, 0, 0, 0);
        const days = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
        let urgency: "overdue" | "due_soon" | "upcoming" = "upcoming";
        if (days < 0) urgency = "overdue";
        else if (days <= 7) urgency = "due_soon";
        return {
          ...i,
          schoolName: byId.get(i.school_id)?.name || "—",
          daysUntilDue: days,
          urgency,
          amountLabel: formatMwk(Number(i.amount)),
        };
      }),
    };
  });

// ---------------------------------------------------------------------------
// B: Academic engine — grading, ranking, assessments, exams, promotions
// ---------------------------------------------------------------------------

const DEFAULT_BANDS = [
  { grade: "A+", min: 90, max: 100, points: 5, remark: "Outstanding" },
  { grade: "A", min: 80, max: 89.99, points: 4, remark: "Excellent" },
  { grade: "B", min: 70, max: 79.99, points: 3, remark: "Good" },
  { grade: "C", min: 60, max: 69.99, points: 2, remark: "Credit" },
  { grade: "D", min: 50, max: 59.99, points: 1, remark: "Pass" },
  { grade: "F", min: 0, max: 49.99, points: 0, remark: "Fail" },
];

export function gradeFromScale(
  score: number,
  bands: { grade: string; min_score: number; max_score: number }[],
): string {
  const s = Number(score);
  for (const b of bands) {
    if (s >= Number(b.min_score) && s <= Number(b.max_score)) return b.grade;
  }
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  if (s >= 50) return "D";
  return "F";
}

export const ensureGradingScale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const existing = await sql<{ id: string }>`
      select id from grading_scales where school_id = ${data.schoolId} and is_default = true limit 1
    `;
    if (existing[0]) {
      const bands = await sql<{
        grade: string;
        min_score: string | number;
        max_score: string | number;
        points: string | number | null;
        remark: string | null;
      }>`
        select grade, min_score, max_score, points, remark from grading_bands
        where scale_id = ${existing[0].id} order by sort_order
      `;
      const scale = await sql<{
        id: string;
        continuous_weight: string | number;
        exam_weight: string | number;
        name: string;
      }>`select * from grading_scales where id = ${existing[0].id}`;
      return { scale: scale[0], bands };
    }

    const scaleId = nid(context.userId, `gs-${data.schoolId.slice(-8)}`);
    await sql.query(
      `insert into grading_scales (id, school_id, name, is_default, continuous_weight, exam_weight)
       values ($1,$2,'Default',true,40,60)`,
      [scaleId, data.schoolId],
    );
    for (const [i, b] of DEFAULT_BANDS.entries()) {
      await sql.query(
        `insert into grading_bands (id, scale_id, grade, min_score, max_score, points, remark, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          nid(context.userId, `gb-${i}-${scaleId.slice(-6)}`),
          scaleId,
          b.grade,
          b.min,
          b.max,
          b.points,
          b.remark,
          i,
        ],
      );
    }
    await sql.query(
      `insert into ranking_settings (school_id, enabled, show_to_parents)
       values ($1,true,true) on conflict (school_id) do nothing`,
      [data.schoolId],
    );
    const bands = DEFAULT_BANDS.map((b) => ({
      grade: b.grade,
      min_score: b.min,
      max_score: b.max,
      points: b.points,
      remark: b.remark,
    }));
    return {
      scale: {
        id: scaleId,
        continuous_weight: 40,
        exam_weight: 60,
        name: "Default",
      },
      bands,
    };
  });

export const updateGradingScale = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      continuousWeight: number;
      examWeight: number;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "school.settings.manage");
    const sql = await getSql();
    await sql.query(
      `update grading_scales set continuous_weight = $1, exam_weight = $2
       where school_id = $3 and is_default = true`,
      [data.continuousWeight, data.examWeight, data.schoolId],
    );
    return { ok: true };
  });

export const updateRankingSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      enabled: boolean;
      showToParents: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "school.settings.manage");
    const sql = await getSql();
    await sql.query(
      `insert into ranking_settings (school_id, enabled, show_to_parents)
       values ($1,$2,$3)
       on conflict (school_id) do update set enabled = $2, show_to_parents = $3`,
      [data.schoolId, data.enabled, data.showToParents],
    );
    return { ok: true };
  });

export const recalculateRankings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; termId: string; classId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "results.review");
    const sql = await getSql();

    const results = await sql<{
      id: string;
      student_id: string;
      subject_id: string;
      overall_score: string | number | null;
    }>`
      select id, student_id, subject_id, overall_score from student_results
      where school_id = ${data.schoolId}
        and term_id = ${data.termId}
        and status in ('VERIFIED','APPROVED','READY_TO_PUBLISH','PUBLISHED','LOCKED')
    `;

    // Only students in class
    const students = await sql<{ id: string }>`
      select id from students where school_id = ${data.schoolId} and class_id = ${data.classId}
    `;
    const classSet = new Set(students.map((s) => s.id));
    const classResults = results.filter((r) => classSet.has(r.student_id));

    // Overall average per student
    const byStudent = new Map<string, number[]>();
    for (const r of classResults) {
      if (r.overall_score == null) continue;
      const arr = byStudent.get(r.student_id) || [];
      arr.push(Number(r.overall_score));
      byStudent.set(r.student_id, arr);
    }
    const averages = [...byStudent.entries()]
      .map(([studentId, scores]) => ({
        studentId,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    let pos = 0;
    let lastAvg = NaN;
    let index = 0;
    for (const row of averages) {
      index += 1;
      if (row.avg !== lastAvg) {
        pos = index;
        lastAvg = row.avg;
      }
      // Store position on any result row for this student/term (use first)
      const sample = classResults.find((r) => r.student_id === row.studentId);
      if (sample) {
        await sql.query(
          `update student_results set position = $1
           where student_id = $2 and term_id = $3 and school_id = $4`,
          [pos, row.studentId, data.termId, data.schoolId],
        );
      }
    }

    // Subject ranks
    const bySubject = new Map<string, { studentId: string; score: number }[]>();
    for (const r of classResults) {
      if (r.overall_score == null) continue;
      const list = bySubject.get(r.subject_id) || [];
      list.push({ studentId: r.student_id, score: Number(r.overall_score) });
      bySubject.set(r.subject_id, list);
    }
    for (const [subjectId, list] of bySubject) {
      list.sort((a, b) => b.score - a.score);
      let p = 0;
      let last = NaN;
      let i = 0;
      for (const row of list) {
        i += 1;
        if (row.score !== last) {
          p = i;
          last = row.score;
        }
        const rid = nid(context.userId, `srk-${data.termId.slice(-4)}-${subjectId.slice(-4)}-${row.studentId.slice(-4)}`);
        await sql.query(
          `insert into subject_rankings (id, school_id, term_id, class_id, subject_id, student_id, score, position)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (term_id, class_id, subject_id, student_id)
           do update set score = $7, position = $8`,
          [
            rid,
            data.schoolId,
            data.termId,
            data.classId,
            subjectId,
            row.studentId,
            row.score,
            p,
          ],
        );
      }
    }

    await audit(
      context.userId,
      data.schoolId,
      "Exam office",
      "RECALCULATE_RANKINGS",
      "student_results",
      data.classId,
      `Term ${data.termId} class rankings updated (${averages.length} students)`,
    );

    return { ok: true, rankedStudents: averages.length };
  });

export const createAssessment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      classId: string;
      subjectId: string;
      termId?: string;
      name: string;
      assessmentType: string;
      maximumMarks: number;
      weight?: number;
      dueDate?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "results.view");
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;
    const id = nid(context.userId, `asmt-${Date.now()}`);
    await sql.query(
      `insert into assessments (
         id, user_id, school_id, class_id, subject_id, term_id, name,
         assessment_type, maximum_marks, weight, due_date, status
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'OPEN')`,
      [
        id,
        uid,
        data.schoolId,
        data.classId,
        data.subjectId,
        data.termId || null,
        data.name.trim(),
        data.assessmentType,
        data.maximumMarks,
        data.weight ?? null,
        data.dueDate || null,
      ],
    );
    return { ok: true, id };
  });

export const createExamination = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      name: string;
      termId?: string;
      startDate?: string;
      endDate?: string;
      subjectIds?: string[];
      classId?: string;
      maximumMarks?: number;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "results.review");
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;
    const examId = nid(context.userId, `exam-${Date.now()}`);
    await sql.query(
      `insert into examinations (id, user_id, school_id, term_id, name, start_date, end_date, status)
       values ($1,$2,$3,$4,$5,$6,$7,'OPEN')`,
      [
        examId,
        uid,
        data.schoolId,
        data.termId || null,
        data.name.trim(),
        data.startDate || null,
        data.endDate || null,
      ],
    );
    for (const [i, sid] of (data.subjectIds || []).entries()) {
      await sql.query(
        `insert into examination_subjects (id, examination_id, subject_id, class_id, maximum_marks)
         values ($1,$2,$3,$4,$5)`,
        [
          nid(context.userId, `exs-${Date.now()}-${i}`),
          examId,
          sid,
          data.classId || null,
          data.maximumMarks ?? 100,
        ],
      );
    }
    return { ok: true, examId };
  });

export const listExaminations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const exams = await sql<{
      id: string;
      name: string;
      term_id: string | null;
      start_date: string | null;
      end_date: string | null;
      status: string;
    }>`
      select id, name, term_id, start_date, end_date, status
      from examinations where school_id = ${data.schoolId}
      order by created_at desc limit 40
    `;
    return { exams };
  });

export const promoteStudents = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      studentIds: string[];
      toClassId: string | null;
      action: "PROMOTED" | "REPEATED" | "TRANSFERRED" | "GRADUATED" | "WITHDRAWN";
      notes?: string;
      effectiveDate?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "students.manage");
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;

    let count = 0;
    for (const studentId of data.studentIds) {
      const st = await sql<Student>`
        select * from students where id = ${studentId} and school_id = ${data.schoolId} limit 1
      `;
      const student = st[0];
      if (!student) continue;

      const fromClass = student.class_id;
      const promoId = nid(context.userId, `promo-${Date.now()}-${count}`);
      await sql.query(
        `insert into student_promotions (
           id, user_id, school_id, student_id, from_class_id, to_class_id,
           action, notes, effective_date, created_by
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          promoId,
          uid,
          data.schoolId,
          studentId,
          fromClass,
          data.toClassId,
          data.action,
          data.notes || null,
          data.effectiveDate || new Date().toISOString().slice(0, 10),
          context.userId,
        ],
      );

      if (data.action === "GRADUATED" || data.action === "WITHDRAWN") {
        await sql.query(
          `update students set status = $1, class_id = null where id = $2`,
          [data.action === "GRADUATED" ? "GRADUATED" : "WITHDRAWN", studentId],
        );
      } else if (data.toClassId) {
        await sql.query(`update students set class_id = $1, status = 'ACTIVE' where id = $2`, [
          data.toClassId,
          studentId,
        ]);
      }
      count += 1;
    }

    await audit(
      context.userId,
      data.schoolId,
      "Registrar",
      "STUDENT_PROMOTION",
      "students",
      data.schoolId,
      `${data.action} × ${count}`,
    );

    return { ok: true, count };
  });

// ---------------------------------------------------------------------------
// C: Finance engine — fee structures, apply charges, void, receipt, reports
// ---------------------------------------------------------------------------

export const createFeeStructure = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      name: string;
      amount: number;
      classId?: string;
      termId?: string;
      dueDate?: string;
      mandatory?: boolean;
      lateFeeAmount?: number;
      lateFeeAfterDays?: number;
      description?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "finance.manage");
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;
    const id = nid(context.userId, `fee-${Date.now()}`);
    await sql.query(
      `insert into fee_structures (
         id, user_id, school_id, name, class_id, term_id, amount, due_date,
         mandatory, late_fee_amount, late_fee_after_days, description
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        uid,
        data.schoolId,
        data.name.trim(),
        data.classId || null,
        data.termId || null,
        data.amount,
        data.dueDate || null,
        data.mandatory !== false,
        data.lateFeeAmount ?? 0,
        data.lateFeeAfterDays ?? 0,
        data.description || null,
      ],
    );
    return { ok: true, id };
  });

/** Apply a fee structure to all students in its class (or whole school if no class). */
export const applyFeeStructure = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; feeStructureId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "finance.manage");
    const sql = await getSql();
    const fees = await sql<{
      id: string;
      name: string;
      class_id: string | null;
      amount: string | number;
      due_date: string | null;
      user_id: string;
    }>`
      select * from fee_structures where id = ${data.feeStructureId} and school_id = ${data.schoolId} limit 1
    `;
    const fee = fees[0];
    if (!fee) throw new Error("Fee structure not found");

    const students = fee.class_id
      ? await sql<Student>`
          select * from students
          where school_id = ${data.schoolId} and class_id = ${fee.class_id} and status = 'ACTIVE'
        `
      : await sql<Student>`
          select * from students where school_id = ${data.schoolId} and status = 'ACTIVE'
        `;

    let created = 0;
    for (const st of students) {
      // Skip if already charged for this structure
      const exists = await sql<{ id: string }>`
        select id from student_charges
        where student_id = ${st.id} and fee_structure_id = ${fee.id} limit 1
      `;
      if (exists[0]) continue;

      const cid = nid(context.userId, `ch-${Date.now()}-${created}`);
      await sql.query(
        `insert into student_charges (
           id, user_id, school_id, student_id, fee_structure_id, description,
           amount, paid, due_date, status
         ) values ($1,$2,$3,$4,$5,$6,$7,0,$8,'UNPAID')`,
        [
          cid,
          fee.user_id,
          data.schoolId,
          st.id,
          fee.id,
          fee.name,
          fee.amount,
          fee.due_date,
        ],
      );
      created += 1;
    }

    await audit(
      context.userId,
      data.schoolId,
      "Bursar",
      "APPLY_FEE_STRUCTURE",
      "fee_structures",
      fee.id,
      `Applied “${fee.name}” to ${created} student(s)`,
    );
    return { ok: true, created };
  });

export const voidPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { paymentId: string; reason: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const pays = await sql<{
      id: string;
      school_id: string;
      student_id: string;
      amount: string | number;
      status: string;
      receipt_number: string | null;
      user_id: string;
    }>`
      select * from payments where id = ${data.paymentId} limit 1
    `;
    const pay = pays[0];
    if (!pay) throw new Error("Payment not found");
    if (pay.status === "VOID") throw new Error("Already voided");
    await requirePermission(context.userId, pay.school_id, "finance.manage");

    await sql.query(
      `update payments set status = 'VOID', voided_at = now(), void_reason = $1, voided_by = $2
       where id = $3`,
      [data.reason.trim(), context.userId, data.paymentId],
    );

    // Reverse paid amount on matching charges (best effort: reduce paid by payment amount)
    const amount = Number(pay.amount);
    const charges = await sql<StudentCharge>`
      select * from student_charges
      where school_id = ${pay.school_id} and student_id = ${pay.student_id}
      order by due_date desc
    `;
    let remaining = amount;
    for (const ch of charges) {
      if (remaining <= 0) break;
      const paid = Number(ch.paid);
      if (paid <= 0) continue;
      const reduce = Math.min(paid, remaining);
      const newPaid = paid - reduce;
      const status =
        newPaid <= 0.5 ? "UNPAID" : newPaid >= Number(ch.amount) - 0.5 ? "PAID" : "PARTIAL";
      await sql.query(
        `update student_charges set paid = $1, status = $2 where id = $3`,
        [newPaid, status, ch.id],
      );
      remaining -= reduce;
    }

    await sql.query(
      `insert into financial_adjustments (
         id, user_id, school_id, student_id, payment_id, adjustment_type, amount, reason, approved_by
       ) values ($1,$2,$3,$4,$5,'VOID',$6,$7,$8)`,
      [
        nid(context.userId, `adj-${Date.now()}`),
        pay.user_id,
        pay.school_id,
        pay.student_id,
        pay.id,
        amount,
        data.reason.trim(),
        context.userId,
      ],
    );

    await audit(
      context.userId,
      pay.school_id,
      "Bursar",
      "VOID_PAYMENT",
      "payments",
      pay.id,
      data.reason.trim(),
    );
    return { ok: true };
  });

export const getReceiptData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { paymentId: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const pays = await sql<{
      id: string;
      school_id: string;
      student_id: string;
      amount: string | number;
      method: string;
      reference: string | null;
      payment_date: string;
      receipt_number: string | null;
      status: string;
    }>`select * from payments where id = ${data.paymentId} limit 1`;
    const pay = pays[0];
    if (!pay) throw new Error("Payment not found");
    await requireSchoolAccess(context.userId, pay.school_id);

    const school = await sql<School>`select * from schools where id = ${pay.school_id} limit 1`;
    const student = await sql<Student>`select * from students where id = ${pay.student_id} limit 1`;

    return {
      payment: pay,
      school: school[0]
        ? {
            name: school[0].name,
            address: school[0].address,
            city: school[0].city,
            phone: school[0].phone,
            motto: school[0].motto,
            logo_mark: school[0].logo_mark,
          }
        : null,
      student: student[0]
        ? {
            name: `${student[0].first_name} ${student[0].last_name}`,
            admission_number: student[0].admission_number,
          }
        : null,
    };
  });

export const financeReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "finance.view");
    const sql = await getSql();

    const charges = await sql<{
      student_id: string;
      amount: string | number;
      paid: string | number;
      status: string;
      description: string;
    }>`
      select student_id, amount, paid, status, description
      from student_charges where school_id = ${data.schoolId}
    `;
    const students = await sql<Student>`
      select * from students where school_id = ${data.schoolId}
    `;
    const classes = await sql<ClassRow>`
      select * from classes where school_id = ${data.schoolId}
    `;
    const classById = new Map(classes.map((c) => [c.id, c]));
    const studentById = new Map(students.map((s) => [s.id, s]));

    type Bucket = { classId: string; className: string; charged: number; collected: number; outstanding: number; students: number };
    const byClass = new Map<string, Bucket>();

    for (const ch of charges) {
      const st = studentById.get(ch.student_id);
      const classId = st?.class_id || "_none";
      const cls = classById.get(classId || "");
      const key = classId || "_none";
      const b = byClass.get(key) || {
        classId: key,
        className: cls ? `${cls.section} ${cls.name}${cls.stream ? " " + cls.stream : ""}` : "Unassigned",
        charged: 0,
        collected: 0,
        outstanding: 0,
        students: 0,
      };
      b.charged += Number(ch.amount);
      b.collected += Number(ch.paid);
      b.outstanding += Math.max(0, Number(ch.amount) - Number(ch.paid));
      byClass.set(key, b);
    }

    // Count unique students with charges per class
    const seen = new Set<string>();
    for (const ch of charges) {
      const st = studentById.get(ch.student_id);
      const key = `${st?.class_id || "_none"}:${ch.student_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const b = byClass.get(st?.class_id || "_none");
      if (b) b.students += 1;
    }

    const payments = await sql<{ amount: string | number; method: string; status: string }>`
      select amount, method, status from payments where school_id = ${data.schoolId}
    `;
    const byMethod: Record<string, number> = {};
    let voided = 0;
    for (const p of payments) {
      if (p.status === "VOID") {
        voided += Number(p.amount);
        continue;
      }
      byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
    }

    return {
      byClass: [...byClass.values()].sort((a, b) => b.outstanding - a.outstanding),
      byMethod,
      voided,
      totals: {
        charged: charges.reduce((a, c) => a + Number(c.amount), 0),
        collected: charges.reduce((a, c) => a + Number(c.paid), 0),
        outstanding: charges.reduce(
          (a, c) => a + Math.max(0, Number(c.amount) - Number(c.paid)),
          0,
        ),
      },
    };
  });

// ---------------------------------------------------------------------------
// D: Messaging + parent portal manifest
// ---------------------------------------------------------------------------

export const sendSchoolMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      parentId: string;
      studentId?: string;
      subject?: string;
      body: string;
      alsoSms?: boolean;
      alsoEmail?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "notifications.manage");
    const sql = await getSql();
    const threadId = `th-${data.parentId}`;
    const id = nid(context.userId, `msg-${Date.now()}`);
    await sql.query(
      `insert into messages (
         id, school_id, thread_id, sender_type, sender_user_id,
         recipient_parent_id, student_id, subject, body, channel
       ) values ($1,$2,$3,'SCHOOL',$4,$5,$6,$7,$8,'IN_APP')`,
      [
        id,
        data.schoolId,
        threadId,
        context.userId,
        data.parentId,
        data.studentId || null,
        data.subject || null,
        data.body.trim(),
      ],
    );

    const parents = await sql<Parent>`select * from parents where id = ${data.parentId} limit 1`;
    const parent = parents[0];
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;

    if (data.alsoSms !== false && parent?.phone) {
      await logSms(
        sql,
        data.schoolId,
        parent.phone,
        `${school[0]?.name || "School"}: ${data.body.trim().slice(0, 140)}`,
        "MESSAGE",
      );
    }
    if (data.alsoEmail !== false && parent?.email) {
      await sendEmail({
        to: parent.email,
        subject: data.subject || `Message from ${school[0]?.name || "school"}`,
        text: data.body.trim(),
        html: `<p>${data.body.trim().replace(/\n/g, "<br/>")}</p>`,
      });
    }

    return { ok: true, id, threadId };
  });

export const sendParentMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      slug: string;
      token: string;
      body: string;
      studentId?: string;
      subject?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${data.slug.trim()} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");

    const sessions = await sql<{ parent_id: string; expires_at: string }>`
      select parent_id, expires_at from parent_sessions
      where token = ${data.token.trim()} and school_id = ${school.id} limit 1
    `;
    const session = sessions[0];
    if (!session || new Date(session.expires_at) < new Date()) {
      throw new Error("Session expired");
    }

    const threadId = `th-${session.parent_id}`;
    const id = `msg-p-${Date.now()}`;
    await sql.query(
      `insert into messages (
         id, school_id, thread_id, sender_type, sender_parent_id,
         student_id, subject, body, channel
       ) values ($1,$2,$3,'PARENT',$4,$5,$6,$7,'IN_APP')`,
      [
        id,
        school.id,
        threadId,
        session.parent_id,
        data.studentId || null,
        data.subject || null,
        data.body.trim(),
      ],
    );
    return { ok: true, id };
  });

export const listMessageThreads = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const rows = await sql<{
      thread_id: string;
      recipient_parent_id: string | null;
      sender_parent_id: string | null;
      body: string;
      created_at: string;
      subject: string | null;
    }>`
      select distinct on (thread_id)
        thread_id, recipient_parent_id, sender_parent_id, body, created_at, subject
      from messages
      where school_id = ${data.schoolId}
      order by thread_id, created_at desc
    `;
    const parents = await sql<Parent>`
      select * from parents where school_id = ${data.schoolId}
    `;
    const byId = new Map(parents.map((p) => [p.id, p]));
    return {
      threads: rows.map((r) => {
        const pid = r.recipient_parent_id || r.sender_parent_id;
        return {
          threadId: r.thread_id,
          parentId: pid,
          parentName: pid ? byId.get(pid)?.full_name : "—",
          lastBody: r.body,
          lastAt: r.created_at,
          subject: r.subject,
        };
      }),
    };
  });

export const listThreadMessages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; threadId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const messages = await sql<{
      id: string;
      sender_type: string;
      body: string;
      subject: string | null;
      created_at: string;
    }>`
      select id, sender_type, body, subject, created_at
      from messages
      where school_id = ${data.schoolId} and thread_id = ${data.threadId}
      order by created_at asc
      limit 100
    `;
    return { messages };
  });

export const listParentMessages = createServerFn({ method: "POST" })
  .validator((data: { slug: string; token: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${data.slug.trim()} limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");
    const sessions = await sql<{ parent_id: string; expires_at: string }>`
      select parent_id, expires_at from parent_sessions
      where token = ${data.token.trim()} and school_id = ${school.id} limit 1
    `;
    const session = sessions[0];
    if (!session || new Date(session.expires_at) < new Date()) {
      throw new Error("Session expired");
    }
    const threadId = `th-${session.parent_id}`;
    const messages = await sql<{
      id: string;
      sender_type: string;
      body: string;
      subject: string | null;
      created_at: string;
    }>`
      select id, sender_type, body, subject, created_at
      from messages
      where school_id = ${school.id} and thread_id = ${threadId}
      order by created_at asc
      limit 100
    `;
    return { messages, threadId };
  });

/** Public: branded PWA manifest for a parent app slug */
export const getParentAppManifest = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools where parent_app_slug = ${data.slug.trim()} limit 1
    `;
    const school = schools[0];
    if (!school) {
      return {
        name: "NEXUS Parent",
        short_name: "Parent",
        start_url: `/p/${data.slug}`,
        display: "standalone",
        background_color: "#0b1220",
        theme_color: "#0f766e",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      };
    }
    const name = school.parent_app_name || `${school.name} Parent`;
    const color = school.primary_color || "#0f766e";
    return {
      name,
      short_name: (school.logo_mark || school.name.slice(0, 12)).slice(0, 12),
      description: `Parent portal for ${school.name}`,
      start_url: `/p/${school.parent_app_slug}`,
      scope: `/p/${school.parent_app_slug}`,
      display: "standalone",
      background_color: "#0b1220",
      theme_color: color,
      icons: [
        {
          src: "/favicon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
      ],
    };
  });

// ---------------------------------------------------------------------------
// E: Calendar, documents, admissions, ID card data
// ---------------------------------------------------------------------------

export const listCalendarEvents = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const events = await sql<{
      id: string;
      title: string;
      event_type: string | null;
      event_date: string;
      end_date: string | null;
      description: string | null;
      audience: string | null;
    }>`
      select id, title, event_type, event_date, end_date, description, audience
      from calendar_events
      where school_id = ${data.schoolId}
      order by event_date asc
      limit 100
    `;
    return { events };
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      title: string;
      eventDate: string;
      endDate?: string;
      eventType?: string;
      description?: string;
      audience?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;
    const id = nid(context.userId, `cal-${Date.now()}`);
    await sql.query(
      `insert into calendar_events (
         id, user_id, school_id, title, event_type, event_date, end_date, description, audience
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        uid,
        data.schoolId,
        data.title.trim(),
        data.eventType || "General",
        data.eventDate,
        data.endDate || null,
        data.description || null,
        data.audience || "ALL",
      ],
    );
    return { ok: true, id };
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; eventId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    await sql.query(
      `delete from calendar_events where id = $1 and school_id = $2`,
      [data.eventId, data.schoolId],
    );
    return { ok: true };
  });

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const documents = await sql<{
      id: string;
      title: string;
      category: string | null;
      description: string | null;
      file_url: string | null;
      audience: string;
      created_at: string;
    }>`
      select id, title, category, description, file_url, audience, created_at
      from documents where school_id = ${data.schoolId}
      order by created_at desc limit 100
    `;
    return { documents };
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      title: string;
      category?: string;
      description?: string;
      fileUrl?: string;
      audience?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const uid = school[0]?.user_id || context.userId;
    const id = nid(context.userId, `doc-${Date.now()}`);
    await sql.query(
      `insert into documents (
         id, user_id, school_id, title, category, description, file_url, audience, uploaded_by
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        uid,
        data.schoolId,
        data.title.trim(),
        data.category || "OTHER",
        data.description || null,
        data.fileUrl || null,
        data.audience || "STAFF",
        context.userId,
      ],
    );
    return { ok: true, id };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; documentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    await sql.query(`delete from documents where id = $1 and school_id = $2`, [
      data.documentId,
      data.schoolId,
    ]);
    return { ok: true };
  });

export const submitAdmission = createServerFn({ method: "POST" })
  .validator(
    (data: {
      slug: string;
      applicantName: string;
      dateOfBirth?: string;
      gender?: string;
      guardianName: string;
      guardianPhone: string;
      guardianEmail?: string;
      applyingClass?: string;
      previousSchool?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const schools = await sql<School>`
      select * from schools
      where parent_app_slug = ${data.slug.trim()} or slug = ${data.slug.trim()}
      limit 1
    `;
    const school = schools[0];
    if (!school) throw new Error("School not found");
    const id = `adm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await sql.query(
      `insert into admission_applications (
         id, school_id, applicant_name, date_of_birth, gender,
         guardian_name, guardian_phone, guardian_email,
         applying_class, previous_school, notes, status
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SUBMITTED')`,
      [
        id,
        school.id,
        data.applicantName.trim(),
        data.dateOfBirth || null,
        data.gender || null,
        data.guardianName.trim(),
        data.guardianPhone.trim(),
        data.guardianEmail || null,
        data.applyingClass || null,
        data.previousSchool || null,
        data.notes || null,
      ],
    );
    return { ok: true, id, schoolName: school.name };
  });

export const listAdmissions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "students.manage");
    const sql = await getSql();
    const applications = await sql<{
      id: string;
      applicant_name: string;
      guardian_name: string;
      guardian_phone: string;
      applying_class: string | null;
      status: string;
      created_at: string;
      previous_school: string | null;
    }>`
      select id, applicant_name, guardian_name, guardian_phone, applying_class, status, created_at, previous_school
      from admission_applications
      where school_id = ${data.schoolId}
      order by created_at desc
      limit 100
    `;
    return { applications };
  });

export const reviewAdmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      schoolId: string;
      applicationId: string;
      status: "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "ENROLLED";
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "students.manage");
    const sql = await getSql();
    await sql.query(
      `update admission_applications
       set status = $1, reviewed_by = $2, reviewed_at = now()
       where id = $3 and school_id = $4`,
      [data.status, context.userId, data.applicationId, data.schoolId],
    );
    return { ok: true };
  });

export const getStudentIdCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; studentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const students = await sql<Student>`
      select * from students where id = ${data.studentId} and school_id = ${data.schoolId} limit 1
    `;
    const student = students[0];
    if (!student) throw new Error("Student not found");
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const cls = student.class_id
      ? await sql<ClassRow>`select * from classes where id = ${student.class_id} limit 1`
      : [];
    return {
      school: school[0]
        ? {
            name: school[0].name,
            logo_mark: school[0].logo_mark,
            primary_color: school[0].primary_color,
            address: school[0].address,
            phone: school[0].phone,
          }
        : null,
      student: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number,
        gender: student.gender,
        classLabel: cls[0]
          ? `${cls[0].section} ${cls[0].name}${cls[0].stream ? " " + cls[0].stream : ""}`
          : "—",
      },
    };
  });

// ---------------------------------------------------------------------------
// F: Search, exports, job runner
// ---------------------------------------------------------------------------

export const searchSchool = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; q: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const q = data.q.trim();
    if (q.length < 2) {
      return { students: [], parents: [], payments: [], staff: [] };
    }
    const sql = await getSql();
    const like = `%${q.replace(/%/g, "")}%`;

    const students = await sql<{
      id: string;
      first_name: string;
      last_name: string;
      admission_number: string;
      class_id: string | null;
    }>`
      select id, first_name, last_name, admission_number, class_id
      from students
      where school_id = ${data.schoolId}
        and (
          first_name ilike ${like}
          or last_name ilike ${like}
          or admission_number ilike ${like}
          or (first_name || ' ' || last_name) ilike ${like}
        )
      limit 20
    `;

    const parents = await sql<{
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
    }>`
      select id, full_name, phone, email
      from parents
      where school_id = ${data.schoolId}
        and (full_name ilike ${like} or coalesce(phone,'') ilike ${like} or coalesce(email,'') ilike ${like})
      limit 15
    `;

    const payments = await sql<{
      id: string;
      receipt_number: string | null;
      reference: string | null;
      amount: string | number;
      student_id: string;
      payment_date: string;
    }>`
      select id, receipt_number, reference, amount, student_id, payment_date
      from payments
      where school_id = ${data.schoolId}
        and (coalesce(receipt_number,'') ilike ${like} or coalesce(reference,'') ilike ${like})
      limit 15
    `;

    const staff = await sql<{
      id: string;
      full_name: string;
      role_title: string | null;
      email: string | null;
    }>`
      select id, full_name, role_title, email
      from staff
      where school_id = ${data.schoolId}
        and (full_name ilike ${like} or coalesce(email,'') ilike ${like})
      limit 10
    `;

    return { students, parents, payments, staff, query: q };
  });

export const exportStudentsCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; classId?: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "students.view");
    const sql = await getSql();
    const students = data.classId
      ? await sql<Student>`
          select * from students where school_id = ${data.schoolId} and class_id = ${data.classId}
          order by last_name, first_name
        `
      : await sql<Student>`
          select * from students where school_id = ${data.schoolId}
          order by last_name, first_name
        `;
    const classes = await sql<ClassRow>`select * from classes where school_id = ${data.schoolId}`;
    const byId = new Map(classes.map((c) => [c.id, c]));
    const header = "admission_number,first_name,last_name,gender,class,status,phone";
    const rows = students.map((s) => {
      const c = s.class_id ? byId.get(s.class_id) : null;
      const className = c
        ? `${c.section} ${c.name}${c.stream ? " " + c.stream : ""}`
        : "";
      return [
        s.admission_number,
        s.first_name,
        s.last_name,
        s.gender,
        className,
        s.status,
        s.phone || "",
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",");
    });
    return { csv: [header, ...rows].join("\n"), filename: "students.csv", count: students.length };
  });

export const exportPaymentsCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "finance.view");
    const sql = await getSql();
    const payments = await sql<{
      receipt_number: string | null;
      payment_date: string;
      amount: string | number;
      method: string;
      reference: string | null;
      status: string;
      student_id: string;
    }>`
      select receipt_number, payment_date, amount, method, reference, status, student_id
      from payments where school_id = ${data.schoolId}
      order by payment_date desc
    `;
    const students = await sql<Student>`select id, first_name, last_name, admission_number from students where school_id = ${data.schoolId}`;
    const byId = new Map(students.map((s) => [s.id, s]));
    const header = "receipt_number,date,student,admission_number,amount,method,reference,status";
    const rows = payments.map((p) => {
      const s = byId.get(p.student_id);
      return [
        p.receipt_number || "",
        p.payment_date,
        s ? `${s.first_name} ${s.last_name}` : "",
        s?.admission_number || "",
        p.amount,
        p.method,
        p.reference || "",
        p.status,
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",");
    });
    return { csv: [header, ...rows].join("\n"), filename: "payments.csv", count: payments.length };
  });

export const exportChargesCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string }) => data)
  .handler(async ({ context, data }) => {
    await requirePermission(context.userId, data.schoolId, "finance.view");
    const sql = await getSql();
    const charges = await sql<StudentCharge>`
      select * from student_charges where school_id = ${data.schoolId}
    `;
    const students = await sql<Student>`
      select id, first_name, last_name, admission_number from students where school_id = ${data.schoolId}
    `;
    const byId = new Map(students.map((s) => [s.id, s]));
    const header = "student,admission_number,description,amount,paid,balance,status,due_date";
    const rows = charges.map((c) => {
      const s = byId.get(c.student_id);
      const balance = Math.max(0, Number(c.amount) - Number(c.paid));
      return [
        s ? `${s.first_name} ${s.last_name}` : "",
        s?.admission_number || "",
        c.description,
        c.amount,
        c.paid,
        balance,
        c.status,
        c.due_date || "",
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",");
    });
    return { csv: [header, ...rows].join("\n"), filename: "charges.csv", count: charges.length };
  });

export const enqueueBackgroundJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      jobType: "FEE_REMINDERS" | "GENERATE_INVOICES" | "MARK_OVERDUE_INVOICES";
      schoolId?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const { enqueueJob } = await import("./jobs");
    if (data.schoolId) {
      await requireSchoolAccess(context.userId, data.schoolId);
    } else {
      const platform = await isPlatformOwner(context.userId);
      if (!platform) throw new Error("Platform owner required for global jobs");
    }
    const id = await enqueueJob({
      jobType: data.jobType,
      schoolId: data.schoolId,
      payload: { requestedBy: context.userId },
    });
    return { ok: true, jobId: id };
  });

export const processBackgroundJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const platform = await isPlatformOwner(context.userId);
    // Allow school owners to process their own queued fee reminders via same runner
    const { claimNextJobs, completeJob } = await import("./jobs");
    const jobs = await claimNextJobs(10);
    const results: { id: string; type: string; ok: boolean; detail?: string }[] = [];

    for (const job of jobs) {
      try {
        if (job.job_type === "FEE_REMINDERS" && job.school_id) {
          // Reuse runFeeReminders logic by direct call pattern
          const res = await runFeeReminders({
            data: { schoolId: job.school_id, dryRun: false },
          });
          await completeJob(job.id);
          results.push({
            id: job.id,
            type: job.job_type,
            ok: true,
            detail: `sent ${res.sent}`,
          });
        } else if (job.job_type === "GENERATE_INVOICES") {
          const res = await generatePlatformInvoices({ data: { period: "monthly" } });
          await completeJob(job.id);
          results.push({
            id: job.id,
            type: job.job_type,
            ok: true,
            detail: `created ${res.count}`,
          });
        } else if (job.job_type === "MARK_OVERDUE_INVOICES") {
          const sql = await getSql();
          await sql.query(
            `update platform_invoices set status = 'OVERDUE'
             where status in ('SENT','DRAFT') and due_date < current_date`,
          );
          await completeJob(job.id);
          results.push({ id: job.id, type: job.job_type, ok: true });
        } else {
          await completeJob(job.id, `Unhandled job type: ${job.job_type}`);
          results.push({ id: job.id, type: job.job_type, ok: false, detail: "unhandled" });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        await completeJob(job.id, msg);
        results.push({ id: job.id, type: job.job_type, ok: false, detail: msg });
      }
    }

    return { processed: results.length, results };
  });

export const listBackgroundJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const jobs = await sql<{
      id: string;
      school_id: string | null;
      job_type: string;
      status: string;
      attempts: number;
      last_error: string | null;
      scheduled_for: string;
      finished_at: string | null;
    }>`
      select id, school_id, job_type, status, attempts, last_error, scheduled_for, finished_at
      from background_jobs
      order by created_at desc
      limit 50
    `;
    return { jobs };
  });

// ---------------------------------------------------------------------------
// PayChangu fee payments + report cards
// ---------------------------------------------------------------------------

export const initiateFeePayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (data: {
      chargeId: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      returnPath?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const charges = await sql<StudentCharge>`
      select * from student_charges where id = ${data.chargeId} limit 1
    `;
    const ch = charges[0];
    if (!ch) throw new Error("Charge not found");
    await requirePermission(context.userId, ch.school_id, "finance.manage");

    const balance = Math.max(0, Number(ch.amount) - Number(ch.paid));
    if (balance <= 0) throw new Error("Charge already paid");

    const students = await sql<Student>`select * from students where id = ${ch.student_id} limit 1`;
    const school = await sql<School>`select * from schools where id = ${ch.school_id} limit 1`;
    const st = students[0];

    const { initiateCheckout } = await import("./paychangu");
    const base =
      process.env.BETTER_AUTH_URL ||
      process.env.VITE_APP_URL ||
      "http://localhost:8080";
    const origin = base.replace(/\/$/, "");
    const txRef = `NEX-FEE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const returnPath = data.returnPath || "/app/finance";
    const returnUrl = `${origin}${returnPath.startsWith("/") ? returnPath : "/" + returnPath}`;
    const callbackUrl = `${origin}/api/paychangu/webhook`;

    const result = await initiateCheckout({
      amount: balance,
      currency: "MWK",
      txRef,
      email: data.email,
      firstName: data.firstName || st?.first_name,
      lastName: data.lastName || st?.last_name,
      callbackUrl,
      returnUrl,
      title: `${school[0]?.name || "School"} fees`,
      description: ch.description,
      meta: {
        purpose: "STUDENT_FEE",
        schoolId: ch.school_id,
        chargeId: ch.id,
        studentId: ch.student_id,
      },
    });

    if (!result.ok) throw new Error(result.error || "Could not start payment");

    const intentId = nid(context.userId, `pi-${Date.now()}`);
    await sql.query(
      `insert into payment_intents (
         id, school_id, purpose, student_id, charge_id, amount, currency, tx_ref,
         provider, status, checkout_url, payer_email, meta
       ) values ($1,$2,'STUDENT_FEE',$3,$4,$5,'MWK',$6,'paychangu','PENDING',$7,$8,$9::jsonb)`,
      [
        intentId,
        ch.school_id,
        ch.student_id,
        ch.id,
        balance,
        txRef,
        result.checkoutUrl || null,
        data.email || null,
        JSON.stringify({ chargeDescription: ch.description }),
      ],
    );

    return {
      ok: true,
      checkoutUrl: result.checkoutUrl,
      txRef,
      intentId,
      amount: balance,
      demo: result.status === "demo",
    };
  });

export const initiatePlatformInvoicePayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { invoiceId: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const inv = await sql<{
      id: string;
      school_id: string;
      invoice_number: string;
      amount: string | number;
      status: string;
    }>`select * from platform_invoices where id = ${data.invoiceId} limit 1`;
    const invoice = inv[0];
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "PAID") throw new Error("Already paid");

    const school = await sql<School>`select * from schools where id = ${invoice.school_id} limit 1`;
    const { initiateCheckout } = await import("./paychangu");
    const base =
      process.env.BETTER_AUTH_URL ||
      process.env.VITE_APP_URL ||
      "http://localhost:8080";
    const origin = base.replace(/\/$/, "");
    const txRef = `NEX-SUB-${invoice.invoice_number}-${Date.now()}`;
    const result = await initiateCheckout({
      amount: Number(invoice.amount),
      currency: "MWK",
      txRef,
      email: school[0]?.owner_email || school[0]?.email || undefined,
      callbackUrl: `${origin}/api/paychangu/webhook`,
      returnUrl: `${origin}/app/invoices`,
      title: `NEXUS subscription ${invoice.invoice_number}`,
      description: `Subscription for ${school[0]?.name || "school"}`,
      meta: {
        purpose: "PLATFORM_INVOICE",
        invoiceId: invoice.id,
        schoolId: invoice.school_id,
      },
    });
    if (!result.ok) throw new Error(result.error || "Could not start payment");

    const intentId = nid(context.userId, `pi-sub-${Date.now()}`);
    await sql.query(
      `insert into payment_intents (
         id, school_id, purpose, platform_invoice_id, amount, currency, tx_ref,
         provider, status, checkout_url, meta
       ) values ($1,$2,'PLATFORM_INVOICE',$3,$4,'MWK',$5,'paychangu','PENDING',$6,$7::jsonb)`,
      [
        intentId,
        invoice.school_id,
        invoice.id,
        invoice.amount,
        txRef,
        result.checkoutUrl || null,
        JSON.stringify({ invoiceNumber: invoice.invoice_number }),
      ],
    );

    return { ok: true, checkoutUrl: result.checkoutUrl, txRef, intentId };
  });

/** Complete a successful PayChangu payment (after verify or webhook). */
export async function fulfillPaychanguPayment(txRef: string) {
  const sql = await getSql();
  const { verifyPayment } = await import("./paychangu");
  const verified = await verifyPayment(txRef);
  if (!verified.ok && verified.status !== "success") {
    return { ok: false, error: verified.error || "Not paid" };
  }

  const intents = await sql<{
    id: string;
    school_id: string;
    purpose: string;
    student_id: string | null;
    charge_id: string | null;
    platform_invoice_id: string | null;
    amount: string | number;
    status: string;
    user_id?: string;
  }>`select * from payment_intents where tx_ref = ${txRef} limit 1`;

  const intent = intents[0];
  if (!intent) return { ok: false, error: "Intent not found" };
  if (intent.status === "SUCCESS") return { ok: true, already: true };

  await sql.query(
    `update payment_intents set status = 'SUCCESS', completed_at = now(),
       provider_reference = $1, channel = $2
     where id = $3`,
    [verified.reference || null, verified.channel || null, intent.id],
  );

  if (intent.purpose === "STUDENT_FEE" && intent.charge_id) {
    const charges = await sql<StudentCharge>`
      select * from student_charges where id = ${intent.charge_id} limit 1
    `;
    const ch = charges[0];
    if (ch) {
      const paid = Number(ch.paid) + Number(intent.amount);
      const amount = Number(ch.amount);
      const status = paid >= amount - 0.5 ? "PAID" : "PARTIAL";
      await sql.query(
        `update student_charges set paid = $1, status = $2 where id = $3`,
        [paid, status, ch.id],
      );
      const receipt = `PC-${String(Date.now()).slice(-8)}`;
      const payId = `pay-pc-${Date.now()}`;
      await sql.query(
        `insert into payments (
           id, user_id, school_id, student_id, amount, method, reference,
           payment_date, status, recorded_by, receipt_number
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,'VERIFIED',$9,$10)`,
        [
          payId,
          ch.user_id,
          ch.school_id,
          ch.student_id,
          intent.amount,
          verified.channel || "PayChangu",
          verified.reference || txRef,
          new Date().toISOString().slice(0, 10),
          "PayChangu",
          receipt,
        ],
      );
    }
  }

  if (intent.purpose === "PLATFORM_INVOICE" && intent.platform_invoice_id) {
    await sql.query(
      `update platform_invoices set status = 'PAID', paid_at = now(), payment_reference = $1
       where id = $2`,
      [verified.reference || txRef, intent.platform_invoice_id],
    );
    await sql.query(
      `update schools set status = 'ACTIVE',
         subscription_expires_at = now() + interval '32 days'
       where id = $1`,
      [intent.school_id],
    );
  }

  return { ok: true };
}

export const confirmPaychanguReturn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { txRef: string }) => data)
  .handler(async ({ data }) => {
    return fulfillPaychanguPayment(data.txRef);
  });

export const generateReportCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { schoolId: string; studentId: string; termId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireSchoolAccess(context.userId, data.schoolId);
    const sql = await getSql();
    const school = await sql<School>`select * from schools where id = ${data.schoolId} limit 1`;
    const student = await sql<Student>`
      select * from students where id = ${data.studentId} and school_id = ${data.schoolId} limit 1
    `;
    if (!student[0] || !school[0]) throw new Error("Not found");

    const term = await sql<{ id: string; name: string }>`
      select id, name from terms where id = ${data.termId} limit 1
    `;
    const results = await sql<{
      subject_id: string;
      overall_score: string | number | null;
      grade: string | null;
      position: number | null;
      status: string;
    }>`
      select subject_id, overall_score, grade, position, status
      from student_results
      where student_id = ${data.studentId} and term_id = ${data.termId}
        and status in ('PUBLISHED','APPROVED','READY_TO_PUBLISH','VERIFIED','LOCKED')
    `;
    const subjects = await sql<{ id: string; name: string; code: string | null }>`
      select id, name, code from subjects where school_id = ${data.schoolId}
    `;
    const bySub = new Map(subjects.map((s) => [s.id, s]));
    const cls = student[0].class_id
      ? await sql<ClassRow>`select * from classes where id = ${student[0].class_id} limit 1`
      : [];

    const rows = results.map((r) => ({
      subject: bySub.get(r.subject_id)?.name || "—",
      code: bySub.get(r.subject_id)?.code || "",
      score: r.overall_score != null ? Number(r.overall_score) : null,
      grade: r.grade,
    }));
    const scored = rows.filter((r) => r.score != null);
    const average =
      scored.length === 0
        ? null
        : Math.round(
            (scored.reduce((a, r) => a + (r.score as number), 0) / scored.length) * 10,
          ) / 10;
    const position = results.find((r) => r.position != null)?.position ?? null;

    return {
      school: {
        name: school[0].name,
        motto: school[0].motto,
        logo_mark: school[0].logo_mark,
        primary_color: school[0].primary_color || "#0f766e",
        address: school[0].address,
        phone: school[0].phone,
      },
      student: {
        name: `${student[0].first_name} ${student[0].last_name}`,
        admission_number: student[0].admission_number,
        classLabel: cls[0]
          ? `${cls[0].section} ${cls[0].name}${cls[0].stream ? " " + cls[0].stream : ""}`
          : "—",
      },
      term: term[0]?.name || "Term",
      rows,
      average,
      position,
      generatedAt: new Date().toISOString(),
    };
  });
