import { ethers } from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

export function willId(seed: string) {
  return keccak256(toUtf8Bytes(seed));
}

export function docHash(seed: string) {
  return keccak256(toUtf8Bytes(seed));
}

export async function deployAll() {
  const [admin, testator, ben1, ben2, ben3, executor, witness1, witness2, authority, stranger] =
    await ethers.getSigners();

  const BWillToken = await ethers.getContractFactory("BWillToken");
  const token = await BWillToken.deploy(admin.address);

  const WillRegistry = await ethers.getContractFactory("WillRegistry");
  const registry = await WillRegistry.deploy(admin.address);

  const ExecutorManager = await ethers.getContractFactory("ExecutorManager");
  const execManager = await ExecutorManager.deploy(admin.address, await registry.getAddress());

  const InheritanceManager = await ethers.getContractFactory("InheritanceManager");
  const inheritance = await InheritanceManager.deploy(
    admin.address,
    await registry.getAddress(),
    await execManager.getAddress(),
    await token.getAddress()
  );

  await registry.connect(admin).grantManagerRole(await inheritance.getAddress());
  await registry.connect(admin).grantManagerRole(await execManager.getAddress());

  // fund testator with BWILL for escrow deposits
  await token.connect(admin).transfer(testator.address, ethers.parseEther("10000"));

  return {
    admin,
    testator,
    ben1,
    ben2,
    ben3,
    executor,
    witness1,
    witness2,
    authority,
    stranger,
    token,
    registry,
    execManager,
    inheritance,
  };
}

export const Status = {
  DRAFT: 0,
  ACTIVE: 1,
  REVOKED: 2,
  DEATH_VERIFICATION_PENDING: 3,
  VERIFIED: 4,
  INHERITANCE_IN_PROGRESS: 5,
  EXECUTED: 6,
  DISPUTED: 7,
};

export const Condition = {
  IMMEDIATE: 0,
  AGE_BASED: 1,
  TIME_LOCK: 2,
  EXECUTOR_APPROVAL: 3,
};
