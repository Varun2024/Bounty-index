import { shortenIdentifier } from '@/lib/format';

// Data-as-atmosphere: ghosted real in-scope identifiers drift behind the hero, proving
// the index is real in the background texture itself. No other site can render this
// because it's our data. Styling + mask + drift + reduced-motion live in globals.css
// (.hero-data-backdrop). Identifiers are sampled server-side (see sampleScopeIdentifiers);
// on empty we fall back to just the glow, never fabricated domains.

const COLS = 3;
const MIN_FILL = 40; // enough lines per column for a seamless vertical loop
const MAX_IDS = 48;

export function HeroDataBackdrop({ identifiers }: { identifiers: string[] }) {
  let ids = identifiers.filter(Boolean);

  if (ids.length === 0) {
    return (
      <div className="hero-data-backdrop" aria-hidden>
        <div className="hero-data-backdrop__glow" />
      </div>
    );
  }

  // Repeat to fill, then cap, then shorten so lines stay tidy.
  while (ids.length < MIN_FILL) ids = ids.concat(ids);
  ids = ids.slice(0, MAX_IDS).map((id) => shortenIdentifier(id, 28));

  const columns = Array.from({ length: COLS }, (_, i) => ids.filter((_, idx) => idx % COLS === i));

  return (
    <div className="hero-data-backdrop" aria-hidden>
      <div className="hero-data-backdrop__glow" />
      <div className="hero-data-backdrop__field">
        {columns.map((col, ci) => (
          <div className="hdb-col" key={ci}>
            {/* list rendered twice: translateY(-50%) loops seamlessly over one copy */}
            {[0, 1].map((dup) => (
              <ul className="hdb-list" key={dup}>
                {col.map((id, i) => (
                  <li key={`${dup}-${i}`} className="hdb-id mono">{id}</li>
                ))}
              </ul>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
