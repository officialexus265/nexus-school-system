import type { Sql } from "@/lib/db";
import { gradeFromScore } from "@/lib/utils";

export function nid(userId: string, key: string): string {
  return `${userId}:${key}`;
}

type Row = Record<string, unknown>;

async function ins(sql: Sql, table: string, row: Row) {
  const keys = Object.keys(row);
  const vals = Object.values(row);
  const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
  await sql.query(`insert into ${table} (${keys.join(", ")}) values (${ph})`, vals);
}

async function insMany(sql: Sql, table: string, rows: Row[]) {
  for (const row of rows) await ins(sql, table, row);
}

export async function seedWorkspace(sql: Sql, userId: string) {
  const id = (key: string) => nid(userId, key);
  const u = userId;

  const sunrise = id("sch-sunrise");
  const lakeview = id("sch-lakeview");
  const karonga = id("sch-karonga");

  await insMany(sql, "schools", [
    {
      id: sunrise,
      user_id: u,
      slug: "sunrise",
      name: "Sunrise Academy",
      registration_number: "EDU-LLW-2014-088",
      address: "Area 10, Kenyatta Drive",
      district: "Lilongwe",
      city: "Lilongwe",
      country: "Malawi",
      phone: "+265 1 755 210",
      email: "office@sunrise.ac.mw",
      website: "sunrise.ac.mw",
      motto: "Light. Discipline. Excellence.",
      school_type: "Primary & Secondary",
      boarding_status: "Day and boarding",
      status: "ACTIVE",
      logo_mark: "S",
      primary_color: "#2F5F5A",
      secondary_color: "#F3F0E8",
      timezone: "Africa/Blantyre",
      currency: "MWK",
      subscription_plan: "Campus",
      activation_fee: 850000,
      student_capacity: 640,
      parent_app_name: "Sunrise Parent",
      parent_app_slug: "sunrise",
    },
    {
      id: lakeview,
      user_id: u,
      slug: "lakeview",
      name: "Lakeview Secondary",
      registration_number: "EDU-BT-2019-041",
      address: "Mandala Road",
      district: "Blantyre",
      city: "Blantyre",
      country: "Malawi",
      phone: "+265 1 822 440",
      email: "admin@lakeview.ac.mw",
      website: null,
      motto: "By the lake, toward the horizon.",
      school_type: "Secondary",
      boarding_status: "Day",
      status: "PENDING_PAYMENT",
      logo_mark: "L",
      primary_color: "#1E3D3A",
      secondary_color: "#F3F0E8",
      timezone: "Africa/Blantyre",
      currency: "MWK",
      subscription_plan: "Campus",
      activation_fee: 850000,
      student_capacity: 420,
    },
    {
      id: karonga,
      user_id: u,
      slug: "karonga",
      name: "Karonga Girls High",
      registration_number: "EDU-KA-2011-016",
      address: "M1 North",
      district: "Karonga",
      city: "Karonga",
      country: "Malawi",
      phone: "+265 1 362 110",
      email: "head@karongagirls.ac.mw",
      website: null,
      motto: "Character before applause.",
      school_type: "Secondary",
      boarding_status: "Boarding",
      status: "GRACE_PERIOD",
      logo_mark: "K",
      primary_color: "#2F5F5A",
      secondary_color: "#F3F0E8",
      timezone: "Africa/Blantyre",
      currency: "MWK",
      subscription_plan: "Studio",
      activation_fee: 620000,
      student_capacity: 280,
    },
  ]);

  const staffRows = [
    ["st-owner", "Dr. Chimwemwe Phiri", "owner", "School Owner", "CP"],
    ["st-head", "Mrs. Grace Mvula", "head", "Head Teacher", "GM"],
    ["st-deputy", "Mr. Blessings Chirwa", "deputy", "Deputy Head", "BC"],
    ["st-bursar", "Mrs. Thandiwe Banda", "bursar", "Bursar", "TB"],
    ["st-exam", "Mr. Patrick Gondwe", "exam", "Examination Officer", "PG"],
    ["st-james", "Mr. James Banda", "teacher", "Mathematics", "JB"],
    ["st-linda", "Ms. Linda Phiri", "teacher", "English", "LP"],
    ["st-yusuf", "Mr. Yusuf Mwale", "teacher", "Science", "YM"],
    ["st-mercy", "Mrs. Mercy Kachale", "teacher", "Standard 5 class teacher", "MK"],
    ["st-isaac", "Mr. Isaac Nkhoma", "teacher", "Standard 7 class teacher", "IN"],
  ] as const;

  await insMany(
    sql,
    "staff",
    staffRows.map(([key, name, role, title, initials]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      full_name: name,
      email: `${key.replace("st-", "")}@sunrise.ac.mw`,
      phone: "+265 99 100 00" + key.length,
      role,
      title,
      status: "ACTIVE",
      initials,
    })),
  );

  const classKeys = [
    ["cl-f2a", "Secondary", "Form 2", "A", 12],
    ["cl-f1a", "Secondary", "Form 1", "A", 11],
    ["cl-f1b", "Secondary", "Form 1", "B", 11],
    ["cl-s7", "Primary", "Standard 7", null, 7],
    ["cl-s5", "Primary", "Standard 5", null, 5],
  ] as const;

  await insMany(
    sql,
    "classes",
    classKeys.map(([key, section, name, stream, order]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      section,
      name,
      stream,
      level_order: order,
    })),
  );

  const subjectKeys = [
    ["sub-math", "Mathematics", "MATH", "Secondary"],
    ["sub-eng", "English", "ENG", "Secondary"],
    ["sub-sci", "Science", "SCI", "Secondary"],
    ["sub-pmath", "Mathematics", "PMATH", "Primary"],
    ["sub-peng", "English", "PENG", "Primary"],
    ["sub-pchichewa", "Chichewa", "CHI", "Primary"],
  ] as const;

  await insMany(
    sql,
    "subjects",
    subjectKeys.map(([key, name, code, section]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      name,
      code,
      section,
    })),
  );

  const assigns: [string, string, string, boolean][] = [
    ["st-james", "cl-f2a", "sub-math", true],
    ["st-james", "cl-f1a", "sub-math", false],
    ["st-james", "cl-f1b", "sub-math", false],
    ["st-linda", "cl-f2a", "sub-eng", false],
    ["st-linda", "cl-f1a", "sub-eng", true],
    ["st-yusuf", "cl-f2a", "sub-sci", false],
    ["st-yusuf", "cl-f1a", "sub-sci", false],
    ["st-mercy", "cl-s5", "sub-pmath", true],
    ["st-mercy", "cl-s5", "sub-peng", false],
    ["st-isaac", "cl-s7", "sub-pmath", true],
    ["st-isaac", "cl-s7", "sub-peng", false],
  ];

  await insMany(
    sql,
    "teacher_assignments",
    assigns.map(([staff, cls, sub, isCt], i) => ({
      id: id(`ta-${i}`),
      user_id: u,
      school_id: sunrise,
      staff_id: id(staff),
      class_id: id(cls),
      subject_id: id(sub),
      is_class_teacher: isCt,
    })),
  );

  type Stu = [string, string, string, string, string, string, string, string];
  const students: Stu[] = [
    ["stu-john", "SA-2024-014", "John", "Banda", "M", "2009-03-12", "cl-f2a", "Area 10"],
    ["stu-chisomo", "SA-2024-015", "Chisomo", "Mvula", "F", "2009-07-02", "cl-f2a", "Area 18"],
    ["stu-tiya", "SA-2024-016", "Tiyamike", "Gondwe", "M", "2009-11-19", "cl-f2a", "Kanengo"],
    ["stu-faith", "SA-2024-017", "Faith", "Chirwa", "F", "2009-01-28", "cl-f2a", "Area 47"],
    ["stu-blessings", "SA-2025-021", "Blessings", "Phiri", "M", "2010-04-08", "cl-f1a", "Area 12"],
    ["stu-tamara", "SA-2025-022", "Tamara", "Mwale", "F", "2010-09-14", "cl-f1a", "Area 9"],
    ["stu-patrick", "SA-2025-031", "Patrick", "Nkhoma", "M", "2010-06-21", "cl-f1b", "Area 25"],
    ["stu-linda", "SA-2025-032", "Linda", "Kachale", "F", "2010-12-03", "cl-f1b", "Area 15"],
    ["stu-mary", "SA-2023-008", "Mary", "Banda", "F", "2014-05-16", "cl-s5", "Area 10"],
    ["stu-yankho", "SA-2023-009", "Yankho", "Banda", "M", "2014-08-11", "cl-s5", "Area 18"],
    ["stu-mercy", "SA-2022-004", "Mercy", "Mvula", "F", "2012-02-27", "cl-s7", "Area 18"],
    ["stu-gift", "SA-2022-005", "Gift", "Phiri", "M", "2012-10-09", "cl-s7", "Area 12"],
  ];

  await insMany(
    sql,
    "students",
    students.map(([key, adm, first, last, gender, dob, cls, address]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      admission_number: adm,
      first_name: first,
      last_name: last,
      gender,
      date_of_birth: dob,
      class_id: id(cls),
      status: "ACTIVE",
      admission_date: "2024-01-15",
      address,
    })),
  );

  const parents: [string, string, string][] = [
    ["par-agnes", "Agnes Banda", "+265 99 811 2201"],
    ["par-ellen", "Ellen Mvula", "+265 88 422 1094"],
    ["par-joseph", "Joseph Gondwe", "+265 99 300 4412"],
    ["par-ruth", "Ruth Chirwa", "+265 88 771 0098"],
    ["par-peter", "Peter Phiri", "+265 99 214 8830"],
    ["par-alice", "Alice Mwale", "+265 88 650 2177"],
  ];

  await insMany(
    sql,
    "parents",
    parents.map(([key, name, phone]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      full_name: name,
      phone,
      email: `${key.replace("par-", "")}@mail.mw`,
      verification_status: "VERIFIED",
    })),
  );

  const links: [string, string, string][] = [
    ["par-agnes", "stu-john", "Mother"],
    ["par-agnes", "stu-mary", "Mother"],
    ["par-ellen", "stu-chisomo", "Mother"],
    ["par-ellen", "stu-mercy", "Mother"],
    ["par-joseph", "stu-tiya", "Father"],
    ["par-ruth", "stu-faith", "Mother"],
    ["par-peter", "stu-blessings", "Father"],
    ["par-peter", "stu-gift", "Father"],
    ["par-alice", "stu-tamara", "Mother"],
    ["par-alice", "stu-yankho", "Aunt"],
  ];

  await insMany(
    sql,
    "parent_students",
    links.map(([p, s, rel], i) => ({
      id: id(`ps-${i}`),
      user_id: u,
      parent_id: id(p),
      student_id: id(s),
      relationship: rel,
      is_primary: true,
    })),
  );

  const year = id("yr-2026");
  await ins(sql, "academic_years", {
    id: year,
    user_id: u,
    school_id: sunrise,
    name: "2026",
    is_current: true,
  });

  const t1 = id("term-1");
  const t2 = id("term-2");
  await insMany(sql, "terms", [
    {
      id: t1,
      user_id: u,
      school_id: sunrise,
      academic_year_id: year,
      name: "Term 1",
      term_number: 1,
      is_current: false,
      start_date: "2026-01-13",
      end_date: "2026-04-10",
    },
    {
      id: t2,
      user_id: u,
      school_id: sunrise,
      academic_year_id: year,
      name: "Term 2",
      term_number: 2,
      is_current: true,
      start_date: "2026-05-04",
      end_date: "2026-08-14",
    },
  ]);

  await insMany(sql, "assessments", [
    {
      id: id("as-math-quiz"),
      user_id: u,
      school_id: sunrise,
      class_id: id("cl-f2a"),
      subject_id: id("sub-math"),
      staff_id: id("st-james"),
      term_id: t2,
      name: "Algebra quiz",
      assessment_type: "Quiz",
      maximum_marks: 20,
      weight: 10,
      due_date: "2026-06-12",
      status: "MARKED",
    },
    {
      id: id("as-eng-essay"),
      user_id: u,
      school_id: sunrise,
      class_id: id("cl-f2a"),
      subject_id: id("sub-eng"),
      staff_id: id("st-linda"),
      term_id: t2,
      name: "Narrative essay",
      assessment_type: "Assignment",
      maximum_marks: 30,
      weight: 10,
      due_date: "2026-06-20",
      status: "MARKED",
    },
    {
      id: id("as-sci-prac"),
      user_id: u,
      school_id: sunrise,
      class_id: id("cl-f2a"),
      subject_id: id("sub-sci"),
      staff_id: id("st-yusuf"),
      term_id: t2,
      name: "Lab practical",
      assessment_type: "Practical",
      maximum_marks: 25,
      weight: 10,
      due_date: "2026-07-02",
      status: "OPEN",
    },
  ]);

  const f2a = ["stu-john", "stu-chisomo", "stu-tiya", "stu-faith"] as const;
  const quizScores: Record<string, number> = {
    "stu-john": 16,
    "stu-chisomo": 18,
    "stu-tiya": 12,
    "stu-faith": 15,
  };
  const essayScores: Record<string, number> = {
    "stu-john": 24,
    "stu-chisomo": 27,
    "stu-tiya": 19,
    "stu-faith": 22,
  };

  await insMany(
    sql,
    "assessment_scores",
    f2a.map((s) => ({
      id: id(`sc-q-${s}`),
      user_id: u,
      assessment_id: id("as-math-quiz"),
      student_id: id(s),
      score: quizScores[s],
      comment: null,
    })),
  );
  await insMany(
    sql,
    "assessment_scores",
    f2a.map((s) => ({
      id: id(`sc-e-${s}`),
      user_id: u,
      assessment_id: id("as-eng-essay"),
      student_id: id(s),
      score: essayScores[s],
      comment: null,
    })),
  );

  // Term 1 published results for Form 2A
  type Marks = { c: number; e: number; comment: string };
  const t1Marks: Record<string, Record<string, Marks>> = {
    "stu-john": {
      "sub-math": { c: 78, e: 84, comment: "Consistent and careful." },
      "sub-eng": { c: 74, e: 77, comment: "Voice is forming. Keep reading." },
      "sub-sci": { c: 88, e: 93, comment: "Excellent practical work." },
    },
    "stu-chisomo": {
      "sub-math": { c: 90, e: 92, comment: "Top of the class." },
      "sub-eng": { c: 86, e: 89, comment: "Fluent and precise." },
      "sub-sci": { c: 84, e: 86, comment: "Strong conceptual grasp." },
    },
    "stu-tiya": {
      "sub-math": { c: 62, e: 68, comment: "Needs more practice on algebra." },
      "sub-eng": { c: 70, e: 72, comment: "Improving structure." },
      "sub-sci": { c: 76, e: 80, comment: "Good lab technique." },
    },
    "stu-faith": {
      "sub-math": { c: 80, e: 76, comment: "Solid. Watch careless errors." },
      "sub-eng": { c: 82, e: 85, comment: "Beautiful essays." },
      "sub-sci": { c: 71, e: 74, comment: "Revise formulae." },
    },
  };

  const t1Results: Row[] = [];
  const t1Subs: Row[] = [];
  for (const sub of ["sub-math", "sub-eng", "sub-sci"] as const) {
    t1Subs.push({
      id: id(`rs-t1-${sub}`),
      user_id: u,
      school_id: sunrise,
      class_id: id("cl-f2a"),
      subject_id: id(sub),
      term_id: t1,
      staff_id: id(sub === "sub-math" ? "st-james" : sub === "sub-eng" ? "st-linda" : "st-yusuf"),
      status: "PUBLISHED",
      submitted_at: "2026-04-02T10:00:00Z",
      reviewed_at: "2026-04-04T09:00:00Z",
      approved_at: "2026-04-05T11:00:00Z",
      published_at: "2026-04-06T08:00:00Z",
      published_by: "Mrs. Grace Mvula",
    });
    for (const s of f2a) {
      const m = t1Marks[s]![sub]!;
      const overall = Math.round(m.c * 0.4 + m.e * 0.6);
      t1Results.push({
        id: id(`res-t1-${s}-${sub}`),
        user_id: u,
        school_id: sunrise,
        student_id: id(s),
        term_id: t1,
        subject_id: id(sub),
        continuous_score: m.c,
        exam_score: m.e,
        overall_score: overall,
        grade: gradeFromScore(overall),
        position: null,
        status: "PUBLISHED",
        teacher_comment: m.comment,
      });
    }
  }
  await insMany(sql, "result_submissions", t1Subs);
  await insMany(sql, "student_results", t1Results);

  // Rank term 1 overall per student
  const t1Overall = f2a.map((s) => {
    const subs = ["sub-math", "sub-eng", "sub-sci"] as const;
    const avg =
      subs.reduce((a, sub) => {
        const m = t1Marks[s]![sub]!;
        return a + Math.round(m.c * 0.4 + m.e * 0.6);
      }, 0) / 3;
    return { s, avg };
  });
  t1Overall.sort((a, b) => b.avg - a.avg);
  for (let i = 0; i < t1Overall.length; i++) {
    const s = t1Overall[i]!.s;
    await sql.query(
      `update student_results set position = $1 where user_id = $2 and student_id = $3 and term_id = $4`,
      [i + 1, u, id(s), t1],
    );
  }

  // Term 2 in-flight: math SUBMITTED, english VERIFIED, science DRAFT
  const t2Marks: Record<string, Record<string, { c: number; e: number; comment: string }>> = {
    "stu-john": {
      "sub-math": { c: 80, e: 81, comment: "Steady improvement." },
      "sub-eng": { c: 76, e: 79, comment: "Clearer argument this term." },
      "sub-sci": { c: 90, e: 88, comment: "Draft — awaiting practical." },
    },
    "stu-chisomo": {
      "sub-math": { c: 92, e: 94, comment: "Outstanding." },
      "sub-eng": { c: 88, e: 90, comment: "Publishable writing." },
      "sub-sci": { c: 85, e: 87, comment: "Draft." },
    },
    "stu-tiya": {
      "sub-math": { c: 64, e: 70, comment: "Better on word problems." },
      "sub-eng": { c: 71, e: 73, comment: "Keep the reading log." },
      "sub-sci": { c: 74, e: 76, comment: "Draft." },
    },
    "stu-faith": {
      "sub-math": { c: 78, e: 80, comment: "Cleaner algebra." },
      "sub-eng": { c: 84, e: 86, comment: "Strong voice." },
      "sub-sci": { c: 72, e: 75, comment: "Draft." },
    },
  };

  const t2Status: Record<string, string> = {
    "sub-math": "SUBMITTED",
    "sub-eng": "VERIFIED",
    "sub-sci": "DRAFT",
  };

  for (const sub of ["sub-math", "sub-eng", "sub-sci"] as const) {
    const st = t2Status[sub]!;
    await ins(sql, "result_submissions", {
      id: id(`rs-t2-${sub}`),
      user_id: u,
      school_id: sunrise,
      class_id: id("cl-f2a"),
      subject_id: id(sub),
      term_id: t2,
      staff_id: id(sub === "sub-math" ? "st-james" : sub === "sub-eng" ? "st-linda" : "st-yusuf"),
      status: st,
      submitted_at: st === "DRAFT" ? null : "2026-08-01T10:00:00Z",
      reviewed_at: st === "VERIFIED" ? "2026-08-03T09:00:00Z" : null,
      approved_at: null,
      published_at: null,
      published_by: null,
    });
    for (const s of f2a) {
      const m = t2Marks[s]![sub]!;
      const overall = Math.round(m.c * 0.4 + m.e * 0.6);
      await ins(sql, "student_results", {
        id: id(`res-t2-${s}-${sub}`),
        user_id: u,
        school_id: sunrise,
        student_id: id(s),
        term_id: t2,
        subject_id: id(sub),
        continuous_score: m.c,
        exam_score: m.e,
        overall_score: overall,
        grade: gradeFromScore(overall),
        position: null,
        status: st,
        teacher_comment: m.comment,
      });
    }
  }

  // Attendance — last 8 school days for Form 2A + Mary
  const days = [
    "2026-09-04",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
    "2026-09-14",
    "2026-09-15",
  ];
  const attPattern: Record<string, string[]> = {
    "stu-john": ["P", "P", "P", "L", "P", "P", "P", "P"],
    "stu-chisomo": ["P", "P", "P", "P", "P", "P", "P", "P"],
    "stu-tiya": ["P", "A", "P", "P", "P", "L", "P", "P"],
    "stu-faith": ["P", "P", "P", "P", "E", "P", "P", "P"],
    "stu-mary": ["P", "P", "P", "P", "P", "P", "P", "P"],
  };
  const map: Record<string, string> = { P: "PRESENT", A: "ABSENT", L: "LATE", E: "EXCUSED" };
  const attRows: Row[] = [];
  for (const [stu, pattern] of Object.entries(attPattern)) {
    pattern.forEach((code, i) => {
      attRows.push({
        id: id(`att-${stu}-${days[i]}`),
        user_id: u,
        school_id: sunrise,
        student_id: id(stu),
        class_id: id(stu === "stu-mary" ? "cl-s5" : "cl-f2a"),
        date: days[i],
        status: map[code],
        recorded_by: "Mr. James Banda",
      });
    });
  }
  await insMany(sql, "attendance", attRows);

  await insMany(sql, "behaviour_records", [
    {
      id: id("beh-1"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-john"),
      category: "Helpfulness",
      kind: "POSITIVE",
      severity: "Low",
      points: 5,
      description: "Tutored a Form 1 student after games.",
      date: "2026-09-08",
      status: "CLOSED",
      recorded_by: "Mr. James Banda",
    },
    {
      id: id("beh-2"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-tiya"),
      category: "Punctuality",
      kind: "NEGATIVE",
      severity: "Low",
      points: -2,
      description: "Late to first period without a note.",
      date: "2026-09-11",
      status: "OPEN",
      recorded_by: "Mrs. Grace Mvula",
    },
    {
      id: id("beh-3"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-chisomo"),
      category: "Leadership",
      kind: "POSITIVE",
      severity: "Medium",
      points: 8,
      description: "Led the science club demonstration for Standard 7.",
      date: "2026-09-04",
      status: "CLOSED",
      recorded_by: "Mr. Yusuf Mwale",
    },
  ]);

  const feeDefs: [string, string, number, string | null][] = [
    ["fee-tu-f2", "Tuition", 450000, "cl-f2a"],
    ["fee-ex-f2", "Examination fee", 25000, "cl-f2a"],
    ["fee-tr-f2", "Transport", 80000, "cl-f2a"],
    ["fee-tu-s5", "Tuition", 280000, "cl-s5"],
    ["fee-un-s5", "Uniform", 45000, "cl-s5"],
  ];
  await insMany(
    sql,
    "fee_structures",
    feeDefs.map(([key, name, amount, cls]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      name,
      class_id: cls ? id(cls) : null,
      term_id: t2,
      amount,
      due_date: "2026-09-30",
      mandatory: true,
    })),
  );

  const charges: [string, string, string, number, number, string][] = [
    ["ch-john-tu", "stu-john", "fee-tu-f2", 450000, 300000, "PARTIAL"],
    ["ch-john-ex", "stu-john", "fee-ex-f2", 25000, 0, "UNPAID"],
    ["ch-john-tr", "stu-john", "fee-tr-f2", 80000, 80000, "PAID"],
    ["ch-chi-tu", "stu-chisomo", "fee-tu-f2", 450000, 450000, "PAID"],
    ["ch-chi-ex", "stu-chisomo", "fee-ex-f2", 25000, 25000, "PAID"],
    ["ch-tiya-tu", "stu-tiya", "fee-tu-f2", 450000, 150000, "PARTIAL"],
    ["ch-mary-tu", "stu-mary", "fee-tu-s5", 280000, 280000, "PAID"],
    ["ch-mary-un", "stu-mary", "fee-un-s5", 45000, 0, "UNPAID"],
  ];
  await insMany(
    sql,
    "student_charges",
    charges.map(([key, stu, fee, amount, paid, status]) => ({
      id: id(key),
      user_id: u,
      school_id: sunrise,
      student_id: id(stu),
      fee_structure_id: id(fee),
      description: feeDefs.find((f) => f[0] === fee)?.[1] ?? "Fee",
      amount,
      paid,
      due_date: "2026-09-30",
      status,
    })),
  );

  await insMany(sql, "payments", [
    {
      id: id("pay-1"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-john"),
      parent_id: id("par-agnes"),
      amount: 300000,
      method: "Airtel Money",
      reference: "AM-229184",
      payment_date: "2026-08-20",
      status: "VERIFIED",
      recorded_by: "Mrs. Thandiwe Banda",
      receipt_number: "SA-2026-0412",
    },
    {
      id: id("pay-2"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-john"),
      parent_id: id("par-agnes"),
      amount: 80000,
      method: "Cash",
      reference: null,
      payment_date: "2026-08-22",
      status: "VERIFIED",
      recorded_by: "Mrs. Thandiwe Banda",
      receipt_number: "SA-2026-0418",
    },
    {
      id: id("pay-3"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-chisomo"),
      parent_id: id("par-ellen"),
      amount: 475000,
      method: "Bank transfer",
      reference: "NBM-881203",
      payment_date: "2026-08-12",
      status: "VERIFIED",
      recorded_by: "Mrs. Thandiwe Banda",
      receipt_number: "SA-2026-0388",
    },
    {
      id: id("pay-4"),
      user_id: u,
      school_id: sunrise,
      student_id: id("stu-mary"),
      parent_id: id("par-agnes"),
      amount: 280000,
      method: "Airtel Money",
      reference: "AM-230011",
      payment_date: "2026-08-21",
      status: "VERIFIED",
      recorded_by: "Mrs. Thandiwe Banda",
      receipt_number: "SA-2026-0415",
    },
  ]);

  await insMany(sql, "announcements", [
    {
      id: id("an-1"),
      user_id: u,
      school_id: sunrise,
      title: "Term 2 examinations begin 22 September",
      body: "The examination timetable is posted on the parent portal. Students should be on campus by 07:30. Calculators are permitted for Mathematics Paper 2 only.",
      audience: "ALL",
      class_id: null,
      created_at: "2026-09-10T08:00:00Z",
      author: "Mrs. Grace Mvula",
    },
    {
      id: id("an-2"),
      user_id: u,
      school_id: sunrise,
      title: "Fee deadline 30 September",
      body: "Outstanding Term 2 balances should be cleared before the examination period. Airtel Money, bank transfer and cash at the bursar’s office are accepted.",
      audience: "PARENTS",
      class_id: null,
      created_at: "2026-09-08T09:30:00Z",
      author: "Mrs. Thandiwe Banda",
    },
    {
      id: id("an-3"),
      user_id: u,
      school_id: sunrise,
      title: "Science club — Saturday 20 September",
      body: "Form 2 science club will host a practical for Standard 7. Volunteers from Form 2A please confirm with Mr. Mwale.",
      audience: "CLASS",
      class_id: id("cl-f2a"),
      created_at: "2026-09-12T14:00:00Z",
      author: "Mr. Yusuf Mwale",
    },
  ]);

  await insMany(sql, "notifications", [
    {
      id: id("nt-1"),
      user_id: u,
      school_id: sunrise,
      title: "Term 1 results published",
      message: "Form 2A Term 1 results are now visible to verified parents.",
      channel: "IN_APP",
      event_type: "RESULT_PUBLISHED",
      created_at: "2026-04-06T08:01:00Z",
      is_read: true,
    },
    {
      id: id("nt-2"),
      user_id: u,
      school_id: sunrise,
      title: "Absence recorded",
      message: "Tiyamike Gondwe was marked absent on 7 September.",
      channel: "SMS",
      event_type: "ABSENCE",
      created_at: "2026-09-07T08:40:00Z",
      is_read: false,
    },
    {
      id: id("nt-3"),
      user_id: u,
      school_id: sunrise,
      title: "Fee reminder",
      message: "John Banda — MK 175,000 outstanding. Due 30 September.",
      channel: "PUSH",
      event_type: "FEE_DUE",
      created_at: "2026-09-14T07:00:00Z",
      is_read: false,
    },
  ]);

  await insMany(sql, "audit_logs", [
    {
      id: id("au-1"),
      user_id: u,
      school_id: sunrise,
      actor: "Mrs. Grace Mvula",
      action: "PUBLISH_RESULTS",
      entity_type: "result_submissions",
      entity_id: id("rs-t1-sub-math"),
      detail: "Published Form 2A Term 1 results for 4 students.",
      created_at: "2026-04-06T08:00:00Z",
    },
    {
      id: id("au-2"),
      user_id: u,
      school_id: sunrise,
      actor: "Mrs. Thandiwe Banda",
      action: "RECORD_PAYMENT",
      entity_type: "payments",
      entity_id: id("pay-1"),
      detail: "Verified Airtel Money MK 300,000 for John Banda.",
      created_at: "2026-08-20T11:12:00Z",
    },
    {
      id: id("au-3"),
      user_id: u,
      school_id: sunrise,
      actor: "Mr. James Banda",
      action: "SUBMIT_MARKS",
      entity_type: "result_submissions",
      entity_id: id("rs-t2-sub-math"),
      detail: "Submitted Form 2A Mathematics Term 2 marks.",
      created_at: "2026-08-01T10:00:00Z",
    },
    {
      id: id("au-4"),
      user_id: u,
      school_id: lakeview,
      actor: "Platform",
      action: "REGISTER_SCHOOL",
      entity_type: "schools",
      entity_id: lakeview,
      detail: "Lakeview Secondary registered. Awaiting activation payment.",
      created_at: "2026-09-01T09:00:00Z",
    },
  ]);

  await insMany(sql, "calendar_events", [
    {
      id: id("ev-1"),
      user_id: u,
      school_id: sunrise,
      title: "Term 2 examinations",
      event_type: "EXAM",
      event_date: "2026-09-22",
    },
    {
      id: id("ev-2"),
      user_id: u,
      school_id: sunrise,
      title: "Fee deadline",
      event_type: "FEE",
      event_date: "2026-09-30",
    },
    {
      id: id("ev-3"),
      user_id: u,
      school_id: sunrise,
      title: "Parent meeting — Form 2",
      event_type: "MEETING",
      event_date: "2026-09-18",
    },
    {
      id: id("ev-4"),
      user_id: u,
      school_id: sunrise,
      title: "Closing day",
      event_type: "TERM",
      event_date: "2026-12-04",
    },
  ]);

  await ins(sql, "nexus_workspaces", { user_id: u });
}

export async function ensureWorkspace(sql: Sql, userId: string) {
  const existing = await sql<{ user_id: string }>`
    select user_id from nexus_workspaces where user_id = ${userId}
  `;
  if (existing.length) return;

  // Demo school data is OPT-IN only (SEED_DEMO=true).
  // Production: platform owner creates schools; school owners get memberships via invite.
  const seedDemo =
    (typeof process !== "undefined" &&
      process.env.SEED_DEMO?.trim().toLowerCase() === "true") ||
    (typeof process !== "undefined" &&
      process.env.VITE_SEED_DEMO?.trim().toLowerCase() === "true");

  if (!seedDemo) {
    await sql.query(
      `insert into nexus_workspaces (user_id, seeded_at) values ($1, now())
       on conflict (user_id) do nothing`,
      [userId],
    );
    return;
  }
  await seedWorkspace(sql, userId);
}
