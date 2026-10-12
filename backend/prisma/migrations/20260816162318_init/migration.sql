-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TESTATOR', 'BENEFICIARY', 'EXECUTOR', 'WITNESS', 'AUTHORITY', 'ADMIN');

-- CreateEnum
CREATE TYPE "WillStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVOKED', 'DEATH_VERIFICATION_PENDING', 'VERIFIED', 'INHERITANCE_IN_PROGRESS', 'EXECUTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('IMMEDIATE', 'AGE_BASED', 'TIME_LOCK', 'EXECUTOR_APPROVAL');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CRYPTOCURRENCY', 'BANK_ACCOUNT', 'PROPERTY', 'VEHICLE', 'DIGITAL_ASSET', 'OTHER');

-- CreateEnum
CREATE TYPE "WitnessStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('INCORRECT_ALLOCATION', 'IDENTITY_ISSUE', 'INVALID_BENEFICIARY', 'SUSPECTED_FRAUD', 'DOCUMENT_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'DISTRIBUTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WILL_REGISTERED', 'WITNESS_REQUESTED', 'WITNESS_SIGNED', 'WILL_FINALIZED', 'WILL_REVOKED', 'DEATH_VERIFICATION_REQUESTED', 'DEATH_VERIFIED', 'EXECUTOR_APPROVAL_REQUIRED', 'EXECUTOR_APPROVED', 'BENEFICIARY_VERIFIED', 'INHERITANCE_EXECUTED', 'ASSET_DISTRIBUTED', 'DISPUTE_RAISED', 'DISPUTE_RESOLVED', 'GENERAL');

