import { ShieldAlert } from "lucide-react";
import clsx from "clsx";

export function LegalDisclaimer({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={clsx("flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900", className)}>
      <ShieldAlert size={compact ? 16 : 20} className="mt-0.5 shrink-0" />
      <p className={compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"}>
        <strong>Academic prototype.</strong> This platform demonstrates blockchain-based digital will and inheritance
        management for educational purposes. It does not constitute legal advice, does not create a legally valid
        will by itself, and does not replace execution requirements under applicable law. Death verification is
        simulated and is <strong>not</strong> a real government integration.
      </p>
    </div>
  );
}

export function SimulationBadge({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800", className)}>
      <ShieldAlert size={13} /> ACADEMIC SIMULATION
    </span>
  );
}
