import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Scale } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Dispute } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

export default function DisputesPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ disputes: Dispute[] }>("/disputes");
      setDisputes(res.disputes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string, reinstate: boolean) {
    try {
      await api.post(`/disputes/${id}/resolve`, { reinstate, restoreToStatus: "VERIFIED" });
      push(reinstate ? "Dispute resolved — inheritance process reinstated." : "Dispute rejected — will remains disputed.", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to resolve dispute", "error");
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Disputes</h1>
        <p className="text-sm text-slate-500">
          {user?.role === "ADMIN" ? "All disputes raised across the platform." : "Disputes you have raised."}
        </p>
      </div>

      {disputes.length === 0 ? (
        <EmptyState icon={<Scale size={22} />} title="No disputes" description="Disputes raised by beneficiaries will appear here." />
      ) : (
        <div className="grid gap-3">
          {disputes.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/wills/${d.willId}`} className="font-medium text-slate-800 hover:text-brand-600">{d.will?.title ?? d.willId}</Link>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-medium">{d.reason.replace(/_/g, " ")}:</span> {d.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Raised by {d.raisedBy?.fullName ?? "—"} on {formatDate(d.createdAt)}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
              {user?.role === "ADMIN" && d.status === "OPEN" && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => resolve(d.id, true)}>Reinstate & Resolve</button>
                  <button className="btn-secondary text-xs" onClick={() => resolve(d.id, false)}>Reject Dispute</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
