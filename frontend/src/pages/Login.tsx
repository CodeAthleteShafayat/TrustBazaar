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

export function Login() {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "otp">("form");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;
  const nextPath = safeNext(fromState || searchParams.get("next"));
  const { setSession } = useAuth();

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.login({ email, password });
      setSession(res.data.access_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.display_name || res.data.user.email}`);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.requestOtp(email);
      if (res.debug_code) toast.success(`Dev OTP: ${res.debug_code}`);
      else toast.success("OTP sent to your email");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.verifyOtp({ email, code });
      setSession(res.data.access_token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.display_name || res.data.user.email}`);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbf7f2] p-4">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-rose-200/40 blur-3xl" />
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
          <h2 className="text-2xl font-bold text-stone-900">Sign in</h2>
          <p className="mt-1 text-sm text-stone-500">
            {mode === "password" ? "Use your email and password." : "We'll send a one-time code."}
          </p>

          <div className="mt-4 flex gap-2 rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              onClick={() => { setMode("password"); setStep("form"); }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "password"
                  ? "bg-white shadow-sm text-stone-900 border border-stone-200"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => { setMode("otp"); setStep("form"); }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "otp"
                  ? "bg-white shadow-sm text-stone-900 border border-stone-200"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              OTP
            </button>
          </div>

          {step === "form" ? (
            <form onSubmit={mode === "password" ? submitPassword : requestOtp} className="mt-6 space-y-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              {mode === "password" && (
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              )}
              <Button type="submit" loading={loading} className="w-full">
                {mode === "password" ? "Sign in" : "Send code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="mt-6 space-y-4">
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-stone-700">
                Code sent to <span className="font-medium text-stone-900">{email}</span>
                <br />
                <span className="text-orange-700">Demo code: 123456</span>
              </div>
              <Input label="Verification code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" required inputMode="numeric" />
              <Button type="submit" loading={loading} className="w-full">Verify and sign in</Button>
              <button type="button" onClick={() => setStep("form")} className="block w-full text-center text-xs text-stone-500 hover:text-stone-900">
                ← Use a different email
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-stone-500">
            New here?{" "}
            <Link to="/signup" className="font-medium text-orange-600 hover:text-orange-700">Create an account</Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}