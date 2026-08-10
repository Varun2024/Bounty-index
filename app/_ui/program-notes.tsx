'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { saveNote } from '@/app/actions/notes';
import { NOTE_MAX_LEN, type NoteResult } from '@/lib/notes';
import { relativeTime } from '@/lib/format';

interface ProgramNotesProps {
  programId: number;
  initialNote: NoteResult;
}

type Status = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 800;

export function ProgramNotes({ programId, initialNote }: ProgramNotesProps) {
  const { status: sessionStatus } = useSession();
  const isAuthed = sessionStatus === 'authenticated';

  const [content, setContent] = useState(initialNote.content);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialNote.updatedAt);
  const [status, setStatus] = useState<Status>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(initialNote.content);

  const flush = useCallback(
    async (next: string) => {
      if (next === savedRef.current) return;
      setStatus('saving');
      try {
        const res = await saveNote(programId, next);
        savedRef.current = res.content;
        setUpdatedAt(res.updatedAt);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    },
    [programId],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value.slice(0, NOTE_MAX_LEN);
      setContent(next);
      if (!isAuthed) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => flush(next), AUTOSAVE_DEBOUNCE_MS);
    },
    [flush, isAuthed],
  );

  // Flush on blur so a quick tab-away doesn't drop the pending save.
  const onBlur = useCallback(() => {
    if (!isAuthed) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void flush(content);
  }, [content, flush, isAuthed]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <section className="mt-14 reveal reveal-delay-1">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500">Your notes</h2>
        <StatusPill
          isAuthed={isAuthed}
          sessionLoading={sessionStatus === 'loading'}
          status={status}
          updatedAt={updatedAt}
          length={content.length}
        />
      </div>

      {!isAuthed ? (
        <SignedOutPlaceholder onSignIn={() => signIn('github')} />
      ) : (
        <div className="relative">
          <textarea
            value={content}
            onChange={onChange}
            onBlur={onBlur}
            maxLength={NOTE_MAX_LEN}
            placeholder="private notes — recon leads, endpoints of interest, response times, whatever helps you come back to this program."
            className="focus-ring w-full min-h-[140px] mono text-xs leading-relaxed px-4 py-3 bg-neutral-950/60 border border-neutral-900 rounded-lg text-neutral-200 placeholder:text-neutral-600 resize-y focus:outline-none focus:border-emerald-400/50"
          />
        </div>
      )}
    </section>
  );
}

interface StatusPillProps {
  isAuthed: boolean;
  sessionLoading: boolean;
  status: Status;
  updatedAt: string | null;
  length: number;
}

function StatusPill({ isAuthed, sessionLoading, status, updatedAt, length }: StatusPillProps) {
  if (sessionLoading) return null;
  if (!isAuthed) {
    return (
      <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">sign in to save</span>
    );
  }
  const pctFull = length / NOTE_MAX_LEN;
  const counterColor =
    pctFull >= 0.95 ? 'text-amber-300' : pctFull >= 0.8 ? 'text-neutral-400' : 'text-neutral-600';
  return (
    <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums flex items-center gap-3">
      {status === 'saving' && <span className="text-neutral-400">saving…</span>}
      {status === 'saved' && updatedAt && (
        <span className="text-emerald-400/70">saved {relativeTime(new Date(updatedAt))}</span>
      )}
      {status === 'error' && <span className="text-amber-300">save failed</span>}
      {status === 'idle' && updatedAt && (
        <span>saved {relativeTime(new Date(updatedAt))}</span>
      )}
      <span className={counterColor}>
        <span className="tabular-nums">{length}</span>
        <span className="text-neutral-700"> / {NOTE_MAX_LEN}</span>
      </span>
    </span>
  );
}

function SignedOutPlaceholder({ onSignIn }: { onSignIn: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignIn}
      className="focus-ring group w-full min-h-[100px] px-4 py-6 border border-dashed border-neutral-800 rounded-lg text-left hover:border-emerald-400/40 hover:bg-neutral-900/30 transition"
    >
      <p className="mono text-xs text-neutral-400 group-hover:text-neutral-200 transition">
        <span className="text-emerald-400 group-hover:text-emerald-300">Sign in with GitHub</span>
        {' '}to add private notes on this program.
      </p>
      <p className="mono text-[11px] text-neutral-600 mt-2 leading-relaxed">
        <span className="text-neutral-700">{'// '}</span>
        notes are per-account and never public. Autosaved as you type. Cross-device.
      </p>
    </button>
  );
}
