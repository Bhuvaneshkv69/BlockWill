import { expect } from "chai";
import { deployAll, willId, docHash, Status } from "./helpers";

describe("ExecutorManager", () => {
  it("only allows the testator to nominate an executor", async () => {
    const { registry, execManager, testator, executor, stranger } = await deployAll();
    const id = willId("exec-1");
    await registry.connect(testator).createWill(id, docHash("doc"));

    await expect(execManager.connect(stranger).nominateExecutor(id, executor.address)).to.be.revertedWithCustomError(
      execManager,
      "NotTestator"
    );

    await expect(execManager.connect(testator).nominateExecutor(id, executor.address)).to.emit(
      execManager,
      "ExecutorNominated"
    );
    expect(await execManager.isExecutorFor(id, executor.address)).to.equal(true);
  });

  it("requires the will to be VERIFIED before the executor can approve", async () => {
    const { registry, execManager, testator, witness1, witness2, executor, admin } = await deployAll();
    const id = willId("exec-2");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);
    await registry.connect(testator).addWitness(id, witness2.address);
    await registry.connect(witness1).signAsWitness(id);
    await registry.connect(witness2).signAsWitness(id);
    await registry.connect(testator).finalizeWill(id);
    await execManager.connect(testator).nominateExecutor(id, executor.address);

    await expect(execManager.connect(executor).executorApprove(id)).to.be.revertedWithCustomError(
      execManager,
      "InvalidWillStatus"
    );

    await registry.connect(admin).requestDeathVerification(id);
    await registry.connect(admin).verifyDeath(id, docHash("cert"), true);

    await expect(execManager.connect(executor).executorApprove(id)).to.emit(execManager, "ExecutorApproved");
    expect(await execManager.isApproved(id)).to.equal(true);

    await expect(execManager.connect(executor).executorApprove(id)).to.be.revertedWithCustomError(
      execManager,
      "AlreadyApproved"
    );
  });

  it("rejects approval from an address that is not the nominated executor", async () => {
    const { registry, execManager, testator, witness1, witness2, executor, admin, stranger } = await deployAll();
    const id = willId("exec-3");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);
    await registry.connect(testator).addWitness(id, witness2.address);
    await registry.connect(witness1).signAsWitness(id);
    await registry.connect(witness2).signAsWitness(id);
    await registry.connect(testator).finalizeWill(id);
    await execManager.connect(testator).nominateExecutor(id, executor.address);
    await registry.connect(admin).requestDeathVerification(id);
    await registry.connect(admin).verifyDeath(id, docHash("cert"), true);

    await expect(execManager.connect(stranger).executorApprove(id)).to.be.revertedWithCustomError(
      execManager,
      "NotExecutor"
    );
  });
});
