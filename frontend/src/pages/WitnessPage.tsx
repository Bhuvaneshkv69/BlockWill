import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PenTool } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Card } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

interface WitnessRequest {
  id: string;
  willId: string;
  status: "PENDING" | "SIGNED" | "DECLINED";
  signedAt?: string | null;
  will: { title: string; testator: { fullName: string; email: string } };
}

export default function WitnessPage() {
  const { push } = useToast();
  const [requests, setRequests] = useState<WitnessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ requests: WitnessRequest[] }>("/witness/requests");
      setRequests(res.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function sign(req: WitnessRequest) {
    try {
      await api.post(`/wills/${req.willId}/witnesses/${req.id}/sign`);
      push("Signed on-chain as a witness.", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to sign", "error");
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Witness Requests</h1>
        <p className="text-sm text-slate-500">Wills where you've been asked to witness the testator's signing.</p>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={<PenTool size={22} />} title="No witness requests" description="You'll see requests here when a testator adds you as a witness." />
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <Link to={`/wills/${r.willId}`} className="font-medium text-slate-800 hover:text-brand-600">{r.will.title}</Link>
                <p className="text-xs text-slate-500">Testator: {r.will.testator.fullName}</p>
                {r.signedAt && <p className="text-xs text-slate-400">Signed {formatDate(r.signedAt)}</p>}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={r.status} />
                {r.status === "PENDING" && (
                  <button className="btn-primary" onClick={() => sign(r)}>
                    <PenTool size={15} /> Sign
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
