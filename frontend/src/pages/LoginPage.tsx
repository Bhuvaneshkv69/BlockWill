import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/format";
import { LegalDisclaimer } from "@/components/Disclaimer";

interface DemoAccount {
  email: string;
  role: string;
  label: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoPassword, setDemoPassword] = useState("");

  useEffect(() => {
    api
      .get<{ password: string; accounts: DemoAccount[] }>("/auth/demo-accounts")
      .then((res) => {
        setDemoAccounts(res.accounts);
        setDemoPassword(res.password);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loginAsDemo(demoEmail: string) {
    setLoading(true);
    try {
      await login(demoEmail, demoPassword);
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Demo login failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <ShieldCheck size={20} />
          </div>
          <span className="text-lg font-bold">BlockWill</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">Blockchain-Based Digital Will & Inheritance Management</h1>
          <p className="mt-4 max-w-md text-brand-100">
            A working prototype demonstrating smart-contract inheritance execution, cryptographic document integrity,
            role-based access control, and an immutable audit trail — built for a final-year Blockchain Technology
            project.
          </p>
        </div>
        <p className="text-xs text-brand-200">© {new Date().getFullYear()} BlockWill — Academic Prototype</p>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Access your BlockWill account.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            No account? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create one</Link>
          </p>

          {demoAccounts.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Demo accounts</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => loginAsDemo(acc.email)}
                    disabled={loading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs hover:border-brand-300 hover:bg-brand-50"
                  >
                    <p className="font-medium text-slate-800">{acc.label}</p>
                    <p className="text-slate-400">{ROLE_LABELS[acc.role] ?? acc.role}</p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">Demo password: {demoPassword}</p>
            </div>
          )}

          <LegalDisclaimer compact className="mt-8" />
        </div>
      </div>
    </div>
  );
}
