import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  POSTGRES_HOST: z.string().min(1).default('postgres'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1).default('search_service'),
  POSTGRES_USER: z.string().min(1).default('search_user'),
  POSTGRES_PASSWORD: z.string().min(1).default('search_password'),
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL must be a valid connection string' })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  SHADOW_DATABASE_URL: z
    .string()
    .url({ message: 'SHADOW_DATABASE_URL must be a valid connection string' })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  OPENSEARCH_NODE: z
    .string()
    .url({ message: 'OPENSEARCH_NODE must be a valid URL' })
    .default('http://opensearch:9200'),
  OPENSEARCH_USERNAME: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  OPENSEARCH_PASSWORD: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export type Environment = typeof env;
export type LogLevel = (typeof LOG_LEVELS)[number];

export default env;
