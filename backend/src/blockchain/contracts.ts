import fs from "fs";
import path from "path";
import { ethers, Signer } from "ethers";
import { env } from "../config/env";
import { getProvider } from "./provider";

const ABI_DIR = path.resolve(__dirname, "../../../shared/abi");

interface Deployment {
  network: string;
  chainId: string;
  contracts: {
    BWillToken: string;
    WillRegistry: string;
    ExecutorManager: string;
    InheritanceManager: string;
  };
}

let cachedDeployment: Deployment | null = null;

export function loadDeployment(): Deployment {
  if (cachedDeployment) return cachedDeployment;

  const filePath = path.join(ABI_DIR, "deployment.json");
  if (env.contracts.willRegistry && env.contracts.inheritanceManager && env.contracts.executorManager && env.contracts.bwillToken) {
    cachedDeployment = {
      network: "hardhat-local",
      chainId: String(env.blockchainChainId),
      contracts: {
        WillRegistry: env.contracts.willRegistry,
        InheritanceManager: env.contracts.inheritanceManager,
        ExecutorManager: env.contracts.executorManager,
        BWillToken: env.contracts.bwillToken,
      },
    };
    return cachedDeployment;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      "Contracts have not been deployed yet. Run `npm run blockchain` then `npm run deploy` from the repo root."
    );
  }
  cachedDeployment = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return cachedDeployment as Deployment;
}

function loadAbi(name: string) {
  const filePath = path.join(ABI_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ABI file not found for ${name}. Run the contracts deploy script first.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export function getContract(
  name: "BWillToken" | "WillRegistry" | "ExecutorManager" | "InheritanceManager",
  runner: Signer | ethers.Provider = getProvider()
) {
  const deployment = loadDeployment();
  const abi = loadAbi(name);
  return new ethers.Contract(deployment.contracts[name], abi, runner);
}

export function isDeployed(): boolean {
  try {
    loadDeployment();
    return true;
  } catch {
    return false;
  }
}
