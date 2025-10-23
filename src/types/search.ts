export type CategoryTierLevel = 'lower' | 'medium' | 'higher';
export type AdBoostStatus = 'boosted' | 'organic';

export interface ReviewSearchDocument {
  id: string;
  userId: string;
  categoryTierId: string | null;
  categoryTierLevel: CategoryTierLevel | null;
  title: string;
  content: string;
  rating: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    email: string;
  };
  category: {
    id: string;
    name: string;
    priority: number;
  } | null;
  activityTotalQuantity: number;
  boostCreditsPurchased: number;
  boostCreditsConsumed: number;
  boostCreditsRemaining: number;
  adBoostStatus: AdBoostStatus;
}
