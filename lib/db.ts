import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __prospecionPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no configurada');
}

export const db = global.__prospecionPool ?? new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

if (process.env.NODE_ENV !== 'production') {
  global.__prospecionPool = db;
}
