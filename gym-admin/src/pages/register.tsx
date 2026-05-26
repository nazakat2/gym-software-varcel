import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2, Building2, User, Mail, Lock, Phone, MapPin, ClipboardPaste } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "form" | "otp" | "success";

const OTP_LEN = 6;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form state
  const [gymName, setGymName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [successData, setSuccessData] = useState<any>(null);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LEN).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email availability check
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [ownerEmailAvailable, setOwnerEmailAvailable] = useState<boolean | null>(null);

  const clearError = () => setError("");
  const resetOtp = () => setOtpDigits(Array(OTP_LEN).fill(""));
  const getOtp = () => otpDigits.join("");

  const startCooldown = () => {
    setResendCooldown(60);
    const iv = setInterval(() => {
      setResendCooldown((p) => {
        if (p <= 1) {
          clearInterval(iv);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  };

  // OTP box handlers
  const handleOtpChange = (val: string, idx: number) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    if (digit && idx < OTP_LEN - 1) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

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

  // Check email availability
  const checkEmailAvailability = async (gymEmail: string, ownerEmailVal: string) => {
    if (!gymEmail && !ownerEmailVal) return;

    setEmailChecking(true);
    try {
      const res = await fetch("/api/onboarding/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymEmail: gymEmail || undefined,
          ownerEmail: ownerEmailVal || undefined,
        }),
      });
      const data = await res.json();

      if (gymEmail) setEmailAvailable(data.gymEmailAvailable);
      if (ownerEmailVal) setOwnerEmailAvailable(data.ownerEmailAvailable);
    } catch (err) {
      console.error("Email check failed:", err);
    } finally {
      setEmailChecking(false);
    }
  };

  // Handle gym email blur
  const handleGymEmailBlur = () => {
    if (email && /\S+@\S+\.\S+/.test(email)) {
      checkEmailAvailability(email, "");
    }
  };

  // Handle owner email blur
  const handleOwnerEmailBlur = () => {
    if (ownerEmail && /\S+@\S+\.\S+/.test(ownerEmail)) {
      checkEmailAvailability("", ownerEmail);
    }
  };

  // Form validation
  const validateForm = () => {
    if (!gymName || gymName.length < 2) {
      setError("Gym name must be at least 2 characters");
      return false;
    }
    if (!address || address.length < 5) {
      setError("Please enter a valid address");
      return false;
    }
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return false;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid gym email");
      return false;
    }
    if (emailAvailable === false) {
      setError("This gym email is already registered");
      return false;
    }
    if (!ownerName || ownerName.length < 2) {
      setError("Owner name must be at least 2 characters");
      return false;
    }
    if (!ownerEmail || !/\S+@\S+\.\S+/.test(ownerEmail)) {
      setError("Please enter a valid owner email");
      return false;
    }
    if (ownerEmailAvailable === false) {
      setError("This owner email is already registered");
      return false;
    }
    if (!ownerPassword || ownerPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (ownerPassword !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  // Handle registration - Step 1: Send OTP
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymName,
          address,
          phone,
          email: email.toLowerCase().trim(),
          city: city || undefined,
          ownerName,
          ownerEmail: ownerEmail.toLowerCase().trim(),
          ownerPassword,
          currency: "PKR",
          timezone: "Asia/Karachi",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to send OTP");
      }

      // Move to OTP step
      setStep("otp");
      resetOtp();
      startCooldown();

      toast({
        title: "OTP Sent!",
        description: "Please check your email for the verification code.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
      toast({
        title: "Failed to Send OTP",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP verification - Step 2: Verify and complete registration
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (getOtp().length < OTP_LEN) {
      setError("Please enter all 6 digits");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: ownerEmail.toLowerCase().trim(),
          otp: getOtp(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Invalid OTP");
      }

      // Store JWT token
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      // Show success
      setSuccessData(data);
      setStep("success");

      toast({
        title: "Registration Successful!",
        description: "Your 14-day free trial has started.",
      });

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP. Please try again.");
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymName,
          address,
          phone,
          email: email.toLowerCase().trim(),
          city: city || undefined,
          ownerName,
          ownerEmail: ownerEmail.toLowerCase().trim(),
          ownerPassword,
          currency: "PKR",
          timezone: "Asia/Karachi",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to resend OTP");
      }

      resetOtp();
      otpRefs.current[0]?.focus();
      startCooldown();

      toast({
        title: "OTP Resent",
        description: "A new code has been sent to your email.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  const Logo = () => (
    <div className="flex flex-col items-center gap-3">
      <img src="/images/logo.png" alt="Core X" className="h-24 w-24 object-contain" />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-muted-foreground">Core X</h1>
        <p className="text-sm text-muted-foreground">Gym Management System</p>
      </div>
    </div>
  );

  const ErrorBox = () =>
    error ? (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[#05070a] relative flex items-center justify-center p-4 overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        <Logo />

        {/* ════════════════ REGISTRATION FORM ════════════════ */}
        {step === "form" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
              <CardDescription>
                Register your gym and get 14 days of free access to all features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-6">
                {/* Gym Details Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Building2 className="h-4 w-4" />
                    <span>Gym Details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="gymName">Gym Name *</Label>
                      <Input
                        id="gymName"
                        placeholder="e.g. Elite Fitness Center"
                        value={gymName}
                        onChange={(e) => {
                          setGymName(e.target.value);
                          clearError();
                        }}
                        autoFocus
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Address *</Label>
                      <Input
                        id="address"
                        placeholder="e.g. 123 Main Street, Block A"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          clearError();
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+923001234567"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            clearError();
                          }}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="city"
                          placeholder="e.g. Karachi"
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            clearError();
                          }}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email">Gym Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="info@yourgym.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailAvailable(null);
                            clearError();
                          }}
                          onBlur={handleGymEmailBlur}
                          className="pl-10"
                        />
                      </div>
                      {emailChecking && email && (
                        <p className="text-xs text-muted-foreground">Checking availability...</p>
                      )}
                      {emailAvailable === false && (
                        <p className="text-xs text-destructive">This email is already registered</p>
                      )}
                      {emailAvailable === true && (
                        <p className="text-xs text-green-500">Email is available</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Owner Details Section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <User className="h-4 w-4" />
                    <span>Owner Details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="ownerName">Owner Name *</Label>
                      <Input
                        id="ownerName"
                        placeholder="e.g. Sarim "
                        value={ownerName}
                        onChange={(e) => {
                          setOwnerName(e.target.value);
                          clearError();
                        }}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="ownerEmail">Owner Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="ownerEmail"
                          type="email"
                          placeholder="owner@example.com"
                          value={ownerEmail}
                          onChange={(e) => {
                            setOwnerEmail(e.target.value);
                            setOwnerEmailAvailable(null);
                            clearError();
                          }}
                          onBlur={handleOwnerEmailBlur}
                          className="pl-10"
                        />
                      </div>
                      {emailChecking && ownerEmail && (
                        <p className="text-xs text-muted-foreground">Checking availability...</p>
                      )}
                      {ownerEmailAvailable === false && (
                        <p className="text-xs text-destructive">This email is already registered</p>
                      )}
                      {ownerEmailAvailable === true && (
                        <p className="text-xs text-green-500">Email is available</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownerPassword">Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="ownerPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={ownerPassword}
                          onChange={(e) => {
                            setOwnerPassword(e.target.value);
                            clearError();
                          }}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            clearError();
                          }}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <ErrorBox />

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Creating your account..." : "Start Free 14-Day Trial"}
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                  By registering, you agree to our Terms of Service and Privacy Policy
                </div>
              </form>

              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ OTP VERIFICATION ════════════════ */}
        {step === "otp" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl">Verify Your Email</CardTitle>
              <CardDescription>
                We've sent a 6-digit code to <strong>{ownerEmail}</strong>
                <br />
                Code expires in 10 minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {/* OTP Input Boxes */}
                <div className="flex gap-2 justify-center">
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(r) => {
                        otpRefs.current[i] = r;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleOtpChange(e.target.value, i)}
                      onKeyDown={(e) => handleOtpKey(e, i)}
                      autoFocus={i === 0}
                      className={`w-11 h-14 rounded-xl border-2 text-center text-xl font-bold bg-background text-foreground outline-none transition-colors
                        ${d ? "border-primary" : "border-input"} focus:border-primary`}
                    />
                  ))}
                </div>

                {/* Paste from Clipboard */}
                <button
                  type="button"
                  onClick={handlePasteOtp}
                  className="flex items-center gap-1.5 mx-auto text-xs text-primary hover:underline"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste Code from Clipboard
                </button>

                <ErrorBox />

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Complete Registration"}
                </Button>

                {/* Resend OTP */}
                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive it?{" "}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || loading}
                    className={`font-semibold ${
                      resendCooldown > 0 ? "text-muted-foreground" : "text-primary hover:underline"
                    }`}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </p>

                {/* Back to form */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      resetOtp();
                      clearError();
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Back to registration form
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ════════════════ SUCCESS ════════════════ */}
        {step === "success" && (
          <Card className="glass glass-dark border-primary/20 shadow-2xl">
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Welcome to Core X!</h2>
                <p className="text-sm text-muted-foreground">
                  Your gym <strong>{successData?.gym?.name}</strong> has been registered successfully.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-primary/10 text-primary mt-2">
                  🎉 14-Day Free Trial Started
                </div>
              </div>
              <div className="w-full max-w-sm space-y-2 text-left bg-muted/20 rounded-lg p-4 mt-2">
                <p className="text-xs text-muted-foreground">Your Account Details:</p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <strong>{successData?.owner?.email}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Role:</span>{" "}
                    <strong>Gym Owner (Full Access)</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Trial Ends:</span>{" "}
                    <strong>
                      {successData?.gym?.trialEndsAt
                        ? new Date(successData.gym.trialEndsAt).toLocaleDateString()
                        : "14 days"}
                    </strong>
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Redirecting to dashboard...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
