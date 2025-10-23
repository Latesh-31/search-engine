import { FastifyPluginAsync } from 'fastify';
import { context, trace, Span } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

import { getMeter, getTracer } from '../telemetry';

const OBSERVABILITY_STATE = Symbol('observabilityState');

interface RequestObservabilityState {
  startTime: [number, number];
  span?: Span;
}

declare module 'fastify' {
  interface FastifyRequest {
    [OBSERVABILITY_STATE]?: RequestObservabilityState;
  }
}

const toMillis = (start: [number, number]): number => {
  const [seconds, nanoseconds] = process.hrtime(start);
  return seconds * 1000 + nanoseconds / 1_000_000;
};

export const observabilityPlugin: FastifyPluginAsync = async (fastify) => {
  const tracer = getTracer('http.server');
  const meter = getMeter('http.server');

  const requestCounter = meter.createCounter('http.server.requests', {
    description: 'Count of HTTP requests received by the Fastify server',
  });

  const durationHistogram = meter.createHistogram('http.server.request.duration', {
    description: 'Duration of HTTP requests handled by the Fastify server',
    unit: 'ms',
  });

  fastify.addHook('onRequest', async (request) => {
    const startTime = process.hrtime();

    const span = tracer.startSpan(
      `${request.method} ${request.routerPath ?? request.url}`,
      {
        attributes: {
          [SemanticAttributes.HTTP_REQUEST_METHOD]: request.method,
          [SemanticAttributes.HTTP_URL]: request.url,
          [SemanticAttributes.HTTP_ROUTE]: request.routerPath,
          [SemanticAttributes.NET_HOST_NAME]: request.hostname,
          [SemanticAttributes.HTTP_USER_AGENT]: request.headers['user-agent'] ?? '',
          [SemanticAttributes.NET_PEER_IP]: request.ip,
        },
      },
      context.active(),
    );

    request[OBSERVABILITY_STATE] = {
      startTime,
      span,
    };
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const state = request[OBSERVABILITY_STATE];
    const duration = state ? toMillis(state.startTime) : 0;
    const statusCode = reply.statusCode;
    const route = request.routerPath ?? reply.request?.raw.url ?? request.url;

    requestCounter.add(1, {
      [SemanticAttributes.HTTP_REQUEST_METHOD]: request.method,
      [SemanticAttributes.HTTP_ROUTE]: route,
      [SemanticAttributes.HTTP_RESPONSE_STATUS_CODE]: statusCode,
    });

    durationHistogram.record(duration, {
      [SemanticAttributes.HTTP_REQUEST_METHOD]: request.method,
      [SemanticAttributes.HTTP_ROUTE]: route,
      [SemanticAttributes.HTTP_RESPONSE_STATUS_CODE]: statusCode,
    });

    request.log.info(
      {
        req: {
          id: request.id,
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        res: {
          statusCode,
          contentLength: reply.getHeader('content-length'),
        },
        duration,
      },
      'Request completed',
    );

    if (state?.span) {
      state.span.setAttribute(SemanticAttributes.HTTP_RESPONSE_STATUS_CODE, statusCode);
      state.span.end();
    }
  });

  fastify.addHook('onError', async (request, reply, error) => {
    const state = request[OBSERVABILITY_STATE];
    const duration = state ? toMillis(state.startTime) : 0;
    const route = request.routerPath ?? request.url;

    requestCounter.add(1, {
      [SemanticAttributes.HTTP_REQUEST_METHOD]: request.method,
      [SemanticAttributes.HTTP_ROUTE]: route,
      [SemanticAttributes.HTTP_RESPONSE_STATUS_CODE]: reply.statusCode || 500,
      error: true,
    });

    durationHistogram.record(duration, {
      [SemanticAttributes.HTTP_REQUEST_METHOD]: request.method,
      [SemanticAttributes.HTTP_ROUTE]: route,
      [SemanticAttributes.HTTP_RESPONSE_STATUS_CODE]: reply.statusCode || 500,
      error: true,
    });

    if (state?.span) {
      state.span.recordException(error);
      state.span.setAttribute(SemanticAttributes.HTTP_RESPONSE_STATUS_CODE, reply.statusCode || 500);
      state.span.end();
    }
  });
};
