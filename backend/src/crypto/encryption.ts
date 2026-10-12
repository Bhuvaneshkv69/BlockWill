import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = Buffer.from(env.encryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte (64 hex character) key for AES-256-GCM");
  }
  return key;
}

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: string; // hex
  authTag: string; // hex
}

/** Encrypts a document buffer with AES-256-GCM. Never stores plaintext at rest. */
export function encryptBuffer(plaintext: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv: iv.toString("hex"), authTag: authTag.toString("hex") };
}

export function decryptBuffer(ciphertext: Buffer, ivHex: string, authTagHex: string): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
