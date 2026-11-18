import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const useSsl = process.env.SQL_SSL === 'true';
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      statement_timeout: 15000,
      query_timeout: 15000,
      ...(useSsl
        ? {
            ssl: {
              rejectUnauthorized: process.env.SQL_SSL_REJECT_UNAUTHORIZED !== 'false',
            },
          }
        : {}),
    });

    global._postgresPool.on('error', (err) => {
      console.error('Database pool idle client error:', err.message);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
export { pool };
