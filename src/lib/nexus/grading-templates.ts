/**
 * Starter grading bands only — every school edits these in setup.
 * Form 1–2 and primary use letter grades (A–F).
 * Form 3–4 starter follows a common MANEB MSCE-style points scale (1 best … 9 fail);
 * percentage cut-offs are illustrative and fully editable.
 */

export const PRIMARY_LETTER_BANDS = [
  { grade: "A", min: 80, max: 100, points: null as number | null, remark: "Excellent" },
  { grade: "B", min: 70, max: 79.99, points: null, remark: "Very good" },
  { grade: "C", min: 60, max: 69.99, points: null, remark: "Good" },
  { grade: "D", min: 50, max: 59.99, points: null, remark: "Average" },
  { grade: "E", min: 40, max: 49.99, points: null, remark: "Below average" },
  { grade: "F", min: 0, max: 39.99, points: null, remark: "Fail" },
] as const;

/** Same letter shape as primary — used for Form 1 & 2 by default. */
export const SECONDARY_JUNIOR_LETTER_BANDS = [
  { grade: "A", min: 80, max: 100, points: null as number | null, remark: "Excellent" },
  { grade: "B", min: 70, max: 79.99, points: null, remark: "Very good" },
  { grade: "C", min: 60, max: 69.99, points: null, remark: "Good" },
  { grade: "D", min: 50, max: 59.99, points: null, remark: "Satisfactory" },
  { grade: "E", min: 40, max: 49.99, points: null, remark: "Weak" },
  { grade: "F", min: 0, max: 39.99, points: null, remark: "Fail" },
] as const;

/**
 * MANEB MSCE-oriented points (1 = strongest, 9 = fail).
 * % ranges are a practical school mapping for continuous/exam % → point;
 * official national conversion can differ — owners must align to their policy.
 */
export const MANEB_POINTS_BANDS = [
  { grade: "1", min: 80, max: 100, points: 1, remark: "Distinction" },
  { grade: "2", min: 75, max: 79.99, points: 2, remark: "Distinction" },
  { grade: "3", min: 70, max: 74.99, points: 3, remark: "Credit" },
  { grade: "4", min: 65, max: 69.99, points: 4, remark: "Credit" },
  { grade: "5", min: 60, max: 64.99, points: 5, remark: "Credit" },
  { grade: "6", min: 55, max: 59.99, points: 6, remark: "Pass" },
  { grade: "7", min: 50, max: 54.99, points: 7, remark: "Pass" },
  { grade: "8", min: 40, max: 49.99, points: 8, remark: "Pass" },
  { grade: "9", min: 0, max: 39.99, points: 9, remark: "Fail" },
] as const;
