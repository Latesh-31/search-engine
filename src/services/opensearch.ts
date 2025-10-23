import { readFileSync } from 'node:fs';

import { Client, type ClientOptions } from '@opensearch-project/opensearch';

import env from '../config/env';
import {
  ensureOpenSearchInfrastructure,
  type BootstrapResult,
  type LoggerLike,
} from '../opensearch/bootstrap';
import type { ComponentHealth } from '../types/health';

export type { BootstrapResult, LoggerLike } from '../opensearch/bootstrap';

let client: Client | undefined;

const readSecretFile = (filePath: string, variableName: string): string => {
  try {
    const value = readFileSync(filePath, 'utf8').trim();

    if (!value) {
      throw new Error(`${variableName} file at ${filePath} is empty.`);
    }

    return value;
  } catch (error) {
    throw new Error(
      `Failed to read ${variableName} file at ${filePath}: ${(error as Error).message}`,
    );
  }
};

const resolveCredential = (
  value: string | undefined,
  filePath: string | undefined,
  variableName: string,
): string | undefined => {
  if (filePath) {
    return readSecretFile(filePath, `${variableName}_FILE`);
  }

  if (value && value.length > 0) {
    return value;
  }

  return undefined;
};

const resolveCertificateAuthority = (filePath?: string): Buffer | undefined => {
  if (!filePath) {
    return undefined;
  }

  try {
    return readFileSync(filePath);
  } catch (error) {
    throw new Error(
      `Failed to read OpenSearch CA certificate at ${filePath}: ${(error as Error).message}`,
    );
  }
};

const createClient = (): Client => {
  const username = resolveCredential(
    env.OPENSEARCH_USERNAME,
    env.OPENSEARCH_USERNAME_FILE,
    'OPENSEARCH_USERNAME',
  );
  const password = resolveCredential(
    env.OPENSEARCH_PASSWORD,
    env.OPENSEARCH_PASSWORD_FILE,
    'OPENSEARCH_PASSWORD',
  );

  if ((username && !password) || (!username && password)) {
    throw new Error(
      'OpenSearch credentials are misconfigured. Provide both OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD (or their *_FILE variants).',
    );
  }

  const rejectUnauthorized =
    env.OPENSEARCH_TLS_REJECT_UNAUTHORIZED ?? env.NODE_ENV === 'production';

  const sslOptions: NonNullable<ClientOptions['ssl']> = {
    rejectUnauthorized,
  };

  const ca = resolveCertificateAuthority(env.OPENSEARCH_CA_CERT_PATH);
  if (ca) {
    sslOptions.ca = ca;
  }

  const options: ClientOptions = {
    node: env.OPENSEARCH_NODE,
    requestTimeout: 2000,
    ssl: sslOptions,
  };

  if (username && password) {
    options.auth = {
      username,
      password,
    };
  }

  return new Client(options);
};

export const getOpenSearchClient = (): Client => {
  if (!client) {
    client = createClient();
  }

  return client;
};

export const bootstrapOpenSearchInfrastructure = async (
  logger?: LoggerLike,
): Promise<BootstrapResult[]> => {
  if (!env.OPENSEARCH_BOOTSTRAP_ENABLED) {
    logger?.info?.('OpenSearch bootstrap disabled via configuration flag.');
    return [];
  }

  if (env.NODE_ENV === 'test') {
    return [];
  }

  const openSearchClient = getOpenSearchClient();
  return ensureOpenSearchInfrastructure(openSearchClient, logger);
};

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
    await getOpenSearchClient().cluster.health({
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
