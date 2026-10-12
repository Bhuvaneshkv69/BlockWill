import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/demoAccounts";
import { getDemoSigner, DEMO_ROLE_INDEX } from "../src/blockchain/signers";

const prisma = new PrismaClient();

const DEMO_KEY_BY_EMAIL: Record<string, keyof typeof DEMO_ROLE_INDEX> = {
  "admin@demo.blockwill": "ADMIN",
  "alex.morgan@demo.blockwill": "TESTATOR_DEMO",
  "james.morgan@demo.blockwill": "EXECUTOR_DEMO",
  "witness.one@demo.blockwill": "WITNESS_DEMO_1",
  "witness.two@demo.blockwill": "WITNESS_DEMO_2",
  "authority@demo.blockwill": "AUTHORITY_DEMO",
  "sarah.morgan@demo.blockwill": "BENEFICIARY_DEMO_1",
  "daniel.morgan@demo.blockwill": "BENEFICIARY_DEMO_2",
  "emma.morgan@demo.blockwill": "BENEFICIARY_DEMO_3",
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const account of DEMO_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { fullName: account.fullName, role: account.role, isDemoAccount: true },
      create: {
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        isDemoAccount: true,
        passwordHash,
      },
    });

    const demoKey = DEMO_KEY_BY_EMAIL[account.email];
    const wallet = getDemoSigner(demoKey);
    const address = await wallet.getAddress();

    await prisma.wallet.upsert({
      where: { address },
      update: { userId: user.id },
      create: { userId: user.id, address, label: account.demoLabel, isPrimary: true },
    });

    console.log(`Seeded ${account.demoLabel} <${account.email}> — wallet ${address}`);
  }

  console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
