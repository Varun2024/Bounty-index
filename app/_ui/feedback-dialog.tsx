'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { submitFeedback } from '@/app/actions/feedback';
import { FEEDBACK_TOPICS, FEEDBACK_TOPIC_META, type FeedbackTopic } from '@/lib/feedback';

// A quiet edge tab pinned to the right of every page. It never auto-opens, so it reads as a
// standing offer, not an ad. Click opens a small modal; the form posts to a private Discord
// channel via submitFeedback. One instance, mounted once in the root layout.

const PLACEHOLDER: Record<FeedbackTopic, string> = {
  improve: 'What slowed you down, or what would make this more useful?',
  feature: 'What feature or flow are you missing?',
  bug: 'What broke, and on which page?',
  'discord-setup': 'What tripped you up setting up the Discord alerts?',
};

export function FeedbackTab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<FeedbackTopic>('improve');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the dialog opens; Esc closes it.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
      const res = await submitFeedback({ topic, message, email, website, path: pathname });
      if (res.ok) {
        setSent(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 inline-flex items-center gap-1.5 rounded-l-lg border border-r-0 border-neutral-800 bg-neutral-950/90 backdrop-blur px-1.5 py-3 text-neutral-400 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)] hover:text-emerald-300 hover:border-emerald-400/40 hover:bg-neutral-900/90 transition focus-ring"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
        </svg>
        <span className="mono text-[11px] tracking-wide [writing-mode:vertical-rl]">feedback</span>
      </button>

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
            {sent ? (
              <div className="py-4 text-center">
                <p className="text-base font-medium text-neutral-100">Got it. Thank you.</p>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  I read every one of these myself. If you left an email, I&rsquo;ll reply when I can.
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
                    <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">Feedback</p>
                    <h2 className="mt-1 text-lg font-semibold text-neutral-100">What would make this better?</h2>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="shrink-0 -mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded text-neutral-500 hover:text-neutral-200 transition focus-ring"
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
                  className="mt-3 w-full text-sm px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-400/60 focus:outline-none resize-y"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email (optional, if you want a reply)"
                  maxLength={200}
                  className="mt-2 w-full text-sm px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-400/60 focus:outline-none"
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

                <p className="mt-3 mono text-[10px] text-neutral-600 leading-relaxed">
                  {'// '}goes straight to me. no account needed, nothing tracked beyond the page you&rsquo;re on.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
