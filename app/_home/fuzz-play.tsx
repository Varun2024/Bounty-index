'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { SectionEyebrow } from './shared';
import { pickFuzzLine } from '@/lib/fuzz-lines';

// Interactive Fuzz. He follows the cursor (gaze tilt), perks up when you approach (hunt), gets
// excited and drops a hunter quip when you poke him (found), and dozes off when left alone (sleep).
// Keyboard-accessible (he's a real button) and reduced-motion safe (no tilt, expression + quip still
// fire). Expressions reuse the existing pose art; quips reuse lib/fuzz-lines.

type Expression = 'idle' | 'hunt' | 'found' | 'sleep';

const SRC: Record<Expression, string> = {
  idle: '/fuzz.png',
  hunt: '/fuzz-hunt.png',
  found: '/fuzz-found.png',
  sleep: '/fuzz-sleep.png',
};

const ALT: Record<Expression, string> = {
  idle: 'Fuzz the bloodhound, sitting calmly',
  hunt: 'Fuzz, ears perked, on the scent',
  found: 'Fuzz, delighted, having found something',
  sleep: 'Fuzz, dozing',
};

const SLEEP_AFTER_MS = 12_000;
const FOUND_HOLD_MS = 2600;
const MAX_SHIFT_PX = 10;
const MAX_ROT_DEG = 6;

export function FuzzPlay() {
  const [expr, setExpr] = useState<Expression>('idle');
  const [line, setLine] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const fuzzRef = useRef<HTMLButtonElement>(null);
  const lastLine = useRef(-1);
  const sleepTimer = useRef<number | null>(null);
  const foundTimer = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const insideRef = useRef(false);
  const foundRef = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const clearSleep = () => {
    if (sleepTimer.current) window.clearTimeout(sleepTimer.current);
    sleepTimer.current = null;
  };

  const armSleep = useCallback(() => {
    clearSleep();
    sleepTimer.current = window.setTimeout(() => {
      if (!insideRef.current && !foundRef.current) setExpr('sleep');
    }, SLEEP_AFTER_MS);
  }, []);

  const resetTilt = useCallback(() => {
    const el = fuzzRef.current;
    if (el) el.style.transform = '';
  }, []);

  // Cursor-follow tilt. Throttled to one update per frame.
  const onMove = useCallback(
    (e: React.PointerEvent) => {
      insideRef.current = true;
      clearSleep();
      if (!foundRef.current) setExpr('hunt');
      if (reduced.current) return;
      const el = fuzzRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        el.style.transform = `translate(${nx * MAX_SHIFT_PX}px, ${ny * MAX_SHIFT_PX}px) rotate(${nx * MAX_ROT_DEG}deg)`;
      });
    },
    [],
  );

  const onLeave = useCallback(() => {
    insideRef.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    resetTilt();
    if (!foundRef.current) setExpr('idle');
    armSleep();
  }, [armSleep, resetTilt]);

  // Poke him: delight + a quip.
  const poke = useCallback(() => {
    const [i, text] = pickFuzzLine(lastLine.current);
    lastLine.current = i;
    foundRef.current = true;
    setExpr('found');
    setLine(text);
    clearSleep();
    if (foundTimer.current) window.clearTimeout(foundTimer.current);
    foundTimer.current = window.setTimeout(() => {
      foundRef.current = false;
      setExpr(insideRef.current ? 'hunt' : 'idle');
      if (!insideRef.current) armSleep();
    }, FOUND_HOLD_MS);
  }, [armSleep]);

  useEffect(() => {
    armSleep();
    return () => {
      clearSleep();
      if (foundTimer.current) window.clearTimeout(foundTimer.current);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [armSleep]);

  return (
    <section ref={sectionRef} className="border-t border-neutral-900" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
        <div className="grid gap-10 md:gap-16 md:grid-cols-2 md:items-center">
          {/* Left: who he is */}
          <div className="max-w-xl">
            <SectionEyebrow n="06" label="Fuzz" />
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">
              Meet Fuzz, the nose behind the index.
            </h2>
            <p className="mt-4 text-lg text-neutral-300 leading-snug">
              Every morning he works the platforms for scope that moved, rewards that changed, and new
              programs worth a look. The rest of this site is his nose, written down.
            </p>
            <p className="mt-4 mono text-[11px] uppercase tracking-widest text-emerald-400/90">
              go on, poke him
            </p>
          </div>

          {/* Right: the mascot */}
          <div className="relative flex justify-center md:justify-end">
            {/* Quip bubble */}
            <div
              aria-live="polite"
              className={`pointer-events-none absolute -top-2 left-1/2 md:left-auto md:right-8 z-10 w-[min(18rem,80%)] -translate-x-1/2 md:translate-x-0 rounded-xl rounded-bl-sm border border-neutral-800 bg-background px-3.5 py-2.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)] transition-all duration-200 ease-out motion-reduce:transition-opacity ${
                line ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 motion-reduce:translate-y-0'
              }`}
            >
              <p className="mono text-[11px] uppercase tracking-widest text-emerald-400/90">Fuzz says</p>
              <p className="mt-1 text-sm text-neutral-200 leading-snug">{line ?? ' '}</p>
            </div>

            <button
              ref={fuzzRef}
              type="button"
              onClick={poke}
              onFocus={() => {
                clearSleep();
                if (!foundRef.current) setExpr('hunt');
              }}
              onBlur={() => {
                if (!insideRef.current && !foundRef.current) setExpr('idle');
                armSleep();
              }}
              aria-label="Poke Fuzz for a hunting tip"
              className="group relative rounded-full transition-[transform] duration-200 ease-out will-change-transform focus-ring"
            >
              <Image
                src={SRC[expr]}
                alt={ALT[expr]}
                width={300}
                height={300}
                priority={false}
                className="w-[220px] h-[220px] md:w-[300px] md:h-[300px] select-none object-contain"
                draggable={false}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
