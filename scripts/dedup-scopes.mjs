// One-shot: drop duplicate scopes, add the natural-key unique index that the new
// ingest upsert relies on. Idempotent — safe to re-run.
//
// Usage: node scripts/dedup-scopes.mjs
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL\s*=\s*(.+)/)[1].trim();
const sql = postgres(url, { ssl: 'require', max: 1 });

const [{ before }] = await sql`SELECT count(*)::int AS before FROM scopes`;

// Keep the lowest id per (program_id, identifier, asset_type).
const deleted = await sql`
  DELETE FROM scopes
  WHERE id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (
        PARTITION BY program_id, identifier, asset_type ORDER BY id
      ) AS rn
      FROM scopes
    ) t WHERE rn > 1
  )
`;

// CONCURRENTLY so the running app isn't blocked. IF NOT EXISTS makes it idempotent.
await sql.unsafe(
  `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS scopes_program_identifier_asset_uq
   ON scopes (program_id, identifier, asset_type)`,
);

// Reclaim the space from the churn.
await sql.unsafe(`VACUUM (ANALYZE) scopes`);

const [{ after }] = await sql`SELECT count(*)::int AS after FROM scopes`;
console.log(`scopes: ${before} -> ${after} (${before - after} dupes removed, ${deleted.count} rows deleted)`);
console.log('unique index: scopes_program_identifier_asset_uq ready');

await sql.end();
