export interface ScoringWeights {
  performance: number;
  activeness: number;
  boost: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  activityTypeWeights: {
    VIEW: number;
    HELPFUL: number;
    SHARE: number;
    COMMENT: number;
    CLICK: number;
  };
  boostTypeWeights: {
    FEATURE: number;
    PRIORITY: number;
    HIGHLIGHT: number;
  };
  performanceWeights: {
    averageRating: number;
    totalReviews: number;
    publishedReviews: number;
  };
  maxNormalizedValues: {
    totalActivities: number;
    totalReviews: number;
    totalBoostCredits: number;
  };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    performance: 0.4,
    activeness: 0.3,
    boost: 0.3,
  },
  activityTypeWeights: {
    VIEW: 1.0,
    HELPFUL: 3.0,
    SHARE: 2.5,
    COMMENT: 2.0,
    CLICK: 1.5,
  },
  boostTypeWeights: {
    FEATURE: 3.0,
    PRIORITY: 2.0,
    HIGHLIGHT: 1.5,
  },
  performanceWeights: {
    averageRating: 0.5,
    totalReviews: 0.3,
    publishedReviews: 0.2,
  },
  maxNormalizedValues: {
    totalActivities: 1000,
    totalReviews: 100,
    totalBoostCredits: 500,
  },
};

export const getScoringConfig = (): ScoringConfig => {
  return DEFAULT_SCORING_CONFIG;
};
