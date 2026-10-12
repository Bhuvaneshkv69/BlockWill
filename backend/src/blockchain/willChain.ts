import { Signer } from "ethers";
import { BlockchainEventType } from "@prisma/client";
import { getContract } from "./contracts";
import { recordTx } from "./txRecorder";
import { onChainWillId, toTokenAmount } from "./utils";

const CONTRACT_NAMES = {
  registry: "WillRegistry",
  inheritance: "InheritanceManager",
  executor: "ExecutorManager",
  token: "BWillToken",
} as const;

async function addresses() {
  const registry = getContract("WillRegistry");
  const inheritance = getContract("InheritanceManager");
  const executor = getContract("ExecutorManager");
  const token = getContract("BWillToken");
  return {
    registry: await registry.getAddress(),
    inheritance: await inheritance.getAddress(),
    executor: await executor.getAddress(),
    token: await token.getAddress(),
  };
}

// ---------------------------------------------------------------------
// WillRegistry
// ---------------------------------------------------------------------

export async function chainCreateWill(signer: Signer, dbWillId: string, documentHashHex: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const addr = await registry.getAddress();
  const tx = await registry.createWill(onChainWillId(dbWillId), documentHashHex);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.WILL_CREATED,
    fromAddress: from,
    toAddress: addr,
    contractName: CONTRACT_NAMES.registry,
  });
}

export async function chainAddWitness(signer: Signer, dbWillId: string, witnessAddress: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.addWitness(onChainWillId(dbWillId), witnessAddress);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.WITNESS_ADDED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
    payload: { witnessAddress },
  });
}

export async function chainSignAsWitness(signer: Signer, dbWillId: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.signAsWitness(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.WITNESS_SIGNED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
  });
}

export async function chainUpdateDocumentHash(signer: Signer, dbWillId: string, newHashHex: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.updateDocumentHash(onChainWillId(dbWillId), newHashHex);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.WILL_DOCUMENT_UPDATED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
  });
}

export async function chainFinalizeWill(signer: Signer, dbWillId: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.finalizeWill(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.WILL_FINALIZED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
  });
}

export async function chainRevokeWill(signer: Signer, dbWillId: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.revokeWill(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.WILL_REVOKED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
  });
}

export async function chainRequestDeathVerification(signer: Signer, dbWillId: string) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.requestDeathVerification(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.DEATH_VERIFICATION_REQUESTED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
  });
}

export async function chainVerifyDeath(
  signer: Signer,
  dbWillId: string,
  certificateHashHex: string,
  approved: boolean
) {
  const registry = getContract("WillRegistry", signer);
  const from = await signer.getAddress();
  const tx = await registry.verifyDeath(onChainWillId(dbWillId), certificateHashHex, approved);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.DEATH_VERIFIED,
    fromAddress: from,
    toAddress: await registry.getAddress(),
    contractName: CONTRACT_NAMES.registry,
    payload: { approved },
  });
}

export async function chainGetWill(dbWillId: string) {
  const registry = getContract("WillRegistry");
  return registry.getWill(onChainWillId(dbWillId));
}

// ---------------------------------------------------------------------
// ExecutorManager
// ---------------------------------------------------------------------

export async function chainNominateExecutor(signer: Signer, dbWillId: string, executorAddress: string) {
  const executor = getContract("ExecutorManager", signer);
  const from = await signer.getAddress();
  const tx = await executor.nominateExecutor(onChainWillId(dbWillId), executorAddress);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.EXECUTOR_NOMINATED,
    fromAddress: from,
    toAddress: await executor.getAddress(),
    contractName: CONTRACT_NAMES.executor,
    payload: { executorAddress },
  });
}

export async function chainExecutorApprove(signer: Signer, dbWillId: string) {
  const executor = getContract("ExecutorManager", signer);
  const from = await signer.getAddress();
  const tx = await executor.executorApprove(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.EXECUTOR_APPROVED,
    fromAddress: from,
    toAddress: await executor.getAddress(),
    contractName: CONTRACT_NAMES.executor,
  });
}

// ---------------------------------------------------------------------
// InheritanceManager
// ---------------------------------------------------------------------

