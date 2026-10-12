import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { bpsToPercent, shortAddress } from "@/lib/format";
import { Users } from "lucide-react";

interface BeneficiaryRow {
  id: string;
  willId: string;
  name: string;
  walletAddress: string;
  allocationPercent: number;
  distributionStatus: string;
  distributedAmount?: string | null;
  onChainBalance: string;
  will: { id: string; title: string; status: string; testator: { fullName: string } };
}

export default function BeneficiariesPage() {
  const [rows, setRows] = useState<BeneficiaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ beneficiaries: BeneficiaryRow[] }>("/beneficiaries").then((r) => setRows(r.beneficiaries)).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Beneficiaries</h1>
        <p className="text-sm text-slate-500">Wills where you have been named as a beneficiary, and your BWILL wallet balance.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title="No inheritance assigned yet" description="You'll see wills here once a testator names you as a beneficiary." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Will</th>
                  <th className="px-5 py-3">Testator</th>
                  <th className="px-5 py-3">Allocation</th>
                  <th className="px-5 py-3">Wallet</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">On-chain balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link to={`/wills/${r.willId}`} className="font-medium text-slate-800 hover:text-brand-600">{r.will.title}</Link>
                      <div className="mt-0.5"><StatusBadge status={r.will.status} /></div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.will.testator.fullName}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{r.allocationPercent}%</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{shortAddress(r.walletAddress)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.distributionStatus} /></td>
                    <td className="px-5 py-3 text-slate-700">{r.onChainBalance} BWILL</td>
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
