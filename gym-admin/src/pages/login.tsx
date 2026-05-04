import { useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Eye, EyeOff, ArrowLeft, CheckCircle2, ClipboardPaste } from "lucide-react";

type Step =
  | "login"
  | "signup-form" | "signup-otp" | "signup-success"
  | "forgot-email" | "forgot-otp" | "forgot-success";

async function apiFetch(path: string, body: object) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { }
  if (!res.ok) throw new Error((data.message as string) || "Something went wrong");
  return data;
}

const OTP_LEN = 6;

export default function Login() {
  const { login } = useAuth();

  // ── Login ──────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── Signup ─────────────────────────────────────────────────────────────────
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suRole, setSuRole] = useState("staff");
  const [showSuPassword, setShowSuPassword] = useState(false);
  const [suSuccess, setSuSuccess] = useState<{ name: string; email: string; role: string } | null>(null);

  // ── Forgot ─────────────────────────────────────────────────────────────────
  const [fpEmail, setFpEmail] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [showFpPassword, setShowFpPassword] = useState(false);

  // ── OTP (shared for signup & forgot) ──────────────────────────────────────
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LEN).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clearError = () => setError("");
  const resetOtp = () => setOtpDigits(Array(OTP_LEN).fill(""));
  const getOtp = () => otpDigits.join("");

  const startCooldown = () => {
    setResendCooldown(60);
    const iv = setInterval(() => setResendCooldown(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; }), 1000);
  };

  // ── OTP box handlers ────────────────────────────────────────────────────────
  const handleOtpChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits]; next[idx] = digit; setOtpDigits(next);
    if (digit && idx < OTP_LEN - 1) otpRefs.current[idx + 1]?.focus();
  };
  const handleOtpKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Email and password are required"); return; }
    setError(""); setLoading(true);
    try { await login(email, password); }
    catch (err: any) { setError(err.message || "Invalid credentials"); }
    finally { setLoading(false); }
  };

  // ── Signup step 1: send OTP ────────────────────────────────────────────────
  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suName || !suEmail || !suPassword || !suConfirm) { setError("All fields are required"); return; }
    if (!/\S+@\S+\.\S+/.test(suEmail)) { setError("Invalid email address"); return; }
    if (suPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (suPassword !== suConfirm) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/admin/auth/send-signup-otp", { name: suName, email: suEmail, password: suPassword, role: suRole });
      resetOtp(); setStep("signup-otp"); startCooldown();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Signup step 2: verify OTP → create account ─────────────────────────────
  const handleVerifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getOtp().length < OTP_LEN) { setError("Enter all 6 digits"); return; }
    setError(""); setLoading(true);
    try {
      const data = await apiFetch("/api/admin/auth/register", { email: suEmail, otp: getOtp() });
      const u = (data as any).user;
      setSuSuccess({ name: u?.name || suName, email: u?.email || suEmail, role: u?.role || suRole });
      setStep("signup-success");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleResendSignupOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true); setError("");
    try {
      await apiFetch("/api/admin/auth/send-signup-otp", { name: suName, email: suEmail, password: suPassword });
      resetOtp(); otpRefs.current[0]?.focus(); startCooldown();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Forgot step 1: send OTP ───────────────────────────────────────────────
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpEmail) { setError("Email is required"); return; }
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/admin/auth/forgot-password", { email: fpEmail });
      resetOtp(); setStep("forgot-otp");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Forgot step 2: reset password ─────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getOtp().length < OTP_LEN) { setError("Enter all 6 digits"); return; }
    if (!fpNewPassword) { setError("Enter a new password"); return; }
    if (fpNewPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (fpNewPassword !== fpConfirm) { setError("Passwords do not match"); return; }
    setError(""); setLoading(true);
    try {
      await apiFetch("/api/admin/auth/reset-password", { email: fpEmail, otp: getOtp(), newPassword: fpNewPassword });
      setStep("forgot-success");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Shared components ──────────────────────────────────────────────────────
  const Logo = () => (
    <div className="flex flex-col items-center gap-3">
      <img src="/images/logo.png" alt="Core X" className="h-24 w-24 object-contain" />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">Core X</h1>
        <p className="text-sm text-muted-foreground">Gym Management System</p>
      </div>
    </div>
  );

  const ErrorBox = () => error ? (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
      {error}
    </div>
  ) : null;

  const BackBtn = ({ to }: { to: Step }) => (
    <button type="button" onClick={() => { setStep(to); clearError(); }}
      className="text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="h-4 w-4" />
    </button>
  );

  const OtpBoxes = () => (
    <div className="flex gap-2 justify-center">
      {otpDigits.map((d, i) => (
        <input
          key={i}
          ref={r => { otpRefs.current[i] = r; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleOtpChange(e.target.value, i)}
          onKeyDown={e => handleOtpKey(e, i)}
          autoFocus={i === 0}
          className={`w-11 h-14 rounded-xl border-2 text-center text-xl font-bold bg-background text-foreground outline-none transition-colors
            ${d ? "border-primary" : "border-input"} focus:border-primary`}
        />
      ))}
    </div>
  );

  const handlePasteOtp = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, "").slice(0, OTP_LEN).split("");
      if (digits.length > 0) {
        const filled = [...Array(OTP_LEN)].map((_, i) => digits[i] || "");
        setOtpDigits(filled);
        const lastFilled = Math.min(digits.length, OTP_LEN) - 1;
        otpRefs.current[lastFilled]?.focus();
      }
    } catch {
      setError("Could not read clipboard. Please paste manually.");
    }
  };

  const ResendRow = ({ onResend }: { onResend: () => void }) => (
    <p className="text-center text-xs text-muted-foreground">
      Didn't receive it?{" "}
      <button type="button" onClick={onResend} disabled={resendCooldown > 0 || loading}
        className={`font-semibold ${resendCooldown > 0 ? "text-muted-foreground" : "text-primary hover:underline"}`}>
        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
      </button>
    </p>
  );

  return (
    <div className="min-h-screen bg-[#05070a] relative flex items-center justify-center p-4 overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        <Logo />

        {/* ════════════════ LOGIN ════════════════ */}
        {step === "login" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl">Sign In</CardTitle>
              <CardDescription>Enter your credentials to access the admin panel</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="you@example.com"
                    value={email} onChange={e => { setEmail(e.target.value); clearError(); }}
                    autoFocus autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => { setFpEmail(email); setStep("forgot-email"); clearError(); }}
                      className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                      value={password} onChange={e => { setPassword(e.target.value); clearError(); }}
                      autoComplete="current-password" className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <ErrorBox />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="mt-5 pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button type="button"
                    onClick={() => { setStep("signup-form"); clearError(); setSuName(""); setSuEmail(""); setSuPassword(""); setSuConfirm(""); setSuRole("staff"); }}
                    className="text-primary font-semibold hover:underline">
                    Create Account
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ SIGNUP — FORM ════════════════ */}
        {step === "signup-form" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <BackBtn to="login" />
                <CardTitle className="text-xl">Create Account</CardTitle>
              </div>
              <CardDescription>Register a new GymAdmin account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendSignupOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Full Name</Label>
                  <Input id="su-name" placeholder="e.g. Ahmed Khan" value={suName}
                    onChange={e => { setSuName(e.target.value); clearError(); }} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email Address</Label>
                  <Input id="su-email" type="email" placeholder="you@example.com" value={suEmail}
                    onChange={e => { setSuEmail(e.target.value); clearError(); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Password</Label>
                  <div className="relative">
                    <Input id="su-password" type={showSuPassword ? "text" : "password"}
                      placeholder="Min. 6 characters" value={suPassword}
                      onChange={e => { setSuPassword(e.target.value); clearError(); }} className="pr-10" />
                    <button type="button" onClick={() => setShowSuPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSuPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-confirm">Confirm Password</Label>
                  <Input id="su-confirm" type="password" placeholder="Re-enter password" value={suConfirm}
                    onChange={e => { setSuConfirm(e.target.value); clearError(); }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-role">Role</Label>
                  <Select value={suRole} onValueChange={val => { setSuRole(val); clearError(); }}>
                    <SelectTrigger id="su-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff (Limited Access)</SelectItem>
                      <SelectItem value="admin">Admin (Full Access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ErrorBox />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending OTP..." : "Send Verification Code"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ SIGNUP — OTP ════════════════ */}
        {step === "signup-otp" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <BackBtn to="signup-form" />
                <CardTitle className="text-xl">Verify Email</CardTitle>
              </div>
              <CardDescription>
                A 6-digit code was sent to <strong>{suEmail}</strong>. Expires in 10 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifySignup} className="space-y-5">
                <OtpBoxes />
                <button type="button" onClick={handlePasteOtp}
                  className="flex items-center gap-1.5 mx-auto text-xs text-primary hover:underline">
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste Code from Clipboard
                </button>
                <ErrorBox />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Verify & Create Account"}
                </Button>
                <ResendRow onResend={handleResendSignupOtp} />
              </form>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ SIGNUP — SUCCESS ════════════════ */}
        {step === "signup-success" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Account Created!</h2>
                <p className="text-sm text-muted-foreground">
                  Welcome, <strong>{suSuccess?.name}</strong>. You can now sign in with your credentials.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  Role: {suSuccess?.role === "admin" ? "Admin (Full Access)" : "Staff (Limited Access)"}
                </div>
              </div>
              <Button className="w-full mt-2" onClick={() => {
                setEmail(suSuccess?.email || ""); setStep("login"); clearError();
              }}>
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ FORGOT — EMAIL ════════════════ */}
        {step === "forgot-email" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <BackBtn to="login" />
                <CardTitle className="text-xl">Forgot Password</CardTitle>
              </div>
              <CardDescription>Enter your email to receive a reset code.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email Address</Label>
                  <Input id="fp-email" type="email" placeholder="you@example.com"
                    value={fpEmail} onChange={e => { setFpEmail(e.target.value); clearError(); }} autoFocus />
                </div>
                <ErrorBox />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ FORGOT — OTP + NEW PASSWORD ════════════════ */}
        {step === "forgot-otp" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <BackBtn to="forgot-email" />
                <CardTitle className="text-xl">Reset Password</CardTitle>
              </div>
              <CardDescription>
                Code sent to <strong>{fpEmail}</strong>. Enter it below with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <OtpBoxes />
                <button type="button" onClick={handlePasteOtp}
                  className="flex items-center gap-1.5 mx-auto text-xs text-primary hover:underline">
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste Code from Clipboard
                </button>
                <div className="space-y-2">
                  <Label htmlFor="fp-new">New Password</Label>
                  <div className="relative">
                    <Input id="fp-new" type={showFpPassword ? "text" : "password"}
                      placeholder="Min. 6 characters" value={fpNewPassword}
                      onChange={e => { setFpNewPassword(e.target.value); clearError(); }} className="pr-10" />
                    <button type="button" onClick={() => setShowFpPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showFpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirm">Confirm Password</Label>
                  <Input id="fp-confirm" type="password" placeholder="Re-enter password"
                    value={fpConfirm} onChange={e => { setFpConfirm(e.target.value); clearError(); }} />
                </div>
                <ErrorBox />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
                <ResendRow onResend={async () => {
                  setLoading(true); setError("");
                  try { await apiFetch("/api/admin/auth/forgot-password", { email: fpEmail }); resetOtp(); otpRefs.current[0]?.focus(); }
                  catch (err: any) { setError(err.message); }
                  finally { setLoading(false); }
                }} />
              </form>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ FORGOT — SUCCESS ════════════════ */}
        {step === "forgot-success" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <div>
                <h2 className="text-xl font-bold">Password Reset!</h2>
                <p className="text-sm text-muted-foreground mt-1">Your password has been updated. You can now sign in.</p>
              </div>
              <Button className="w-full mt-2" onClick={() => {
                setStep("login"); setFpEmail(""); setFpNewPassword(""); setFpConfirm(""); resetOtp(); clearError();
              }}>
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
