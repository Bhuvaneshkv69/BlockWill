import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Mints/transfers demo BWILL balances to the well-known local Hardhat
 * accounts used by the backend's role -> wallet map (see
 * backend/src/blockchain/signers.ts). Account #0 is the deployer/admin and
 * already holds the full initial supply from BWillToken's constructor, so
 * this simply redistributes a demo-friendly amount to the testator account
 * (#1) that the "Testator Demo" login uses to fund wills during the demo.
 */
async function main() {
  const deploymentPath = path.join(__dirname, "..", "..", "shared", "abi", "deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const [admin, testatorDemo] = await ethers.getSigners();
  const token = await ethers.getContractAt("BWillToken", deployment.contracts.BWillToken);

  const amount = ethers.parseEther("10000");
  const tx = await token.connect(admin).transfer(testatorDemo.address, amount);
  await tx.wait();

  console.log(`Transferred 10,000 BWILL to demo testator account: ${testatorDemo.address}`);
  console.log(`Balance: ${ethers.formatEther(await token.balanceOf(testatorDemo.address))} BWILL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
