import { useEffect, useState } from "react";
import { Search, Blocks, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { BlockchainTx } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { TxDetailModal } from "@/components/TxDetailModal";
import { formatDate, shortAddress, shortHash } from "@/lib/format";

interface Status {
  reachable: boolean;
  deployed: boolean;
  blockNumber: number | null;
  chainId: string | null;
  network: string;
  contracts: Record<string, string> | null;
}

export default function BlockchainExplorerPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<BlockchainTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [statusRes, eventsRes] = await Promise.all([
        api.get<Status>("/blockchain/status"),
        api.get<{ events: BlockchainTx[] }>(query ? `/blockchain/events?txHash=${encodeURIComponent(query)}` : "/blockchain/events"),
      ]);
      setStatus(statusRes);
      setEvents(eventsRes.events);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !status) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <TxDetailModal txHash={selectedTx} onClose={() => setSelectedTx(null)} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Blockchain Explorer</h1>
        <p className="text-sm text-slate-500">Internal explorer over BlockWill's local Hardhat chain and smart contracts.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="flex items-center gap-3">
          <Activity size={20} className={status?.reachable ? "text-emerald-500" : "text-rose-500"} />
          <div>
            <p className="text-sm font-semibold">{status?.reachable ? "Chain reachable" : "Chain offline"}</p>
            <p className="text-xs text-slate-400">{status?.network}</p>
          </div>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-slate-900">{status?.blockNumber ?? "—"}</p>
          <p className="text-xs text-slate-500">Current block</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-slate-900">{status?.chainId ?? "—"}</p>
          <p className="text-xs text-slate-500">Chain ID</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-slate-900">{events.length}</p>
          <p className="text-xs text-slate-500">Recent transactions</p>
        </Card>
      </div>

      {status?.contracts && (
        <Card>
          <CardHeader title="Deployed contracts" />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(status.contracts).map(([name, addr]) => (
              <div key={name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <dt className="font-medium text-slate-600">{name}</dt>
                <dd className="font-mono text-xs text-slate-500">{addr}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card>
        <CardHeader title="Search" subtitle="By transaction hash, wallet address, or will ID" />
        <div className="flex gap-2">
          <input className="input" placeholder="0x… or will id" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary shrink-0" onClick={load}><Search size={15} /> Search</button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Transactions</h3>
        </div>
        {events.length === 0 ? (
          <div className="p-6"><EmptyState icon={<Blocks size={22} />} title="No transactions found" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2">Event</th>
                  <th className="px-5 py-2">Contract</th>
                  <th className="px-5 py-2">From</th>
                  <th className="px-5 py-2">Block</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2">Time</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{e.eventType.replace(/_/g, " ")}</td>
                    <td className="px-5 py-2.5 text-slate-500">{e.contractName}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{shortAddress(e.fromAddress)}</td>
                    <td className="px-5 py-2.5 text-slate-500">{e.blockNumber ?? "—"}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={e.status} /></td>
                    <td className="px-5 py-2.5 text-slate-400">{formatDate(e.createdAt)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setSelectedTx(e.txHash)}>
                        View Transaction
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
