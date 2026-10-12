import { UserRole, WillStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getWillOrThrow, signerFor } from "./willService";
import { chainExecuteInheritance, chainStartInheritance, chainVerifyBeneficiary } from "../blockchain/willChain";
import { getContract } from "../blockchain/contracts";
import { onChainWillId, fromTokenAmount } from "../blockchain/utils";
import { logAudit } from "./auditService";
import { notify } from "./notificationService";

async function assertIsExecutor(actor: { id: string }, willId: string) {
  const will = await getWillOrThrow(willId);
  if (!will.executor) throw AppError.badRequest("No executor nominated for this will");
  if (will.executor.userId && will.executor.userId !== actor.id) {
    throw AppError.forbidden("Only the nominated executor can perform this action");
  }
  return will;
}

export async function startInheritance(actor: { id: string; role: UserRole }, willId: string) {
  const will = await assertIsExecutor(actor, willId);
  if (will.status !== WillStatus.VERIFIED) {
    throw AppError.badRequest("Inheritance can only start after death has been verified");
  }

  const signer = signerFor(actor as any);
  const { record } = await chainStartInheritance(signer, willId);

  await prisma.will.update({ where: { id: willId }, data: { status: WillStatus.INHERITANCE_IN_PROGRESS } });
  const inheritance = await prisma.inheritance.upsert({
    where: { willId },
    update: { startedAt: new Date(), startTxHash: record.txHash },
    create: { willId, startedAt: new Date(), startTxHash: record.txHash },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "INHERITANCE_STARTED", txHash: record.txHash });

  for (const b of will.beneficiaries) {
    if (b.userId) {
      await notify({
        userId: b.userId,
        type: "GENERAL",
        title: "Inheritance process started",
        message: "The executor has started the inheritance distribution process for a will naming you as beneficiary.",
        willId,
      });
    }
  }

  return inheritance;
}

export async function verifyBeneficiary(actor: { id: string; role: UserRole }, willId: string, beneficiaryId: string) {
  const will = await assertIsExecutor(actor, willId);
  const beneficiary = will.beneficiaries.find((b) => b.id === beneficiaryId);
  if (!beneficiary) throw AppError.notFound("Beneficiary not found on this will");

  const signer = signerFor(actor as any);
  const { record } = await chainVerifyBeneficiary(signer, willId, beneficiary.walletAddress);

  const updated = await prisma.beneficiary.update({
    where: { id: beneficiaryId },
    data: { verifiedAt: new Date() },
  });

  await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "BENEFICIARY_VERIFIED", txHash: record.txHash, details: { beneficiaryId } });

  if (beneficiary.userId) {
    await notify({
      userId: beneficiary.userId,
      type: "BENEFICIARY_VERIFIED",
      title: "Your identity has been verified",
      message: "The executor has verified your eligibility to receive your inheritance.",
      willId,
    });
  }

  return updated;
}

export async function executeInheritance(actor: { id: string; role: UserRole }, willId: string) {
  const will = await assertIsExecutor(actor, willId);
  if (will.status !== WillStatus.INHERITANCE_IN_PROGRESS) {
    throw AppError.badRequest("The executor must start the inheritance process before executing distribution");
  }

  const signer = signerFor(actor as any);
  const { record, receipt } = await chainExecuteInheritance(signer, willId);

  const inheritanceContract = getContract("InheritanceManager");
  const iface = inheritanceContract.interface;
  const willChainId = onChainWillId(willId);

  const distributed: { beneficiaryId: string; amount: string }[] = [];

  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AssetDistributed" && parsed.args.willId === willChainId) {
        const address = (parsed.args.beneficiary as string).toLowerCase();
        const amount = fromTokenAmount(parsed.args.amount as bigint);
        const beneficiary = will.beneficiaries.find((b) => b.walletAddress.toLowerCase() === address);
        if (beneficiary) {
          await prisma.beneficiary.update({
            where: { id: beneficiary.id },
            data: { distributionStatus: "DISTRIBUTED", distributedAmount: amount, distributedTxHash: record.txHash },
          });
          const inheritance = await prisma.inheritance.findUnique({ where: { willId } });
          if (inheritance) {
            await prisma.inheritanceDistribution.create({
              data: { inheritanceId: inheritance.id, beneficiaryId: beneficiary.id, amount, txHash: record.txHash },
            });
          }
          distributed.push({ beneficiaryId: beneficiary.id, amount });
          if (beneficiary.userId) {
            await notify({
              userId: beneficiary.userId,
              type: "ASSET_DISTRIBUTED",
              title: "Your inheritance has been distributed",
              message: `${amount} BWILL has been transferred to your wallet.`,
              willId,
            });
          }
        }
      }
    } catch {
      // log from a different event/contract - ignore
    }
  }

  const registry = getContract("WillRegistry");
  const onChainWill = await registry.getWill(willChainId);
  const STATUS_NAMES: WillStatus[] = [
    "DRAFT",
    "ACTIVE",
    "REVOKED",
    "DEATH_VERIFICATION_PENDING",
    "VERIFIED",
    "INHERITANCE_IN_PROGRESS",
    "EXECUTED",
    "DISPUTED",
  ];
  const newStatus = STATUS_NAMES[Number(onChainWill.status)];

  await prisma.will.update({ where: { id: willId }, data: { status: newStatus } });

  if (newStatus === "EXECUTED") {
    await prisma.inheritance.update({
      where: { willId },
      data: { executedAt: new Date(), executeTxHash: record.txHash },
    });
    await logAudit({ willId, actorId: actor.id, actorRole: actor.role, action: "INHERITANCE_EXECUTED", txHash: record.txHash });
  }

  await logAudit({
    willId,
    actorId: actor.id,
    actorRole: actor.role,
    action: "DISTRIBUTION_ROUND_COMPLETED",
    txHash: record.txHash,
    details: { distributed },
  });

  return { distributed, status: newStatus, txHash: record.txHash };
}
