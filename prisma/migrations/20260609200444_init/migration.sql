-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DataProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "updateFrequency" TEXT NOT NULL,
    "dataVolume" TEXT NOT NULL,
    "dataFormat" TEXT NOT NULL,
    "sampleData" TEXT,
    "samplePreview" TEXT,
    "pricingModel" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "priceUnit" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "visibleTo" TEXT,
    "tags" TEXT,
    "ratingAvg" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" TEXT,
    "frozenReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "DataProduct_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthorizationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "usageScope" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approveNote" TEXT,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthorizationRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthorizationRequest_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNo" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "authRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "price" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "terms" TEXT NOT NULL,
    "signedAt" DATETIME,
    "completedAt" DATETIME,
    "terminatedAt" DATETIME,
    "terminateReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_authRequestId_fkey" FOREIGN KEY ("authRequestId") REFERENCES "AuthorizationRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dataSize" TEXT,
    "deliveryUrl" TEXT,
    "deliveryNote" TEXT,
    "deliveredAt" DATETIME,
    "confirmedAt" DATETIME,
    "proofHash" TEXT,
    "proofData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRecord_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryProof" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "proofType" TEXT NOT NULL,
    "proofHash" TEXT NOT NULL,
    "proofContent" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "auditor" TEXT,
    "auditTrail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryProof_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "DeliveryRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "reply" TEXT,
    "repliedAt" DATETIME,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "handlerId" TEXT,
    "handleNote" TEXT,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "operator" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductAuditLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductViewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "viewerId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "DataProduct_status_idx" ON "DataProduct"("status");

-- CreateIndex
CREATE INDEX "DataProduct_industry_idx" ON "DataProduct"("industry");

-- CreateIndex
CREATE INDEX "DataProduct_region_idx" ON "DataProduct"("region");

-- CreateIndex
CREATE INDEX "DataProduct_category_idx" ON "DataProduct"("category");

-- CreateIndex
CREATE INDEX "DataProduct_updateFrequency_idx" ON "DataProduct"("updateFrequency");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_status_idx" ON "AuthorizationRequest"("status");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_consumerId_idx" ON "AuthorizationRequest"("consumerId");

-- CreateIndex
CREATE INDEX "AuthorizationRequest_productId_idx" ON "AuthorizationRequest"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNo_key" ON "Contract"("contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_authRequestId_key" ON "Contract"("authRequestId");

-- CreateIndex
CREATE INDEX "DeliveryRecord_contractId_idx" ON "DeliveryRecord"("contractId");

-- CreateIndex
CREATE INDEX "DeliveryRecord_status_idx" ON "DeliveryRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryProof_deliveryId_key" ON "DeliveryProof"("deliveryId");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_productId_idx" ON "Report"("productId");

-- CreateIndex
CREATE INDEX "ProductAuditLog_productId_idx" ON "ProductAuditLog"("productId");

-- CreateIndex
CREATE INDEX "ProductViewLog_productId_idx" ON "ProductViewLog"("productId");

-- CreateIndex
CREATE INDEX "ProductViewLog_createdAt_idx" ON "ProductViewLog"("createdAt");
