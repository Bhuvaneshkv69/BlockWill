import { useState } from "react";
import { Wallet, Link2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { LegalDisclaimer } from "@/components/Disclaimer";
import { ROLE_LABELS, shortAddress } from "@/lib/format";
import { hasInjectedProvider } from "@/lib/injectedProvider";

export default function SettingsPage() {
  const { user } = useAuth();
  const { address, connect, disconnect, connecting, switching, isCorrectNetwork, switchNetwork } = useWallet();
  const { push } = useToast();
  const [linking, setLinking] = useState(false);

  async function linkWallet() {
    if (!address) return;
    setLinking(true);
    try {
      await api.post("/users/wallet", { address, label: "MetaMask" });
      push("Wallet linked to your account.", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to link wallet", "error");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Your profile and wallet configuration.</p>
      </div>

      <Card>
        <CardHeader title="Profile" />
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><dt className="text-slate-500">Full name</dt><dd className="font-medium text-slate-800">{user?.fullName}</dd></div>
          <div><dt className="text-slate-500">Email</dt><dd className="font-medium text-slate-800">{user?.email}</dd></div>
          <div><dt className="text-slate-500">Role</dt><dd className="font-medium text-slate-800">{user && ROLE_LABELS[user.role]}</dd></div>
          <div><dt className="text-slate-500">Account type</dt><dd className="font-medium text-slate-800">{user?.isDemoAccount ? "Demo account" : "Standard account"}</dd></div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Wallet connection" subtitle="MetaMask (or another injected wallet)" />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-800">{address ? shortAddress(address, 6) : "Not connected"}</p>
              <p className="text-xs text-slate-400">Network: {isCorrectNetwork ? "Hardhat Local" : "Wrong network — please switch"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {address ? (
              <>
                {!isCorrectNetwork && (
                  <button className="btn-secondary text-xs" onClick={switchNetwork} disabled={switching}>
                    {switching ? "Switching…" : "Switch to Hardhat Local"}
                  </button>
                )}
                <button className="btn-secondary text-xs" onClick={linkWallet} disabled={linking}>
                  <Link2 size={14} /> {linking ? "Linking…" : "Link to account"}
                </button>
                <button className="btn-ghost text-xs" onClick={disconnect}>Disconnect</button>
              </>
            ) : (
              <button className="btn-primary text-xs" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect"}
              </button>
            )}
          </div>
        </div>

        {!hasInjectedProvider() && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No injected wallet was detected in this browser. Install the{" "}
            <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="font-medium underline">
              MetaMask extension
            </a>{" "}
            (modern <code className="font-mono">window.ethereum</code> or legacy{" "}
            <code className="font-mono">window.web3</code> builds are both supported) and reload this page before connecting.
          </p>
        )}

        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <p className="font-medium text-slate-600">Manual network setup (if "Switch to Hardhat Local" doesn't work):</p>
          <p className="mt-1">
            In MetaMask → Networks → Add network manually — Network name: <code className="font-mono">Hardhat Local</code>,
            RPC URL: <code className="font-mono">http://127.0.0.1:8545</code>, Chain ID: <code className="font-mono">31337</code>,
            Currency symbol: <code className="font-mono">ETH</code>. The local Hardhat node (<code className="font-mono">npm run blockchain</code>) must be running for MetaMask to reach it.
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          BlockWill's write actions are signed by your account's server-managed custodial wallet (see docs/security.md)
          so the full multi-role demo works without six simultaneous browser wallets. Connecting MetaMask here lets
          you inspect balances and network state directly, and is available for future non-demo deployments — it is
          not required to use any feature of the demo.
        </p>
      </Card>

      <LegalDisclaimer />
    </div>
  );
}
