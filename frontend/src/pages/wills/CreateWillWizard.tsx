import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Trash2, UploadCloud, FileCheck2 } from "lucide-react";
import clsx from "clsx";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Will, Beneficiary, Asset, ExecutorAssignment, Witness, ConditionType } from "@/lib/types";
import { bpsToPercent, shortAddress } from "@/lib/format";
import { LegalDisclaimer } from "@/components/Disclaimer";

const STEPS = ["Testator", "Beneficiaries", "Assets", "Executor", "Witnesses", "Conditions", "Document", "Review"];
const COLORS = ["#4f46e5", "#818cf8", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9"];

export default function CreateWillWizard() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [will, setWill] = useState<Will | null>(null);
  const [title, setTitle] = useState("Last Will & Testament");
  const [creating, setCreating] = useState(false);

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [executor, setExecutor] = useState<ExecutorAssignment | null>(null);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [conditions, setConditions] = useState<{ id: string; description: string }[]>([]);
  const [document, setDocument] = useState<{ fileName: string; sha256Hash: string } | null>(null);

  const totalAllocation = beneficiaries.reduce((s, b) => s + b.allocationBps, 0);

  async function createWill() {
    setCreating(true);
    try {
      const res = await api.post<{ will: Will }>("/wills", { title });
      setWill(res.will);
      setStep(1);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to create will", "error");
    } finally {
      setCreating(false);
    }
  }

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Create a Digital Will</h1>
        <p className="text-sm text-slate-500">Step-by-step wizard — each step is committed to the database and blockchain as you go.</p>
      </div>

      <LegalDisclaimer compact />

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={clsx(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
              i === step ? "bg-brand-600 text-white" : i < step ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
            )}
          >
            {i < step ? <Check size={13} /> : <span>{i + 1}</span>}
            {label}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Testator Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={user?.fullName ?? ""} disabled />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={user?.email ?? ""} disabled />
              </div>
            </div>
            <div>
              <label className="label">Will title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Last Will & Testament of Jane Doe" />
            </div>
            <p className="text-xs text-slate-400">
              Your account's custodial wallet will sign the on-chain registration transaction for this will. Only your
              name and email are used — no unnecessary sensitive information is collected.
            </p>
            <div className="flex justify-end pt-2">
              <button className="btn-primary" disabled={creating} onClick={createWill}>
                {creating ? "Creating…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 1 && will && (
          <BeneficiariesStep willId={will.id} beneficiaries={beneficiaries} setBeneficiaries={setBeneficiaries} onBack={back} onNext={next} />
        )}

        {step === 2 && will && <AssetsStep willId={will.id} assets={assets} setAssets={setAssets} beneficiaries={beneficiaries} onBack={back} onNext={next} />}

        {step === 3 && will && <ExecutorStep willId={will.id} executor={executor} setExecutor={setExecutor} onBack={back} onNext={next} />}

        {step === 4 && will && <WitnessesStep willId={will.id} witnesses={witnesses} setWitnesses={setWitnesses} onBack={back} onNext={next} />}

        {step === 5 && will && <ConditionsStep willId={will.id} conditions={conditions} setConditions={setConditions} onBack={back} onNext={next} />}

        {step === 6 && will && <DocumentStep willId={will.id} document={document} setDocument={setDocument} onBack={back} onNext={next} />}

        {step === 7 && will && (
          <ReviewStep
            willId={will.id}
            title={title}
            totalAllocation={totalAllocation}
            beneficiaries={beneficiaries}
            assets={assets}
            executor={executor}
            witnesses={witnesses}
            document={document}
            onBack={back}
            onFinalized={() => navigate(`/wills/${will.id}`)}
          />
        )}
      </div>

      {step === 1 && (
        <div className="card p-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Live allocation preview</h3>
          {beneficiaries.length === 0 ? (
            <p className="text-sm text-slate-400">Add beneficiaries to see the allocation chart.</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={beneficiaries} dataKey="allocationBps" nameKey="name" innerRadius={45} outerRadius={80}>
                    {beneficiaries.map((b, i) => (
                      <Cell key={b.id} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => bpsToPercent(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-1 text-sm">
                {beneficiaries.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {b.name} — {bpsToPercent(b.allocationBps)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function StepFooter({ onBack, onNext, nextLabel = "Continue", nextDisabled }: { onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="flex justify-between pt-4">
      <button className="btn-secondary" onClick={onBack}>Back</button>
      <button className="btn-primary" onClick={onNext} disabled={nextDisabled}>{nextLabel}</button>
    </div>
  );
}

function BeneficiariesStep({ willId, beneficiaries, setBeneficiaries, onBack, onNext }: { willId: string; beneficiaries: Beneficiary[]; setBeneficiaries: (b: Beneficiary[]) => void; onBack: () => void; onNext: () => void }) {
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", walletAddress: "", relationship: "", allocationPercent: 0, conditionType: "IMMEDIATE" as ConditionType });
  const total = beneficiaries.reduce((s, b) => s + b.allocationBps, 0);

  async function add() {
    try {
      const res = await api.post<{ beneficiary: Beneficiary }>(`/wills/${willId}/beneficiaries`, form);
      setBeneficiaries([...beneficiaries, res.beneficiary]);
      setForm({ name: "", walletAddress: "", relationship: "", allocationPercent: 0, conditionType: "IMMEDIATE" });
      push("Beneficiary added and recorded on-chain.", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to add beneficiary", "error");
    }
  }

  async function remove(id: string) {
    await api.delete(`/wills/${willId}/beneficiaries/${id}`);
    setBeneficiaries(beneficiaries.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Beneficiaries</h2>
      <p className="text-sm text-slate-500">Total allocation must equal exactly 100% before you can finalize.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Wallet address (0x…)" value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} />
        <input className="input" placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
        <input className="input" type="number" min={0} max={100} placeholder="Allocation %" value={form.allocationPercent || ""} onChange={(e) => setForm({ ...form, allocationPercent: Number(e.target.value) })} />
        <select className="input" value={form.conditionType} onChange={(e) => setForm({ ...form, conditionType: e.target.value as ConditionType })}>
          <option value="IMMEDIATE">Immediate distribution</option>
          <option value="AGE_BASED">Age-based (18+)</option>
          <option value="TIME_LOCK">Time-locked (1 year)</option>
          <option value="EXECUTOR_APPROVAL">Requires executor approval</option>
        </select>
        <button className="btn-secondary" onClick={add} disabled={!form.name || !form.walletAddress || !form.allocationPercent}>
          <Plus size={16} /> Add beneficiary
        </button>
      </div>

      {beneficiaries.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400"><th className="py-1">Name</th><th>Wallet</th><th>Allocation</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {beneficiaries.map((b) => (
              <tr key={b.id}>
                <td className="py-2">{b.name}</td>
                <td className="py-2 font-mono text-xs">{shortAddress(b.walletAddress)}</td>
                <td className="py-2">{bpsToPercent(b.allocationBps)}</td>
                <td className="py-2 text-right"><button onClick={() => remove(b.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className={clsx("text-sm font-medium", total === 10000 ? "text-emerald-600" : "text-amber-600")}>
        Total allocated: {bpsToPercent(total)} {total === 10000 ? "✓" : `(${bpsToPercent(10000 - total)} remaining)`}
      </p>

      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={total !== 10000} />
    </div>
  );
}

function AssetsStep({ willId, assets, setAssets, beneficiaries, onBack, onNext }: { willId: string; assets: Asset[]; setAssets: (a: Asset[]) => void; beneficiaries: Beneficiary[]; onBack: () => void; onNext: () => void }) {
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", description: "", assetType: "CRYPTOCURRENCY", estimatedValue: 0, beneficiaryId: "" });

  async function add() {
    try {
      const res = await api.post<{ asset: Asset }>(`/wills/${willId}/assets`, { ...form, beneficiaryId: form.beneficiaryId || undefined });
      setAssets([...assets, res.asset]);
      setForm({ name: "", description: "", assetType: "CRYPTOCURRENCY", estimatedValue: 0, beneficiaryId: "" });
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to add asset", "error");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Assets</h2>
      <p className="text-sm text-slate-500">
        Cryptocurrency (BWILL) is distributed automatically by the smart contract. Physical/other assets are recorded
        as metadata with a simulated ownership-transfer workflow.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
          <option value="CRYPTOCURRENCY">Cryptocurrency</option>
          <option value="BANK_ACCOUNT">Bank account</option>
          <option value="PROPERTY">Property</option>
          <option value="VEHICLE">Vehicle</option>
          <option value="DIGITAL_ASSET">Digital asset</option>
          <option value="OTHER">Other</option>
        </select>
        <input className="input" type="number" placeholder="Estimated value (USD)" value={form.estimatedValue || ""} onChange={(e) => setForm({ ...form, estimatedValue: Number(e.target.value) })} />
        <select className="input" value={form.beneficiaryId} onChange={(e) => setForm({ ...form, beneficiaryId: e.target.value })}>
          <option value="">No specific beneficiary</option>
          {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input className="input sm:col-span-2" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn-secondary sm:col-span-2" onClick={add} disabled={!form.name}>
          <Plus size={16} /> Add asset
        </button>
      </div>

      {assets.length > 0 && (
        <ul className="divide-y divide-slate-50 text-sm">
          {assets.map((a) => (
            <li key={a.id} className="flex justify-between py-2">
              <span>{a.name} <span className="text-slate-400">({a.assetType})</span></span>
              <span className="text-slate-600">${a.estimatedValue.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

function ExecutorStep({ willId, executor, setExecutor, onBack, onNext }: { willId: string; executor: ExecutorAssignment | null; setExecutor: (e: ExecutorAssignment) => void; onBack: () => void; onNext: () => void }) {
  const { push } = useToast();
  const [form, setForm] = useState({ name: executor?.name ?? "", walletAddress: executor?.walletAddress ?? "", email: executor?.email ?? "", relationship: executor?.relationship ?? "" });

  async function save() {
    try {
      const res = await api.post<{ executor: ExecutorAssignment }>(`/wills/${willId}/executor`, form);
      setExecutor(res.executor);
      push("Executor nominated on-chain.", "success");
      onNext();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to nominate executor", "error");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Executor</h2>
      <p className="text-sm text-slate-500">The executor carries out distribution once death has been verified.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Wallet address (0x…)" value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
      </div>
      {executor && <p className="text-sm text-emerald-600">✓ {executor.name} nominated as executor.</p>}
      <StepFooter onBack={onBack} onNext={executor ? onNext : save} nextLabel={executor ? "Continue" : "Nominate & Continue"} nextDisabled={!executor && (!form.name || !form.walletAddress || !form.email)} />
    </div>
  );
}

function WitnessesStep({ willId, witnesses, setWitnesses, onBack, onNext }: { willId: string; witnesses: Witness[]; setWitnesses: (w: Witness[]) => void; onBack: () => void; onNext: () => void }) {
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", walletAddress: "", email: "" });

  async function add() {
    try {
      const res = await api.post<{ witness: Witness }>(`/wills/${willId}/witnesses`, form);
      setWitnesses([...witnesses, res.witness]);
      setForm({ name: "", walletAddress: "", email: "" });
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to add witness", "error");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Witnesses</h2>
      <p className="text-sm text-slate-500">At least 2 witnesses must sign (via their own wallet) before the will can be finalized.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Wallet address (0x…)" value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} />
        <input className="input" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <button className="btn-secondary" onClick={add} disabled={!form.name || !form.walletAddress}>
        <Plus size={16} /> Add witness
      </button>

      {witnesses.length > 0 && (
        <ul className="divide-y divide-slate-50 text-sm">
          {witnesses.map((w) => (
            <li key={w.id} className="flex justify-between py-2">
              <span>{w.name}</span>
              <span className="text-slate-400 font-mono text-xs">{shortAddress(w.walletAddress)}</span>
            </li>
          ))}
        </ul>
      )}

      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={witnesses.length < 2} />
      {witnesses.length < 2 && <p className="text-xs text-amber-600">Add at least 2 witnesses to continue.</p>}
    </div>
  );
}

function ConditionsStep({ willId, conditions, setConditions, onBack, onNext }: { willId: string; conditions: { id: string; description: string }[]; setConditions: (c: { id: string; description: string }[]) => void; onBack: () => void; onNext: () => void }) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ConditionType>("IMMEDIATE");

  async function add() {
    const res = await api.post<{ condition: { id: string; description: string } }>(`/wills/${willId}/conditions`, { description, type });
    setConditions([...conditions, res.condition]);
    setDescription("");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Inheritance Conditions (optional)</h2>
      <p className="text-sm text-slate-500">
        Per-beneficiary conditions (age, time-lock, executor approval) were already set in the Beneficiaries step.
        Use this step to record any additional human-readable notes for your executor and witnesses.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input sm:col-span-2" placeholder='e.g. "Funds remain locked until executor approval"' value={description} onChange={(e) => setDescription(e.target.value)} />
        <select className="input" value={type} onChange={(e) => setType(e.target.value as ConditionType)}>
          <option value="IMMEDIATE">Immediate</option>
          <option value="AGE_BASED">Age-based</option>
          <option value="TIME_LOCK">Time-lock</option>
          <option value="EXECUTOR_APPROVAL">Executor approval</option>
        </select>
      </div>
      <button className="btn-secondary" onClick={add} disabled={!description}>
        <Plus size={16} /> Add note
      </button>
      {conditions.length > 0 && (
        <ul className="list-inside list-disc text-sm text-slate-600">
          {conditions.map((c) => <li key={c.id}>{c.description}</li>)}
        </ul>
      )}
      <StepFooter onBack={onBack} onNext={onNext} />
    </div>
  );
}

function DocumentStep({ willId, document, setDocument, onBack, onNext }: { willId: string; document: { fileName: string; sha256Hash: string } | null; setDocument: (d: { fileName: string; sha256Hash: string }) => void; onBack: () => void; onNext: () => void }) {
  const { push } = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const res = await api.upload<{ document: { fileName: string; sha256Hash: string } }>(`/wills/${willId}/documents`, formData);
      setDocument(res.document);
      push("Document hashed (SHA-256), AES-256-GCM encrypted, and hash registered on-chain.", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Will Document</h2>
      <p className="text-sm text-slate-500">
        PDF → SHA-256 hash → AES-256-GCM encryption → encrypted file stored off-chain → hash recorded on-chain. The
        raw document is never stored on the blockchain.
      </p>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40">
        <UploadCloud size={28} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{uploading ? "Uploading…" : "Click to upload a PDF"}</span>
        <span className="text-xs text-slate-400">or plain text for a quick demo</span>
        <input
          type="file"
          accept="application/pdf,text/plain"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>

      {document && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <FileCheck2 size={18} />
          <div>
            <p className="font-medium">{document.fileName}</p>
            <p className="font-mono text-xs">{document.sha256Hash}</p>
          </div>
        </div>
      )}

      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!document} />
    </div>
  );
}

function ReviewStep({
  willId,
  title,
  totalAllocation,
  beneficiaries,
  assets,
  executor,
  witnesses,
  document,
  onBack,
  onFinalized,
}: {
  willId: string;
  title: string;
  totalAllocation: number;
  beneficiaries: Beneficiary[];
  assets: Asset[];
  executor: ExecutorAssignment | null;
  witnesses: Witness[];
  document: { fileName: string; sha256Hash: string } | null;
  onBack: () => void;
  onFinalized: () => void;
}) {
  const { push } = useToast();
  const [finalizing, setFinalizing] = useState(false);

  async function finalize() {
    setFinalizing(true);
    try {
      await api.post(`/wills/${willId}/finalize`);
      push("Will finalized and activated on-chain!", "success");
      onFinalized();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Could not finalize yet", "error");
    } finally {
      setFinalizing(false);
    }
  }

  const signedCount = witnesses.filter((w) => w.status === "SIGNED").length;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">Review & Finalize</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewBlock title="Title"><p>{title}</p></ReviewBlock>
        <ReviewBlock title="Allocation"><p>{bpsToPercent(totalAllocation)}</p></ReviewBlock>
        <ReviewBlock title="Beneficiaries">
          <ul className="space-y-0.5">{beneficiaries.map((b) => <li key={b.id}>{b.name} — {bpsToPercent(b.allocationBps)}</li>)}</ul>
        </ReviewBlock>
        <ReviewBlock title="Assets">
          <ul className="space-y-0.5">{assets.map((a) => <li key={a.id}>{a.name}</li>)}</ul>
        </ReviewBlock>
        <ReviewBlock title="Executor"><p>{executor?.name ?? "—"}</p></ReviewBlock>
        <ReviewBlock title="Witnesses">
          <p>{signedCount} / {witnesses.length} signed</p>
          {signedCount < 2 && <p className="mt-1 text-xs text-amber-600">Witnesses must sign in from their own account before you can finalize.</p>}
        </ReviewBlock>
        <ReviewBlock title="Document hash"><p className="break-all font-mono text-xs">{document?.sha256Hash}</p></ReviewBlock>
        <ReviewBlock title="Network"><p>Hardhat Local (chain 31337)</p></ReviewBlock>
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={finalize} disabled={finalizing}>
          {finalizing ? "Finalizing…" : "Finalize Will On-Chain"}
        </button>
      </div>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
