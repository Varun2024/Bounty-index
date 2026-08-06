// Enables pg_trgm and installs trigram GIN indexes for fuzzy search on program names
// and scope identifiers. Idempotent — safe to re-run.
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db/client';

async function main() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS programs_search_text_trgm_idx ON programs USING GIN (search_text gin_trgm_ops)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS scopes_identifier_trgm_idx ON scopes USING GIN (identifier gin_trgm_ops)`,
  );
  console.log('pg_trgm ready. Trigram GIN indexes on programs.search_text and scopes.identifier.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
