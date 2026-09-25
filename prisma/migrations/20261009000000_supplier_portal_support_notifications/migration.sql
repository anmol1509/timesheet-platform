-- CreateTable
CREATE TABLE "SupplierTicket" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "SupplierTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierTicketMessage" (
    "id" TEXT NOT NULL,
    "fromSupplier" BOOLEAN NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" TEXT NOT NULL,

    CONSTRAINT "SupplierTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierNotification" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT NOT NULL,

    CONSTRAINT "SupplierNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalContact" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "PortalContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierTicket_supplierId_updatedAt_idx" ON "SupplierTicket"("supplierId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupplierTicket_branchId_status_idx" ON "SupplierTicket"("branchId", "status");

-- CreateIndex
CREATE INDEX "SupplierTicketMessage_ticketId_createdAt_idx" ON "SupplierTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierNotification_supplierId_readAt_createdAt_idx" ON "SupplierNotification"("supplierId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "PortalContact_branchId_isActive_sortOrder_idx" ON "PortalContact"("branchId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "SupplierTicket" ADD CONSTRAINT "SupplierTicket_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierTicketMessage" ADD CONSTRAINT "SupplierTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupplierTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierNotification" ADD CONSTRAINT "SupplierNotification_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalContact" ADD CONSTRAINT "PortalContact_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

