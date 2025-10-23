import { BoostType } from '@prisma/client';

import {
  BoostRepository,
  InsufficientBoostCreditsError,
} from '../src/repositories/boostRepository';
import {
  BoostService,
  BoostUsageInsufficientCreditsError,
  createBoostService,
} from '../src/services/domain';

const createRepositoryMock = (): jest.Mocked<BoostRepository> => ({
  createBoostPurchase: jest.fn(),
  listBoostPurchases: jest.fn(),
  getBoostPurchaseById: jest.fn(),
  updateBoostPurchase: jest.fn(),
  deleteBoostPurchase: jest.fn(),
  createBoostUsage: jest.fn(),
  listBoostUsage: jest.fn(),
});

describe('BoostService', () => {
  let repository: jest.Mocked<BoostRepository>;
  let service: BoostService;

  beforeEach(() => {
    repository = createRepositoryMock();
    service = createBoostService(repository);
  });

  describe('createBoostPurchase', () => {
    it('propagates range errors for invalid credits purchased', async () => {
      await expect(
        service.createBoostPurchase({
          userId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
          boostType: BoostType.FEATURE,
          creditsPurchased: 0,
        }),
      ).rejects.toThrow(RangeError);

      expect(repository.createBoostPurchase).not.toHaveBeenCalled();
    });

    it('defaults creditsConsumed to zero when omitted', async () => {
      repository.createBoostPurchase.mockResolvedValue({
        id: 'boost-id',
        userId: 'user-id',
        reviewId: null,
        categoryTierId: null,
        boostType: BoostType.FEATURE,
        creditsPurchased: 10,
        creditsConsumed: 0,
        activatedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.createBoostPurchase({
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
        boostType: BoostType.FEATURE,
        creditsPurchased: 10,
      });

      expect(repository.createBoostPurchase).toHaveBeenCalledWith({
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
        boostType: BoostType.FEATURE,
        creditsPurchased: 10,
        creditsConsumed: 0,
      });
    });
  });

  describe('createBoostUsage', () => {
    it('converts insufficient credit errors into domain error', async () => {
      repository.createBoostUsage.mockRejectedValueOnce(new InsufficientBoostCreditsError());

      await expect(
        service.createBoostUsage({ boostPurchaseId: 'boost-id', quantity: 5 }),
      ).rejects.toBeInstanceOf(BoostUsageInsufficientCreditsError);
    });

    it('delegates to repository for valid payloads', async () => {
      repository.createBoostUsage.mockResolvedValue({
        purchase: {} as never,
        usage: {} as never,
      });

      await service.createBoostUsage({ boostPurchaseId: 'boost-id', quantity: 2 });

      expect(repository.createBoostUsage).toHaveBeenCalledWith({
        boostPurchaseId: 'boost-id',
        quantity: 2,
      });
    });
  });
});
