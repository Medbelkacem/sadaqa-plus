-- DropIndex
DROP INDEX "campaigns_summary_trgm_idx";

-- DropIndex
DROP INDEX "campaigns_title_trgm_idx";

-- DropIndex
DROP INDEX "events_summary_trgm_idx";

-- DropIndex
DROP INDEX "events_title_trgm_idx";

-- DropIndex
DROP INDEX "organizations_description_trgm_idx";

-- DropIndex
DROP INDEX "organizations_public_name_trgm_idx";

-- DropIndex
DROP INDEX "requests_description_trgm_idx";

-- DropIndex
DROP INDEX "requests_title_trgm_idx";

-- DropIndex
DROP INDEX "volunteer_missions_title_trgm_idx";

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limit_buckets_resetAt_idx" ON "rate_limit_buckets"("resetAt");
