import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployAll, willId, docHash, Status, Condition } from "./helpers";

async function createFinalizedWill(ctx: Awaited<ReturnType<typeof deployAll>>, id: string) {
  const { registry, testator, witness1, witness2 } = ctx;
  const wId = willId(id);
  await registry.connect(testator).createWill(wId, docHash(id));
  await registry.connect(testator).addWitness(wId, witness1.address);
  await registry.connect(testator).addWitness(wId, witness2.address);
  await registry.connect(witness1).signAsWitness(wId);
  await registry.connect(witness2).signAsWitness(wId);
  return wId;
}

describe("InheritanceManager", () => {
  it("rejects beneficiary allocations exceeding 100%", async () => {
    const ctx = await deployAll();
    const { inheritance, testator, ben1, ben2 } = ctx;
    const id = await createFinalizedWill(ctx, "alloc-1");
    await inheritance.connect(testator).addBeneficiary(id, ben1.address, 6000, Condition.IMMEDIATE, 0);
    await expect(
      inheritance.connect(testator).addBeneficiary(id, ben2.address, 5000, Condition.IMMEDIATE, 0)
    ).to.be.revertedWithCustomError(inheritance, "AllocationExceeded");
  });

  it("only the testator can add beneficiaries", async () => {
    const ctx = await deployAll();
    const { inheritance, ben1, stranger } = ctx;
    const id = await createFinalizedWill(ctx, "alloc-2");
    await expect(
      inheritance.connect(stranger).addBeneficiary(id, ben1.address, 5000, Condition.IMMEDIATE, 0)
    ).to.be.revertedWithCustomError(inheritance, "NotTestator");
  });

  it("full lifecycle: finalize -> verify -> executor approve -> distribute -> no double distribution", async () => {
    const ctx = await deployAll();
    const { registry, execManager, inheritance, token, testator, ben1, ben2, ben3, executor, admin } = ctx;
    const id = await createFinalizedWill(ctx, "lifecycle-1");

    await inheritance.connect(testator).addBeneficiary(id, ben1.address, 5000, Condition.IMMEDIATE, 0);
    await inheritance.connect(testator).addBeneficiary(id, ben2.address, 3000, Condition.IMMEDIATE, 0);
    await inheritance.connect(testator).addBeneficiary(id, ben3.address, 2000, Condition.IMMEDIATE, 0);

    await registry.connect(testator).finalizeWill(id);

    const deposit = ethers.parseEther("1000");
    await token.connect(testator).approve(await inheritance.getAddress(), deposit);
    await inheritance.connect(testator).depositAssets(id, deposit);

    await registry.connect(admin).requestDeathVerification(id);
    await registry.connect(admin).verifyDeath(id, docHash("cert-1"), true);

    await execManager.connect(testator).nominateExecutor(id, executor.address);
    await execManager.connect(executor).executorApprove(id);

    await inheritance.connect(executor).startInheritance(id);
    expect(await registry.getStatus(id)).to.equal(Status.INHERITANCE_IN_PROGRESS);

    await expect(inheritance.connect(executor).executeInheritance(id)).to.emit(inheritance, "InheritanceExecuted");

    expect(await token.balanceOf(ben1.address)).to.equal(ethers.parseEther("500"));
    expect(await token.balanceOf(ben2.address)).to.equal(ethers.parseEther("300"));
    expect(await token.balanceOf(ben3.address)).to.equal(ethers.parseEther("200"));
    expect(await registry.getStatus(id)).to.equal(Status.EXECUTED);

    // once EXECUTED the will can never be distributed again (double-distribution prevention)
    await expect(inheritance.connect(executor).executeInheritance(id)).to.be.revertedWithCustomError(
      inheritance,
      "InvalidStatus"
    );
    expect(await token.balanceOf(ben1.address)).to.equal(ethers.parseEther("500"));
  });

  it("blocks execution before executor approval", async () => {
    const ctx = await deployAll();
    const { registry, execManager, inheritance, token, testator, ben1, executor, admin } = ctx;
    const id = await createFinalizedWill(ctx, "no-approval");
    await inheritance.connect(testator).addBeneficiary(id, ben1.address, 10000, Condition.IMMEDIATE, 0);
    await registry.connect(testator).finalizeWill(id);
    await registry.connect(admin).requestDeathVerification(id);
    await registry.connect(admin).verifyDeath(id, docHash("cert"), true);
    await execManager.connect(testator).nominateExecutor(id, executor.address);

    await expect(inheritance.connect(executor).startInheritance(id)).to.not.be.reverted;
    await expect(inheritance.connect(executor).executeInheritance(id)).to.be.revertedWithCustomError(
      inheritance,
      "ExecutorNotApproved"
    );
  });

  it("honors a TIME_LOCK condition and lets the beneficiary claim once unlocked", async () => {
    const ctx = await deployAll();
    const { registry, execManager, inheritance, token, testator, ben1, ben2, executor, admin } = ctx;
    const id = await createFinalizedWill(ctx, "timelock");

    const unlockAt = (await time.latest()) + 3600;
    await inheritance.connect(testator).addBeneficiary(id, ben1.address, 4000, Condition.IMMEDIATE, 0);
    await inheritance.connect(testator).addBeneficiary(id, ben2.address, 6000, Condition.TIME_LOCK, unlockAt);
    await registry.connect(testator).finalizeWill(id);

    const deposit = ethers.parseEther("1000");
    await token.connect(testator).approve(await inheritance.getAddress(), deposit);
    await inheritance.connect(testator).depositAssets(id, deposit);

    await registry.connect(admin).requestDeathVerification(id);
    await registry.connect(admin).verifyDeath(id, docHash("cert"), true);
    await execManager.connect(testator).nominateExecutor(id, executor.address);
    await execManager.connect(executor).executorApprove(id);
    await inheritance.connect(executor).startInheritance(id);

    await inheritance.connect(executor).executeInheritance(id);
    expect(await token.balanceOf(ben1.address)).to.equal(ethers.parseEther("400"));
    expect(await token.balanceOf(ben2.address)).to.equal(0n);
    // will not yet EXECUTED because ben2 is still locked
    expect(await registry.getStatus(id)).to.equal(Status.INHERITANCE_IN_PROGRESS);

    await expect(inheritance.connect(ben2).claim(id)).to.be.revertedWithCustomError(inheritance, "NotEligible");

    await time.increaseTo(unlockAt + 1);
    await inheritance.connect(ben2).claim(id);
    expect(await token.balanceOf(ben2.address)).to.equal(ethers.parseEther("600"));
    expect(await registry.getStatus(id)).to.equal(Status.EXECUTED);
  });

  it("pauses distribution while disputed and resumes after resolution", async () => {
    const ctx = await deployAll();
    const { registry, execManager, inheritance, token, testator, ben1, executor, admin } = ctx;
    const id = await createFinalizedWill(ctx, "dispute-1");
    await inheritance.connect(testator).addBeneficiary(id, ben1.address, 10000, Condition.IMMEDIATE, 0);
    await registry.connect(testator).finalizeWill(id);

    const deposit = ethers.parseEther("100");
    await token.connect(testator).approve(await inheritance.getAddress(), deposit);
    await inheritance.connect(testator).depositAssets(id, deposit);

    await registry.connect(admin).requestDeathVerification(id);
    await registry.connect(admin).verifyDeath(id, docHash("cert"), true);
    await execManager.connect(testator).nominateExecutor(id, executor.address);
    await execManager.connect(executor).executorApprove(id);
    await inheritance.connect(executor).startInheritance(id);

    await expect(inheritance.connect(ben1).raiseDispute(id, "Incorrect allocation")).to.emit(
      inheritance,
      "DisputeRaised"
    );
    expect(await registry.getStatus(id)).to.equal(Status.DISPUTED);

    await expect(inheritance.connect(executor).executeInheritance(id)).to.be.revertedWithCustomError(
      inheritance,
      "IsDisputed"
    );

    await inheritance.connect(admin).resolveDispute(id, true, Status.INHERITANCE_IN_PROGRESS);
    expect(await registry.getStatus(id)).to.equal(Status.INHERITANCE_IN_PROGRESS);

    await expect(inheritance.connect(executor).executeInheritance(id)).to.emit(inheritance, "InheritanceExecuted");
  });

  it("refunds escrowed assets to the testator when a will is revoked", async () => {
    const ctx = await deployAll();
    const { registry, inheritance, token, testator, ben1 } = ctx;
    const id = await createFinalizedWill(ctx, "revoke-refund");
    await inheritance.connect(testator).addBeneficiary(id, ben1.address, 10000, Condition.IMMEDIATE, 0);
    await registry.connect(testator).finalizeWill(id);

    const deposit = ethers.parseEther("250");
    await token.connect(testator).approve(await inheritance.getAddress(), deposit);
    await inheritance.connect(testator).depositAssets(id, deposit);

    const balanceBefore = await token.balanceOf(testator.address);
    await registry.connect(testator).revokeWill(id);
    await inheritance.connect(testator).withdrawOnRevoke(id);
    const balanceAfter = await token.balanceOf(testator.address);
    expect(balanceAfter - balanceBefore).to.equal(deposit);
  });
});
