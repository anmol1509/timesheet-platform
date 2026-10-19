ALTER TABLE "User" ADD COLUMN "preferences" JSONB, ADD COLUMN "sessionsValidAfter" TIMESTAMP(3);
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
