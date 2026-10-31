import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL\s*=\s*(.+)/)[1].trim();
const sql = postgres(url, { ssl: 'require', max: 1 });
const [r] = await sql`
  SELECT n_live_tup AS live, n_tup_ins AS ins, n_tup_upd AS upd, n_tup_del AS del
  FROM pg_stat_user_tables WHERE relname = 'scopes'
`;
console.log(JSON.stringify(r));
await sql.end();
