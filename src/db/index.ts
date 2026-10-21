import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Database client, created lazily on first use.
 *
 * Importing this module must not throw: Next collects page data for the API
 * routes at build time, and a missing DATABASE_URL in that environment should
 * not break the build. The first real query will throw a clear error instead.
 */
const globalForDb = globalThis as typeof globalThis & {
  __twistcraftPool?: Pool;
  __twistcraftDb?: NodePgDatabase;
};

function connect(): NodePgDatabase {
  if (globalForDb.__twistcraftDb) return globalForDb.__twistcraftDb;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use the database. Set it in .env (see .env.example).");
  }
  const pool = globalForDb.__twistcraftPool ?? new Pool({ connectionString: databaseUrl });
  const instance = drizzle(pool);
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__twistcraftPool = pool;
    globalForDb.__twistcraftDb = instance;
  }
  return instance;
}

export function getDb(): NodePgDatabase {
  return connect();
}

/** Drop-in `db` that connects on first access */
export const db: NodePgDatabase = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const real = connect() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
