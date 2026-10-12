import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-center">
      <FileQuestion size={40} className="text-slate-300" />
      <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="btn-primary mt-2">Back to Dashboard</Link>
    </div>
  );
}
