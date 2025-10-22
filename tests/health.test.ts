import { buildApp } from '../src/app';

describe('GET /health', () => {
  it('returns structured health information', async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const payload = response.json();

      expect(payload).toHaveProperty('status');
      expect(payload.status).toBe('pass');
      expect(payload).toHaveProperty('checks');
      expect(payload.checks).toHaveProperty('postgres');
      expect(payload.checks).toHaveProperty('opensearch');
      expect(payload.checks.postgres).toHaveProperty('status');
      expect(payload.checks.opensearch).toHaveProperty('status');
      expect(payload.checks.postgres.status).toBe('skipped');
      expect(payload.checks.opensearch.status).toBe('skipped');
    } finally {
      await app.close();
    }
  });
});
