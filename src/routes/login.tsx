import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export const Route = createFileRoute("/login")({ component: Login });

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

function Login() {
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSetupPassword(params.get("setupPassword") === "1");
    const reason = params.get("authError");
    const messages: Record<string, string> = {
      setup: "Google login is not configured yet. Check the server environment variables.",
      domain: "Use a verified @miraclecloud-technology.com Google account.",
      denied: "Google sign-in was cancelled.",
      failed: "Google sign-in failed. Please try again.",
    };
    if (reason) setAuthError(messages[reason] ?? messages.failed ?? "Google sign-in failed.");
  }, []);

  useEffect(() => {
    if (isAuthenticated && !setupPassword) navigate({ to: "/" });
  }, [isAuthenticated, navigate, setupPassword]);

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setAuthError(await responseError(response, "Invalid email or password."));
        return;
      }
      window.location.assign("/");
    } catch {
      setAuthError("Password login is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/password/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password: newPassword, confirmPassword }),
      });
      if (!response.ok) {
        setAuthError(await responseError(response, "Could not save the password."));
        return;
      }
      window.location.assign("/");
    } catch {
      setAuthError("Could not save the password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPasswordSetup = setupPassword && isAuthenticated;
  const showGoogleVerification = setupPassword && !isAuthenticated && !isLoading;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">Ecommerce 360 Login</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          {showPasswordSetup ? "Create your dashboard password" : "Sign in with your company account"}
        </p>
      </div>

      <div className="mx-auto mt-8 w-full max-w-md rounded-2xl border border-slate-100 bg-white px-6 py-8 shadow-xl shadow-slate-200/50 sm:px-10">
        {authError ? <p role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{authError}</p> : null}

        {showPasswordSetup ? (
          <form className="space-y-4" onSubmit={handleSetPassword}>
            <p className="text-sm text-slate-600">Set a separate dashboard password for this verified company account. Use at least 12 characters.</p>
            <label className="block text-sm font-medium text-slate-700">
              New dashboard password
              <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Confirm password
              <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {isSubmitting ? "Saving password…" : "Save dashboard password"}
              {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </form>
        ) : showGoogleVerification ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Verify your company Google account before creating a dashboard password.</p>
            <button type="button" onClick={() => login("set-password")} className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
              <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>
              Verify with Google
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <button type="button" onClick={() => login()} className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary">
              <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>
              Continue with Google
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div>

            <form className="space-y-4" onSubmit={handlePasswordLogin}>
              <label className="block text-sm font-medium text-slate-700">
                Company email
                <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@miraclecloud-technology.com" className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Dashboard password
                <input type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {isSubmitting ? "Signing in…" : "Sign in with email"}
                {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>

            <button type="button" onClick={() => { setSetupPassword(true); setAuthError(""); }} className="w-full text-center text-sm font-medium text-primary hover:underline">
              First time? Set up a dashboard password
            </button>
          </div>
        )}

        <p className="mt-5 text-center text-xs text-slate-500">Only verified @miraclecloud-technology.com accounts can access this dashboard.</p>
      </div>
    </div>
  );
}
