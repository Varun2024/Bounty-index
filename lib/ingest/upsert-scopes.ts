import { db, schema } from '@/lib/db/client';
import { and, eq, notInArray, sql } from 'drizzle-orm';

export interface IncomingScope {
  identifier: string;
  assetType: string;
  inScope: boolean;
  eligibleForBounty: boolean;
  severity: string | null;
  instruction: string | null;
}

/**
 * Replace the scopes for a program idempotently.
 *
 * Old pattern: DELETE all scopes for the program, then INSERT. Writes WAL for every row every day
 * even when nothing changed — ~95% of our Neon storage was this churn.
 *
 * New pattern: upsert on the natural key (program_id, identifier, asset_type) and only delete rows
 * that have genuinely disappeared from upstream. Postgres' ON CONFLICT DO UPDATE is a no-op (no
 * WAL write) when every column equals the existing row — so steady-state ingests cost ~zero WAL.
 *
 * Requires the unique index `scopes_program_identifier_asset_uq` (added in lib/db/schema.ts,
 * backfilled by scripts/dedup-scopes.mjs).
 *
 * Returns the number of incoming rows upserted (unchanged semantics for the caller's counter).
 */
export async function upsertScopes(programId: number, incoming: readonly IncomingScope[]): Promise<number> {
  // Dedup within the batch — upstream data occasionally lists the same (identifier, asset_type)
  // twice, and a single INSERT ... ON CONFLICT can't collide against its own batch.
  const seen = new Set<string>();
  const rows: IncomingScope[] = [];
  for (const s of incoming) {
    const key = `${s.identifier}\x00${s.assetType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(s);
  }

  if (rows.length === 0) {
    // Program has no scopes at all — remove any stale ones.
    await db.delete(schema.scopes).where(eq(schema.scopes.programId, programId));
    return 0;
  }

  // PG bind limit is 65535 params. Scopes have 7 cols → 500 rows/chunk keeps us well under.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((s) => ({ programId, ...s }));
    await db
      .insert(schema.scopes)
      .values(slice)
      .onConflictDoUpdate({
        target: [schema.scopes.programId, schema.scopes.identifier, schema.scopes.assetType],
        set: {
          inScope: sql`excluded.in_scope`,
          eligibleForBounty: sql`excluded.eligible_for_bounty`,
          severity: sql`excluded.severity`,
          instruction: sql`excluded.instruction`,
        },
        // ponytail: setWhere skips UPDATE (and its WAL) when all target cols already match.
        // This is the whole point of the refactor.
        setWhere: sql`
          scopes.in_scope IS DISTINCT FROM excluded.in_scope
          OR scopes.eligible_for_bounty IS DISTINCT FROM excluded.eligible_for_bounty
          OR scopes.severity IS DISTINCT FROM excluded.severity
          OR scopes.instruction IS DISTINCT FROM excluded.instruction
        `,
      });
  }

  // Delete scopes that disappeared from upstream. Drizzle's sql template serializes JS arrays
  // as individual bind params (not a single text[]), so unnest(array[], array[]) blows up with
  // "cannot cast row to array". Build a tuple-list for NOT IN instead — each (ident, type) pair
  // gets its own placeholders.
  const tuples = rows.map((r) => sql`(${r.identifier}, ${r.assetType})`);
  await db.execute(sql`
    DELETE FROM scopes
    WHERE program_id = ${programId}
      AND (identifier, asset_type) NOT IN (${sql.join(tuples, sql`, `)})
  `);

  return rows.length;
}
