import { Client } from '@opensearch-project/opensearch';

import env from '../config/env';
import type { ComponentHealth } from '../types/health';

let client: Client | undefined;

const getClient = (): Client => {
  if (!client) {
    const auth = env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD
      ? {
          username: env.OPENSEARCH_USERNAME,
          password: env.OPENSEARCH_PASSWORD,
        }
      : undefined;

    client = new Client({
      node: env.OPENSEARCH_NODE,
      auth,
      requestTimeout: 2000,
      ssl: {
        rejectUnauthorized: env.NODE_ENV === 'production',
      },
    });
  }

  return client;
};

export const getOpenSearchClient = (): Client => getClient();

export const checkOpenSearchConnection = async (): Promise<ComponentHealth> => {
  if (env.NODE_ENV === 'test') {
    return {
      componentId: 'opensearch',
      componentType: 'search',
      status: 'skipped',
      time: new Date().toISOString(),
      output: 'Connectivity checks are skipped when NODE_ENV=test.',
    };
  }

  const start = Date.now();

  try {
    await getClient().cluster.health({
      timeout: '2s',
    });

    return {
      componentId: 'opensearch',
      componentType: 'search',
      status: 'pass',
      time: new Date().toISOString(),
      observedValue: Date.now() - start,
      observedUnit: 'ms',
    };
  } catch (error) {
    return {
      componentId: 'opensearch',
      componentType: 'search',
      status: 'fail',
      time: new Date().toISOString(),
      output: error instanceof Error ? error.message : 'Unknown OpenSearch error',
    };
  }
};

export const closeOpenSearchClient = async (): Promise<void> => {
  if (client) {
    const transport = client.transport as unknown as { close?: () => Promise<void> | void };
    if (typeof transport.close === 'function') {
      await transport.close();
    }
    client = undefined;
  }
};
