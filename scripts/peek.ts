const BASE = 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data';

async function main() {
  // intigriti target structure
  const int = await (await fetch(`${BASE}/intigriti_data.json`)).json();
  const arr = Array.isArray(int) ? int : (int as { programs?: unknown[] }).programs ?? [];
  const p = (arr as Record<string, unknown>[])[0];
  console.log('=== intigriti targets shape ===');
  console.log(JSON.stringify(p.targets, null, 2).slice(0, 1200));

  // check hackenproof filename options
  const candidates = ['hackenproof_data.json', 'hacken_proof_data.json', 'hackenproof.json'];
  for (const c of candidates) {
    const res = await fetch(`${BASE}/${c}`, { method: 'HEAD' });
    console.log(c, res.status);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
