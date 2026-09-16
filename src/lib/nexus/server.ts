import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { gradeFromScore, num } from "@/lib/utils";
import { ensureWorkspace, nid } from "./seed";
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

  const schools = await sql<School>`
    select * from schools where user_id = ${userId} order by name
  `;
  const school =
    schools.find((s) => s.slug === schoolSlug) ??
    schools.find((s) => s.slug === "sunrise") ??
    schools[0];
  if (!school) throw new Error("No school in workspace");
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
      select * from student_charges where id = ${data.chargeId} and user_id = ${context.userId}
    `;
    const ch = charges[0];
    if (!ch) throw new Error("Charge not found");
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
    await audit(
      context.userId,
      ch.school_id,
      "Bursar",
      "RECORD_PAYMENT",
      "payments",
      payId,
      `Recorded ${data.method} ${data.amount} receipt ${receipt}.`,
    );
    return { ok: true, receipt, status };
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
