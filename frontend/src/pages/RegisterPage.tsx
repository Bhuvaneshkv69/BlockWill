import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { UserRole } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/format";
import { LegalDisclaimer } from "@/components/Disclaimer";

const ROLES: UserRole[] = ["TESTATOR", "BENEFICIARY", "EXECUTOR", "WITNESS", "AUTHORITY"];

export default function RegisterPage() {
  const { register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "TESTATOR" as UserRole });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      push("Account created — a custodial demo wallet has been provisioned for you.", "success");
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <ShieldCheck size={20} />
          </div>
          <span className="text-lg font-bold text-slate-900">BlockWill</span>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Choose the role that best describes how you'll use BlockWill.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="mt-1 text-xs text-slate-400">Minimum 8 characters.</p>
            </div>
            <div>
              <label className="label">I am a…</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setForm({ ...form, role: r })}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      form.role === r ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
          </p>
        </div>

        <LegalDisclaimer compact className="mt-4" />
      </div>
    </div>
  );
}
