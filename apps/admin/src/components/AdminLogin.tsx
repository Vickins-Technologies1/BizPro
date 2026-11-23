"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminAuthClient } from "../lib/auth-client";

export function AdminLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "request-reset" | "set-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) { setResetToken(token); setMode("set-password"); }
    if (params.get("error") === "INVALID_TOKEN") setError("This password reset link is invalid or expired. Request a new link.");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "request-reset") {
        const result = await adminAuthClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/login?reset=1` });
        if (result.error) throw new Error(result.error.message || "Unable to send a password reset link");
        setResetRequested(true);
      } else if (mode === "set-password") {
        const result = await adminAuthClient.resetPassword({ token: resetToken, newPassword: password });
        if (result.error) throw new Error(result.error.message || "This reset link could not be used");
        setMode("login"); setPassword(""); setResetToken(""); setResetRequested(false); setResetCompleted(true);
        window.history.replaceState({}, "", "/login");
      } else if (needsTotp) {
        const result = await adminAuthClient.twoFactor.verifyTotp({ code: totp });
        if (result.error) throw new Error(result.error.message || "The verification code was not accepted");
      } else {
        const result = await adminAuthClient.signIn.email({ email: email.trim(), password });
        if (result.error) {
          if (result.error.code === "TWO_FACTOR_REQUIRED") { setNeedsTotp(true); return; }
          throw new Error(result.error.message || "Unable to sign in with those credentials");
        }
      }
      router.replace("/"); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed. Try again.");
    } finally { setBusy(false); }
  }

  const title = mode === "request-reset" ? "Reset your password" : mode === "set-password" ? "Choose a new password" : needsTotp ? "Verify your identity" : "Welcome back";
  const intro = mode === "request-reset" ? "Enter your administrator email. If an account exists, we will send a secure reset link." : mode === "set-password" ? "Choose a new password for your administrator account." : needsTotp ? "Enter the current code from your authenticator app." : "Sign in with your administrator account to continue.";

  return <main className="login-page"><div className="login-backdrop"/><section className="login-card">
    <div className="brand-lockup login-brand"><span className="brand-mark">D</span><span className="brand-copy"><strong>DIRA OS</strong><small>Platform control centre</small></span></div>
    <div className="login-intro"><div className="eyebrow">VICKINS TECHNOLOGIES</div><h1>{title}</h1><p>{intro}</p></div>
    <form onSubmit={submit} className="login-form">
      {mode === "request-reset" ? <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@company.com"/></label> : mode === "set-password" ? <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters"/></label> : needsTotp ? <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" required maxLength={8} value={totp} onChange={(event) => setTotp(event.target.value)} placeholder="000000"/></label> : <><label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@company.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password"/></label></>}
      {error && <div className="inline-alert danger" role="alert">{error}</div>}
      {mode === "request-reset" && resetRequested && <div className="inline-alert success" role="status">If the account exists and email delivery is available, a reset link is on its way.</div>}
      {mode === "login" && resetCompleted && <div className="inline-alert success" role="status">Your password has been updated. Sign in with the new password.</div>}
      <button className="primary-button full-width" disabled={busy || (mode === "request-reset" && resetRequested)}>{busy ? "Working…" : mode === "request-reset" ? "Send reset link" : mode === "set-password" ? "Update password" : needsTotp ? "Verify and continue" : "Sign in securely"}</button>
      {mode === "login" && !needsTotp && <button type="button" className="text-button" onClick={() => { setMode("request-reset"); setError(""); setResetRequested(false); }}>Forgot password?</button>}
      {(mode === "request-reset" || mode === "set-password" || needsTotp) && <button type="button" className="text-button" onClick={() => { setMode("login"); setNeedsTotp(false); setTotp(""); setError(""); setPassword(""); setResetToken(""); setResetRequested(false); window.history.replaceState({}, "", "/login"); }}>Back to sign in</button>}
    </form>
    <div className="login-security"><span className="status-pulse"/>Secure, database-backed administrator session</div>
  </section><footer>DIRA OS · Vickins Technologies</footer></main>;
}
