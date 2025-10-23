import { FastifyReply } from 'fastify';

interface ErrorPayload {
  message: string;
  details?: unknown;
}

export const sendValidationError = (
  reply: FastifyReply,
  message: string,
  details?: unknown,
): FastifyReply => reply.status(400).send({ message, details } satisfies ErrorPayload);

export const sendNotFound = (reply: FastifyReply, resource: string): FastifyReply =>
  reply.status(404).send({ message: `${resource} not found.` } satisfies ErrorPayload);

export const handleServiceError = (reply: FastifyReply, error: unknown): FastifyReply => {
  if (error instanceof RangeError) {
    return reply.status(400).send({ message: error.message } satisfies ErrorPayload);
  }

  return reply.status(500).send({ message: 'An unexpected error occurred.' } satisfies ErrorPayload);
};
