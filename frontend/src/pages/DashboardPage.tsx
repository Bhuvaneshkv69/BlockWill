import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { FileText, CheckCircle2, XCircle, Clock, Scale, Users, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Will } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LegalDisclaimer } from "@/components/Disclaimer";
import { formatDate, ROLE_LABELS } from "@/lib/format";

const COLORS = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#22c55e", "#f59e0b", "#ef4444", "#94a3b8"];

interface AdminStats {
  totalWills: number;
  activeWills: number;
  revokedWills: number;
  executedWills: number;
  pendingVerification: number;
  activeDisputes: number;
  totalBeneficiaries: number;
  totalUsers: number;
  willsByStatus: { status: string; count: number }[];
  assetsByType: { type: string; totalValue: number; count: number }[];
  recentWills: { id: string; title: string; status: string; createdAt: string; testator: { fullName: string } }[];
}

function StatCard({ label, value, icon: Icon, tint }: { label: string; value: number | string; icon: any; tint: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [wills, setWills] = useState<Will[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (user?.role === "ADMIN") {
          const res = await api.get<AdminStats>("/admin/stats");
          setAdminStats(res);
        }
        const willsRes = await api.get<{ wills: Will[] }>("/wills");
        setWills(willsRes.wills);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return <PageSpinner />;

  const counts = {
    total: wills.length,
    active: wills.filter((w) => w.status === "ACTIVE").length,
    revoked: wills.filter((w) => w.status === "REVOKED").length,
    executed: wills.filter((w) => w.status === "EXECUTED").length,
    pending: wills.filter((w) => w.status === "DEATH_VERIFICATION_PENDING").length,
    disputed: wills.filter((w) => w.status === "DISPUTED").length,
  };

  const statusChartData = (adminStats?.willsByStatus ?? Object.entries(
    wills.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.status]: (acc[w.status] ?? 0) + 1 }), {})
  ).map(([status, count]) => ({ status, count }))).filter((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Welcome back, {user?.fullName?.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500">{user && ROLE_LABELS[user.role]} overview</p>
        </div>
        {user?.role === "TESTATOR" && (
          <Link to="/wills/create" className="btn-primary">
            <Plus size={16} /> New Will
          </Link>
        )}
      </div>

      <LegalDisclaimer />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Wills" value={adminStats?.totalWills ?? counts.total} icon={FileText} tint="bg-brand-50 text-brand-600" />
        <StatCard label="Active Wills" value={adminStats?.activeWills ?? counts.active} icon={CheckCircle2} tint="bg-emerald-50 text-emerald-600" />
        <StatCard label="Revoked Wills" value={adminStats?.revokedWills ?? counts.revoked} icon={XCircle} tint="bg-slate-100 text-slate-500" />
        <StatCard label="Inheritance Executed" value={adminStats?.executedWills ?? counts.executed} icon={CheckCircle2} tint="bg-violet-50 text-violet-600" />
        <StatCard label="Pending Verification" value={adminStats?.pendingVerification ?? counts.pending} icon={Clock} tint="bg-amber-50 text-amber-600" />
        <StatCard label="Active Disputes" value={adminStats?.activeDisputes ?? counts.disputed} icon={Scale} tint="bg-rose-50 text-rose-600" />
        {adminStats && <StatCard label="Total Beneficiaries" value={adminStats.totalBeneficiaries} icon={Users} tint="bg-blue-50 text-blue-600" />}
        {adminStats && <StatCard label="Total Users" value={adminStats.totalUsers} icon={Users} tint="bg-indigo-50 text-indigo-600" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Wills by status" subtitle="Distribution across the inheritance lifecycle" />
          {statusChartData.length === 0 ? (
            <EmptyState title="No wills yet" description="Status breakdown will appear once wills exist." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusChartData} dataKey="count" nameKey="status" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={entry.status} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {adminStats && (
          <Card>
            <CardHeader title="Assets by category" subtitle="Estimated value across recorded assets" />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={adminStats.assetsByType}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="totalValue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {!adminStats && (
          <Card>
            <CardHeader title="Recent activity" subtitle="Your most recently updated wills" />
            {wills.length === 0 ? (
              <EmptyState title="No wills yet" description="Create your first digital will to get started." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {wills.slice(0, 6).map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link to={`/wills/${w.id}`} className="text-sm font-medium text-slate-800 hover:text-brand-600">
                        {w.title}
                      </Link>
                      <p className="text-xs text-slate-400">{formatDate(w.updatedAt)}</p>
                    </div>
                    <StatusBadge status={w.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {adminStats && (
        <Card>
          <CardHeader title="Recently created wills" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Title</th>
                  <th className="pb-2">Testator</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {adminStats.recentWills.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5">
                      <Link to={`/wills/${w.id}`} className="font-medium text-slate-800 hover:text-brand-600">{w.title}</Link>
                    </td>
                    <td className="py-2.5 text-slate-600">{w.testator.fullName}</td>
                    <td className="py-2.5"><StatusBadge status={w.status} /></td>
                    <td className="py-2.5 text-slate-500">{formatDate(w.createdAt)}</td>
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
