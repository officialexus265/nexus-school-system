export type SchoolStatus =
  | "DORMANT"
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "GRACE_PERIOD"
  | "SUSPENDED"
  | "CANCELLED";

export type ResultStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "RETURNED"
  | "VERIFIED"
  | "APPROVED"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "LOCKED";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type Persona =
  | "platform"
  | "owner"
  | "head"
  | "teacher"
  | "bursar"
  | "exam"
  | "parent";

export type School = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  registration_number: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  motto: string | null;
  school_type: string | null;
  boarding_status: string | null;
  status: SchoolStatus;
  logo_mark: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  timezone: string | null;
  currency: string | null;
  subscription_plan: string | null;
  activation_fee: string | number | null;
  student_capacity: number | null;
  created_at: string;
};

export type Staff = {
  id: string;
  user_id: string;
  school_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  title: string | null;
  status: string;
  initials: string | null;
};

export type ClassRow = {
  id: string;
  user_id: string;
  school_id: string;
  section: string;
  name: string;
  stream: string | null;
  level_order: number;
};

export type Subject = {
  id: string;
  user_id: string;
  school_id: string;
  name: string;
  code: string | null;
  section: string | null;
};

export type TeacherAssignment = {
  id: string;
  user_id: string;
  school_id: string;
  staff_id: string;
  class_id: string;
  subject_id: string;
  is_class_teacher: boolean;
};

export type Student = {
  id: string;
  user_id: string;
  school_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  date_of_birth: string | null;
  class_id: string | null;
  status: string;
  admission_date: string | null;
  address: string | null;
};

export type Parent = {
  id: string;
  user_id: string;
  school_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  verification_status: string;
};

export type ParentStudent = {
  id: string;
  user_id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
  is_primary: boolean;
};

export type AcademicYear = {
  id: string;
  user_id: string;
  school_id: string;
  name: string;
  is_current: boolean;
};

export type Term = {
  id: string;
  user_id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  term_number: number;
  is_current: boolean;
  start_date: string | null;
  end_date: string | null;
};

export type Assessment = {
  id: string;
  user_id: string;
  school_id: string;
  class_id: string | null;
  subject_id: string | null;
  staff_id: string | null;
  term_id: string | null;
  name: string;
  assessment_type: string | null;
  maximum_marks: number;
  weight: number | null;
  due_date: string | null;
  status: string;
};

export type AssessmentScore = {
  id: string;
  user_id: string;
  assessment_id: string;
  student_id: string;
  score: string | number | null;
  comment: string | null;
};

export type ResultSubmission = {
  id: string;
  user_id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  staff_id: string | null;
  status: ResultStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  published_by: string | null;
};

export type StudentResult = {
  id: string;
  user_id: string;
  school_id: string;
  student_id: string;
  term_id: string;
  subject_id: string;
  continuous_score: string | number | null;
  exam_score: string | number | null;
  overall_score: string | number | null;
  grade: string | null;
  position: number | null;
  status: ResultStatus;
  teacher_comment: string | null;
};

export type Attendance = {
  id: string;
  user_id: string;
  school_id: string;
  student_id: string;
  class_id: string | null;
  date: string;
  status: AttendanceStatus;
  recorded_by: string | null;
};

export type BehaviourRecord = {
  id: string;
  user_id: string;
  school_id: string;
  student_id: string;
  category: string;
  kind: string;
  severity: string | null;
  points: number;
  description: string | null;
  date: string;
  status: string;
  recorded_by: string | null;
};

export type FeeStructure = {
  id: string;
  user_id: string;
  school_id: string;
  name: string;
  class_id: string | null;
  term_id: string | null;
  amount: string | number;
  due_date: string | null;
  mandatory: boolean;
};

export type StudentCharge = {
  id: string;
  user_id: string;
  school_id: string;
  student_id: string;
  fee_structure_id: string | null;
  description: string;
  amount: string | number;
  paid: string | number;
  due_date: string | null;
  status: string;
};

export type Payment = {
  id: string;
  user_id: string;
  school_id: string;
  student_id: string;
  parent_id: string | null;
  amount: string | number;
  method: string;
  reference: string | null;
  payment_date: string;
  status: string;
  recorded_by: string | null;
  receipt_number: string | null;
};

export type Announcement = {
  id: string;
  user_id: string;
  school_id: string;
  title: string;
  body: string;
  audience: string;
  class_id: string | null;
  created_at: string;
  author: string | null;
};

export type Notification = {
  id: string;
  user_id: string;
  school_id: string;
  title: string;
  message: string;
  channel: string;
  event_type: string | null;
  created_at: string;
  is_read: boolean;
};

export type AuditLog = {
  id: string;
  user_id: string;
  school_id: string | null;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: string | null;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  school_id: string;
  title: string;
  event_type: string | null;
  event_date: string;
};

export type Snapshot = {
  schools: School[];
  school: School;
  staff: Staff[];
  classes: ClassRow[];
  subjects: Subject[];
  assignments: TeacherAssignment[];
  students: Student[];
  parents: Parent[];
  parentLinks: ParentStudent[];
  years: AcademicYear[];
  terms: Term[];
  assessments: Assessment[];
  scores: AssessmentScore[];
  submissions: ResultSubmission[];
  results: StudentResult[];
  attendance: Attendance[];
  behaviour: BehaviourRecord[];
  fees: FeeStructure[];
  charges: StudentCharge[];
  payments: Payment[];
  announcements: Announcement[];
  notifications: Notification[];
  audit: AuditLog[];
  events: CalendarEvent[];
};
