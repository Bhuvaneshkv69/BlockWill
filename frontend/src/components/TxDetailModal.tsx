import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { BlockchainTx } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function TxDetailModal({ txHash, onClose }: { txHash: string | null; onClose: () => void }) {
  const [record, setRecord] = useState<BlockchainTx | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!txHash) return;
    setLoading(true);
    api
      .get<{ record: BlockchainTx | null }>(`/blockchain/tx/${txHash}`)
      .then((r) => setRecord(r.record))
      .finally(() => setLoading(false));
  }, [txHash]);

  return (
    <Modal open={!!txHash} onClose={onClose} title="Transaction Detail">
      {loading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {!loading && record && (
        <dl className="space-y-3 text-sm">
          <Row label="Transaction hash" value={<span className="break-all font-mono text-xs">{record.txHash}</span>} />
          <Row label="Event" value={record.eventType.replace(/_/g, " ")} />
          <Row label="Contract" value={record.contractName} />
          <Row label="From" value={<span className="break-all font-mono text-xs">{record.fromAddress}</span>} />
          {record.toAddress && <Row label="To" value={<span className="break-all font-mono text-xs">{record.toAddress}</span>} />}
          <Row label="Status" value={record.status} />
          <Row label="Block" value={record.blockNumber ?? "pending"} />
          <Row label="Gas used" value={record.gasUsed ?? "—"} />
          <Row label="Timestamp" value={formatDate(record.createdAt)} />
        </dl>
      )}
      {!loading && !record && <p className="py-4 text-center text-sm text-slate-500">Transaction not found.</p>}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 pb-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}
