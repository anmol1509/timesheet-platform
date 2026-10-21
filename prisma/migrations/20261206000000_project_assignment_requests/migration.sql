CREATE TABLE "ProjectAssignmentRequest" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeIdNo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "siteId" TEXT,
    "fromProjectName" TEXT,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "branchId" TEXT,
    CONSTRAINT "ProjectAssignmentRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectAssignmentRequest_branchId_status_idx" ON "ProjectAssignmentRequest"("branchId", "status");
CREATE INDEX "ProjectAssignmentRequest_employeeId_status_idx" ON "ProjectAssignmentRequest"("employeeId", "status");
