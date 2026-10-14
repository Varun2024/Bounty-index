// Enable pg_stat_statements on Neon. Neon preloads the lib, so a CREATE EXTENSION is enough.
// Idempotent — safe to re-run.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL\s*=\s*(.+)/)[1].trim();
const sql = postgres(url, { ssl: 'require', max: 1 });

await sql.unsafe('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
const [row] = await sql`SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements'`;
console.log(row ? `pg_stat_statements v${row.extversion} ready` : 'extension not available on this plan');

await sql.end();
