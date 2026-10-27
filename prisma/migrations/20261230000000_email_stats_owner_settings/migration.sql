CREATE TABLE "EmailStat" (
    "month" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EmailStat_pkey" PRIMARY KEY ("month")
);

CREATE TABLE "OwnerSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OwnerSetting_pkey" PRIMARY KEY ("key")
);
