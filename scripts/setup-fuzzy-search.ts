// Enables pg_trgm and creates a GIN trigram index on programs.search_text.
// Idempotent — safe to re-run. Speeds up ILIKE '%q%' and enables similarity() ranking.
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db/client';

async function main() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS programs_search_text_trgm_idx ON programs USING GIN (search_text gin_trgm_ops)`,
  );
  console.log('pg_trgm ready. Trigram GIN index installed on programs.search_text.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
