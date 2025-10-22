import env from './config/env';
import { buildApp } from './app';

const start = async () => {
  const app = buildApp();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      try {
        app.log.info({ signal }, 'Received shutdown signal');
        await app.close();
        process.exit(0);
      } catch (error) {
        app.log.error(error, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  });

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info({ port: env.PORT }, 'Server is listening');
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
};

void start();
