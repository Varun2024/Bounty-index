// What is actually costing us? Run after 24h+ of production traffic.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL\s*=\s*(.+)/)[1].trim();
const sql = postgres(url, { ssl: 'require', max: 1 });

const section = (t) => console.log(`\n=== ${t} ===`);

section('DB size');
console.log(await sql`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`);

section('scopes churn since fix (should be tiny now)');
console.table(await sql`
  SELECT relname AS t, n_live_tup AS live, n_dead_tup AS dead,
         n_tup_ins AS ins, n_tup_upd AS upd, n_tup_del AS del,
         last_autovacuum
  FROM pg_stat_user_tables
  WHERE relname IN ('scopes','programs','program_snapshots')
`);

section('TOP 15 queries by TOTAL cost (what to kill first)');
console.table(await sql`
  SELECT substring(regexp_replace(query, '\\s+', ' ', 'g'), 1, 110) AS query,
         calls,
         (total_exec_time/1000)::int AS total_sec,
         mean_exec_time::int AS mean_ms,
         rows
  FROM pg_stat_statements
  WHERE query NOT ILIKE '%pg_stat%' AND query NOT ILIKE '%pg_catalog%'
  ORDER BY total_exec_time DESC
  LIMIT 15
`);

section('TOP 10 by CALLS (hottest, even if fast)');
console.table(await sql`
  SELECT substring(regexp_replace(query, '\\s+', ' ', 'g'), 1, 100) AS query,
         calls,
         mean_exec_time::numeric(10,2) AS mean_ms,
         (total_exec_time/1000)::int AS total_sec
  FROM pg_stat_statements
  WHERE query NOT ILIKE '%pg_stat%' AND query NOT ILIKE '%pg_catalog%'
  ORDER BY calls DESC
  LIMIT 10
`);

section('TOP 10 slow queries (mean >50ms)');
console.table(await sql`
  SELECT substring(regexp_replace(query, '\\s+', ' ', 'g'), 1, 110) AS query,
         calls, mean_exec_time::int AS mean_ms, (total_exec_time/1000)::int AS total_sec
  FROM pg_stat_statements
  WHERE mean_exec_time > 50 AND query NOT ILIKE '%pg_stat%'
  ORDER BY mean_exec_time DESC
  LIMIT 10
`);

section('When were stats reset? (gives a per-second rate)');
console.log(await sql`SELECT stats_reset FROM pg_stat_statements_info`);

await sql.end();
