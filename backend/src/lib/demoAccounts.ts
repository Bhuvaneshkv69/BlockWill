import { UserRole } from "@prisma/client";

export const DEMO_PASSWORD = "Demo@1234";

/** Keys into signers.ts' DEMO_ROLE_INDEX map. */
export type DemoSignerKey =
  | "ADMIN"
  | "TESTATOR_DEMO"
  | "EXECUTOR_DEMO"
  | "WITNESS_DEMO_1"
  | "WITNESS_DEMO_2"
  | "AUTHORITY_DEMO"
  | "BENEFICIARY_DEMO_1"
  | "BENEFICIARY_DEMO_2"
  | "BENEFICIARY_DEMO_3";

export interface DemoAccountSeed {
  email: string;
  fullName: string;
  role: UserRole;
  demoLabel: string;
  /** Exact signer identity for this persona (role alone is ambiguous when
   *  a role has more than one demo persona, e.g. two witnesses). */
  signerKey: DemoSignerKey;
}

export const DEMO_ACCOUNTS: DemoAccountSeed[] = [
  { email: "admin@demo.blockwill", fullName: "System Administrator", role: "ADMIN", demoLabel: "Admin Demo", signerKey: "ADMIN" },
  { email: "alex.morgan@demo.blockwill", fullName: "Alex Morgan", role: "TESTATOR", demoLabel: "Testator Demo", signerKey: "TESTATOR_DEMO" },
  { email: "james.morgan@demo.blockwill", fullName: "James Morgan", role: "EXECUTOR", demoLabel: "Executor Demo", signerKey: "EXECUTOR_DEMO" },
  { email: "witness.one@demo.blockwill", fullName: "Witness One", role: "WITNESS", demoLabel: "Witness Demo (1)", signerKey: "WITNESS_DEMO_1" },
  { email: "witness.two@demo.blockwill", fullName: "Witness Two", role: "WITNESS", demoLabel: "Witness Demo (2)", signerKey: "WITNESS_DEMO_2" },
  { email: "authority@demo.blockwill", fullName: "Mock Verification Authority", role: "AUTHORITY", demoLabel: "Authority Demo", signerKey: "AUTHORITY_DEMO" },
  { email: "sarah.morgan@demo.blockwill", fullName: "Sarah Morgan", role: "BENEFICIARY", demoLabel: "Beneficiary Demo (Sarah, 50%)", signerKey: "BENEFICIARY_DEMO_1" },
  { email: "daniel.morgan@demo.blockwill", fullName: "Daniel Morgan", role: "BENEFICIARY", demoLabel: "Beneficiary Demo (Daniel, 30%)", signerKey: "BENEFICIARY_DEMO_2" },
  { email: "emma.morgan@demo.blockwill", fullName: "Emma Morgan", role: "BENEFICIARY", demoLabel: "Beneficiary Demo (Emma, 20%)", signerKey: "BENEFICIARY_DEMO_3" },
];

export function demoSignerKeyForEmail(email: string): DemoSignerKey | undefined {
  return DEMO_ACCOUNTS.find((a) => a.email === email)?.signerKey;
}
