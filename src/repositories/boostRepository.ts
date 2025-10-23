import { BoostPurchase, BoostType, BoostUsage, Prisma, PrismaClient } from '@prisma/client';

export class InsufficientBoostCreditsError extends Error {
  constructor() {
    super('Not enough credits remain on the boost purchase to record usage.');
    this.name = 'InsufficientBoostCreditsError';
  }
}

export interface CreateBoostPurchaseData {
  userId: string;
  reviewId?: string | null;
  categoryTierId?: string | null;
  boostType: BoostType;
  creditsPurchased: number;
  creditsConsumed?: number;
  activatedAt?: Date | null;
  expiresAt?: Date | null;
}

export type UpdateBoostPurchaseData = Partial<CreateBoostPurchaseData>;

export interface CreateBoostUsageData {
  boostPurchaseId: string;
  reviewId?: string | null;
  quantity?: number;
  appliedAt?: Date;
}

export interface BoostRepository {
  createBoostPurchase(data: CreateBoostPurchaseData): Promise<BoostPurchase>;
  listBoostPurchases(): Promise<BoostPurchase[]>;
  getBoostPurchaseById(id: string): Promise<BoostPurchase | null>;
  updateBoostPurchase(id: string, data: UpdateBoostPurchaseData): Promise<BoostPurchase | null>;
  deleteBoostPurchase(id: string): Promise<BoostPurchase | null>;
  createBoostUsage(
    data: CreateBoostUsageData,
  ): Promise<{ purchase: BoostPurchase; usage: BoostUsage } | null>;
  listBoostUsage(boostPurchaseId: string): Promise<BoostUsage[]>;
}

const handleNotFound = (error: unknown): null | never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return null;
  }

  throw error;
};

export const createBoostRepository = (prisma: PrismaClient): BoostRepository => ({
  async createBoostPurchase(data) {
    return prisma.boostPurchase.create({ data });
  },
  async listBoostPurchases() {
    return prisma.boostPurchase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        review: true,
        categoryTier: true,
        usages: true,
      },
    });
  },
  async getBoostPurchaseById(id) {
    return prisma.boostPurchase.findUnique({
      where: { id },
      include: {
        user: true,
        review: true,
        categoryTier: true,
        usages: true,
      },
    });
  },
  async updateBoostPurchase(id, data) {
    try {
      return await prisma.boostPurchase.update({ where: { id }, data });
    } catch (error) {
      return handleNotFound(error);
    }
  },
  async deleteBoostPurchase(id) {
    try {
      return await prisma.boostPurchase.delete({ where: { id } });
    } catch (error) {
      return handleNotFound(error);
    }
  },
  async createBoostUsage(data) {
    const quantity = data.quantity ?? 1;

    return prisma.$transaction(async (tx) => {
      const purchase = await tx.boostPurchase.findUnique({ where: { id: data.boostPurchaseId } });

      if (!purchase) {
        return null;
      }

      if (quantity <= 0) {
        throw new RangeError('Usage quantity must be greater than zero.');
      }

      const remainingCredits = purchase.creditsPurchased - purchase.creditsConsumed;

      if (remainingCredits < quantity) {
        throw new InsufficientBoostCreditsError();
      }

      const usage = await tx.boostUsage.create({
        data: {
          boostPurchaseId: data.boostPurchaseId,
          reviewId: data.reviewId ?? null,
          quantity,
          appliedAt: data.appliedAt,
        },
      });

      const updatedPurchase = await tx.boostPurchase.update({
        where: { id: purchase.id },
        data: {
          creditsConsumed: purchase.creditsConsumed + quantity,
        },
      });

      return { purchase: updatedPurchase, usage };
    });
  },
  async listBoostUsage(boostPurchaseId) {
    return prisma.boostUsage.findMany({
      where: { boostPurchaseId },
      orderBy: { appliedAt: 'desc' },
    });
  },
});
