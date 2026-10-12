import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { Will } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, bpsToPercent } from "@/lib/format";

export default function WillsListPage() {
  const { user } = useAuth();
  const [wills, setWills] = useState<Will[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ wills: Will[] }>("/wills").then((res) => setWills(res.wills)).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Wills</h1>
          <p className="text-sm text-slate-500">
            {user?.role === "TESTATOR" ? "Wills you have created." : "Wills relevant to your role."}
          </p>
        </div>
        {user?.role === "TESTATOR" && (
          <Link to="/wills/create" className="btn-primary">
            <Plus size={16} /> New Will
          </Link>
        )}
      </div>

      {wills.length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="No wills found"
          description={user?.role === "TESTATOR" ? "Create your first digital will using the wizard." : "Nothing assigned to you yet."}
          action={
            user?.role === "TESTATOR" && (
              <Link to="/wills/create" className="btn-primary">
                <Plus size={16} /> Create Will
              </Link>
            )
          }
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Testator</th>
                  <th className="px-5 py-3">Beneficiaries</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {wills.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link to={`/wills/${w.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                        {w.title}
                      </Link>
                      <p className="text-xs text-slate-400">v{w.version}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{w.testator?.fullName ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {w.beneficiaries?.length
                        ? w.beneficiaries.map((b) => `${b.name} (${bpsToPercent(b.allocationBps)})`).join(", ")
                        : "—"}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(w.updatedAt)}</td>
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
