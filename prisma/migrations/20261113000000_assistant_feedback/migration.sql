-- What people thought of My Assistant's answers, and the questions it could not resolve. A new table; nothing existing changes.
CREATE TABLE IF NOT EXISTS "AssistantFeedback" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "branchId" TEXT,
  "page" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "rating" TEXT,
  "unanswered" BOOLEAN NOT NULL DEFAULT false,
  "comment" TEXT,
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssistantFeedback_branchId_createdAt_idx" ON "AssistantFeedback"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantFeedback_reviewed_createdAt_idx" ON "AssistantFeedback"("reviewed", "createdAt");
