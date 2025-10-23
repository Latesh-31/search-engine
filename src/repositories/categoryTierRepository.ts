import { CategoryTier, Prisma, PrismaClient } from '@prisma/client';

export interface CreateCategoryTierData {
  name: string;
  slug: string;
  description?: string | null;
  priority?: number;
}

export type UpdateCategoryTierData = Partial<CreateCategoryTierData>;

export interface CategoryTierRepository {
  createCategoryTier(data: CreateCategoryTierData): Promise<CategoryTier>;
  listCategoryTiers(): Promise<CategoryTier[]>;
  getCategoryTierById(id: string): Promise<CategoryTier | null>;
  updateCategoryTier(id: string, data: UpdateCategoryTierData): Promise<CategoryTier | null>;
  deleteCategoryTier(id: string): Promise<CategoryTier | null>;
}

const handleNotFound = <T>(error: unknown): null | never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return null;
  }

  throw error;
};

export const createCategoryTierRepository = (
  prisma: PrismaClient,
): CategoryTierRepository => ({
  async createCategoryTier(data) {
    return prisma.categoryTier.create({ data });
  },
  async listCategoryTiers() {
    return prisma.categoryTier.findMany({ orderBy: { priority: 'asc' } });
  },
  async getCategoryTierById(id) {
    return prisma.categoryTier.findUnique({ where: { id } });
  },
  async updateCategoryTier(id, data) {
    try {
      return await prisma.categoryTier.update({ where: { id }, data });
    } catch (error) {
      return handleNotFound<CategoryTier>(error);
    }
  },
  async deleteCategoryTier(id) {
    try {
      return await prisma.categoryTier.delete({ where: { id } });
    } catch (error) {
      return handleNotFound<CategoryTier>(error);
    }
  },
});
