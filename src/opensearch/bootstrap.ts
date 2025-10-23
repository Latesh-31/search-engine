import { Client } from '@opensearch-project/opensearch';

import { INDEX_DEFINITIONS, type IndexDefinition } from './indices';

export type LoggerLike = Pick<Console, 'info' | 'warn' | 'error'>;

export interface BootstrapResult {
  alias: string;
  templateName: string;
  createdIndex?: string;
}

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const resolveAliasExists = async (client: Client, alias: string): Promise<boolean> => {
  const response = (await client.indices.existsAlias({ name: alias })) as unknown;

  if (typeof response === 'boolean') {
    return response;
  }

  if (typeof response === 'object' && response !== null && 'body' in response) {
    const body = (response as { body: unknown }).body;
    if (typeof body === 'boolean') {
      return body;
    }
  }

  if (typeof response === 'object' && response !== null && 'statusCode' in response) {
    const statusCode = (response as { statusCode?: number }).statusCode;
    if (typeof statusCode === 'number') {
      return statusCode === 200;
    }
  }

  return false;
};

const isResourceAlreadyExists = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const meta = (error as { meta?: { body?: { error?: { type?: string } } } }).meta;
  const errorType = meta?.body?.error?.type;

  return errorType === 'resource_already_exists_exception' || errorType === 'index_already_exists_exception';
};

const attachAliasToIndex = async (
  client: Client,
  indexName: string,
  alias: string,
  logger?: LoggerLike,
): Promise<void> => {
  try {
    await client.indices.updateAliases({
      body: {
        actions: [
          {
            add: {
              index: indexName,
              alias,
              is_write_index: true,
            },
          },
        ],
      },
    });

    logger?.info(
      { alias, index: indexName },
      'Attached OpenSearch alias to existing index',
    );
  } catch (error) {
    if (isResourceAlreadyExists(error)) {
      logger?.warn(
        { alias, index: indexName },
        'OpenSearch alias already attached to index',
      );
    } else {
      throw error;
    }
  }
};

const ensureTemplate = async (
  client: Client,
  definition: IndexDefinition,
  logger?: LoggerLike,
): Promise<void> => {
  await client.indices.putIndexTemplate({
    name: definition.templateName,
    body: {
      index_patterns: definition.indexPatterns,
      priority: definition.priority ?? 100,
      template: {
        aliases: {
          [definition.alias]: {},
        },
        settings: deepClone(definition.settings),
        mappings: deepClone(definition.mappings),
      },
      _meta: {
        managed_by: 'search-platform-api',
        alias: definition.alias,
      },
    },
  });

  logger?.info(
    { alias: definition.alias, template: definition.templateName },
    'Applied OpenSearch index template',
  );
};

const ensureBackingIndex = async (
  client: Client,
  definition: IndexDefinition,
  logger?: LoggerLike,
): Promise<string | undefined> => {
  const aliasAlreadyExists = await resolveAliasExists(client, definition.alias);

  if (aliasAlreadyExists) {
    logger?.info({ alias: definition.alias }, 'OpenSearch alias already present');
    return undefined;
  }

  const indexName = definition.initialIndex;

  try {
    await client.indices.create({
      index: indexName,
      body: {
        aliases: {
          [definition.alias]: {
            is_write_index: true,
          },
        },
        settings: deepClone(definition.settings),
        mappings: deepClone(definition.mappings),
      },
    });

    logger?.info(
      { alias: definition.alias, index: indexName },
      'Created OpenSearch index and assigned write alias',
    );

    return indexName;
  } catch (error) {
    if (isResourceAlreadyExists(error)) {
      logger?.warn(
        { alias: definition.alias, index: indexName },
        'OpenSearch index already exists, ensuring alias assignment',
      );

      await attachAliasToIndex(client, indexName, definition.alias, logger);

      return indexName;
    }

    throw error;
  }
};

export const ensureOpenSearchInfrastructure = async (
  client: Client,
  logger?: LoggerLike,
): Promise<BootstrapResult[]> => {
  const results: BootstrapResult[] = [];

  for (const definition of INDEX_DEFINITIONS) {
    await ensureTemplate(client, definition, logger);
    const createdIndex = await ensureBackingIndex(client, definition, logger);

    results.push({
      alias: definition.alias,
      templateName: definition.templateName,
      createdIndex,
    });
  }

  return results;
};
