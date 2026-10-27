-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailPrefs" JSONB;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "emailQueued" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Notification_emailQueued_userId_idx" ON "Notification"("emailQueued", "userId");
