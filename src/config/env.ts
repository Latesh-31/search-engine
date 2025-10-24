import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const BOOLEAN_STRINGS = ['true', 'false'] as const;

const optionalUrl = (message: string) =>
  z
    .string()
    .url({ message })
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const booleanFlag = z.enum(BOOLEAN_STRINGS).transform((value) => value === 'true');

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
  DATABASE_URL: optionalUrl('DATABASE_URL must be a valid connection string'),
  SHADOW_DATABASE_URL: optionalUrl('SHADOW_DATABASE_URL must be a valid connection string'),
  OPENSEARCH_NODE: z
    .string()
    .url({ message: 'OPENSEARCH_NODE must be a valid URL' })
    .default('http://opensearch:9200'),
  OPENSEARCH_USERNAME: optionalString,
  OPENSEARCH_PASSWORD: optionalString,
  OPENSEARCH_USERNAME_FILE: optionalString,
  OPENSEARCH_PASSWORD_FILE: optionalString,
  OPENSEARCH_CA_CERT_PATH: optionalString,
  OPENSEARCH_TLS_REJECT_UNAUTHORIZED: z
    .enum(BOOLEAN_STRINGS)
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  OPENSEARCH_BOOTSTRAP_ENABLED: z.enum(BOOLEAN_STRINGS).default('true').transform((value) => value === 'true'),
  OTEL_ENABLED: z.enum(BOOLEAN_STRINGS).default('false').transform((value) => value === 'true'),
  OTEL_SERVICE_NAME: z.string().min(1).default('search-platform-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL'),
  OTEL_EXPORTER_OTLP_HEADERS: optionalString,
  OTEL_METRICS_PORT: z.coerce.number().int().positive().default(9464),
  OTEL_METRICS_ENDPOINT: z.string().min(1).default('/metrics'),
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
