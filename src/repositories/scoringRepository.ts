import { Prisma, PrismaClient, User, ActivityType, BoostType, ReviewStatus } from '@prisma/client';

export interface UserScoreData {
  compositeScore: number;
  performanceScore: number;
  activenessScore: number;
  boostScore: number;
  lastScoredAt: Date;
}

export interface UserPerformanceMetrics {
  totalReviews: number;
  publishedReviews: number;
  averageRating: number;
}

export interface UserActivityMetrics {
  activityCounts: Array<{
    type: ActivityType;
    totalQuantity: number;
  }>;
}

export interface UserBoostMetrics {
  totalCreditsAvailable: number;
  totalCreditsConsumed: number;
  activeBoosts: Array<{
    boostType: BoostType;
    creditsRemaining: number;
  }>;
}

export interface ScoringRepository {
  ensureUserExists(userId: string): Promise<boolean>;
  updateUserScore(userId: string, scoreData: UserScoreData): Promise<User | null>;
  getUserPerformanceMetrics(userId: string): Promise<UserPerformanceMetrics>;
  getUserActivityMetrics(userId: string): Promise<UserActivityMetrics>;
  getUserBoostMetrics(userId: string): Promise<UserBoostMetrics>;
  getUserWithScores(userId: string): Promise<User | null>;
}

const handleNotFound = (error: unknown): null | never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return null;
  }

  throw error;
};

export const createScoringRepository = (prisma: PrismaClient): ScoringRepository => ({
  async ensureUserExists(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user !== null;
  },

  async updateUserScore(userId, scoreData) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: scoreData,
      });
    } catch (error) {
      return handleNotFound(error);
    }
  },

  async getUserPerformanceMetrics(userId) {
    const reviews = await prisma.review.findMany({
      where: { userId },
      select: {
        rating: true,
        status: true,
      },
    });

    const totalReviews = reviews.length;
    const publishedReviews = reviews.filter((r) => r.status === ReviewStatus.PUBLISHED).length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    return {
      totalReviews,
      publishedReviews,
      averageRating,
    };
  },

  async getUserActivityMetrics(userId) {
    const activities = await prisma.reviewActivityMetric.groupBy({
      by: ['type'],
      where: {
        OR: [
          { userId },
          {
            review: {
              userId,
            },
          },
        ],
      },
      _sum: {
        quantity: true,
      },
    });

    const activityCounts = activities.map((activity) => ({
      type: activity.type,
      totalQuantity: activity._sum.quantity || 0,
    }));

    return { activityCounts };
  },

  async getUserBoostMetrics(userId) {
    const boosts = await prisma.boostPurchase.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      select: {
        boostType: true,
        creditsPurchased: true,
        creditsConsumed: true,
      },
    });

    const totalCreditsAvailable = boosts.reduce(
      (sum, b) => sum + Math.max(0, b.creditsPurchased - b.creditsConsumed),
      0,
    );
    const totalCreditsConsumed = boosts.reduce((sum, b) => sum + b.creditsConsumed, 0);

    const activeBoosts = boosts
      .filter((b) => b.creditsPurchased > b.creditsConsumed)
      .map((b) => ({
        boostType: b.boostType,
        creditsRemaining: b.creditsPurchased - b.creditsConsumed,
      }));

    return {
      totalCreditsAvailable,
      totalCreditsConsumed,
      activeBoosts,
    };
  },

  async getUserWithScores(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        compositeScore: true,
        performanceScore: true,
        activenessScore: true,
        boostScore: true,
        lastScoredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
});
