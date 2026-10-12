import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import * as willService from "./willService";
import * as inheritanceService from "./inheritanceService";
import * as verificationService from "./verificationService";
import { getAuditTrail } from "./auditService";
import { fromTokenAmount } from "../blockchain/utils";
import { tokenBalanceOf } from "../blockchain/willChain";

const DEMO_WILL_TITLE = "Alex Morgan — Demo Will";

async function demoUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw AppError.internal(
      `Demo account ${email} is missing. Run "npm run db:seed --workspace backend" to seed demo accounts.`
    );
  }
  return user;
}

async function activeDemoWill() {
  const testator = await demoUser("alex.morgan@demo.blockwill");
  const will = await prisma.will.findFirst({
    where: { testatorId: testator.id, title: DEMO_WILL_TITLE },
    orderBy: { createdAt: "desc" },
  });
  if (!will) throw AppError.badRequest('No demo will exists yet. Run step 1, "Create Demo Will", first.');
  return will;
}

function syntheticDocument() {
  const text = `BLOCKWILL — ACADEMIC DEMONSTRATION DOCUMENT (NOT LEGALLY BINDING)\n\nLast Will and Testament of Alex Morgan\nGenerated: ${new Date().toISOString()}\n\nThis document is a synthetic artifact created for the BlockWill demo\ncontrol panel. It stands in for a testator-authored legal document so the\nSHA-256 hashing + AES-256-GCM encryption pipeline can be demonstrated\nend-to-end without requiring a real PDF upload.\n`;
  return Buffer.from(text, "utf-8");
}

function syntheticCertificate() {
  const text = `ACADEMIC SIMULATION — MOCK DEATH CERTIFICATE\nNOT A REAL GOVERNMENT DOCUMENT\n\nIssued by: BlockWill Simulated Authority Portal\nSubject: Alex Morgan (demo persona)\nDate: ${new Date().toISOString()}\n`;
  return Buffer.from(text, "utf-8");
}

export async function step1_createDemoWill() {
  const testator = await demoUser("alex.morgan@demo.blockwill");
  const existing = await prisma.will.findFirst({
    where: { testatorId: testator.id, title: DEMO_WILL_TITLE, status: { in: ["DRAFT", "ACTIVE"] } },
  });
  if (existing) return existing;

  const will = await willService.createWill(testator, DEMO_WILL_TITLE);

  const executorUser = await demoUser("james.morgan@demo.blockwill");
  const witness1 = await demoUser("witness.one@demo.blockwill");
  const witness2 = await demoUser("witness.two@demo.blockwill");
  const sarah = await demoUser("sarah.morgan@demo.blockwill");
  const daniel = await demoUser("daniel.morgan@demo.blockwill");
  const emma = await demoUser("emma.morgan@demo.blockwill");

  const executorWallet = willService.signerFor(executorUser as any);
  await willService.nominateExecutor(testator, will.id, {
    name: executorUser.fullName,
    walletAddress: await executorWallet.getAddress(),
    email: executorUser.email,
    relationship: "Sibling",
    userId: executorUser.id,
  });

  for (const [user, relationship] of [
    [witness1, "Family friend"],
    [witness2, "Neighbor"],
  ] as const) {
    const wallet = willService.signerFor(user as any);
    await willService.addWitness(testator, will.id, {
      name: user.fullName,
      walletAddress: await wallet.getAddress(),
      email: user.email,
      userId: user.id,
    });
  }

  for (const [user, allocation, relationship] of [
    [sarah, 50, "Daughter"],
    [daniel, 30, "Son"],
    [emma, 20, "Daughter"],
  ] as const) {
    const wallet = willService.signerFor(user as any);
    await willService.addBeneficiary(testator, will.id, {
      name: user.fullName,
      walletAddress: await wallet.getAddress(),
      relationship,
      allocationPercent: allocation,
      conditionType: "IMMEDIATE",
    });
  }

  await prisma.asset.createMany({
    data: [
      { willId: will.id, name: "BWILL Demo Token Holdings", description: "On-chain demo token distributed via smart contract", assetType: "CRYPTOCURRENCY", estimatedValue: 5000 },
      { willId: will.id, name: "10 ETH (simulated)", description: "Simulated cryptocurrency holding for demonstration purposes only", assetType: "CRYPTOCURRENCY", estimatedValue: 10 },
      { willId: will.id, name: "Demo Apartment", description: "Simulated real-estate asset — ownership transfer is a recorded workflow, not an on-chain transfer", assetType: "PROPERTY", estimatedValue: 250000 },
    ],
  });

  return prisma.will.findUniqueOrThrow({ where: { id: will.id } });
}

