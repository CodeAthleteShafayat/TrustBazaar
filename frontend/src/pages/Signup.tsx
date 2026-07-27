import { useState } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { useAuth } from "../lib/auth";
import { apiClient } from "../lib/client";
import toast from "react-hot-toast";

function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;
  const nextPath = safeNext(fromState || searchParams.get("next"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.signup({ email, password, display_name: name });
      setSession(res.data.access_token || "", res.data.user);
      toast.success(`Welcome, ${res.data.user.display_name || name}! Your Trust Score starts at 0.`);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-4">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-amber-200/40 blur-3xl" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-md shadow-orange-500/30">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-stone-900">TrustBazaar</span>
          </Link>
        </div>

        <Card>
          <h2 className="text-2xl font-bold text-stone-900">Create your account</h2>
          <p className="mt-1 text-sm text-stone-500">
            {nextPath !== "/dashboard"
              ? "Create an account to continue where you left off."
              : "Start with a Trust Score of 0. Every deal moves it up or down."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters" required />
            <Button type="submit" loading={loading} className="w-full">Create account</Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-500">
            Already have an account?{" "}
            <Link to={`/login${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-medium text-orange-600 hover:text-orange-700">
              Sign in
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}