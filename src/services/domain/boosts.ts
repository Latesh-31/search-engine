import { BoostPurchase, BoostUsage } from '@prisma/client';

import {
  BoostRepository,
  CreateBoostPurchaseData,
  CreateBoostUsageData,
  InsufficientBoostCreditsError,
  UpdateBoostPurchaseData,
} from '../../repositories/boostRepository';

const validateCredits = (
  creditsPurchased: number | undefined,
  creditsConsumed: number | undefined,
): void => {
  if (creditsPurchased !== undefined) {
    if (!Number.isInteger(creditsPurchased) || creditsPurchased <= 0) {
      throw new RangeError('creditsPurchased must be a positive integer.');
    }
  }

  if (creditsConsumed !== undefined) {
    if (!Number.isInteger(creditsConsumed) || creditsConsumed < 0) {
      throw new RangeError('creditsConsumed must be a non-negative integer.');
    }

    if (creditsPurchased !== undefined && creditsConsumed > creditsPurchased) {
      throw new RangeError('creditsConsumed cannot exceed creditsPurchased.');
    }
  }
};

const validateUsageQuantity = (quantity: number | undefined): void => {
  if (quantity === undefined) {
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError('Usage quantity must be a positive integer.');
  }
};

export interface BoostService {
  createBoostPurchase(data: CreateBoostPurchaseData): Promise<BoostPurchase>;
  listBoostPurchases(): Promise<BoostPurchase[]>;
  getBoostPurchase(id: string): Promise<BoostPurchase | null>;
  updateBoostPurchase(id: string, data: UpdateBoostPurchaseData): Promise<BoostPurchase | null>;
  deleteBoostPurchase(id: string): Promise<BoostPurchase | null>;
  createBoostUsage(
    data: CreateBoostUsageData,
  ): Promise<{ purchase: BoostPurchase; usage: BoostUsage } | null>;
  listBoostUsage(boostPurchaseId: string): Promise<BoostUsage[]>;
}

export class BoostUsageInsufficientCreditsError extends Error {
  constructor() {
    super('Boost usage cannot be recorded due to insufficient credits.');
    this.name = 'BoostUsageInsufficientCreditsError';
  }
}

export const createBoostService = (repository: BoostRepository): BoostService => ({
  async createBoostPurchase(data) {
    validateCredits(data.creditsPurchased, data.creditsConsumed);
    return repository.createBoostPurchase({
      ...data,
      creditsConsumed: data.creditsConsumed ?? 0,
    });
  },
  listBoostPurchases: () => repository.listBoostPurchases(),
  getBoostPurchase: (id) => repository.getBoostPurchaseById(id),
  async updateBoostPurchase(id, data) {
    validateCredits(data.creditsPurchased, data.creditsConsumed);
    return repository.updateBoostPurchase(id, data);
  },
  deleteBoostPurchase: (id) => repository.deleteBoostPurchase(id),
  async createBoostUsage(data) {
    validateUsageQuantity(data.quantity);

    try {
      return await repository.createBoostUsage(data);
    } catch (error) {
      if (error instanceof InsufficientBoostCreditsError) {
        throw new BoostUsageInsufficientCreditsError();
      }

      throw error;
    }
  },
  listBoostUsage: (boostPurchaseId) => repository.listBoostUsage(boostPurchaseId),
});
