import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { NAV_ITEMS } from "./nav";
import { ROLE_LABELS } from "@/lib/format";

export function Sidebar() {
  const { user } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ShieldCheck size={18} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">BlockWill</p>
          <p className="text-[11px] leading-tight text-slate-400">Academic Prototype</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
      )}
    </aside>
  );
}
