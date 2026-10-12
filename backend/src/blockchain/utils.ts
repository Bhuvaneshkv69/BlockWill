import { keccak256, toUtf8Bytes, parseEther, formatEther, getAddress } from "ethers";
import { AppError } from "../lib/errors";

/**
 * Normalizes a wallet address to its canonical EIP-55 checksummed form.
 * Addresses are always lowercased first, so any casing a user types or
 * pastes is accepted - ethers only rejects a *mixed-case* string that
 * doesn't match the checksum it expects, which would otherwise surface as
 * a confusing 500 from deep inside a contract call instead of a clear
 * validation error here.
 */
export function normalizeAddress(address: string): string {
  try {
    return getAddress(address.toLowerCase());
  } catch {
    throw AppError.badRequest(`"${address}" is not a valid Ethereum address`);
  }
}

/** Derives the deterministic on-chain bytes32 willId from the database Will.id. */
export function onChainWillId(dbWillId: string): string {
  return keccak256(toUtf8Bytes(dbWillId));
}

export function toBps(percentage: number): number {
  return Math.round(percentage * 100);
}

export function fromBps(bps: number): number {
  return bps / 100;
}

export function toTokenAmount(amount: number | string): bigint {
  return parseEther(String(amount));
}

export function fromTokenAmount(amount: bigint): string {
  return formatEther(amount);
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
