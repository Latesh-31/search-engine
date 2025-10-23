import {
  ActivityType,
  Prisma,
  PrismaClient,
  ReviewActivityMetric,
} from '@prisma/client';

export interface CreateReviewActivityData {
  reviewId: string;
  userId?: string | null;
  type: ActivityType;
  quantity?: number;
  notes?: string | null;
  recordedAt?: Date;
}

export type UpdateReviewActivityData = Partial<Omit<CreateReviewActivityData, 'reviewId' | 'type'>> & {
  type?: ActivityType;
};

export interface ReviewActivityRepository {
  createActivity(data: CreateReviewActivityData): Promise<ReviewActivityMetric>;
  listActivitiesByReview(reviewId: string): Promise<ReviewActivityMetric[]>;
  getActivityById(id: string): Promise<ReviewActivityMetric | null>;
  updateActivity(id: string, data: UpdateReviewActivityData): Promise<ReviewActivityMetric | null>;
  deleteActivity(id: string): Promise<ReviewActivityMetric | null>;
}

const handleNotFound = (error: unknown): null | never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return null;
  }

  throw error;
};

export const createReviewActivityRepository = (
  prisma: PrismaClient,
): ReviewActivityRepository => ({
  async createActivity(data) {
    return prisma.reviewActivityMetric.create({ data });
  },
  async listActivitiesByReview(reviewId) {
    return prisma.reviewActivityMetric.findMany({
      where: { reviewId },
      orderBy: { recordedAt: 'desc' },
    });
  },
  async getActivityById(id) {
    return prisma.reviewActivityMetric.findUnique({ where: { id } });
  },
  async updateActivity(id, data) {
    try {
      return await prisma.reviewActivityMetric.update({ where: { id }, data });
    } catch (error) {
      return handleNotFound(error);
    }
  },
  async deleteActivity(id) {
    try {
      return await prisma.reviewActivityMetric.delete({ where: { id } });
    } catch (error) {
      return handleNotFound(error);
    }
  },
});
