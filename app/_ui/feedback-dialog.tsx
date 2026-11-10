'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { submitFeedback } from '@/app/actions/feedback';
import { FEEDBACK_TOPICS, FEEDBACK_TOPIC_META, type FeedbackTopic } from '@/lib/feedback';

// A quiet edge tab pinned to the right of every page. It never auto-opens, so it reads as a
// standing offer, not an ad. Click opens a small modal; the form posts to a private Discord
// channel via submitFeedback. One instance, mounted once in the root layout.
//
// Feedback now requires a GitHub sign-in: that's the reply path (no email field) and it keeps the
// owner's channel clean. Signed-out visitors see a sign-in panel instead of the form. The
// FeedbackNudge opens this dialog by dispatching OPEN_FEEDBACK.

const PLACEHOLDER: Record<FeedbackTopic, string> = {
  improve: 'What slowed you down, or what would make this more useful?',
  feature: 'What feature or flow are you missing?',
  bug: 'What broke, and on which page?',
  'discord-setup': 'What tripped you up setting up the Discord alerts?',
};

const SEEN_KEY = 'bi:feedback-seen'; // once they've opened it, stop the pointing nudge
const OPEN_FEEDBACK = 'bi:open-feedback'; // FeedbackNudge dispatches this to open the dialog

export function FeedbackTab() {
  const pathname = usePathname();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<FeedbackTopic>('improve');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(true); // default true: no pointer flash before localStorage reads
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const authed = status === 'authenticated';

  // Show the pointing nudge only until the first time they open the dialog. Defer the
  // setState past the effect body (rAF) to avoid the set-state-in-effect lint rule.
  useEffect(() => {
    let seenAlready = true;
    try {
      seenAlready = !!localStorage.getItem(SEEN_KEY);
    } catch {
      // Blocked storage: leave the nudge off, no harm.
    }
    if (seenAlready) return;
    const id = requestAnimationFrame(() => setSeen(false));
    return () => cancelAnimationFrame(id);
  }, []);

  function openDialog() {
    setOpen(true);
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  }

  // The FeedbackNudge opens this dialog from elsewhere in the layout.
  useEffect(() => {
    const onOpen = () => openDialog();
    window.addEventListener(OPEN_FEEDBACK, onOpen);
    return () => window.removeEventListener(OPEN_FEEDBACK, onOpen);
  }, []);

  // Focus the textarea when the dialog opens with the form showing; Esc closes it.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      if (authed && !sent) textareaRef.current?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, authed, sent]);

  function close() {
    setOpen(false);
    // Reset the "sent" state a moment later so the next open starts fresh.
    window.setTimeout(() => {
      setSent(false);
      setMessage('');
      setError(null);
    }, 200);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitFeedback({ topic, message, website, path: pathname });
      if (res.ok) {
        setSent(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      {/* Scoped keyframes. The beckon nudge and the pointer run only until first open,
          and both stop entirely under prefers-reduced-motion. */}
      <style>{`
        @keyframes fb-beckon { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-5px); } }
        @keyframes fb-point  { 0%,100% { transform: translateX(0); opacity: .45; } 50% { transform: translateX(5px); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .fb-beckon, .fb-point { animation: none !important; } }
      `}</style>

      {/* Outer wrapper owns the vertical centering so the inner translateX animation
          doesn't fight it. The pointer sits to the left, nudging toward the tab. */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1">
        {!seen && (
          <span
            aria-hidden
            className="fb-point text-emerald-400"
            style={{ animation: 'fb-point 1.1s ease-in-out infinite' }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </span>
        )}
        <button
          type="button"
          onClick={openDialog}
          aria-label="Send feedback"
          className="fb-beckon inline-flex items-center gap-1.5 rounded-l-lg border border-r-0 border-neutral-800 bg-neutral-950/90 backdrop-blur px-2.5 py-2 text-neutral-400 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)] hover:text-emerald-300 hover:border-emerald-400/40 hover:bg-neutral-900/90 transition focus-ring"
          style={seen ? undefined : { animation: 'fb-beckon 2.6s ease-in-out infinite' }}
        >
          <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
          <span className="mono text-[11px] tracking-wide">feedback</span>
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md rounded-xl border border-neutral-800 bg-background shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)] p-5">
            {status === 'loading' ? (
              // Loading state: the session is still resolving, so we don't know yet which
              // panel (gate or form) to show.
              <div className="py-8 text-center" aria-live="polite">
                <p className="mono text-sm text-neutral-400">checking your session…</p>
              </div>
            ) : !authed ? (
              // Sign-in gate: feedback needs an identity so the owner can reply and the
              // channel stays spam-free. The sign-in returns to this same page.
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mono text-[10px] uppercase tracking-widest text-neutral-400">Feedback</p>
                    <h2 className="mt-1 text-lg font-semibold text-neutral-100">Sign in to send feedback</h2>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="shrink-0 -mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded text-neutral-400 hover:text-neutral-200 transition focus-ring"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                  A quick GitHub sign-in is how I know who to reply to, and it keeps the channel
                  clear of spam. No email needed, nothing else tracked.
                </p>

                <button
                  type="button"
                  onClick={() => void signIn('github', { callbackUrl: pathname })}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 bg-neutral-100 text-neutral-950 rounded-md hover:bg-white transition focus-ring"
                >
                  <svg aria-hidden viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
                  </svg>
                  sign in with GitHub
                </button>

                <p className="mt-3 mono text-[10px] text-neutral-400 leading-relaxed">
                  {'// '}read-only GitHub login. I can&rsquo;t post anything or see your repos.
                </p>
              </div>
            ) : sent ? (
              <div className="py-4 text-center">
                <p className="text-base font-medium text-neutral-100">Got it. Thank you.</p>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  I read every one of these myself, and I&rsquo;ll follow up when I can.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 mono text-xs px-4 py-2 border border-neutral-800 rounded text-neutral-300 hover:text-emerald-300 hover:border-emerald-400/40 transition focus-ring"
                >
                  close
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mono text-[10px] uppercase tracking-widest text-neutral-400">Feedback</p>
                    <h2 className="mt-1 text-lg font-semibold text-neutral-100">What would make this better?</h2>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="shrink-0 -mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded text-neutral-400 hover:text-neutral-200 transition focus-ring"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {FEEDBACK_TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTopic(t)}
                      className={`mono text-[11px] px-2.5 py-1 rounded-full border transition focus-ring ${
                        topic === t
                          ? 'border-emerald-400/50 bg-emerald-400/[0.10] text-emerald-200'
                          : 'border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                      }`}
                    >
                      {FEEDBACK_TOPIC_META[t].chip}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder={PLACEHOLDER[topic]}
                  className="mt-3 w-full text-sm px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 placeholder:text-neutral-400 focus:border-emerald-400/60 focus:outline-none resize-y"
                />

                {/* Honeypot: hidden from people, catches bots. */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="hidden"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="mono text-[11px] text-red-400">{error ? `✗ ${error}` : ''}</span>
                  <button
                    type="submit"
                    disabled={pending || message.trim().length < 4}
                    className="mono text-xs px-4 py-2 border border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300 rounded hover:bg-emerald-400/[0.12] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {pending ? 'sending…' : 'send →'}
                  </button>
                </div>

                <p className="mt-3 mono text-[10px] text-neutral-400 leading-relaxed">
                  {'// '}goes straight to me, under your GitHub. nothing tracked beyond the page you&rsquo;re on.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
