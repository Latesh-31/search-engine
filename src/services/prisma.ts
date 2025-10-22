import { PrismaClient } from '@prisma/client';

import env from '../config/env';

let prisma: PrismaClient | undefined;

const buildConnectionString = (): string => {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const user = encodeURIComponent(env.POSTGRES_USER);
  const password = encodeURIComponent(env.POSTGRES_PASSWORD);

  return `postgresql://${user}:${password}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;
};

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: buildConnectionString(),
        },
      },
    });
  }

  return prisma;
};

export const closePrismaClient = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
};
