import { createBoostService, type BoostService } from './boosts';
import { createCategoryTierService, type CategoryTierService } from './categoryTiers';
import { createReviewActivityService, type ReviewActivityService } from './reviewActivity';
import { createReviewService, type ReviewService } from './reviews';
import { createScoringService, type ScoringService } from './scoring';
import { createUserService, type UserService } from './users';
import { AppRepositories } from '../../repositories';

export interface AppServices {
  userService: UserService;
  reviewService: ReviewService;
  activityService: ReviewActivityService;
  boostService: BoostService;
  categoryTierService: CategoryTierService;
  scoringService: ScoringService;
}

export {
  createBoostService,
  BoostUsageInsufficientCreditsError,
  type BoostService,
} from './boosts';
export { createCategoryTierService, type CategoryTierService } from './categoryTiers';
export { createReviewActivityService, type ReviewActivityService } from './reviewActivity';
export { createReviewService, type ReviewService } from './reviews';
export { createScoringService, type ScoringService } from './scoring';
export { createUserService, type UserService } from './users';

export const createServices = (repositories: AppRepositories): AppServices => ({
  userService: createUserService(repositories.userRepository),
  reviewService: createReviewService(repositories.reviewRepository),
  activityService: createReviewActivityService(repositories.activityRepository),
  boostService: createBoostService(repositories.boostRepository),
  categoryTierService: createCategoryTierService(repositories.categoryTierRepository),
  scoringService: createScoringService(repositories.scoringRepository),
});
