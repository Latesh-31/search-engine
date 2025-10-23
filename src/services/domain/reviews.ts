import { Review } from '@prisma/client';

import {
  CreateReviewData,
  ReviewRepository,
  UpdateReviewData,
} from '../../repositories/reviewRepository';

const validateRating = (rating: number | undefined): void => {
  if (rating === undefined) {
    return;
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new RangeError('Rating must be an integer between 1 and 5.');
  }
};

export interface ReviewService {
  createReview(data: CreateReviewData): Promise<Review>;
  listReviews(): Promise<Review[]>;
  getReview(id: string): Promise<Review | null>;
  updateReview(id: string, data: UpdateReviewData): Promise<Review | null>;
  deleteReview(id: string): Promise<Review | null>;
}

export const createReviewService = (reviewRepository: ReviewRepository): ReviewService => ({
  async createReview(data) {
    validateRating(data.rating);
    return reviewRepository.createReview(data);
  },
  listReviews: () => reviewRepository.listReviews(),
  getReview: (id) => reviewRepository.getReviewById(id),
  async updateReview(id, data) {
    validateRating(data.rating);
    return reviewRepository.updateReview(id, data);
  },
  deleteReview: (id) => reviewRepository.deleteReview(id),
});
