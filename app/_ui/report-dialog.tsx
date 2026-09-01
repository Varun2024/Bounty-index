'use client';

import { useEffect, useRef, useState } from 'react';
import { submitReport, deleteReport } from '@/app/actions/reports';
import { REPORT_COMMENT_MAX, type UserReport, type ProgramReportStats } from '@/lib/reports';

interface ReportDialogProps {
  programId: number;
  programName: string;
  existing: UserReport | null;
  onClose: () => void;
  onSubmitted: (report: UserReport, stats: ProgramReportStats) => void;
  onDeleted: (stats: ProgramReportStats) => void;
}

export function ReportDialog({ programId, programName, existing, onClose, onSubmitted, onDeleted }: ReportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submittedAt, setSubmittedAt] = useState(existing?.submittedAt ?? '');
  const [firstResponseAt, setFirstResponseAt] = useState(existing?.firstResponseAt ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const report = await submitReport({
        programId,
        submittedAt,
        firstResponseAt: firstResponseAt || null,
        comment: comment.trim() || null,
      });
      // Fresh stats via a separate action call so we don't recompute in submitReport.
      const { getProgramReportStats } = await import('@/app/actions/reports');
      const stats = await getProgramReportStats(programId);
      onSubmitted(report, stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    if (!window.confirm('Delete your report? This can’t be undone.')) return;
    setBusy(true);
    try {
      await deleteReport(programId);
      const { getProgramReportStats } = await import('@/app/actions/reports');
      const stats = await getProgramReportStats(programId);
      onDeleted(stats);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to delete');
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="p-0 bg-transparent backdrop:bg-black/70 backdrop:backdrop-blur-sm max-w-[520px] w-[92vw] rounded-lg text-neutral-100"
    >
      <form onSubmit={onSubmit} className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
        <header className="px-5 py-4 border-b border-neutral-900">
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">Report your times</p>
          <h3 className="text-lg font-semibold text-neutral-50 mt-0.5">{programName}</h3>
        </header>

        <div className="px-5 py-4 space-y-4">
          <Field label="Submitted date" required hint="when you sent the report to the program">
            <input
              type="date"
              required
              max={today}
              value={submittedAt}
              onChange={(e) => setSubmittedAt(e.target.value)}
              className="focus-ring mono text-sm px-3 py-2 bg-neutral-900 border border-neutral-800 rounded w-full focus:outline-none focus:border-emerald-400/50 text-neutral-100"
            />
          </Field>

          <Field label="First response date" hint="leave blank if still waiting">
            <input
              type="date"
              max={today}
              value={firstResponseAt}
              onChange={(e) => setFirstResponseAt(e.target.value)}
              className="focus-ring mono text-sm px-3 py-2 bg-neutral-900 border border-neutral-800 rounded w-full focus:outline-none focus:border-emerald-400/50 text-neutral-100"
            />
          </Field>

          <Field label={`Comment (optional, up to ${REPORT_COMMENT_MAX} chars)`}>
            <input
              type="text"
              maxLength={REPORT_COMMENT_MAX}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. slow during holidays, tight-lipped triage"
              className="focus-ring mono text-xs px-3 py-2 bg-neutral-900 border border-neutral-800 rounded w-full focus:outline-none focus:border-emerald-400/50 text-neutral-100 placeholder:text-neutral-600"
            />
          </Field>

          {error && <p className="mono text-xs text-amber-300">{error}</p>}

          <p className="mono text-[11px] leading-relaxed text-neutral-600">
            <span className="text-neutral-700">{'// '}</span>
            your report is <span className="text-neutral-400">anonymized in aggregates</span>. individual rows are not shown to other users. one report per program per account — resubmitting updates.
          </p>
        </div>

        <footer className="px-5 py-4 border-t border-neutral-900 flex items-center justify-between gap-3">
          <div>
            {existing && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="focus-ring mono text-xs px-3 py-1.5 text-amber-300 hover:text-amber-200 rounded transition disabled:opacity-50"
              >
                delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="focus-ring mono text-xs px-3 py-1.5 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 rounded transition disabled:opacity-50"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={busy || !submittedAt}
              className="focus-ring mono text-xs px-3 py-1.5 border border-emerald-400/50 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 rounded transition disabled:opacity-50"
            >
              {busy ? 'saving…' : existing ? 'update report' : 'submit report'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="mono text-[10px] uppercase tracking-widest text-neutral-500 block">
        {label}
        {required && <span className="text-emerald-400 ml-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mono text-[10px] text-neutral-600">
          <span className="text-neutral-700">{'// '}</span>
          {hint}
        </p>
      )}
    </div>
  );
}
