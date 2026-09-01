import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// ponytail: lazy — Next build imports this module during page-data collection
// even for force-dynamic routes; connecting eagerly makes any URL hiccup a build failure.
type Db = NeonHttpDatabase<typeof schema>;
let cached: Db | undefined;

function connect(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Neon HTTP driver — fetch-over-HTTPS, zero persistent TCP connections. Every warm
  // Fluid instance stops holding a socket, so Neon free-tier max_connections isn't
  // blown by fan-out. Previous postgres.js + max=1 + pooled URL still hit 53000 because
  // held sockets across warm instances × short compute conn cap. No transactions in
  // this codebase, so the neon-http no-transaction limitation doesn't apply.
  cached = drizzle(neon(url), { schema });
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
