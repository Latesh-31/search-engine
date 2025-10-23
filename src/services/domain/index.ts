import { AppRepositories } from '../../repositories';
import { createBoostService, BoostService, BoostUsageInsufficientCreditsError } from './boosts';
import { createCategoryTierService, CategoryTierService } from './categoryTiers';
import { createReviewService, ReviewService } from './reviews';
import { createReviewActivityService, ReviewActivityService } from './reviewActivity';
import { createUserService, UserService } from './users';

export interface AppServices {
  userService: UserService;
  reviewService: ReviewService;
  activityService: ReviewActivityService;
  boostService: BoostService;
  categoryTierService: CategoryTierService;
}

export {
  createBoostService,
  BoostUsageInsufficientCreditsError,
  type BoostService,
} from './boosts';
export { createCategoryTierService, type CategoryTierService } from './categoryTiers';
export { createReviewService, type ReviewService } from './reviews';
export { createReviewActivityService, type ReviewActivityService } from './reviewActivity';
export { createUserService, type UserService } from './users';

export const createServices = (repositories: AppRepositories): AppServices => ({
  userService: createUserService(repositories.userRepository),
  reviewService: createReviewService(repositories.reviewRepository),
  activityService: createReviewActivityService(repositories.activityRepository),
  boostService: createBoostService(repositories.boostRepository),
  categoryTierService: createCategoryTierService(repositories.categoryTierRepository),
});
