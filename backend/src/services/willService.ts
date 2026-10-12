import { ConditionType, DistributionStatus, UserRole, WillStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { sha256Hex, sha256OfJson, hexHashToBytes32 } from "../crypto/hash";
import { encryptBuffer, decryptBuffer } from "../crypto/encryption";
import { env } from "../config/env";
import fs from "fs";
import path from "path";
import { getSignerForUserId, getDemoSigner } from "../blockchain/signers";
import { normalizeAddress, onChainWillId, toBps, toUnixTimestamp } from "../blockchain/utils";
import { demoSignerKeyForEmail } from "../lib/demoAccounts";
import {
  chainAddBeneficiary,
  chainAddWitness,
  chainCreateWill,
  chainDepositAssets,
  chainExecuteInheritance,
  chainExecutorApprove,
  chainFinalizeWill,
  chainNominateExecutor,
  chainRequestDeathVerification,
  chainRevokeWill,
  chainSignAsWitness,
  chainStartInheritance,
  chainUpdateDocumentHash,
  chainVerifyBeneficiary,
  chainVerifyDeath,
  chainRaiseDispute,
  chainResolveDispute,
} from "../blockchain/willChain";
import { logAudit } from "./auditService";
import { notify } from "./notificationService";

const CONDITION_ORDER: ConditionType[] = ["IMMEDIATE", "AGE_BASED", "TIME_LOCK", "EXECUTOR_APPROVAL"];

export function conditionTypeToIndex(type: ConditionType): number {
  return CONDITION_ORDER.indexOf(type);
}

/** Resolves the ethers Signer that should sign transactions on behalf of a DB user. */
export function signerFor(user: { id: string; email: string; isDemoAccount: boolean }) {
  if (!user.isDemoAccount) return getSignerForUserId(user.id);
  const key = demoSignerKeyForEmail(user.email);
  if (key) return getDemoSigner(key);
  return getSignerForUserId(user.id);
}

export async function getWillOrThrow(willId: string) {
  const will = await prisma.will.findUnique({
    where: { id: willId },
    include: {
      testator: { select: { id: true, fullName: true, email: true } },
      beneficiaries: true,
      assets: true,
      executor: true,
      witnesses: true,
      conditions: true,
      documents: { orderBy: { version: "desc" } },
      inheritance: { include: { distributions: true } },
      disputes: true,
    },
  });
  if (!will) throw AppError.notFound("Will not found");
  return will;
}

/** Creates a new draft will (DB row) and registers a placeholder record on-chain. */
export async function createWill(testator: { id: string; email: string; isDemoAccount: boolean; role: UserRole }, title: string) {
  const will = await prisma.will.create({
    data: {
      testatorId: testator.id,
      title: title || "Last Will & Testament",
      status: WillStatus.DRAFT,
      onChainId: "", // filled below once we know the DB id
    },
  });

  const onChainId = onChainWillId(will.id);
  const placeholderHash = hexHashToBytes32(sha256OfJson({ willId: will.id, testatorId: testator.id, createdAt: will.createdAt }));

  const signer = signerFor(testator);
  const { record } = await chainCreateWill(signer, will.id, placeholderHash);

  const updated = await prisma.will.update({
    where: { id: will.id },
    data: { onChainId, documentHash: placeholderHash, registeredTxHash: record.txHash },
  });

  await logAudit({
    willId: will.id,
    actorId: testator.id,
    actorRole: testator.role,
    action: "WILL_CREATED",
    txHash: record.txHash,
    details: { title },
  });

  return updated;
}

interface BeneficiaryInput {
  name: string;
  walletAddress: string;
  relationship: string;
  allocationPercent: number;
  identityReference?: string;
  conditionType?: ConditionType;
  conditionParam?: Date | null;
}

export async function addBeneficiary(actor: { id: string; role: UserRole }, willId: string, input: BeneficiaryInput) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can add beneficiaries");
  if (will.status !== WillStatus.DRAFT) throw AppError.badRequest("Beneficiaries can only be edited while the will is in DRAFT");

  const walletAddress = normalizeAddress(input.walletAddress);
  const allocationBps = toBps(input.allocationPercent);
  if (allocationBps <= 0 || allocationBps > 10000) throw AppError.badRequest("Allocation must be between 0 and 100%");

  const existingTotal = will.beneficiaries.reduce((sum, b) => sum + b.allocationBps, 0);
  if (existingTotal + allocationBps > 10000) {
    throw AppError.badRequest(
      `Total allocation cannot exceed 100%. Currently allocated: ${existingTotal / 100}%, remaining: ${
        (10000 - existingTotal) / 100
      }%`
    );
  }

  const conditionType = input.conditionType ?? ConditionType.IMMEDIATE;
  const conditionParamUnix = input.conditionParam ? toUnixTimestamp(input.conditionParam) : 0;

  const beneficiary = await prisma.beneficiary.create({
    data: {
      willId,
      name: input.name,
      walletAddress,
      relationship: input.relationship,
      allocationBps,
      identityReference: input.identityReference,
      conditionType,
      conditionParam: input.conditionParam ?? null,
    },
  });

  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainAddBeneficiary(
    signer,
    willId,
    walletAddress,
    allocationBps,
    conditionTypeToIndex(conditionType),
    conditionParamUnix
  );

  await logAudit({
    willId,
    actorId: actor.id,
    actorRole: actor.role,
    action: "BENEFICIARY_ADDED",
    txHash: record.txHash,
    details: { beneficiaryId: beneficiary.id, name: input.name, allocationBps },
  });

  return beneficiary;
}

