import clsx from "clsx";
import { STATUS_LABELS } from "@/lib/format";

const COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-600/20",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REVOKED: "bg-slate-100 text-slate-500 ring-slate-500/20 line-through",
  DEATH_VERIFICATION_PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  VERIFIED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  INHERITANCE_IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-600/20",
  EXECUTED: "bg-brand-50 text-brand-700 ring-brand-600/20",
  DISPUTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  SIGNED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
  OPEN: "bg-amber-50 text-amber-700 ring-amber-600/20",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  DISTRIBUTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  LOCKED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        COLORS[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20",
        className
      )}
    >
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
