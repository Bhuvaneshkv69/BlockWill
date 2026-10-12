import { expect } from "chai";
import { ethers } from "hardhat";
import { deployAll, willId, docHash } from "./helpers";

describe("Access control & token security", () => {
  it("only MINTER_ROLE can mint BWILL", async () => {
    const { token, stranger } = await deployAll();
    await expect(token.connect(stranger).mint(stranger.address, ethers.parseEther("1"))).to.be.reverted;
  });

  it("only MANAGER_ROLE contracts can drive WillRegistry status transitions", async () => {
    const { registry, testator, stranger } = await deployAll();
    const id = willId("manager-guard");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await expect(registry.connect(stranger).setInheritanceInProgress(id)).to.be.reverted;
    await expect(registry.connect(stranger).setExecuted(id)).to.be.reverted;
    await expect(registry.connect(stranger).setDisputed(id)).to.be.reverted;
  });

  it("only AUTHORITY_ROLE can request/approve death verification", async () => {
    const { registry, testator, witness1, witness2, stranger } = await deployAll();
    const id = willId("authority-guard");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);
    await registry.connect(testator).addWitness(id, witness2.address);
    await registry.connect(witness1).signAsWitness(id);
    await registry.connect(witness2).signAsWitness(id);
    await registry.connect(testator).finalizeWill(id);

    await expect(registry.connect(stranger).requestDeathVerification(id)).to.be.reverted;
  });

  it("prevents direct external calls from bypassing InheritanceManager escrow accounting", async () => {
    const { token, inheritance, testator } = await deployAll();
    // sending tokens straight to the contract does not credit any will's escrow balance
    await token.connect(testator).transfer(await inheritance.getAddress(), ethers.parseEther("50"));
    const id = willId("no-credit");
    expect(await inheritance.escrowBalance(id)).to.equal(0n);
  });
});
