import dotenv from "dotenv";
import path from "path";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  databaseUrl: required("DATABASE_URL", "postgresql://blockwill:blockwill@localhost:5432/blockwill?schema=public"),

  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",

  encryptionKey: required(
    "ENCRYPTION_KEY",
    "0000000000000000000000000000000000000000000000000000000000000000"
  ).slice(0, 64),
  documentStorageDir: path.resolve(process.env.DOCUMENT_STORAGE_DIR ?? "./storage/documents"),

  blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL ?? "http://127.0.0.1:8545",
  blockchainChainId: Number(process.env.BLOCKCHAIN_CHAIN_ID ?? 31337),
  hardhatDemoMnemonic:
    process.env.HARDHAT_DEMO_MNEMONIC ?? "test test test test test test test test test test test junk",

  contracts: {
    willRegistry: process.env.WILL_REGISTRY_ADDRESS ?? "",
    inheritanceManager: process.env.INHERITANCE_MANAGER_ADDRESS ?? "",
    executorManager: process.env.EXECUTOR_MANAGER_ADDRESS ?? "",
    bwillToken: process.env.BWILL_TOKEN_ADDRESS ?? "",
  },
};

export const isProduction = env.nodeEnv === "production";
