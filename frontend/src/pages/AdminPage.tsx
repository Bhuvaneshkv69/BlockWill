import { useEffect, useState } from "react";
import clsx from "clsx";
import { Activity, Users as UsersIcon, FileClock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { formatDate, ROLE_LABELS } from "@/lib/format";

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: string;
  wallets: { address: string }[];
}
interface AuditRow {
  id: string;
  action: string;
  actor?: { fullName: string; role: string } | null;
  will?: { title: string } | null;
  createdAt: string;
  txHash?: string | null;
}
interface ContractsStatus {
  reachable: boolean;
  deployed: boolean;
  contracts: Record<string, string> | null;
  network: string | null;
}

type Tab = "overview" | "users" | "contracts" | "audit";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [contracts, setContracts] = useState<ContractsStatus | null>(null);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ users: AdminUser[] }>("/admin/users"),
      api.get<ContractsStatus>("/admin/contracts"),
      api.get<{ logs: AuditRow[] }>("/admin/audit-logs?limit=100"),
    ])
      .then(([u, c, l]) => {
        setUsers(u.users);
        setContracts(c);
        setLogs(l.logs);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Administration</h1>
        <p className="text-sm text-slate-500">System-wide user management, contract status, and audit logs. Administrators cannot modify blockchain records.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["overview", "users", "contracts", "audit"] as Tab[]).map((t) => (
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

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-3"><UsersIcon className="text-brand-600" /><div><p className="text-2xl font-bold">{users.length}</p><p className="text-xs text-slate-500">Total users</p></div></Card>
          <Card className="flex items-center gap-3"><Activity className={contracts?.reachable ? "text-emerald-500" : "text-rose-500"} /><div><p className="text-2xl font-bold">{contracts?.reachable ? "Online" : "Offline"}</p><p className="text-xs text-slate-500">Blockchain status</p></div></Card>
          <Card className="flex items-center gap-3"><FileClock className="text-violet-600" /><div><p className="text-2xl font-bold">{logs.length}</p><p className="text-xs text-slate-500">Recent audit entries</p></div></Card>
        </div>
      )}

      {tab === "users" && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Wallet</th><th className="px-5 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{u.fullName} {u.isDemoAccount && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">DEMO</span>}</td>
                    <td className="px-5 py-2.5 text-slate-600">{u.email}</td>
                    <td className="px-5 py-2.5 text-slate-600">{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{u.wallets[0]?.address?.slice(0, 10)}…</td>
                    <td className="px-5 py-2.5 text-slate-400">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "contracts" && (
        <Card>
          <CardHeader title="Smart contract deployment" subtitle="Live on-chain contract addresses" />
          <p className="mb-3 text-sm text-slate-500">Network: {contracts?.network ?? "—"} · Status: {contracts?.reachable ? "Reachable" : "Unreachable"}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {contracts?.contracts &&
              Object.entries(contracts.contracts).map(([name, addr]) => (
                <div key={name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <dt className="font-medium text-slate-600">{name}</dt>
                  <dd className="font-mono text-xs text-slate-500">{addr}</dd>
                </div>
              ))}
          </dl>
        </Card>
      )}

      {tab === "audit" && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Action</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Will</th><th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-2.5 font-medium text-slate-800">{l.action.replace(/_/g, " ")}</td>
                    <td className="px-5 py-2.5 text-slate-600">{l.actor ? `${l.actor.fullName} (${l.actor.role})` : "System"}</td>
                    <td className="px-5 py-2.5 text-slate-600">{l.will?.title ?? "—"}</td>
                    <td className="px-5 py-2.5 text-slate-400">{formatDate(l.createdAt)}</td>
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