export async function addWitness(actor: { id: string; role: UserRole }, willId: string, input: { name: string; walletAddress: string; email?: string; userId?: string }) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can add witnesses");
  if (will.status !== WillStatus.DRAFT) throw AppError.badRequest("Witnesses can only be added while the will is in DRAFT");

  const walletAddress = normalizeAddress(input.walletAddress);
  const witness = await prisma.witness.create({
    data: {
      willId,
      name: input.name,
      walletAddress,
      email: input.email,
      userId: input.userId,
    },
  });

  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainAddWitness(signer, willId, walletAddress);

  if (input.userId) {
    await notify({
      userId: input.userId,
      type: "WITNESS_REQUESTED",
      title: "Witness signature requested",
      message: `${testatorUser.fullName} has requested you witness their will "${will.title}".`,
      willId,
    });
  }

  await logAudit({
    willId,
    actorId: actor.id,
    actorRole: actor.role,
    action: "WITNESS_ADDED",
    txHash: record.txHash,
    details: { witnessId: witness.id, name: input.name },
  });

  return witness;
}

export async function signAsWitness(actor: { id: string; email: string; role: UserRole; isDemoAccount: boolean }, willId: string, witnessId: string) {
  const witness = await prisma.witness.findUnique({ where: { id: witnessId } });
  if (!witness || witness.willId !== willId) throw AppError.notFound("Witness request not found");
  if (witness.userId && witness.userId !== actor.id) throw AppError.forbidden("This witness request is not assigned to you");
  if (witness.status === "SIGNED") throw AppError.conflict("This witness has already signed");

  const signer = signerFor(actor);
  const { record } = await chainSignAsWitness(signer, willId);

  const updated = await prisma.witness.update({
    where: { id: witnessId },
    data: { status: "SIGNED", signedAt: new Date(), signedTxHash: record.txHash, signature: record.txHash },
  });

  await logAudit({
    willId,
    actorId: actor.id,
    actorRole: actor.role,
    action: "WITNESS_SIGNED",
    txHash: record.txHash,
    details: { witnessId },
  });

  return updated;
}

export async function uploadDocument(
  actor: { id: string; role: UserRole },
  willId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer }
) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can upload the will document");
  if (will.status !== WillStatus.DRAFT) throw AppError.badRequest("Documents can only be uploaded while the will is in DRAFT");

  const hash = sha256Hex(file.buffer);
  const { ciphertext, iv, authTag } = encryptBuffer(file.buffer);

  fs.mkdirSync(env.documentStorageDir, { recursive: true });
  const storedName = `${willId}-v${will.version}-${Date.now()}.enc`;
  const storedPath = path.join(env.documentStorageDir, storedName);
  fs.writeFileSync(storedPath, ciphertext);

  const document = await prisma.document.create({
    data: {
      willId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256Hash: hash,
      encryptedPath: storedPath,
      iv,
      authTag,
      version: will.version,
    },
  });

  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainUpdateDocumentHash(signer, willId, hexHashToBytes32(hash));

  await prisma.will.update({ where: { id: willId }, data: { documentHash: hexHashToBytes32(hash) } });

  await logAudit({
    willId,
    actorId: actor.id,
    actorRole: actor.role,
    action: "DOCUMENT_HASH_GENERATED",
    txHash: record.txHash,
    details: { fileName: file.originalname, sha256: hash },
  });

  return document;
}

