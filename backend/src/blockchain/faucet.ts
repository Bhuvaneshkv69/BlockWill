import { ethers } from "ethers";
import { getProvider } from "./provider";
import { getAdminSigner } from "./signers";

const MIN_BALANCE = ethers.parseEther("0.5");
const TOP_UP_AMOUNT = ethers.parseEther("5");

/**
 * Tops up a locally-derived custodial wallet with test ETH so it can pay
 * gas. Only account indices 0-19 are pre-funded by Hardhat's default local
 * network config; every other derived wallet (the general per-user pool,
 * see signers.ts) starts at a zero balance and needs this faucet before its
 * first transaction. Safe to call repeatedly - it is a no-op once the
 * balance is above the threshold.
 */
export async function ensureFunded(address: string) {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  if (balance >= MIN_BALANCE) return;

  const admin = getAdminSigner();
  const tx = await admin.sendTransaction({ to: address, value: TOP_UP_AMOUNT });
  await tx.wait();
}
