import { getContract } from "./contracts";
import { isChainReachable } from "./provider";
import { prisma } from "../lib/prisma";

/**
 * Subscribes to WillRegistry / ExecutorManager / InheritanceManager events
 * so that anything happening on-chain — including actions BlockWill's own
 * backend did not initiate (e.g. a future direct-wallet integration) — is
 * still captured for the audit trail. Every action currently routed through
 * this backend already records its own transaction synchronously (see
 * blockchain/txRecorder.ts); this listener is the safety net that keeps the
 * database consistent with the chain's actual event log regardless of the
 * origin of the transaction.
 */
export async function startEventListeners() {
  const reachable = await isChainReachable();
  if (!reachable) {
    console.warn("[events] Local blockchain not reachable — event listeners not started. Run `npm run blockchain`.");
    return;
  }

  try {
    const registry = getContract("WillRegistry");
    const executor = getContract("ExecutorManager");
    const inheritance = getContract("InheritanceManager");

    registry.on("StatusChanged", async (willId, oldStatus, newStatus, changedBy, timestamp, event) => {
      await mirrorEvent(event.log.transactionHash, "STATUS_CHANGED", { willId, oldStatus: Number(oldStatus), newStatus: Number(newStatus), changedBy });
    });

    executor.on("ExecutorApproved", async (willId, execAddr, timestamp, event) => {
      await mirrorEvent(event.log.transactionHash, "EXECUTOR_APPROVED", { willId, executor: execAddr });
    });

    inheritance.on("InheritanceExecuted", async (willId, timestamp, event) => {
      await mirrorEvent(event.log.transactionHash, "INHERITANCE_EXECUTED", { willId });
    });

    console.log("[events] Blockchain event listeners attached (WillRegistry, ExecutorManager, InheritanceManager)");
  } catch (err) {
    console.warn("[events] Failed to attach event listeners:", err instanceof Error ? err.message : err);
  }
}

async function mirrorEvent(txHash: string, label: string, payload: Record<string, unknown>) {
  const existing = await prisma.blockchainTransaction.findUnique({ where: { txHash } });
  if (existing) return; // already recorded synchronously by the initiating request
  console.log(`[events] observed ${label} in tx ${txHash} not tracked by backend-initiated flow`, payload);
}
