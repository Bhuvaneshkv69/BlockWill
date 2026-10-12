import { useEffect, useState } from "react";
import { Bell, LogOut, Wallet, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { api } from "@/lib/api";
import { Notification } from "@/lib/types";
import { shortAddress, formatDate } from "@/lib/format";

export function Topbar() {
  const { user, logout } = useAuth();
  const { address, connect, disconnect, connecting, switching, isCorrectNetwork, switchNetwork } = useWallet();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = () => api.get<{ notifications: Notification[] }>("/notifications").then((r) => setNotifications(r.notifications)).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="text-sm text-slate-500 md:hidden">
        <span className="font-bold text-slate-900">BlockWill</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        {address && !isCorrectNetwork && (
          <button
            onClick={switchNetwork}
            disabled={switching}
            className="hidden items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 md:flex"
          >
            <AlertTriangle size={13} /> {switching ? "Switching…" : "Wrong network — switch"}
          </button>
        )}

        {address ? (
          <button onClick={disconnect} className="btn-secondary text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {shortAddress(address)}
          </button>
        ) : (
          <button onClick={connect} disabled={connecting} className="btn-secondary text-xs">
            <Wallet size={14} /> {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowNotifs((s) => !s)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs font-medium text-brand-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>}
                {notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`border-b border-slate-50 px-4 py-3 last:border-0 ${!n.read ? "bg-brand-50/40" : ""}`}>
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title="Log out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
