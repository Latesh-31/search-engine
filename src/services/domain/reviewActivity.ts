import { ReviewActivityMetric } from '@prisma/client';

import {
  CreateReviewActivityData,
  ReviewActivityRepository,
  UpdateReviewActivityData,
} from '../../repositories/reviewActivityRepository';

const validateQuantity = (quantity: number | undefined): void => {
  if (quantity === undefined) {
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError('Activity quantity must be a positive integer.');
  }
};

export interface ReviewActivityService {
  createActivity(data: CreateReviewActivityData): Promise<ReviewActivityMetric>;
  listActivitiesByReview(reviewId: string): Promise<ReviewActivityMetric[]>;
  getActivity(id: string): Promise<ReviewActivityMetric | null>;
  updateActivity(id: string, data: UpdateReviewActivityData): Promise<ReviewActivityMetric | null>;
  deleteActivity(id: string): Promise<ReviewActivityMetric | null>;
}

export const createReviewActivityService = (
  repository: ReviewActivityRepository,
): ReviewActivityService => ({
  async createActivity(data) {
    validateQuantity(data.quantity);
    return repository.createActivity({ ...data, quantity: data.quantity ?? 1 });
  },
  listActivitiesByReview: (reviewId) => repository.listActivitiesByReview(reviewId),
  getActivity: (id) => repository.getActivityById(id),
  async updateActivity(id, data) {
    validateQuantity(data.quantity);
    return repository.updateActivity(id, data);
  },
  deleteActivity: (id) => repository.deleteActivity(id),
});
