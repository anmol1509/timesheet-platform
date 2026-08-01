-- CreateTable
CREATE TABLE "ClientTradeRate" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "ClientTradeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientTradeRate_clientId_trade_key" ON "ClientTradeRate"("clientId", "trade");

-- AddForeignKey
ALTER TABLE "ClientTradeRate" ADD CONSTRAINT "ClientTradeRate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
