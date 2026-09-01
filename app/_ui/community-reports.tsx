'use client';

import { useCallback, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { type UserReport, type ProgramReportStats } from '@/lib/reports';
import { SectionHeading } from './section-heading';
import { ReportDialog } from './report-dialog';

interface CommunityReportsProps {
  programId: number;
  programName: string;
  initialStats: ProgramReportStats;
  initialUserReport: UserReport | null;
}

export function CommunityReports({ programId, programName, initialStats, initialUserReport }: CommunityReportsProps) {
  const { status: sessionStatus } = useSession();
  const isAuthed = sessionStatus === 'authenticated';
  const [stats, setStats] = useState(initialStats);
  const [userReport, setUserReport] = useState<UserReport | null>(initialUserReport);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialog = useCallback(() => {
    if (!isAuthed) {
      void signIn('github');
      return;
    }
    setDialogOpen(true);
  }, [isAuthed]);

  const onSubmitted = useCallback((next: UserReport, deltaStats: ProgramReportStats) => {
    setUserReport(next);
    setStats(deltaStats);
    setDialogOpen(false);
  }, []);

  const onDeleted = useCallback((deltaStats: ProgramReportStats) => {
    setUserReport(null);
    setStats(deltaStats);
  }, []);

  return (
    <section className="mt-14 reveal reveal-delay-2">
      <SectionHeading title="Community reports">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {stats.count} {stats.count === 1 ? 'report' : 'reports'}
        </span>
      </SectionHeading>

      <div className="border border-neutral-900 rounded-lg bg-neutral-950/40 p-4 md:p-5">
        {stats.count === 0 ? (
          <div className="space-y-2">
            <p className="mono text-xs text-neutral-400">
              <span className="text-emerald-300">No reports yet</span> — be the first to share your triage timing for {programName}.
            </p>
            <p className="mono text-[11px] text-neutral-600 leading-relaxed">
              <span className="text-neutral-700">{'// '}</span>
              peer-sourced response times. platforms won&rsquo;t publish this — hunters can. anonymized in aggregate.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:gap-8">
            <Stat
              label="median first response"
              value={stats.medianFirstResponseDays !== null ? `${stats.medianFirstResponseDays}d` : '—'}
              hint={
                stats.medianFirstResponseDays === null
                  ? `need ≥ 3 answered reports · currently ${stats.count - stats.waitingCount}`
                  : `from ${stats.count - stats.waitingCount} answered ${stats.count - stats.waitingCount === 1 ? 'report' : 'reports'}`
              }
            />
            <Stat
              label="waiting on response"
              value={String(stats.waitingCount)}
              hint={stats.waitingCount === 0 ? 'everyone got a reply' : `of ${stats.count} total`}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openDialog}
            className="focus-ring mono text-xs px-3 py-1.5 border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 rounded hover:bg-emerald-400/[0.12] hover:border-emerald-400/60 transition"
          >
            {userReport ? 'update your report' : isAuthed ? '+ report your times' : 'sign in to report'}
          </button>
          {userReport && (
            <span className="mono text-[10px] text-neutral-600">
              your report: submitted <span className="text-neutral-400 tabular-nums">{userReport.submittedAt}</span>
              {userReport.firstResponseAt && (
                <>
                  {' → '}first response <span className="text-neutral-400 tabular-nums">{userReport.firstResponseAt}</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {dialogOpen && (
        <ReportDialog
          programId={programId}
          programName={programName}
          existing={userReport}
          onClose={() => setDialogOpen(false)}
          onSubmitted={onSubmitted}
          onDeleted={onDeleted}
        />
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-600">{label}</p>
      <p className="mt-1 font-semibold text-2xl text-neutral-100 tabular-nums">{value}</p>
      <p className="mono text-[10px] text-neutral-600 mt-1">{hint}</p>
    </div>
  );
}
