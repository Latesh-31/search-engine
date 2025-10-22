-- Create tables and enums for initial Prisma schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');
CREATE TYPE "ActivityType" AS ENUM ('VIEW', 'HELPFUL', 'SHARE', 'COMMENT', 'CLICK');
CREATE TYPE "BoostType" AS ENUM ('FEATURE', 'PRIORITY', 'HIGHLIGHT');

-- Users
CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Category tiers
CREATE TABLE "CategoryTier" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reviews
CREATE TABLE "Review" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "categoryTierId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_categoryTierId_fkey" FOREIGN KEY ("categoryTierId") REFERENCES "CategoryTier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Review_userId_idx" ON "Review" ("userId");
CREATE INDEX "Review_categoryTierId_idx" ON "Review" ("categoryTierId");

-- Review activity metrics
CREATE TABLE "ReviewActivityMetric" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "reviewId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ActivityType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewActivityMetric_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewActivityMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ReviewActivityMetric_reviewId_idx" ON "ReviewActivityMetric" ("reviewId");
CREATE INDEX "ReviewActivityMetric_userId_idx" ON "ReviewActivityMetric" ("userId");
CREATE INDEX "ReviewActivityMetric_reviewId_type_idx" ON "ReviewActivityMetric" ("reviewId", "type");

-- Boost purchases
CREATE TABLE "BoostPurchase" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "reviewId" TEXT,
    "categoryTierId" TEXT,
    "boostType" "BoostType" NOT NULL,
    "creditsPurchased" INTEGER NOT NULL,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoostPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoostPurchase_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BoostPurchase_categoryTierId_fkey" FOREIGN KEY ("categoryTierId") REFERENCES "CategoryTier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BoostPurchase_userId_idx" ON "BoostPurchase" ("userId");
CREATE INDEX "BoostPurchase_reviewId_idx" ON "BoostPurchase" ("reviewId");
CREATE INDEX "BoostPurchase_categoryTierId_idx" ON "BoostPurchase" ("categoryTierId");

-- Boost usage
CREATE TABLE "BoostUsage" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "boostPurchaseId" TEXT NOT NULL,
    "reviewId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoostUsage_boostPurchaseId_fkey" FOREIGN KEY ("boostPurchaseId") REFERENCES "BoostPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoostUsage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BoostUsage_boostPurchaseId_idx" ON "BoostUsage" ("boostPurchaseId");
CREATE INDEX "BoostUsage_reviewId_idx" ON "BoostUsage" ("reviewId");
