import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Will, VerificationRequest } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { SimulationBadge } from "@/components/Disclaimer";
import { formatDate } from "@/lib/format";

export default function VerificationPage() {
  const { push } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [activeWills, setActiveWills] = useState<Will[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWill, setSelectedWill] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [reqRes, willsRes] = await Promise.all([
        api.get<{ requests: VerificationRequest[] }>("/verification"),
        api.get<{ wills: Will[] }>("/wills"),
      ]);
      setRequests(reqRes.requests);
      setActiveWills(willsRes.wills.filter((w) => w.status === "ACTIVE"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openRequest() {
    if (!selectedWill) return;
    try {
      await api.post("/verification", { willId: selectedWill, notes: "Manually opened via Authority Portal" });
      push("Death-verification request opened (simulation).", "success");
      setSelectedWill("");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to open request", "error");
    }
  }

  async function uploadCertificate(req: VerificationRequest, file: File) {
    const formData = new FormData();
    formData.append("certificate", file);
    await api.upload(`/verification/${req.id}/certificate`, formData);
    push("Mock certificate uploaded and hashed.", "success");
    load();
  }

  async function decide(req: VerificationRequest, approved: boolean) {
    try {
      await api.post(`/verification/${req.id}/${approved ? "approve" : "reject"}`);
      push(approved ? "Death verified (simulation) — will status is now VERIFIED." : "Verification rejected.", approved ? "success" : "info");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to decide", "error");
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Simulated Authority Portal</h1>
          <p className="text-sm text-slate-500">Mock death-verification workflow for demonstration.</p>
        </div>
        <SimulationBadge />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This portal simulates a civil-registry authority for academic demonstration only. It does not integrate with
        any real government death registry.
      </div>

      <Card>
        <CardHeader title="Open a new verification request" subtitle="Select an ACTIVE will to search & open a request" />
        <div className="flex gap-2">
          <select className="input" value={selectedWill} onChange={(e) => setSelectedWill(e.target.value)}>
            <option value="">Select a will…</option>
            {activeWills.map((w) => (
              <option key={w.id} value={w.id}>{w.title} — {w.testator?.fullName}</option>
            ))}
          </select>
          <button className="btn-primary shrink-0" onClick={openRequest} disabled={!selectedWill}>
            <ShieldCheck size={15} /> Open Request
          </button>
        </div>
      </Card>

      {requests.length === 0 ? (
        <EmptyState title="No verification requests yet" />
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader
                title={<Link to={`/wills/${r.willId}`} className="hover:text-brand-600">{r.will?.title ?? r.willId}</Link>}
                subtitle={`Requested ${formatDate(r.requestedAt)}`}
                action={<StatusBadge status={r.status} />}
              />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {r.certificateHash ? (
                  <span className="font-mono text-xs text-slate-500">Certificate hash: {r.certificateHash.slice(0, 16)}…</span>
                ) : (
                  <label className="btn-secondary cursor-pointer text-xs">
                    <UploadCloud size={14} /> Upload mock certificate
                    <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCertificate(r, e.target.files[0])} />
                  </label>
                )}
                {r.status === "PENDING" && (
                  <>
                    <button className="btn-primary text-xs" onClick={() => decide(r, true)}>
                      <CheckCircle2 size={14} /> Approve Verification
                    </button>
                    <button className="btn-danger text-xs" onClick={() => decide(r, false)}>
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