-- CreateEnum
CREATE TYPE "BlockchainTxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "BlockchainEventType" AS ENUM ('WILL_CREATED', 'WITNESS_ADDED', 'WITNESS_SIGNED', 'WILL_DOCUMENT_UPDATED', 'WILL_FINALIZED', 'WILL_REVOKED', 'DEATH_VERIFICATION_REQUESTED', 'DEATH_VERIFIED', 'STATUS_CHANGED', 'EXECUTOR_NOMINATED', 'EXECUTOR_APPROVED', 'BENEFICIARY_ADDED', 'ASSETS_DEPOSITED', 'ASSETS_WITHDRAWN', 'BENEFICIARY_VERIFIED', 'INHERITANCE_STARTED', 'ASSET_DISTRIBUTED', 'INHERITANCE_EXECUTED', 'DISPUTE_RAISED', 'DISPUTE_RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isDemoAccount" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Will" (
    "id" TEXT NOT NULL,
    "onChainId" TEXT NOT NULL,
    "testatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Last Will & Testament',
    "status" "WillStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "documentHash" TEXT,
    "contractAddress" TEXT,
    "network" TEXT NOT NULL DEFAULT 'hardhat-local',
    "registeredTxHash" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Will_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WillVersion" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "documentHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "allocationBps" INTEGER NOT NULL,
    "identityReference" TEXT,
    "conditionType" "ConditionType" NOT NULL DEFAULT 'IMMEDIATE',
    "conditionParam" TIMESTAMP(3),
    "distributionStatus" "DistributionStatus" NOT NULL DEFAULT 'PENDING',
    "distributedAmount" TEXT,
    "distributedTxHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "beneficiaryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assetType" "AssetType" NOT NULL,
    "estimatedValue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "allocationBps" INTEGER NOT NULL DEFAULT 10000,
    "transferSimulated" BOOLEAN NOT NULL DEFAULT false,
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutorAssignment" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "nominatedTxHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Witness" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "status" "WitnessStatus" NOT NULL DEFAULT 'PENDING',
    "signature" TEXT,
    "signedTxHash" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Witness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ConditionType" NOT NULL,
    "param" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "encryptedPath" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "requestedById" TEXT,
    "authorityId" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "certificateFileName" TEXT,
    "certificateHash" TEXT,
    "requestTxHash" TEXT,
    "decisionTxHash" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inheritance" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "startTxHash" TEXT,
    "executedAt" TIMESTAMP(3),
    "executeTxHash" TEXT,
    "totalEscrowed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inheritance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InheritanceDistribution" (
    "id" TEXT NOT NULL,
    "inheritanceId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT,
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InheritanceDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "willId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "txHash" TEXT,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "willId" TEXT,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "details" JSONB,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "willId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainTransaction" (
    "id" TEXT NOT NULL,
    "willId" TEXT,
    "txHash" TEXT NOT NULL,
    "eventType" "BlockchainEventType" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT,
    "contractName" TEXT NOT NULL,
    "blockNumber" INTEGER,
    "gasUsed" TEXT,
    "status" "BlockchainTxStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "BlockchainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployedContract" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeployedContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Will_onChainId_key" ON "Will"("onChainId");

-- CreateIndex
CREATE INDEX "Will_testatorId_idx" ON "Will"("testatorId");

-- CreateIndex
CREATE INDEX "Will_status_idx" ON "Will"("status");

-- CreateIndex
CREATE INDEX "WillVersion_willId_idx" ON "WillVersion"("willId");

-- CreateIndex
CREATE UNIQUE INDEX "WillVersion_willId_version_key" ON "WillVersion"("willId", "version");

-- CreateIndex
CREATE INDEX "Beneficiary_willId_idx" ON "Beneficiary"("willId");

-- CreateIndex
CREATE INDEX "Beneficiary_walletAddress_idx" ON "Beneficiary"("walletAddress");

-- CreateIndex
CREATE INDEX "Asset_willId_idx" ON "Asset"("willId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutorAssignment_willId_key" ON "ExecutorAssignment"("willId");

-- CreateIndex
CREATE INDEX "ExecutorAssignment_willId_idx" ON "ExecutorAssignment"("willId");

-- CreateIndex
CREATE INDEX "Witness_willId_idx" ON "Witness"("willId");

-- CreateIndex
CREATE INDEX "Condition_willId_idx" ON "Condition"("willId");

-- CreateIndex
CREATE INDEX "Document_willId_idx" ON "Document"("willId");

-- CreateIndex
CREATE INDEX "VerificationRequest_willId_idx" ON "VerificationRequest"("willId");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Inheritance_willId_key" ON "Inheritance"("willId");

-- CreateIndex
CREATE INDEX "Inheritance_willId_idx" ON "Inheritance"("willId");

-- CreateIndex
CREATE INDEX "InheritanceDistribution_inheritanceId_idx" ON "InheritanceDistribution"("inheritanceId");

-- CreateIndex
CREATE INDEX "InheritanceDistribution_beneficiaryId_idx" ON "InheritanceDistribution"("beneficiaryId");

-- CreateIndex
CREATE INDEX "Dispute_willId_idx" ON "Dispute"("willId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "AuditLog_willId_idx" ON "AuditLog"("willId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainTransaction_txHash_key" ON "BlockchainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_willId_idx" ON "BlockchainTransaction"("willId");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_txHash_idx" ON "BlockchainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_eventType_idx" ON "BlockchainTransaction"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "DeployedContract_name_key" ON "DeployedContract"("name");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Will" ADD CONSTRAINT "Will_testatorId_fkey" FOREIGN KEY ("testatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WillVersion" ADD CONSTRAINT "WillVersion_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutorAssignment" ADD CONSTRAINT "ExecutorAssignment_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutorAssignment" ADD CONSTRAINT "ExecutorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Witness" ADD CONSTRAINT "Witness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inheritance" ADD CONSTRAINT "Inheritance_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceDistribution" ADD CONSTRAINT "InheritanceDistribution_inheritanceId_fkey" FOREIGN KEY ("inheritanceId") REFERENCES "Inheritance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceDistribution" ADD CONSTRAINT "InheritanceDistribution_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainTransaction" ADD CONSTRAINT "BlockchainTransaction_willId_fkey" FOREIGN KEY ("willId") REFERENCES "Will"("id") ON DELETE SET NULL ON UPDATE CASCADE;
