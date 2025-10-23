import { CategoryTier } from '@prisma/client';

import {
  CategoryTierRepository,
  CreateCategoryTierData,
  UpdateCategoryTierData,
} from '../../repositories/categoryTierRepository';

const validatePriority = (priority: number | undefined): void => {
  if (priority === undefined) {
    return;
  }

  if (!Number.isInteger(priority) || priority < 0) {
    throw new RangeError('Priority must be a non-negative integer.');
  }
};

export interface CategoryTierService {
  createCategoryTier(data: CreateCategoryTierData): Promise<CategoryTier>;
  listCategoryTiers(): Promise<CategoryTier[]>;
  getCategoryTier(id: string): Promise<CategoryTier | null>;
  updateCategoryTier(id: string, data: UpdateCategoryTierData): Promise<CategoryTier | null>;
  deleteCategoryTier(id: string): Promise<CategoryTier | null>;
}

export const createCategoryTierService = (
  repository: CategoryTierRepository,
): CategoryTierService => ({
  async createCategoryTier(data) {
    validatePriority(data.priority);
    return repository.createCategoryTier({ ...data, priority: data.priority ?? 0 });
  },
  listCategoryTiers: () => repository.listCategoryTiers(),
  getCategoryTier: (id) => repository.getCategoryTierById(id),
  async updateCategoryTier(id, data) {
    validatePriority(data.priority);
    return repository.updateCategoryTier(id, data);
  },
  deleteCategoryTier: (id) => repository.deleteCategoryTier(id),
});
