'use client';

import { useState, useTransition } from 'react';
import { updateSiteConfig } from '@/app/actions/site-config';
import type { SiteConfig } from '@/lib/site-config';

const INPUT = 'w-full bg-neutral-950/60 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-100 focus-ring';
const LABEL = 'mono text-[11px] uppercase tracking-widest text-neutral-400';

// datetime-local <-> ISO, treating the picker value as UTC wall-time so the whole app stays in UTC.
const isoToInput = (iso: string): string => {
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return '';
  }
};
const inputToIso = (v: string): string => (v ? new Date(`${v}:00.000Z`).toISOString() : '');

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <Field label={`${label} · ${suffix}`}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className={INPUT}
      />
    </Field>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-900 rounded-lg bg-neutral-950/40 p-5 space-y-4">
      <h2 className="mono text-[11px] uppercase tracking-widest text-emerald-300/80">{title}</h2>
      {children}
    </section>
  );
}

export function ConfigForm({ initial }: { initial: SiteConfig }) {
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const patch = (p: Partial<SiteConfig>) => setConfig((c) => ({ ...c, ...p }));
  const setAnn = (i: number, p: Partial<SiteConfig['announcements'][number]>) =>
    setConfig((c) => ({ ...c, announcements: c.announcements.map((a, idx) => (idx === i ? { ...a, ...p } : a)) }));
  const addAnn = () =>
    setConfig((c) => ({
      ...c,
      announcements: [
        ...c.announcements,
        {
          id: `note-${Date.now()}`,
          message: '',
          href: '/',
          cta: '',
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        },
      ],
    }));
  const removeAnn = (i: number) =>
    setConfig((c) => ({ ...c, announcements: c.announcements.filter((_, idx) => idx !== i) }));

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      const r = await updateSiteConfig(config);
      setStatus(r.ok ? { ok: true, msg: 'Saved. Live on the next page load.' } : { ok: false, msg: r.error });
    });
  };

  return (
    <div className="space-y-6">
      <Section title={`Announcement strip · ${config.announcements.length}`}>
        <p className="text-xs text-neutral-400 -mt-1">
          The green “new” strip. Shows the newest entry inside its date window that the viewer hasn’t dismissed.
          Times are UTC. Keep <code className="text-neutral-300">id</code> stable and unique (it’s the dismissal key).
        </p>
        {config.announcements.length === 0 && <p className="mono text-xs text-neutral-500">no announcements</p>}
        <div className="space-y-4">
          {config.announcements.map((a, i) => (
            <div key={i} className="border border-neutral-900 rounded-md p-4 space-y-3 bg-neutral-950/40">
              <div className="flex items-center justify-between">
                <span className="mono text-[11px] text-neutral-500">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeAnn(i)}
                  className="mono text-[11px] text-red-400/80 hover:text-red-300 transition focus-ring rounded px-1"
                >
                  remove
                </button>
              </div>
              <Field label="message">
                <input value={a.message} onChange={(e) => setAnn(i, { message: e.target.value })} className={INPUT} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="cta label">
                  <input value={a.cta} onChange={(e) => setAnn(i, { cta: e.target.value })} className={INPUT} />
                </Field>
                <Field label="link (/path or https://)">
                  <input value={a.href} onChange={(e) => setAnn(i, { href: e.target.value })} className={INPUT} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="starts (UTC)">
                  <input
                    type="datetime-local"
                    value={isoToInput(a.startsAt)}
                    onChange={(e) => setAnn(i, { startsAt: inputToIso(e.target.value) })}
                    className={INPUT}
                  />
                </Field>
                <Field label="expires (UTC)">
                  <input
                    type="datetime-local"
                    value={isoToInput(a.expiresAt)}
                    onChange={(e) => setAnn(i, { expiresAt: inputToIso(e.target.value) })}
                    className={INPUT}
                  />
                </Field>
              </div>
              <Field label="id (dismissal key — unique, stable)">
                <input value={a.id} onChange={(e) => setAnn(i, { id: e.target.value })} className={INPUT} />
              </Field>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAnn}
          className="mono text-xs px-3 py-2 border border-neutral-800 rounded-md text-neutral-300 hover:border-emerald-400/40 hover:text-emerald-300 transition focus-ring"
        >
          + add announcement
        </button>
      </Section>

      <Section title="Feedback nudge · timing + caps">
        <div className="grid grid-cols-3 gap-3">
          <Num label="show after" suffix="sec" value={config.feedbackNudge.showAfterSec} onChange={(n) => patch({ feedbackNudge: { ...config.feedbackNudge, showAfterSec: n } })} />
          <Num label="dismiss cooldown" suffix="days" value={config.feedbackNudge.dismissDays} onChange={(n) => patch({ feedbackNudge: { ...config.feedbackNudge, dismissDays: n } })} />
          <Num label="engaged backoff" suffix="days" value={config.feedbackNudge.engagedDays} onChange={(n) => patch({ feedbackNudge: { ...config.feedbackNudge, engagedDays: n } })} />
        </div>
      </Section>

      <Section title="Support nudge · timing + caps">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Num label="arm delay" suffix="sec" value={config.supportNudge.armDelaySec} onChange={(n) => patch({ supportNudge: { ...config.supportNudge, armDelaySec: n } })} />
          <Num label="fallback" suffix="sec" value={config.supportNudge.fallbackSec} onChange={(n) => patch({ supportNudge: { ...config.supportNudge, fallbackSec: n } })} />
          <Num label="dismiss cooldown" suffix="days" value={config.supportNudge.dismissDays} onChange={(n) => patch({ supportNudge: { ...config.supportNudge, dismissDays: n } })} />
          <Num label="engaged backoff" suffix="days" value={config.supportNudge.engagedDays} onChange={(n) => patch({ supportNudge: { ...config.supportNudge, engagedDays: n } })} />
        </div>
      </Section>

      <Section title="Degraded banner · shown only during a DB outage">
        <Field label="title (bold)">
          <input value={config.degradedBanner.title} onChange={(e) => patch({ degradedBanner: { ...config.degradedBanner, title: e.target.value } })} className={INPUT} />
        </Field>
        <Field label="message">
          <input value={config.degradedBanner.message} onChange={(e) => patch({ degradedBanner: { ...config.degradedBanner, message: e.target.value } })} className={INPUT} />
        </Field>
      </Section>

      <Section title="Restored banner · post-incident ‘all good’ strip">
        <label className="flex items-center gap-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            checked={config.restoredBanner.enabled}
            onChange={(e) => patch({ restoredBanner: { ...config.restoredBanner, enabled: e.target.checked } })}
            className="accent-emerald-400"
          />
          enabled
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="title (bold)">
            <input value={config.restoredBanner.title} onChange={(e) => patch({ restoredBanner: { ...config.restoredBanner, title: e.target.value } })} className={INPUT} />
          </Field>
          <Field label="hide after (UTC)">
            <input
              type="datetime-local"
              value={isoToInput(config.restoredBanner.hideAfter)}
              onChange={(e) => patch({ restoredBanner: { ...config.restoredBanner, hideAfter: inputToIso(e.target.value) } })}
              className={INPUT}
            />
          </Field>
        </div>
        <Field label="message">
          <input value={config.restoredBanner.message} onChange={(e) => patch({ restoredBanner: { ...config.restoredBanner, message: e.target.value } })} className={INPUT} />
        </Field>
        <Field label="id (bump to re-show after a new incident)">
          <input value={config.restoredBanner.id} onChange={(e) => patch({ restoredBanner: { ...config.restoredBanner, id: e.target.value } })} className={INPUT} />
        </Field>
      </Section>

      <div className="flex items-center gap-4 sticky bottom-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="mono text-sm px-5 py-2.5 border border-emerald-400/50 bg-emerald-400/[0.1] text-emerald-200 rounded-md hover:bg-emerald-400/[0.18] transition focus-ring disabled:opacity-50"
        >
          {pending ? 'saving…' : 'save changes'}
        </button>
        {status && (
          <span className={`text-sm ${status.ok ? 'text-emerald-300' : 'text-red-400'}`}>{status.msg}</span>
        )}
      </div>
    </div>
  );
}