export async function step2_generateDocumentHash() {
  const will = await activeDemoWill();
  const testator = await demoUser("alex.morgan@demo.blockwill");
  return willService.uploadDocument(testator, will.id, {
    originalname: "alex-morgan-demo-will.txt",
    mimetype: "text/plain",
    size: syntheticDocument().length,
    buffer: syntheticDocument(),
  });
}

export async function step3_simulateWitnessSignatures() {
  const will = await activeDemoWill();
  const witnesses = await prisma.witness.findMany({ where: { willId: will.id } });
  const results = [];
  for (const witness of witnesses) {
    if (witness.status === "SIGNED") continue;
    const user = await prisma.user.findUnique({ where: { id: witness.userId ?? "" } });
    if (!user) continue;
    results.push(await willService.signAsWitness(user, will.id, witness.id));
  }
  return results;
}

export async function step4_registerOnBlockchain() {
  const will = await activeDemoWill();
  const testator = await demoUser("alex.morgan@demo.blockwill");
  const finalized = await willService.finalizeWill(testator, will.id);
  await willService.depositEscrow(testator, will.id, 5000);
  return finalized;
}

export async function step5_simulateDeathCertificate() {
  const will = await activeDemoWill();
  const authority = await demoUser("authority@demo.blockwill");
  const request = await verificationService.requestVerification(
    authority,
    will.id,
    "ACADEMIC SIMULATION — demo control panel"
  );
  return verificationService.attachCertificateHash(request.id, "mock-death-certificate.txt", syntheticCertificate());
}

export async function step6_authorityApprovesDeath() {
  const will = await activeDemoWill();
  const authority = await demoUser("authority@demo.blockwill");
  const request = await prisma.verificationRequest.findFirst({
    where: { willId: will.id, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });
  if (!request) throw AppError.badRequest("Run step 5 (simulate death certificate) first.");
  return verificationService.decideVerification(authority, request.id, true);
}

export async function step7_executorApproves() {
  const will = await activeDemoWill();
  const executor = await demoUser("james.morgan@demo.blockwill");
  return willService.executorApprove(executor, will.id);
}

export async function step8_verifyBeneficiaries() {
  const will = await activeDemoWill();
  const executor = await demoUser("james.morgan@demo.blockwill");
  await inheritanceService.startInheritance(executor, will.id);
  const beneficiaries = await prisma.beneficiary.findMany({ where: { willId: will.id } });
  const results = [];
  for (const b of beneficiaries) {
    results.push(await inheritanceService.verifyBeneficiary(executor, will.id, b.id));
  }
  return results;
}

export async function step9_executeSmartContract() {
  const will = await activeDemoWill();
  const executor = await demoUser("james.morgan@demo.blockwill");
  return inheritanceService.executeInheritance(executor, will.id);
}

export async function step10_distributeAssets() {
  const will = await activeDemoWill();
  const nonTokenAssets = await prisma.asset.findMany({
    where: { willId: will.id, assetType: { not: "CRYPTOCURRENCY" } },
  });
  for (const asset of nonTokenAssets) {
    await prisma.asset.update({ where: { id: asset.id }, data: { transferSimulated: true, transferredAt: new Date() } });
  }

  const beneficiaries = await prisma.beneficiary.findMany({ where: { willId: will.id } });
  const balances = await Promise.all(
    beneficiaries.map(async (b) => ({
      name: b.name,
      walletAddress: b.walletAddress,
      allocationPercent: b.allocationBps / 100,
      onChainBalance: fromTokenAmount(await tokenBalanceOf(b.walletAddress)),
      distributionStatus: b.distributionStatus,
    }))
  );

  return { simulatedAssetsTransferred: nonTokenAssets.length, balances };
}

export async function step11_viewAuditTrail() {
  const will = await activeDemoWill();
  return getAuditTrail(will.id);
}

export async function step12_resetDemo() {
  const testator = await demoUser("alex.morgan@demo.blockwill");
  const wills = await prisma.will.findMany({ where: { testatorId: testator.id, title: DEMO_WILL_TITLE } });
  for (const will of wills) {
    await prisma.will.delete({ where: { id: will.id } });
  }
  return {
    cleared: wills.length,
    note: "The demo workspace has been cleared. Blockchain transactions from the previous run remain permanently on-chain and visible in the Blockchain Explorer — this immutability is intentional and is itself part of the demonstration.",
  };
}

export async function getDemoStatus() {
  const testator = await demoUser("alex.morgan@demo.blockwill");
  const will = await prisma.will.findFirst({
    where: { testatorId: testator.id, title: DEMO_WILL_TITLE },
    orderBy: { createdAt: "desc" },
    include: {
      beneficiaries: true,
      witnesses: true,
      executor: true,
      documents: true,
      inheritance: true,
      disputes: true,
    },
  });
  return will;
}
