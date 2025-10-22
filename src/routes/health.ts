import { FastifyPluginAsync } from 'fastify';

import { checkOpenSearchConnection } from '../services/opensearch';
import { checkPostgresConnection } from '../services/postgres';
import type { HealthStatus } from '../types/health';

const determineOverallStatus = (statuses: HealthStatus[]): 'pass' | 'fail' | 'warn' => {
  if (statuses.every((status) => status === 'pass' || status === 'skipped')) {
    return 'pass';
  }

  if (statuses.some((status) => status === 'fail')) {
    return 'fail';
  }

  return 'warn';
};

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const [postgres, opensearch] = await Promise.all([
      checkPostgresConnection(),
      checkOpenSearchConnection(),
    ] as const);

    const status = determineOverallStatus([postgres.status, opensearch.status]);

    return {
      status,
      checks: {
        postgres,
        opensearch,
      },
    };
  });
};

export default healthRoutes;
