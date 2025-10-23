import { bootstrapOpenSearchInfrastructure, closeOpenSearchClient } from '../services/opensearch';

const run = async (): Promise<void> => {
  try {
    const results = await bootstrapOpenSearchInfrastructure(console);

    if (results.length === 0) {
      console.info('OpenSearch bootstrap skipped (disabled, test environment, or already applied).');
    } else {
      console.info('OpenSearch bootstrap completed.', { results });
    }
  } catch (error) {
    console.error('Failed to bootstrap OpenSearch infrastructure:', error);
    process.exitCode = 1;
  } finally {
    await closeOpenSearchClient();
  }
};

void run();
