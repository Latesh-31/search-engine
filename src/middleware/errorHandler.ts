import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import env from '../config/env';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
}

export const errorHandler = async (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  let statusCode = error.statusCode ?? 500;
  const timestamp = new Date().toISOString();

  const errorResponse: ErrorResponse = {
    statusCode,
    error: error.name || 'Error',
    message: error.message || 'An unexpected error occurred.',
    timestamp,
    path: request.url,
    method: request.method,
    requestId: request.id,
  };

  if (error instanceof ZodError) {
    statusCode = 400;
    errorResponse.statusCode = statusCode;
    errorResponse.error = 'ValidationError';
    errorResponse.message = 'Request validation failed.';
    errorResponse.details = error.format();
  } else if (error instanceof RangeError) {
    statusCode = 400;
    errorResponse.statusCode = statusCode;
    errorResponse.error = 'BadRequestError';
    errorResponse.message = error.message;
  } else if (error.name === 'BoostUsageInsufficientCreditsError' || error.name === 'InsufficientBoostCreditsError') {
    statusCode = 409;
    errorResponse.statusCode = statusCode;
    errorResponse.error = error.name;
    errorResponse.message = error.message || 'Insufficient credits to complete the requested operation.';
  }

  if (error.validation) {
    errorResponse.details = error.validation;
  }

  request.log.error(
    {
      err: error,
      req: {
        id: request.id,
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
      },
      statusCode,
    },
    'Request failed with error',
  );

  if (statusCode >= 500) {
    if (env.NODE_ENV === 'production') {
      errorResponse.message = 'Internal server error.';
      delete errorResponse.details;
    }
  }

  await reply.status(statusCode).send(errorResponse);
};
