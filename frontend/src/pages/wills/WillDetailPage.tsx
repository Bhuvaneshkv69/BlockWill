import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangle, Ban, Coins, PenTool, Scale, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AuditLogEntry, Will } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { Timeline } from "@/components/Timeline";
import { TxDetailModal } from "@/components/TxDetailModal";
import { Modal } from "@/components/ui/Modal";
import { bpsToPercent, formatDate, formatDateOnly, shortAddress, shortHash } from "@/lib/format";

type Tab = "overview" | "audit" | "inheritance";

export default function WillDetailPage({ initialTab = "overview" }: { initialTab?: Tab }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { push } = useToast();

  const [will, setWill] = useState<Will | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [txModal, setTxModal] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [willRes, auditRes] = await Promise.all([
        api.get<{ will: Will }>(`/wills/${id}`),
        api.get<{ logs: AuditLogEntry[] }>(`/audit/${id}`).catch(() => ({ logs: [] })),
      ]);
      setWill(willRes.will);
      setAudit(auditRes.logs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <PageSpinner />;
  if (!will) return <p className="text-sm text-slate-500">Will not found.</p>;

  const isTestator = will.testator?.id === user?.id;
  const myWitness = will.witnesses.find((w) => w.userId === user?.id);
  const myBeneficiary = will.beneficiaries.find((b) => b.userId === user?.id);

  async function revoke() {
    if (!confirm("Revoke this will? This action is recorded permanently on-chain.")) return;
    try {
      await api.post(`/wills/${id}/revoke`);
      push("Will revoked on-chain.", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to revoke", "error");
    }
  }

  async function signAsWitness() {
    if (!myWitness) return;
    try {
      await api.post(`/wills/${id}/witnesses/${myWitness.id}/sign`);
      push("You have signed as a witness on-chain.", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to sign", "error");
    }
  }

  return (
    <div className="space-y-6">
      <TxDetailModal txHash={txModal} onClose={() => setTxModal(null)} />
      {disputeOpen && will && <DisputeModal willId={will.id} onClose={() => setDisputeOpen(false)} onDone={load} />}
      {depositOpen && will && <DepositModal willId={will.id} onClose={() => setDepositOpen(false)} onDone={load} />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{will.title}</h1>
            <StatusBadge status={will.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Testator: {will.testator?.fullName} · Version {will.version} · Updated {formatDate(will.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {myWitness && myWitness.status === "PENDING" && (
            <button className="btn-primary" onClick={signAsWitness}>
              <PenTool size={15} /> Sign as Witness
            </button>
          )}
          {isTestator && will.status === "DRAFT" && (
            <button className="btn-secondary" onClick={() => setDepositOpen(true)}>
              <Coins size={15} /> Deposit BWILL Escrow
            </button>
          )}
          {isTestator && ["DRAFT", "ACTIVE"].includes(will.status) && (
            <button className="btn-danger" onClick={revoke}>
              <Ban size={15} /> Revoke Will
            </button>
          )}
          {myBeneficiary && !["EXECUTED", "REVOKED"].includes(will.status) && (
            <button className="btn-secondary" onClick={() => setDisputeOpen(true)}>
              <Scale size={15} /> Raise Dispute
            </button>
          )}
        </div>
      </div>

      {will.restricted && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} /> {will.restrictionReason}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {(["overview", "inheritance", "audit"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "border-b-2 px-4 py-2 text-sm font-medium capitalize",
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab will={will} onViewTx={setTxModal} />}
      {tab === "inheritance" && <InheritanceTab will={will} onViewTx={setTxModal} onChanged={load} />}
      {tab === "audit" && (
        <Card>
          <CardHeader title="Immutable Audit Trail" subtitle="Every critical action, in chronological order." />
          <Timeline entries={audit} onViewTx={setTxModal} />
        </Card>
      )}
    </div>
  );
}

function OverviewTab({ will, onViewTx }: { will: Will; onViewTx: (h: string) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="On-chain record" />
        <dl className="space-y-2 text-sm">
          <Row label="On-chain will ID" value={<span className="font-mono text-xs">{shortHash(will.onChainId)}</span>} />
          <Row label="Document hash" value={<span className="font-mono text-xs">{shortHash(will.documentHash)}</span>} />
          <Row label="Network" value={will.network} />
          {will.registeredTxHash && (
            <Row
              label="Registration tx"
              value={
                <button className="font-mono text-xs text-brand-600 hover:underline" onClick={() => onViewTx(will.registeredTxHash!)}>
                  {shortHash(will.registeredTxHash)}
                </button>
              }
            />
          )}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Beneficiaries" />
        {will.beneficiaries.length === 0 ? (
          <p className="text-sm text-slate-400">No beneficiaries added.</p>
        ) : (
          <ul className="divide-y divide-slate-50 text-sm">
            {will.beneficiaries.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.relationship} · {shortAddress(b.walletAddress)}</p>
                </div>
                <span className="font-semibold text-slate-700">{bpsToPercent(b.allocationBps)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Executor & Witnesses" />
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Executor</p>
            <p>{will.executor ? `${will.executor.name} (${shortAddress(will.executor.walletAddress)})` : "Not nominated"}</p>
            {will.executor?.approvedAt && <p className="text-xs text-emerald-600">Approved {formatDate(will.executor.approvedAt)}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Witnesses</p>
            <ul className="space-y-1">
              {will.witnesses.map((w) => (
                <li key={w.id} className="flex items-center justify-between">
                  <span>{w.name}</span>
                  <StatusBadge status={w.status} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Assets" />
        {will.assets.length === 0 ? (
          <p className="text-sm text-slate-400">No assets recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-50 text-sm">
            {will.assets.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.assetType}</p>
                </div>
                <span className="text-slate-600">${a.estimatedValue.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Documents" />
        {!will.documents || will.documents.length === 0 ? (
          <p className="text-sm text-slate-400">No document uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50 text-sm">
            {will.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-slate-800">{d.fileName}</p>
                  <p className="font-mono text-xs text-slate-400">{d.sha256Hash}</p>
                </div>
                <span className="text-xs text-slate-400">{formatDateOnly(d.uploadedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function InheritanceTab({ will, onViewTx, onChanged }: { will: Will; onViewTx: (h: string) => void; onChanged: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Process status" />
        <dl className="space-y-2 text-sm">
          <Row label="Current status" value={<StatusBadge status={will.status} />} />
          <Row label="Started" value={will.inheritance?.startedAt ? formatDate(will.inheritance.startedAt) : "Not started"} />
          <Row label="Executed" value={will.inheritance?.executedAt ? formatDate(will.inheritance.executedAt) : "Not yet"} />
        </dl>
        {will.disputes && will.disputes.length > 0 && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <p className="font-medium">{will.disputes.length} dispute(s) recorded</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {will.disputes.map((d) => <li key={d.id}>{d.reason}: {d.description} — {d.status}</li>)}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Distribution" subtitle="BWILL token distribution per beneficiary" />
        <ul className="divide-y divide-slate-50 text-sm">
          {will.beneficiaries.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-slate-800">{b.name}</p>
                <p className="text-xs text-slate-400">{bpsToPercent(b.allocationBps)} · {b.conditionType.replace(/_/g, " ")}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={b.distributionStatus} />
                {b.distributedAmount && <p className="mt-0.5 text-xs text-slate-500">{b.distributedAmount} BWILL</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}

function DisputeModal({ willId, onClose, onDone }: { willId: string; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const [reason, setReason] = useState("INCORRECT_ALLOCATION");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.post("/disputes", { willId, reason, description });
      push("Dispute raised on-chain. Distribution is now paused.", "success");
      onDone();
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to raise dispute", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Raise a Dispute"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-danger" onClick={submit} disabled={loading || description.length < 10}>
            {loading ? "Submitting…" : "Raise Dispute"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Reason</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="INCORRECT_ALLOCATION">Incorrect allocation</option>
            <option value="IDENTITY_ISSUE">Identity issue</option>
            <option value="INVALID_BENEFICIARY">Invalid beneficiary</option>
            <option value="SUSPECTED_FRAUD">Suspected fraud</option>
            <option value="DOCUMENT_ISSUE">Document issue</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain the issue in detail (min. 10 characters)…" />
        </div>
      </div>
    </Modal>
  );
}

function DepositModal({ willId, onClose, onDone }: { willId: string; onClose: () => void; onDone: () => void }) {
  const { push } = useToast();
  const [amount, setAmount] = useState(5000);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.post(`/wills/${willId}/deposit`, { amount });
      push(`${amount} BWILL deposited into escrow on-chain.`, "success");
      onDone();
      onClose();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Deposit failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Deposit BWILL Escrow"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading || amount <= 0}>
            {loading ? "Depositing…" : "Deposit"}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
        <ShieldCheck size={16} /> Tokens are escrowed by the InheritanceManager contract until distribution.
      </div>
      <div className="mt-4">
        <label className="label">Amount (BWILL)</label>
        <input className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
    </Modal>
  );
}
