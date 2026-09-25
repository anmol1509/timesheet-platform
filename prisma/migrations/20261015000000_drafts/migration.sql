-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'new',
    "title" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_userId_updatedAt_idx" ON "Draft"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_userId_type_key_key" ON "Draft"("userId", "type", "key");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
