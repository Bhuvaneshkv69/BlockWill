import { ethers } from "ethers";
import { env } from "../config/env";

let provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(env.blockchainRpcUrl, {
      chainId: env.blockchainChainId,
      name: "hardhat-local",
    });
  }
  return provider;
}

export async function isChainReachable(): Promise<boolean> {
  try {
    await getProvider().getBlockNumber();
    return true;
  } catch {
    return false;
  }
}