export async function chainAddBeneficiary(
  signer: Signer,
  dbWillId: string,
  beneficiaryAddress: string,
  allocationBps: number,
  conditionType: number,
  conditionParamUnix: number
) {
  const inheritance = getContract("InheritanceManager", signer);
  const from = await signer.getAddress();
  const tx = await inheritance.addBeneficiary(
    onChainWillId(dbWillId),
    beneficiaryAddress,
    allocationBps,
    conditionType,
    conditionParamUnix
  );
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.BENEFICIARY_ADDED,
    fromAddress: from,
    toAddress: await inheritance.getAddress(),
    contractName: CONTRACT_NAMES.inheritance,
    payload: { beneficiaryAddress, allocationBps, conditionType },
  });
}

export async function chainDepositAssets(signer: Signer, dbWillId: string, amountEther: number | string) {
  const token = getContract("BWillToken", signer);
  const inheritance = getContract("InheritanceManager", signer);
  const inheritanceAddr = await inheritance.getAddress();
  const amount = toTokenAmount(amountEther);

  const approveTx = await token.approve(inheritanceAddr, amount);
  await approveTx.wait();

  const from = await signer.getAddress();
  const tx = await inheritance.depositAssets(onChainWillId(dbWillId), amount);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.ASSETS_DEPOSITED,
    fromAddress: from,
    toAddress: inheritanceAddr,
    contractName: CONTRACT_NAMES.inheritance,
    payload: { amount: amount.toString() },
  });
}

export async function chainStartInheritance(signer: Signer, dbWillId: string) {
  const inheritance = getContract("InheritanceManager", signer);
  const from = await signer.getAddress();
  const tx = await inheritance.startInheritance(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.INHERITANCE_STARTED,
    fromAddress: from,
    toAddress: await inheritance.getAddress(),
    contractName: CONTRACT_NAMES.inheritance,
  });
}

export async function chainVerifyBeneficiary(signer: Signer, dbWillId: string, beneficiaryAddress: string) {
  const inheritance = getContract("InheritanceManager", signer);
  const from = await signer.getAddress();
  const tx = await inheritance.verifyBeneficiary(onChainWillId(dbWillId), beneficiaryAddress);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.BENEFICIARY_VERIFIED,
    fromAddress: from,
    toAddress: await inheritance.getAddress(),
    contractName: CONTRACT_NAMES.inheritance,
    payload: { beneficiaryAddress },
  });
}

export async function chainExecuteInheritance(signer: Signer, dbWillId: string) {
  const inheritance = getContract("InheritanceManager", signer);
  const from = await signer.getAddress();
  const tx = await inheritance.executeInheritance(onChainWillId(dbWillId));
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.INHERITANCE_EXECUTED,
    fromAddress: from,
    toAddress: await inheritance.getAddress(),
    contractName: CONTRACT_NAMES.inheritance,
  });
}

export async function chainRaiseDispute(signer: Signer, dbWillId: string, reason: string) {
  const inheritance = getContract("InheritanceManager", signer);
  const from = await signer.getAddress();
  const tx = await inheritance.raiseDispute(onChainWillId(dbWillId), reason);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.DISPUTE_RAISED,
    fromAddress: from,
    toAddress: await inheritance.getAddress(),
    contractName: CONTRACT_NAMES.inheritance,
    payload: { reason },
  });
}

export async function chainResolveDispute(
  signer: Signer,
  dbWillId: string,
  reinstate: boolean,
  restoreToStatus: number
) {
  const inheritance = getContract("InheritanceManager", signer);
  const from = await signer.getAddress();
  const tx = await inheritance.resolveDispute(onChainWillId(dbWillId), reinstate, restoreToStatus);
  return recordTx(tx, {
    willId: dbWillId,
    eventType: BlockchainEventType.DISPUTE_RESOLVED,
    fromAddress: from,
    toAddress: await inheritance.getAddress(),
    contractName: CONTRACT_NAMES.inheritance,
    payload: { reinstate },
  });
}

export async function chainGetBeneficiary(dbWillId: string, beneficiaryAddress: string) {
  const inheritance = getContract("InheritanceManager");
  return inheritance.getBeneficiary(onChainWillId(dbWillId), beneficiaryAddress);
}

// ---------------------------------------------------------------------
// BWillToken
// ---------------------------------------------------------------------

export async function tokenBalanceOf(address: string): Promise<bigint> {
  const token = getContract("BWillToken");
  return token.balanceOf(address);
}

export async function chainTransferTokens(signer: Signer, to: string, amountEther: number | string) {
  const token = getContract("BWillToken", signer);
  const tx = await token.transfer(to, toTokenAmount(amountEther));
  await tx.wait();
  return tx;
}

export const contractAddresses = addresses;
