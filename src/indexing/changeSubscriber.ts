import { Pool, PoolClient, Notification } from 'pg';

import { EnqueueIndexingEvent, IndexingQueue } from './queue';
import { IndexingLogger, IndexingOperation } from './types';

interface ChangeNotificationPayload {
  id: string;
  entityType: EnqueueIndexingEvent['entityType'];
  entityId: string;
  operation: IndexingOperation;
  cursor?: string | number;
  availableAt?: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
}

export interface PostgresChangeSubscriberOptions {
  channel?: string;
  logger?: IndexingLogger;
}

const parseCursor = (cursor?: string | number): Date | undefined => {
  if (cursor === undefined || cursor === null) {
    return undefined;
  }

  if (typeof cursor === 'number') {
    return new Date(cursor);
  }

  const parsed = new Date(cursor);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseAvailableAt = (availableAt?: string): Date | undefined => {
  if (!availableAt) {
    return undefined;
  }

  const parsed = new Date(availableAt);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export class PostgresChangeSubscriber {
  private readonly pool: Pool;

  private readonly queue: IndexingQueue;

  private readonly channel: string;

  private readonly logger?: IndexingLogger;

  private listening = false;

  private client?: PoolClient;

  constructor(pool: Pool, queue: IndexingQueue, options: PostgresChangeSubscriberOptions = {}) {
    this.pool = pool;
    this.queue = queue;
    this.channel = options.channel ?? 'search_indexing_changes';
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    if (this.listening) {
      return;
    }

    this.client = await this.pool.connect();
    this.client.on('notification', (notification) => {
      void this.handleNotification(notification);
    });
    this.client.on('error', (error) => {
      this.logger?.error?.({ error }, 'Change subscriber client encountered an error');
    });

    await this.client.query(`LISTEN ${this.channel}`);
    this.listening = true;
    this.logger?.info?.({ channel: this.channel }, 'Subscribed to Postgres change notifications');
  }

  async stop(): Promise<void> {
    if (!this.listening || !this.client) {
      return;
    }

    await this.client.query(`UNLISTEN ${this.channel}`);
    this.client.removeAllListeners('notification');
    this.client.removeAllListeners('error');
    this.client.release();
    this.client = undefined;
    this.listening = false;
    this.logger?.info?.({ channel: this.channel }, 'Unsubscribed from Postgres change notifications');
  }

  private async handleNotification(notification: Notification): Promise<void> {
    if (notification.channel !== this.channel) {
      return;
    }

    if (!notification.payload) {
      this.logger?.warn?.({ notification }, 'Received change notification without payload');
      return;
    }

    let payload: ChangeNotificationPayload;
    try {
      payload = JSON.parse(notification.payload) as ChangeNotificationPayload;
    } catch (error) {
      this.logger?.error?.({ notification, error }, 'Failed to parse change notification payload');
      return;
    }

    if (!payload.id || !payload.entityType || !payload.entityId || !payload.operation) {
      this.logger?.warn?.({ payload }, 'Invalid change notification payload');
      return;
    }

    try {
      await this.queue.enqueue({
        id: payload.id,
        entityType: payload.entityType,
        entityId: payload.entityId,
        operation: payload.operation,
        cursor: parseCursor(payload.cursor),
        availableAt: parseAvailableAt(payload.availableAt),
        metadata: payload.metadata,
        maxAttempts: payload.maxAttempts,
      });
    } catch (error) {
      this.logger?.error?.({ payload, error }, 'Failed to enqueue indexing event from notification');
    }
  }
}
