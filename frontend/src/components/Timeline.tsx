import { CheckCircle2, ExternalLink } from "lucide-react";
import { AuditLogEntry } from "@/lib/types";
import { formatDate, shortHash } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  WILL_CREATED: "Will Created",
  BENEFICIARY_ADDED: "Beneficiary Added",
  WITNESS_ADDED: "Witness Added",
  DOCUMENT_HASH_GENERATED: "Document Hash Generated",
  WITNESS_SIGNED: "Witness Signed",
  WILL_FINALIZED: "Will Finalized & Registered On-Chain",
  WILL_REVOKED: "Will Revoked",
  ASSETS_DEPOSITED: "Assets Deposited (Escrow)",
  EXECUTOR_NOMINATED: "Executor Nominated",
  DEATH_VERIFICATION_REQUESTED: "Death Verification Requested",
  DEATH_VERIFIED_APPROVED: "Authority Verified Death",
  DEATH_VERIFIED_REJECTED: "Authority Rejected Verification",
  EXECUTOR_APPROVED: "Executor Approved",
  INHERITANCE_STARTED: "Inheritance Process Started",
  BENEFICIARY_VERIFIED: "Beneficiary Verified",
  DISTRIBUTION_ROUND_COMPLETED: "Distribution Round Completed",
  INHERITANCE_EXECUTED: "Inheritance Executed",
  DISPUTE_RAISED: "Dispute Raised",
  DISPUTE_RESOLVED: "Dispute Resolved",
  USER_REGISTERED: "Account Registered",
  USER_LOGIN: "User Login",
};

export function Timeline({ entries, onViewTx }: { entries: AuditLogEntry[]; onViewTx?: (hash: string) => void }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No audit events recorded yet.</p>;
  }
  return (
    <ol className="relative border-l border-slate-200 pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="mb-6 last:mb-0">
          <span className="absolute -left-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 ring-4 ring-white">
            <CheckCircle2 size={12} className="text-white" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{ACTION_LABELS[entry.action] ?? entry.action}</p>
            {entry.actorRole && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{entry.actorRole}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(entry.createdAt)} {entry.actor && <>· {entry.actor.fullName}</>}
          </p>
          {entry.txHash && (
            <button
              onClick={() => onViewTx?.(entry.txHash!)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {shortHash(entry.txHash)} <ExternalLink size={12} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
