import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, PlayCircle, ShieldCheck, UserCheck, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Will } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { bpsToPercent } from "@/lib/format";

export default function ExecutorPage() {
  const { push } = useToast();
  const [wills, setWills] = useState<Will[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ wills: Will[] }>("/executor/wills");
      setWills(res.wills);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(action: () => Promise<unknown>, successMsg: string) {
    setBusy(successMsg);
    try {
      await action();
      push(successMsg, "success");
      await load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Action failed", "error");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Executor Console</h1>
        <p className="text-sm text-slate-500">Wills where you have been nominated as executor.</p>
      </div>

      {wills.length === 0 ? (
        <EmptyState icon={<Briefcase size={22} />} title="No wills assigned" description="You'll see wills here once a testator nominates you as executor." />
      ) : (
        <div className="grid gap-4">
          {wills.map((w) => (
            <Card key={w.id}>
              <CardHeader
                title={<Link to={`/wills/${w.id}`} className="hover:text-brand-600">{w.title}</Link>}
                subtitle={`Testator: ${w.testator?.fullName}`}
                action={<StatusBadge status={w.status} />}
              />
              <div className="mb-4 text-sm text-slate-600">
                {w.beneficiaries.length} beneficiaries · {w.beneficiaries.map((b) => bpsToPercent(b.allocationBps)).join(" / ")}
              </div>

              <div className="flex flex-wrap gap-2">
                {w.status === "VERIFIED" && !w.executor?.approvedAt && (
                  <button className="btn-primary" disabled={!!busy} onClick={() => run(() => api.post(`/wills/${w.id}/executor/approve`), "You have approved this executor role on-chain.")}>
                    <UserCheck size={15} /> Approve Executor Role
                  </button>
                )}
                {w.status === "VERIFIED" && w.executor?.approvedAt && (
                  <button className="btn-primary" disabled={!!busy} onClick={() => run(() => api.post(`/inheritance/${w.id}/start`), "Inheritance process started on-chain.")}>
                    <PlayCircle size={15} /> Start Inheritance
                  </button>
                )}
                {w.status === "INHERITANCE_IN_PROGRESS" &&
                  w.beneficiaries.map((b) => (
                    <button
                      key={b.id}
                      className="btn-secondary"
                      disabled={!!busy || !!b.verifiedAt}
                      onClick={() => run(() => api.post(`/inheritance/${w.id}/verify-beneficiary/${b.id}`), `${b.name} verified on-chain.`)}
                    >
                      <UserCheck size={15} /> Verify {b.name}
                    </button>
                  ))}
                {w.status === "INHERITANCE_IN_PROGRESS" && (
                  <button className="btn-primary" disabled={!!busy} onClick={() => run(() => api.post(`/inheritance/${w.id}/execute`), "Smart contract executed — assets distributed.")}>
                    <Zap size={15} /> Execute & Distribute
                  </button>
                )}
                <Link to={`/wills/${w.id}`} className="btn-ghost">
                  <ShieldCheck size={15} /> View full detail
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
