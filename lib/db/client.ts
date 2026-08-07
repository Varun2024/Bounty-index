import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ponytail: lazy — Next build imports this module during page-data collection
// even for force-dynamic routes; connecting eagerly makes any URL hiccup a build failure.
type Db = PostgresJsDatabase<typeof schema>;
let cached: Db | undefined;

function connect(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  cached = drizzle(postgres(url, { max: 10, prepare: false }), { schema });
  return cached;
}

export const db = new Proxy({} as Db, {
  get(_t, prop, receiver) {
    return Reflect.get(connect() as object, prop, receiver);
  },
});

// Auth.js DrizzleAdapter needs a real drizzle instance at construction time — it inspects the
// object to auto-detect the driver. Our lazy Proxy target is `{}` and confuses that detection.
// Expose an eager accessor for the adapter; everything else keeps using `db`.
export function getDrizzleInstance(): Db {
  return connect();
}

export { schema };
