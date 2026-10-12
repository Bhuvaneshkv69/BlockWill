import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploys BWillToken, WillRegistry, ExecutorManager, and InheritanceManager
 * to whichever network Hardhat is pointed at (local Hardhat node by
 * default), wires up the MANAGER_ROLE grants between them, and writes the
 * resulting addresses + ABIs to shared/abi so the backend and frontend can
 * pick them up without any manual copy/paste.
 */
async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const authorityDemo = signers[5];
  console.log(`Deploying BlockWill contracts with account: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  const BWillToken = await ethers.getContractFactory("BWillToken");
  const token = await BWillToken.deploy(deployer.address);
  await token.waitForDeployment();
  console.log(`BWillToken deployed: ${await token.getAddress()}`);

  const WillRegistry = await ethers.getContractFactory("WillRegistry");
  const registry = await WillRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log(`WillRegistry deployed: ${await registry.getAddress()}`);

  const ExecutorManager = await ethers.getContractFactory("ExecutorManager");
  const execManager = await ExecutorManager.deploy(deployer.address, await registry.getAddress());
  await execManager.waitForDeployment();
  console.log(`ExecutorManager deployed: ${await execManager.getAddress()}`);

  const InheritanceManager = await ethers.getContractFactory("InheritanceManager");
  const inheritance = await InheritanceManager.deploy(
    deployer.address,
    await registry.getAddress(),
    await execManager.getAddress(),
    await token.getAddress()
  );
  await inheritance.waitForDeployment();
  console.log(`InheritanceManager deployed: ${await inheritance.getAddress()}`);

  console.log("Granting MANAGER_ROLE to InheritanceManager and ExecutorManager on WillRegistry...");
  await (await registry.grantManagerRole(await inheritance.getAddress())).wait();
  await (await registry.grantManagerRole(await execManager.getAddress())).wait();

  console.log(`Granting AUTHORITY_ROLE to demo authority account: ${authorityDemo.address}`);
  const AUTHORITY_ROLE = await registry.AUTHORITY_ROLE();
  await (await registry.grantRole(AUTHORITY_ROLE, authorityDemo.address)).wait();

  const deployment = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      BWillToken: await token.getAddress(),
      WillRegistry: await registry.getAddress(),
      ExecutorManager: await execManager.getAddress(),
      InheritanceManager: await inheritance.getAddress(),
    },
  };

  const outDir = path.join(__dirname, "..", "..", "shared", "abi");
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, "deployment.json"), JSON.stringify(deployment, null, 2));

  const artifactNames = ["BWillToken", "WillRegistry", "ExecutorManager", "InheritanceManager"];
  for (const name of artifactNames) {
    const artifact = await ethers.getContractFactory(name);
    const abi = artifact.interface.formatJson();
    fs.writeFileSync(path.join(outDir, `${name}.json`), abi);
  }

  console.log("\nDeployment complete. Addresses + ABIs written to shared/abi/");
  console.log(JSON.stringify(deployment.contracts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
