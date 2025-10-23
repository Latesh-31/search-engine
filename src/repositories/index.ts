import { PrismaClient } from '@prisma/client';

import { BoostRepository, createBoostRepository } from './boostRepository';
import {
  CategoryTierRepository,
  createCategoryTierRepository,
} from './categoryTierRepository';
import {
  ReviewActivityRepository,
  createReviewActivityRepository,
} from './reviewActivityRepository';
import { ReviewRepository, createReviewRepository } from './reviewRepository';
import { ScoringRepository, createScoringRepository } from './scoringRepository';
import { UserRepository, createUserRepository } from './userRepository';

export interface AppRepositories {
  userRepository: UserRepository;
  reviewRepository: ReviewRepository;
  activityRepository: ReviewActivityRepository;
  boostRepository: BoostRepository;
  categoryTierRepository: CategoryTierRepository;
  scoringRepository: ScoringRepository;
}

export const createRepositories = (prisma: PrismaClient): AppRepositories => ({
  userRepository: createUserRepository(prisma),
  reviewRepository: createReviewRepository(prisma),
  activityRepository: createReviewActivityRepository(prisma),
  boostRepository: createBoostRepository(prisma),
  categoryTierRepository: createCategoryTierRepository(prisma),
  scoringRepository: createScoringRepository(prisma),
});
