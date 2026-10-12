import { ContractTransactionResponse } from "ethers";
import { prisma } from "../lib/prisma";
import { BlockchainEventType, Prisma } from "@prisma/client";

interface RecordTxParams {
  willId?: string | null;
  eventType: BlockchainEventType;
  fromAddress: string;
  toAddress: string;
  contractName: string;
  payload?: Record<string, unknown>;
}

/**
 * Waits for an on-chain transaction to be mined and persists it to
 * BlockchainTransaction for the internal explorer / audit trail. This is
 * how the UI shows block number, gas used, and status for every
 * blockchain-affecting action without re-querying the chain each time.
 */
export async function recordTx(tx: ContractTransactionResponse, params: RecordTxParams) {
  const pending = await prisma.blockchainTransaction.create({
    data: {
      willId: params.willId ?? null,
      txHash: tx.hash,
      eventType: params.eventType,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      contractName: params.contractName,
      status: "PENDING",
      payload: (params.payload as Prisma.InputJsonValue) ?? undefined,
    },
  });

  const receipt = await tx.wait();

  const updated = await prisma.blockchainTransaction.update({
    where: { id: pending.id },
    data: {
      status: receipt && receipt.status === 1 ? "CONFIRMED" : "FAILED",
      blockNumber: receipt?.blockNumber ?? null,
      gasUsed: receipt?.gasUsed?.toString() ?? null,
      confirmedAt: new Date(),
    },
  });

  return { receipt, record: updated };
}
