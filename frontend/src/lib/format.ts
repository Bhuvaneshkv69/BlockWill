export function shortAddress(address?: string | null, chars = 4): string {
  if (!address) return "—";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function shortHash(hash?: string | null): string {
  return shortAddress(hash, 6);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  REVOKED: "Revoked",
  DEATH_VERIFICATION_PENDING: "Death Verification Pending",
  VERIFIED: "Verified",
  INHERITANCE_IN_PROGRESS: "Inheritance In Progress",
  EXECUTED: "Executed",
  DISPUTED: "Disputed",
};

export const ROLE_LABELS: Record<string, string> = {
  TESTATOR: "Testator",
  BENEFICIARY: "Beneficiary",
  EXECUTOR: "Executor",
  WITNESS: "Witness",
  AUTHORITY: "Authority",
  ADMIN: "Administrator",
};
