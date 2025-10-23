-- AlterTable
ALTER TABLE "User" ADD COLUMN     "compositeScore" DOUBLE PRECISION,
ADD COLUMN     "performanceScore" DOUBLE PRECISION,
ADD COLUMN     "activenessScore" DOUBLE PRECISION,
ADD COLUMN     "boostScore" DOUBLE PRECISION,
ADD COLUMN     "lastScoredAt" TIMESTAMP(3);
