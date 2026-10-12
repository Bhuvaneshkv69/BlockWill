import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FilePlus2,
  Hash,
  PenTool,
  Link2,
  FileWarning,
  ShieldCheck,
  UserCheck,
  Users,
  Zap,
  Coins,
  History,
  RotateCcw,
  CheckCircle2,
  PlayCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { SimulationBadge } from "@/components/Disclaimer";

interface StepDef {
  n: number;
  title: string;
  description: string;
  icon: any;
}

const STEPS: StepDef[] = [
  { n: 1, title: "Create Demo Will", description: "Creates Alex Morgan's draft will with beneficiaries, executor, witnesses & assets.", icon: FilePlus2 },
  { n: 2, title: "Generate Document Hash", description: "SHA-256 hashes and AES-256-GCM encrypts a synthetic will document.", icon: Hash },
  { n: 3, title: "Simulate Witness Signatures", description: "Both demo witnesses sign the will on-chain.", icon: PenTool },
  { n: 4, title: "Register Will On Blockchain", description: "Finalizes the will (DRAFT → ACTIVE) and deposits 5,000 BWILL into escrow.", icon: Link2 },
  { n: 5, title: "Simulate Death Certificate", description: "Opens a mock death-verification request with a hashed certificate.", icon: FileWarning },
  { n: 6, title: "Authority Approves Death", description: "The simulated authority approves verification (ACTIVE → VERIFIED).", icon: ShieldCheck },
  { n: 7, title: "Executor Approves", description: "James Morgan approves the executor role on-chain.", icon: UserCheck },
  { n: 8, title: "Verify Beneficiaries", description: "Starts inheritance and verifies all 3 beneficiaries.", icon: Users },
  { n: 9, title: "Execute Smart Contract", description: "InheritanceManager distributes escrowed BWILL to eligible beneficiaries.", icon: Zap },
  { n: 10, title: "Distribute Assets", description: "Marks simulated physical assets transferred; shows final on-chain balances.", icon: Coins },
  { n: 11, title: "View Blockchain Audit Trail", description: "Displays the complete immutable audit trail for this demo will.", icon: History },
  { n: 12, title: "Reset Demo", description: "Clears the demo workspace. On-chain history remains — blockchain records are immutable.", icon: RotateCcw },
];

export default function DemoControlPanelPage() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [running, setRunning] = useState<number | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [lastResult, setLastResult] = useState<{ step: number; result: unknown } | null>(null);

  async function runStep(n: number) {
    setRunning(n);
    try {
      const res = await api.post<{ step: number; result: unknown }>(`/demo/step/${n}`);
      setLastResult(res);
      setCompleted((prev) => {
        const next = new Set(prev);
        if (n === 12) return new Set();
        next.add(n);
        return next;
      });
      push(`Step ${n} — ${STEPS[n - 1].title} — completed.`, "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : `Step ${n} failed`, "error");
    } finally {
      setRunning(null);
    }
  }

  async function viewDemoWill() {
    const status = await api.get<{ will: { id: string } | null }>("/demo/status");
    if (status.will) navigate(`/wills/${status.will.id}`);
    else push("No demo will exists yet — run step 1 first.", "info");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Demo Control Panel</h1>
          <p className="text-sm text-slate-500">Run the complete BlockWill lifecycle for a viva demonstration, step by step.</p>
        </div>
        <SimulationBadge />
      </div>

      <div className="flex gap-2">
        <button className="btn-secondary" onClick={viewDemoWill}>
          <PlayCircle size={15} /> Open Demo Will
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s) => {
          const isDone = completed.has(s.n);
          const isRunning = running === s.n;
          return (
            <Card key={s.n} className={isDone ? "border-emerald-200 bg-emerald-50/30" : ""}>
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDone ? "bg-emerald-100 text-emerald-600" : "bg-brand-50 text-brand-600"}`}>
                  {isDone ? <CheckCircle2 size={18} /> : <s.icon size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{s.n}. {s.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.description}</p>
                  <button
                    className={s.n === 12 ? "btn-danger mt-3 w-full text-xs" : "btn-primary mt-3 w-full text-xs"}
                    onClick={() => runStep(s.n)}
                    disabled={running !== null}
                  >
                    {isRunning ? "Running…" : s.n === 12 ? "Reset Demo" : "Run Step"}
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {lastResult && (
        <Card>
          <CardHeader title={`Last result — Step ${lastResult.step}`} subtitle="Raw response for viva inspection" />
          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(lastResult.result, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
