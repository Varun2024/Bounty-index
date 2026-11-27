// Fuzz's hunter-flavored one-liners. Shared by the passive corner whisper (FuzzWhisper) and the
// interactive home mascot (FuzzPlay). Kept genuine and specific: no buzzwords, no em dashes.
export const FUZZ_LINES = [
  'Recon pays. Map the scope before you poke it.',
  'The boring programs have the lonely bugs.',
  'Read the policy twice. Dupes hide in the fine print.',
  'Low-hanging fruit is gone. Go one subdomain deeper.',
  'A small bug reported well beats a big one reported badly.',
  'Scope moved today. Someone is already looking. Be first.',
  'Chain the mediums. Impact adds up.',
  'New program, smaller crowd. Worth a look.',
  'Tired eyes miss bugs. Save a filter, come back sharp.',
  'The best bug is the one nobody filtered for.',
  'Out of scope is a trap, not a dare. Respect it.',
  'Came up empty? That is recon, not failure. Next target.',
];

// Pick a random line that isn't the one at `avoidIndex`. Returns [index, line].
export function pickFuzzLine(avoidIndex: number): [number, string] {
  let i = Math.floor(Math.random() * FUZZ_LINES.length);
  if (FUZZ_LINES.length > 1 && i === avoidIndex) i = (i + 1) % FUZZ_LINES.length;
  return [i, FUZZ_LINES[i]];
}
