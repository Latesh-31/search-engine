import { Pool } from 'pg';

import env from '../config/env';
import type { ComponentHealth } from '../types/health';

let pool: Pool | undefined;

const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      max: 5,
      connectionTimeoutMillis: 2000,
    });
  }

  return pool;
};

export const checkPostgresConnection = async (): Promise<ComponentHealth> => {
  if (env.NODE_ENV === 'test') {
    return {
      componentId: 'postgres',
      componentType: 'datastore',
      status: 'skipped',
      time: new Date().toISOString(),
      output: 'Connectivity checks are skipped when NODE_ENV=test.',
    };
  }

  const start = Date.now();

  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();

    return {
      componentId: 'postgres',
      componentType: 'datastore',
      status: 'pass',
      time: new Date().toISOString(),
      observedValue: Date.now() - start,
      observedUnit: 'ms',
    };
  } catch (error) {
    return {
      componentId: 'postgres',
      componentType: 'datastore',
      status: 'fail',
      time: new Date().toISOString(),
      output: error instanceof Error ? error.message : 'Unknown Postgres error',
    };
  }
};

export const closePostgresPool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
