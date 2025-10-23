import {
  BoostPurchase,
  CategoryTier,
  PrismaClient,
  Review,
  ReviewActivityMetric,
  User,
} from '@prisma/client';

export type ReviewForIndexing = Review & {
  user: User;
  categoryTier: CategoryTier | null;
  activityCounts: ReviewActivityMetric[];
  boostPurchases: BoostPurchase[];
};

const includeConfig = {
  user: true,
  categoryTier: true,
  activityCounts: true,
  boostPurchases: true,
} as const;

export class ReviewIndexingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getById(id: string): Promise<ReviewForIndexing | null> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: includeConfig,
    });

    return review as ReviewForIndexing | null;
  }

  async listAll(): Promise<ReviewForIndexing[]> {
    const reviews = await this.prisma.review.findMany({
      orderBy: { updatedAt: 'asc' },
      include: includeConfig,
    });

    return reviews as ReviewForIndexing[];
  }

  async listByIds(ids: string[]): Promise<ReviewForIndexing[]> {
    if (ids.length === 0) {
      return [];
    }

    const reviews = await this.prisma.review.findMany({
      where: { id: { in: ids } },
      include: includeConfig,
    });

    return reviews as ReviewForIndexing[];
  }
}
