import crypto from "crypto";

/** SHA-256 hash of a buffer, returned as a lowercase hex string. */
export function sha256Hex(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** SHA-256 of arbitrary JSON-serializable data (used for will-snapshot hashing). */
export function sha256OfJson(value: unknown): string {
  const json = JSON.stringify(value, Object.keys(value as object).sort());
  return sha256Hex(Buffer.from(json, "utf-8"));
}

/** Converts a hex-encoded SHA-256 hash into a bytes32 value for on-chain storage. */
export function hexHashToBytes32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) {
    throw new Error("Expected a 32-byte (64 hex char) hash");
  }
  return `0x${clean}`;
}
