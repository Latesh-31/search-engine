import { Prisma, PrismaClient, Review, ReviewStatus } from '@prisma/client';

export interface CreateReviewData {
  userId: string;
  categoryTierId?: string | null;
  title: string;
  content: string;
  rating: number;
  status?: ReviewStatus;
}

export type UpdateReviewData = Partial<Omit<CreateReviewData, 'userId'>>;

export interface ReviewRepository {
  createReview(data: CreateReviewData): Promise<Review>;
  listReviews(): Promise<Review[]>;
  getReviewById(id: string): Promise<Review | null>;
  updateReview(id: string, data: UpdateReviewData): Promise<Review | null>;
  deleteReview(id: string): Promise<Review | null>;
}

const handleNotFound = <T>(error: unknown): null | never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return null;
  }

  throw error;
};

export const createReviewRepository = (prisma: PrismaClient): ReviewRepository => ({
  async createReview(data) {
    return prisma.review.create({ data });
  },
  async listReviews() {
    return prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        categoryTier: true,
      },
    });
  },
  async getReviewById(id) {
    return prisma.review.findUnique({
      where: { id },
      include: {
        user: true,
        categoryTier: true,
        activityCounts: true,
        boostPurchases: true,
      },
    });
  },
  async updateReview(id, data) {
    try {
      return await prisma.review.update({ where: { id }, data });
    } catch (error) {
      return handleNotFound<Review>(error);
    }
  },
  async deleteReview(id) {
    try {
      return await prisma.review.delete({ where: { id } });
    } catch (error) {
      return handleNotFound<Review>(error);
    }
  },
});
