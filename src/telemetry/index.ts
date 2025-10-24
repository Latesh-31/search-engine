import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import type { Meter, Tracer } from '@opentelemetry/api';
import { metrics, trace } from '@opentelemetry/api';

import env from '../config/env';

let sdk: NodeSDK | undefined;

const parseHeaders = (raw?: string): Record<string, string> | undefined => {
  if (!raw) {
    return undefined;
  }

  try {
    const value = JSON.parse(raw) as Record<string, string>;
    return value;
  } catch (error) {
    throw new Error(
      `OTEL_EXPORTER_OTLP_HEADERS must be a valid JSON object string: ${(error as Error).message}`,
    );
  }
};

export const initializeTelemetry = async (): Promise<void> => {
  if (env.NODE_ENV === 'test' || !env.OTEL_ENABLED || sdk) {
    return;
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
  });

  const prometheusExporter = new PrometheusExporter(
    {
      port: env.OTEL_METRICS_PORT,
      endpoint: env.OTEL_METRICS_ENDPOINT,
    },
    () => {
      if (env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(
          `📊 Prometheus metrics available at http://localhost:${env.OTEL_METRICS_PORT}${env.OTEL_METRICS_ENDPOINT}`,
        );
      }
    },
  );

  const traceExporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({
        url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
        headers: parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
      })
    : undefined;

  sdk = new NodeSDK({
    resource,
    metricReader: prometheusExporter,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  await sdk.start();
};

export const shutdownTelemetry = async (): Promise<void> => {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
};

export const getTracer = (name = 'search-platform-api'): Tracer => {
  return trace.getTracer(name);
};

export const getMeter = (name = 'search-platform-api'): Meter => {
  return metrics.getMeter(name);
};
