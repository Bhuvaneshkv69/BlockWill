import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  PenTool,
  ShieldCheck,
  Scale,
  Blocks,
  Network,
  FolderLock,
  UserCog,
  Settings,
  PlaySquare,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/lib/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/wills", label: "Wills", icon: FileText },
  { to: "/beneficiaries", label: "Beneficiaries", icon: Users, roles: ["BENEFICIARY", "ADMIN"] },
  { to: "/executor", label: "Executor Console", icon: Briefcase, roles: ["EXECUTOR", "ADMIN"] },
  { to: "/witness", label: "Witness Requests", icon: PenTool, roles: ["WITNESS", "ADMIN"] },
  { to: "/verification", label: "Death Verification", icon: ShieldCheck, roles: ["AUTHORITY", "ADMIN"] },
  { to: "/disputes", label: "Disputes", icon: Scale },
  { to: "/documents", label: "Documents", icon: FolderLock },
  { to: "/blockchain", label: "Blockchain Explorer", icon: Blocks },
  { to: "/dlt-network", label: "DLT Network", icon: Network },
  { to: "/admin", label: "Admin", icon: UserCog, roles: ["ADMIN"] },
  { to: "/demo", label: "Demo Control Panel", icon: PlaySquare, roles: ["ADMIN"] },
  { to: "/settings", label: "Settings", icon: Settings },
];
