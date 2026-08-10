export const REPORT_COMMENT_MAX = 120;

export interface UserReport {
  submittedAt: string; // ISO date (YYYY-MM-DD)
  firstResponseAt: string | null;
  comment: string | null;
  updatedAt: string; // ISO datetime
}

export interface ProgramReportStats {
  count: number; // total reports on this program
  waitingCount: number; // reports where firstResponseAt is null
  medianFirstResponseDays: number | null; // null if <3 non-null reports
}
