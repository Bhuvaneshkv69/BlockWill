import { useEffect, useState } from "react";
import { Network, UserSquare2, Landmark, Briefcase, PenTool, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { SimulationBadge } from "@/components/Disclaimer";
import { shortHash } from "@/lib/format";

interface DltNode {
  id: string;
  label: string;
  blockNumber: number | null;
  blockHash: string | null;
  synced: boolean;
}
interface DltResponse {
  reachable: boolean;
  blockNumber: number | null;
  blockHash: string | null;
  nodes: DltNode[];
  disclaimer: string;
}

const ICONS: Record<string, any> = {
  "Testator Node": UserSquare2,
  "Legal Authority Node": Landmark,
  "Executor Node": Briefcase,
  "Witness Node": PenTool,
  "Beneficiary Node": Users,
};

export default function DltNetworkPage() {
  const [data, setData] = useState<DltResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api.get<DltResponse>("/blockchain/dlt-network");
    setData(res);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  if (loading || !data) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Distributed Ledger Network Visualization</h1>
          <p className="text-sm text-slate-500">Conceptual demonstration of ledger synchronization across participant roles.</p>
        </div>
        <SimulationBadge />
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        {data.disclaimer}
      </div>

      <Card>
        <CardHeader title="Ledger state" subtitle="Every participant node observes the exact same block height and hash" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {data.nodes.map((node) => {
            const Icon = ICONS[node.label] ?? Network;
            return (
              <div key={node.id} className="rounded-xl border border-slate-200 p-4 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Icon size={20} />
                </div>
                <p className="text-sm font-semibold text-slate-800">{node.label}</p>
                <p className="mt-1 text-xs text-slate-400">Block #{node.blockNumber ?? "—"}</p>
                <span
                  className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    node.synced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${node.synced ? "bg-emerald-500" : "bg-rose-500"}`} />
                  {node.synced ? "Synced" : "Offline"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Current canonical block" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-50 pb-2">
            <dt className="text-slate-500">Block number</dt>
            <dd className="font-semibold text-slate-800">{data.blockNumber ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Block hash</dt>
            <dd className="font-mono text-xs text-slate-600">{shortHash(data.blockHash)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Why this matters" />
        <p className="text-sm leading-relaxed text-slate-600">
          Distributed Ledger Technology (DLT) guarantees that every participant in a transaction — the testator, the
          legal authority, the executor, witnesses, and beneficiaries — can independently verify the exact same
          history of events, without needing to trust a single central party. In this prototype, all roles read from
          the same local Hardhat chain; the node cards above represent each role's perspective on that single shared
          ledger, which is the property a real multi-node DLT deployment provides at scale.
        </p>
      </Card>
    </div>
  );
}
