import Link from 'next/link';
import Image from 'next/image';
import { SectionEyebrow } from './shared';

// Home "Sponsors" band. bounty.index is free, neutral, and has no ads or paywall on the core index;
// sponsorship is what keeps it that way. Until there are real sponsors, we show an honest invite
// rather than filler logos (antislop). Populate SPONSORS to render the logo row instead.
interface Sponsor {
  name: string;
  href: string;
  logo: string; // path under /public, e.g. /sponsors/acme.svg
}

const SPONSORS: Sponsor[] = [];

const COFFEE_URL = 'https://buymeacoffee.com/varun_builds';
const CONTACT_URL = 'mailto:varunshukla747@gmail.com?subject=Sponsoring%20bounty.index';

export function Sponsors() {
  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow n="05" label="Sponsors" />
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">
            Free, neutral, and staying that way.
          </h2>
          <p className="mt-4 text-lg text-neutral-300 leading-snug">
            The whole index is free. No ads, no paywall on the data, no platform picking sides.
            Sponsorship is what keeps it independent and running.
          </p>
        </div>

        {SPONSORS.length > 0 ? (
          <ul className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-6">
            {SPONSORS.map((sp) => (
              <li key={sp.name}>
                <Link
                  href={sp.href}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="inline-flex items-center opacity-80 hover:opacity-100 transition focus-ring rounded"
                  aria-label={sp.name}
                >
                  <Image src={sp.logo} alt={sp.name} width={140} height={40} className="h-8 w-auto" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/40 p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <p className="text-neutral-100 font-medium">This space is for the first sponsor.</p>
              <p className="text-sm text-neutral-400 mt-1 max-w-md leading-relaxed">
                Reach security researchers who check scope daily. Your logo sits here and on the index
                they come back to.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href={CONTACT_URL}
                className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition focus-ring"
              >
                get in touch <span className="arrow">→</span>
              </Link>
              <Link
                href={COFFEE_URL}
                target="_blank"
                rel="noreferrer"
                className="mono text-sm px-5 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition"
              >
                buy me a coffee
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
