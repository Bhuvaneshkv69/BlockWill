import { useEffect, useState } from "react";
import { CheckCircle2, FolderLock, ShieldAlert, UploadCloud, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Will } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateOnly } from "@/lib/format";

interface DocRow {
  id: string;
  willId: string;
  willTitle: string;
  testator: string;
  fileName: string;
  sha256Hash: string;
  version: number;
  sizeBytes: number;
  uploadedAt: string;
}

export default function DocumentsPage() {
  const { push } = useToast();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [wills, setWills] = useState<Will[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyWillId, setVerifyWillId] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ result: string; computedHash: string; onChainHash: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    Promise.all([api.get<{ documents: DocRow[] }>("/documents"), api.get<{ wills: Will[] }>("/wills")])
      .then(([d, w]) => {
        setDocs(d.documents);
        setWills(w.wills);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleVerify(file: File) {
    if (!verifyWillId) {
      push("Select which will to verify against first.", "error");
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("willId", verifyWillId);
      const res = await api.upload<{ result: string; computedHash: string; onChainHash: string }>("/documents/verify", formData);
      setVerifyResult(res);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Verification failed", "error");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">Encrypted off-chain documents and on-chain hash verification.</p>
      </div>

      <Card>
        <CardHeader title="Verify Document" subtitle="Re-hash a file and compare it against the hash recorded on-chain" />
        <div className="space-y-3">
          <select className="input" value={verifyWillId} onChange={(e) => setVerifyWillId(e.target.value)}>
            <option value="">Select a will to verify against…</option>
            {wills.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-6 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50/40">
            <UploadCloud size={18} /> {verifying ? "Verifying…" : "Upload a document to verify"}
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleVerify(e.target.files[0])} />
          </label>

          {verifyResult && (
            <div
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                verifyResult.result === "MATCH" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {verifyResult.result === "MATCH" ? <CheckCircle2 size={18} className="mt-0.5" /> : <XCircle size={18} className="mt-0.5" />}
              <div>
                <p className="font-semibold">{verifyResult.result === "MATCH" ? "MATCH — document is unmodified" : "DOCUMENT MODIFIED"}</p>
                <p className="mt-1 font-mono text-xs opacity-80">Computed: {verifyResult.computedHash}</p>
                <p className="font-mono text-xs opacity-80">On-chain: {verifyResult.onChainHash}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <ShieldAlert size={14} /> Raw documents are never stored on-chain — only the SHA-256 hash. Files are encrypted at rest with AES-256-GCM.
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<FolderLock size={22} />} title="No documents uploaded" />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Will</th>
                  <th className="px-5 py-3">SHA-256</th>
                  <th className="px-5 py-3">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-3 font-medium text-slate-800">{d.fileName}</td>
                    <td className="px-5 py-3 text-slate-600">{d.willTitle}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{d.sha256Hash.slice(0, 20)}…</td>
                    <td className="px-5 py-3 text-slate-400">{formatDateOnly(d.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