export async function finalizeWill(actor: { id: string; role: UserRole }, willId: string) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can finalize the will");
  if (will.status !== WillStatus.DRAFT) throw AppError.badRequest("Will has already been finalized");

  const totalAllocation = will.beneficiaries.reduce((sum, b) => sum + b.allocationBps, 0);
  if (totalAllocation !== 10000) {
    throw AppError.badRequest(`Beneficiary allocation must total exactly 100% (currently ${totalAllocation / 100}%)`);
  }
  if (will.documents.length === 0) throw AppError.badRequest("A will document must be uploaded before finalizing");
  const signedWitnesses = will.witnesses.filter((w) => w.status === "SIGNED");
  if (signedWitnesses.length < 2) throw AppError.badRequest("At least 2 witnesses must sign before finalizing");
  if (!will.executor) throw AppError.badRequest("An executor must be nominated before finalizing");

  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainFinalizeWill(signer, willId);

  const updated = await prisma.will.update({
    where: { id: willId },
    data: { status: WillStatus.ACTIVE, finalizedAt: new Date() },
  });

  await prisma.willVersion.create({
    data: {
      willId,
      version: will.version,
      documentHash: will.documentHash ?? "",
      snapshot: {
        beneficiaries: will.beneficiaries.map((b) => ({ name: b.name, walletAddress: b.walletAddress, allocationBps: b.allocationBps })),
        assets: will.assets.map((a) => ({ name: a.name, assetType: a.assetType, estimatedValue: a.estimatedValue })),
        executor: will.executor ? { name: will.executor.name, walletAddress: will.executor.walletAddress } : null,
      },
    },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "WILL_FINALIZED", txHash: record.txHash });

  for (const b of will.beneficiaries) {
    if (b.userId) {
      await notify({
        userId: b.userId,
        type: "WILL_REGISTERED",
        title: "A will naming you as beneficiary is now active",
        message: `${testatorUser.fullName}'s will has been finalized and registered on the blockchain.`,
        willId,
      });
    }
  }

  return updated;
}

export async function revokeWill(actor: { id: string; role: UserRole }, willId: string) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can revoke this will");
  if (["EXECUTED", "REVOKED", "INHERITANCE_IN_PROGRESS"].includes(will.status)) {
    throw AppError.badRequest(`A will with status ${will.status} cannot be revoked`);
  }

  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainRevokeWill(signer, willId);

  const updated = await prisma.will.update({
    where: { id: willId },
    data: { status: WillStatus.REVOKED, revokedAt: new Date() },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "WILL_REVOKED", txHash: record.txHash });
  return updated;
}

export async function depositEscrow(actor: { id: string; role: UserRole }, willId: string, amount: number) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can fund the will");
  if (amount <= 0) throw AppError.badRequest("Deposit amount must be positive");

  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainDepositAssets(signer, willId, amount);

  await prisma.inheritance.upsert({
    where: { willId },
    update: { totalEscrowed: String(amount) },
    create: { willId, totalEscrowed: String(amount) },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "ASSETS_DEPOSITED", txHash: record.txHash, details: { amount } });
  return record;
}

