import { ethers, NonceManager } from "ethers";
import crypto from "crypto";
import { env } from "../config/env";
import { getProvider } from "./provider";

/**
 * Local-demo signer strategy.
 *
 * This is an academic prototype running against a single local Hardhat
 * node, not a production wallet-custody system. Rather than requiring six
 * simultaneous MetaMask sessions (one per role) to demonstrate the full
 * lifecycle, the backend holds server-side signers derived from Hardhat's
 * well-known public test mnemonic and acts as a transaction relayer on
 * behalf of the logged-in demo user. Every action is still a real,
 * independently verifiable on-chain transaction - only the *key custody*
 * is simplified for demoability. This trade-off is documented in
 * docs/security.md. A connected MetaMask wallet (see frontend WalletContext)
 * remains available for inspecting balances/network and can be wired to
 * sign directly in a non-demo deployment.
 *
 * Hardhat's default local network pre-funds the first 20 accounts derived
 * from this mnemonic with 10,000 test ETH each, so the 9 demo personas
 * below are intentionally kept within that range. Every other (non-demo)
 * registered user is assigned a derivation index from a much larger
 * keyspace (see getSignerForUserId) so distinct users can never end up
 * sharing an on-chain address/private key - those accounts start at a
 * zero balance and are topped up on demand via blockchain/faucet.ts.
 */

const DEMO_ROLE_INDEX: Record<string, number> = {
  ADMIN: 0,
  TESTATOR_DEMO: 1,
  EXECUTOR_DEMO: 2,
  WITNESS_DEMO_1: 3,
  WITNESS_DEMO_2: 4,
  AUTHORITY_DEMO: 5,
  BENEFICIARY_DEMO_1: 6,
  BENEFICIARY_DEMO_2: 7,
  BENEFICIARY_DEMO_3: 8,
};

// Non-demo users are derived starting well past the 20 Hardhat-funded
// indices, across a keyspace large enough that collisions between
// unrelated users are practically impossible for an academic-scale demo.
const GENERAL_POOL_START = 1000;
const GENERAL_POOL_SIZE = 10_000_000;

// Signers are cached per derivation index and wrapped in ethers' NonceManager.
// Each demo persona's wallet is reused as the SAME signer instance across
// requests so the NonceManager can track nonces locally in-memory instead
// of re-querying the provider for every transaction - re-deriving a fresh
// Wallet per call was causing sequential same-address transactions issued
// in quick succession (e.g. the demo control panel's "Create Demo Will"
// step, which fires several txs from the testator's address back-to-back)
// to race on `eth_getTransactionCount` and collide on the same nonce.
const signerCache = new Map<number, NonceManager>();

function deriveWallet(index: number): NonceManager {
  const cached = signerCache.get(index);
  if (cached) return cached;

  const root = ethers.HDNodeWallet.fromPhrase(env.hardhatDemoMnemonic, undefined, "m/44'/60'/0'/0");
  const wallet = root.deriveChild(index).connect(getProvider());
  const managed = new NonceManager(wallet);
  signerCache.set(index, managed);
  return managed;
}

export function getSignerByIndex(index: number) {
  return deriveWallet(index);
}

export function getDemoSigner(demoKey: keyof typeof DEMO_ROLE_INDEX) {
  return deriveWallet(DEMO_ROLE_INDEX[demoKey]);
}

/** Deterministically maps a non-demo user id to one of the general-pool funded accounts. */
export function getSignerForUserId(userId: string) {
  const hash = crypto.createHash("sha256").update(userId).digest();
  const offset = hash.readUInt32BE(0) % GENERAL_POOL_SIZE;
  return deriveWallet(GENERAL_POOL_START + offset);
}

export function getAdminSigner() {
  return deriveWallet(DEMO_ROLE_INDEX.ADMIN);
}

export { DEMO_ROLE_INDEX };
