-- Trigram indexes for the ILIKE-based search provider.
--
-- Without these, `%term%` forces a sequential scan on every search. pg_trgm
-- turns them into index scans, which is what makes PostgreSQL-backed search
-- viable at this scale without extra infrastructure.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "requests_title_trgm_idx"
  ON "requests" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "requests_description_trgm_idx"
  ON "requests" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "campaigns_title_trgm_idx"
  ON "campaigns" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "campaigns_summary_trgm_idx"
  ON "campaigns" USING gin ("summary" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "events_title_trgm_idx"
  ON "events" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "events_summary_trgm_idx"
  ON "events" USING gin ("summary" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "organizations_public_name_trgm_idx"
  ON "organizations" USING gin ("publicName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "organizations_description_trgm_idx"
  ON "organizations" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "volunteer_missions_title_trgm_idx"
  ON "volunteer_missions" USING gin ("title" gin_trgm_ops);

-- Partial index for the public request feed: the overwhelmingly common query.
CREATE INDEX IF NOT EXISTS "requests_public_feed_idx"
  ON "requests" ("publishedAt" DESC)
  WHERE "deletedAt" IS NULL
    AND "status" IN ('ACTIVE', 'PARTIALLY_HELPED', 'COMPLETED');