export async function nominateExecutor(actor: { id: string; role: UserRole }, willId: string, input: { name: string; walletAddress: string; email: string; relationship: string; userId?: string }) {
  const will = await getWillOrThrow(willId);
  if (will.testatorId !== actor.id) throw AppError.forbidden("Only the testator can nominate an executor");
  if (will.status !== WillStatus.DRAFT) throw AppError.badRequest("Executor can only be changed while the will is in DRAFT");

  const walletAddress = normalizeAddress(input.walletAddress);
  const testatorUser = await prisma.user.findUniqueOrThrow({ where: { id: will.testatorId } });
  const signer = signerFor(testatorUser);
  const { record } = await chainNominateExecutor(signer, willId, walletAddress);

  const executor = await prisma.executorAssignment.upsert({
    where: { willId },
    update: { ...input, walletAddress, nominatedTxHash: record.txHash },
    create: { willId, ...input, walletAddress, nominatedTxHash: record.txHash },
  });

  if (input.userId) {
    await notify({
      userId: input.userId,
      type: "EXECUTOR_APPROVAL_REQUIRED",
      title: "You have been nominated as executor",
      message: `${testatorUser.fullName} has nominated you as executor of their will.`,
      willId,
    });
  }

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "EXECUTOR_NOMINATED", txHash: record.txHash });
  return executor;
}

export async function executorApprove(actor: { id: string; role: UserRole }, willId: string) {
  const will = await getWillOrThrow(willId);
  if (!will.executor) throw AppError.badRequest("No executor has been nominated for this will");
  if (will.executor.userId && will.executor.userId !== actor.id) {
    throw AppError.forbidden("You are not the nominated executor for this will");
  }
  if (will.status !== WillStatus.VERIFIED) {
    throw AppError.badRequest("The executor can only approve after death has been verified");
  }

  const signer = signerFor(actor as any);
  const { record } = await chainExecutorApprove(signer, willId);

  const executor = await prisma.executorAssignment.update({
    where: { willId },
    data: { approvedAt: new Date(), approvedTxHash: record.txHash },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "EXECUTOR_APPROVED", txHash: record.txHash });
  return executor;
}

export async function raiseDispute(actor: { id: string; role: UserRole }, willId: string, reason: any, description: string) {
  const will = await getWillOrThrow(willId);
  const beneficiary = will.beneficiaries.find((b) => b.userId === actor.id);
  if (!beneficiary) throw AppError.forbidden("Only a named beneficiary can raise a dispute for this will");
  if (["EXECUTED", "REVOKED"].includes(will.status)) throw AppError.badRequest("Disputes cannot be raised on an executed or revoked will");

  const signer = signerFor(actor as any);
  const { record } = await chainRaiseDispute(signer, willId, `${reason}: ${description}`.slice(0, 200));

  const dispute = await prisma.dispute.create({
    data: { willId, raisedById: actor.id, reason, description, txHash: record.txHash },
  });

  await prisma.will.update({ where: { id: willId }, data: { status: WillStatus.DISPUTED } });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "DISPUTE_RAISED", txHash: record.txHash, details: { reason, description } });
  return dispute;
}

export async function resolveDispute(actor: { id: string; role: UserRole }, disputeId: string, reinstate: boolean, restoreToStatus: WillStatus) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw AppError.notFound("Dispute not found");
  if (actor.role !== UserRole.ADMIN) throw AppError.forbidden("Only an administrator can resolve disputes");

  const adminSigner = getDemoSigner("ADMIN");
  const restoreIndex = ["DRAFT", "ACTIVE", "REVOKED", "DEATH_VERIFICATION_PENDING", "VERIFIED", "INHERITANCE_IN_PROGRESS", "EXECUTED", "DISPUTED"].indexOf(restoreToStatus);
  const { record } = await chainResolveDispute(adminSigner, dispute.willId, reinstate, restoreIndex);

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: reinstate ? "RESOLVED" : "REJECTED",
      resolvedById: actor.id,
      resolvedAt: new Date(),
    },
  });

  if (reinstate) {
    await prisma.will.update({ where: { id: dispute.willId }, data: { status: restoreToStatus } });
  }

  await logAudit({ willId: dispute.willId, actorId: actor.id, actorRole: actor.role, action: "DISPUTE_RESOLVED", txHash: record.txHash, details: { reinstate } });
  return updated;
}

export function decryptDocument(document: { encryptedPath: string; iv: string; authTag: string }) {
  const ciphertext = fs.readFileSync(document.encryptedPath);
  return decryptBuffer(ciphertext, document.iv, document.authTag);
}
