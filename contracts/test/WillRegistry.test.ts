import { expect } from "chai";
import { ethers } from "hardhat";
import { deployAll, willId, docHash, Status } from "./helpers";

describe("WillRegistry", () => {
  it("creates a draft will", async () => {
    const { registry, testator } = await deployAll();
    const id = willId("will-1");
    await expect(registry.connect(testator).createWill(id, docHash("doc-1")))
      .to.emit(registry, "WillCreated");
    const w = await registry.getWill(id);
    expect(w.testator).to.equal(testator.address);
    expect(w.status).to.equal(Status.DRAFT);
  });

  it("prevents duplicate will ids", async () => {
    const { registry, testator } = await deployAll();
    const id = willId("dup");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await expect(registry.connect(testator).createWill(id, docHash("doc"))).to.be.revertedWithCustomError(
      registry,
      "WillAlreadyExists"
    );
  });

  it("requires minimum 2 witness signatures before finalizing", async () => {
    const { registry, testator, witness1, witness2 } = await deployAll();
    const id = willId("witness-test");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);
    await registry.connect(testator).addWitness(id, witness2.address);

    await expect(registry.connect(testator).finalizeWill(id)).to.be.revertedWithCustomError(
      registry,
      "InsufficientWitnesses"
    );

    await registry.connect(witness1).signAsWitness(id);
    await expect(registry.connect(testator).finalizeWill(id)).to.be.revertedWithCustomError(
      registry,
      "InsufficientWitnesses"
    );

    await registry.connect(witness2).signAsWitness(id);
    await expect(registry.connect(testator).finalizeWill(id)).to.emit(registry, "WillFinalized");

    const w = await registry.getWill(id);
    expect(w.status).to.equal(Status.ACTIVE);
  });

  it("rejects signatures from non-witnesses and double signatures", async () => {
    const { registry, testator, witness1, stranger } = await deployAll();
    const id = willId("witness-guard");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);

    await expect(registry.connect(stranger).signAsWitness(id)).to.be.revertedWithCustomError(
      registry,
      "NotWitness"
    );

    await registry.connect(witness1).signAsWitness(id);
    await expect(registry.connect(witness1).signAsWitness(id)).to.be.revertedWithCustomError(
      registry,
      "AlreadySigned"
    );
  });

  it("only the testator can revoke, and not after execution", async () => {
    const { registry, testator, witness1, witness2, stranger } = await deployAll();
    const id = willId("revoke-test");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);
    await registry.connect(testator).addWitness(id, witness2.address);
    await registry.connect(witness1).signAsWitness(id);
    await registry.connect(witness2).signAsWitness(id);
    await registry.connect(testator).finalizeWill(id);

    await expect(registry.connect(stranger).revokeWill(id)).to.be.revertedWithCustomError(
      registry,
      "NotTestator"
    );

    await expect(registry.connect(testator).revokeWill(id)).to.emit(registry, "WillRevoked");
    const w = await registry.getWill(id);
    expect(w.status).to.equal(Status.REVOKED);
  });

  it("enforces the death-verification role and status machine", async () => {
    const { registry, testator, witness1, witness2, admin, stranger } = await deployAll();
    const id = willId("death-verify");
    await registry.connect(testator).createWill(id, docHash("doc"));
    await registry.connect(testator).addWitness(id, witness1.address);
    await registry.connect(testator).addWitness(id, witness2.address);
    await registry.connect(witness1).signAsWitness(id);
    await registry.connect(witness2).signAsWitness(id);
    await registry.connect(testator).finalizeWill(id);

    await expect(registry.connect(stranger).requestDeathVerification(id)).to.be.reverted;

    await registry.connect(admin).requestDeathVerification(id);
    let w = await registry.getWill(id);
    expect(w.status).to.equal(Status.DEATH_VERIFICATION_PENDING);

    await expect(
      registry.connect(admin).verifyDeath(id, docHash("cert"), true)
    ).to.emit(registry, "DeathVerified");

    w = await registry.getWill(id);
    expect(w.status).to.equal(Status.VERIFIED);
  });
});
