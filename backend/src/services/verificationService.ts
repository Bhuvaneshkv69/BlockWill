import { UserRole, WillStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getWillOrThrow, signerFor } from "./willService";
import { chainRequestDeathVerification, chainVerifyDeath } from "../blockchain/willChain";
import { hexHashToBytes32, sha256Hex } from "../crypto/hash";
import { logAudit } from "./auditService";
import { notify } from "./notificationService";

/**
 * ACADEMIC SIMULATION ONLY. This models a mock civil-registry authority for
 * demonstration purposes. It performs no real identity or government
 * verification of any kind.
 */
export async function requestVerification(actor: { id: string; role: UserRole }, willId: string, notes?: string) {
  if (actor.role !== UserRole.AUTHORITY && actor.role !== UserRole.ADMIN) {
    throw AppError.forbidden("Only the mock verification authority can open a death-verification request");
  }
  const will = await getWillOrThrow(willId);
  if (will.status !== WillStatus.ACTIVE) {
    throw AppError.badRequest("A death-verification request can only be opened for an ACTIVE will");
  }

  const signer = signerFor(actor as any);
  const { record } = await chainRequestDeathVerification(signer, willId);

  await prisma.will.update({ where: { id: willId }, data: { status: WillStatus.DEATH_VERIFICATION_PENDING } });

  const request = await prisma.verificationRequest.create({
    data: { willId, requestedById: actor.id, authorityId: actor.id, requestTxHash: record.txHash, notes },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "DEATH_VERIFICATION_REQUESTED", txHash: record.txHash });

  await notify({
    userId: will.testatorId,
    type: "DEATH_VERIFICATION_REQUESTED",
    title: "Death verification requested (simulation)",
    message: "A simulated death-verification request has been opened for your will as part of this academic demonstration.",
    willId,
  });

  return request;
}

export async function attachCertificateHash(requestId: string, fileName: string, certificateBuffer: Buffer) {
  const hash = sha256Hex(certificateBuffer);
  return prisma.verificationRequest.update({
    where: { id: requestId },
    data: { certificateFileName: fileName, certificateHash: hash },
  });
}

export async function decideVerification(
  actor: { id: string; role: UserRole },
  requestId: string,
  approved: boolean
) {
  if (actor.role !== UserRole.AUTHORITY && actor.role !== UserRole.ADMIN) {
    throw AppError.forbidden("Only the mock verification authority can decide a verification request");
  }
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound("Verification request not found");
  if (request.status !== "PENDING") throw AppError.conflict("This request has already been decided");

  const certificateHash = request.certificateHash
    ? hexHashToBytes32(request.certificateHash)
    : hexHashToBytes32(sha256Hex(Buffer.from(`no-certificate-${requestId}`)));

  const signer = signerFor(actor as any);
  const { record } = await chainVerifyDeath(signer, request.willId, certificateHash, approved);

  const updated = await prisma.verificationRequest.update({
    where: { id: requestId },
    data: { status: approved ? "APPROVED" : "REJECTED", decisionTxHash: record.txHash, decidedAt: new Date() },
  });

  const will = await prisma.will.update({
    where: { id: request.willId },
    data: { status: approved ? WillStatus.VERIFIED : WillStatus.ACTIVE },
    include: { executor: true, beneficiaries: true },
  });

  await logAudit({
    willId: request.willId,
    actorId: actor.id,
    actorRole: actor.role,
    action: approved ? "DEATH_VERIFIED_APPROVED" : "DEATH_VERIFIED_REJECTED",
    txHash: record.txHash,
  });

  if (approved && will.executor?.userId) {
    await notify({
      userId: will.executor.userId,
      type: "EXECUTOR_APPROVAL_REQUIRED",
      title: "Death verified — executor action required",
      message: "Death has been verified (simulation). Please review and approve to begin the inheritance process.",
      willId: request.willId,
    });
  }

  return updated;
}

export async function pendingRequests() {
  return prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    include: { will: { include: { testator: { select: { fullName: true, email: true } } } } },
    orderBy: { requestedAt: "asc" },
  });
}
