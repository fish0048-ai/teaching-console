/** 學生（Firestore groups/{id}/students） */
export type Student = {
  id: string;
  group: string;
  class: string;
  number: string;
  name: string;
};

/** 分組（Firestore groups/{id}） */
export type Group = {
  id: string;
  name: string;
  sheetLabel?: string;
  studentCount?: number;
};

/** 座位狀態（Firestore groups/{id}/seating/state）— 僅讀取框架 */
export type SeatingState = {
  rows: number;
  cols: number;
  blocked: string[];
  fixedSeats: Record<string, Omit<Student, "id">>;
  draftFixedSeats?: Record<string, Omit<Student, "id">>;
  assignments: Record<string, Omit<Student, "id">>;
  updatedAt?: string;
};

/** 題目（Firestore questions/{id}）— 預留擴充 */
export type Question = {
  id: string;
  subject: string;
  grade: string;
  unit: string;
  concept?: string;
  type: string;
  difficulty: string;
  stem: string;
  options?: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  answer?: string;
  explanation?: string;
  source?: string;
  reviewStatus: string;
  tags?: string;
};

export type QuestionSearchFilter = {
  keyword?: string;
  reviewStatus?: string;
  limit?: number;
};

export type QuestionSearchResult = {
  count: number;
  questions: Question[];
};

export type DashboardStats = {
  groupCount: number;
  studentCount: number;
  questionTotal: number;
  questionApproved: number;
  questionPending: number;
};

/** 作業項目（Firestore groups/{id}/homework/state） */
export type HomeworkAssignment = {
  id: string;
  title: string;
  date?: string;
  createdAt: string;
};

export type HomeworkState = {
  assignments: HomeworkAssignment[];
  /** studentKey (班級_座號) → assignmentId → 已繳交 */
  submissions: Record<string, Record<string, boolean>>;
  updatedAt?: string;
};
