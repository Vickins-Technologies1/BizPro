"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ACCESS_PERMISSIONS, PLAN_EMPLOYEE_LIMITS, PLAN_NAMES, PLAN_PRICING, PLAN_TIERS, ROLE_ACCESS, ROLE_PRESETS, businessSetupSchema, expenseCreateSchema, formatPermissionLabel, formatRoleLabel, getEffectivePermissions, hasPermission, listIndustryModules, resolveBusinessTypeConfig, resolveCatalogCreationConfig, resolveCatalogCreationContext, resolveIndustryKey, type AccessPermission, type Branch, type Customer, type DailySummary, type Product, type Sale, type UserRole } from "@vbo/shared";
import { api, clearSession, DesktopApiError, flushOfflineQueue, isOfflineError, login, queueOffline, queuedCount, readSession, registerBusiness, requestPasswordReset, resetPassword, writeSession, type Session } from "../lib/desktop-api";
import { IndustryProducts } from "./DesktopCatalog";
import { DesktopInvoices } from "./DesktopInvoices";
import { DesktopBranches } from "./DesktopBranches";
import { DesktopPos } from "./DesktopPos";
import { DesktopSalesHistory } from "./DesktopSalesHistory";
import { DesktopPurchaseOrders } from "./DesktopPurchaseOrders";
import { DesktopStockTransfers } from "./DesktopStockTransfers";
import { DesktopOperations } from "./DesktopOperations";
import { DesktopSuppliers } from "./DesktopSuppliers";
import { DesktopNotifications } from "./DesktopNotifications";
import { DesktopFinance } from "./DesktopFinance";

type View = "workspace" | "dashboard" | "pos" | "products" | "inventory" | "purchaseOrders" | "transfers" | "customers" | "suppliers" | "expenses" | "sales" | "reports" | "finance" | "insights" | "operations" | "team" | "teamAccess" | "settings" | "profile" | "notifications" | "subscription";
type RecordItem = Record<string, unknown>;

const nav: Array<{ id: View; label: string; icon: string; group: string; permission?: AccessPermission }> = [
  { id: "workspace", label: "Workspace scope", icon: "workspace", group: "Workspace" },
  { id: "dashboard", label: "Overview", icon: "home", group: "Workspace" },
  { id: "pos", label: "Point of sale", icon: "cart", group: "Workspace", permission: "createSales" },
  { id: "products", label: "Products", icon: "box", group: "Manage", permission: "manageInventory" },
  { id: "inventory", label: "Inventory", icon: "layers", group: "Manage", permission: "manageInventory" },
  { id: "purchaseOrders", label: "Purchase orders", icon: "inbox", group: "Manage", permission: "manageInventory" },
  { id: "transfers", label: "Stock transfers", icon: "transfer", group: "Manage", permission: "manageInventory" },
  { id: "customers", label: "Customers", icon: "users", group: "Manage", permission: "manageCustomers" },
  { id: "suppliers", label: "Suppliers", icon: "truck", group: "Manage", permission: "manageSuppliers" },
  { id: "expenses", label: "Expenses", icon: "receipt", group: "Manage", permission: "manageExpenses" },
  { id: "sales", label: "Sales history", icon: "history", group: "Insights", permission: "manageSales" },
  { id: "reports", label: "Reports", icon: "chart", group: "Insights", permission: "viewReports" },
  { id: "finance", label: "Finance", icon: "wallet", group: "Insights" },
  { id: "insights", label: "Insights", icon: "insights", group: "Insights", permission: "viewReports" },
  { id: "operations", label: "Operations", icon: "grid", group: "Manage", permission: "manageOperations" },
  { id: "team", label: "Team & access", icon: "users", group: "Admin", permission: "manageEmployees" },
  { id: "teamAccess", label: "Team access", icon: "shield", group: "Admin", permission: "manageEmployees" },
  { id: "settings", label: "Business settings", icon: "settings", group: "Admin", permission: "manageSettings" },
  { id: "notifications", label: "Notifications", icon: "bell", group: "Admin" },
  { id: "subscription", label: "Subscription", icon: "card", group: "Admin", permission: "manageSettings" }
];

const lightThemeVars = {
  "--bg": "#f8fafc",
  "--surface": "#ffffff",
  "--surface-2": "#f7f8fa",
  "--line": "#e1e7ef",
  "--text": "#111827",
  "--muted": "#596579",
  "--primary": "#155eef",
  "--primary-2": "#1245a8",
  "--green": "#087f5b",
  "--amber": "#b86a0a",
  "--red": "#c53d55",
  "--purple": "#0e7490",
  "--shadow": "0 14px 34px rgba(15,53,84,.08)",
  "--shadow-strong": "0 20px 44px rgba(15,53,84,.14)"
} as const;

const darkThemeVars = {
  "--bg": "#090a0c",
  "--surface": "#111315",
  "--surface-2": "#191c1f",
  "--line": "#292d31",
  "--text": "#f1f3f5",
  "--muted": "#a2a8b0",
  "--primary": "#3b82f6",
  "--primary-2": "#2563eb",
  "--green": "#32d583",
  "--amber": "#fdb022",
  "--red": "#f97066",
  "--purple": "#7b61c9",
  "--shadow": "0 8px 24px rgba(0,0,0,.22)",
  "--shadow-strong": "0 16px 38px rgba(0,0,0,.36)"
} as const;

const iconPaths: Record<string, ReactNode> = {
  workspace: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M8 9h13"/></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/></>,
  cart: <><path d="M3 4h2l2.3 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  inbox: <><path d="M4 4h16l2 11v5H2v-5L4 4Z"/><path d="M2 14h6l2 3h4l2-3h6"/></>,
  transfer: <><path d="M7 7h13l-3-3M17 17H4l3 3"/><path d="M20 7l-3 3M4 17l3-3"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1H3ZM16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1h-3"/></>,
  truck: <><path d="M3 6h12v12H3zM15 10h4l3 3v5h-7"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="18.5" cy="19" r="1.5"/></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M8 8h8M8 12h8M8 16h3"/></>,
  history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/><path d="M6 5V3h12"/></>,
  insights: <><path d="M4 19V5M4 19h17"/><path d="M7 15c2-1 2-5 5-5s3 3 5 2 2-4 4-5"/><circle cx="12" cy="10" r="1"/></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4L5.5 15a8 8 0 0 1 0-1.9l-1.4-1.2 1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.2a8 8 0 0 1-.1 1.9Z" transform="translate(1 -1) scale(.92)"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/></>
};

function NavIcon({ name }: { name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
}

function money(value: unknown) { return `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function text(value: unknown, fallback = "-") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function canAccess(session: Session, permission: AccessPermission) {
  const permissions = session.user.permissions?.filter((value): value is AccessPermission => ACCESS_PERMISSIONS.includes(value as AccessPermission)) ?? null;
  return hasPermission({ role: session.user.role, permissions }, permission);
}

export function DesktopShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("workspace");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [offline, setOffline] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [pendingWrites, setPendingWrites] = useState(0);

  const updateBranches = useCallback((branches: Branch[]) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, branches };
      writeSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    const cachedSession = readSession();
    setSession(cachedSession);
    if (cachedSession) {
      setView("workspace");
      void api.me().then((profile) => {
        if (!active) return;
        const refreshedSession: Session = { ...cachedSession, ...profile, accessToken: cachedSession.accessToken };
        writeSession(refreshedSession);
        setSession(refreshedSession);
      }).catch((error) => {
        if (active && error instanceof DesktopApiError && error.status === 401) {
          clearSession();
          setSession(null);
        }
      });
    }
    setTheme((window.localStorage.getItem("bizpro.desktop.theme") as "light" | "dark" | null) ?? "dark");
    setPendingWrites(queuedCount());
    const onLine = () => setOffline(!navigator.onLine);
    const sync = () => { onLine(); void flushOfflineQueue().then(({ remaining }) => setPendingWrites(remaining)).catch(() => setPendingWrites(queuedCount())); };
    const onQueueChange = () => setPendingWrites(queuedCount());
    sync(); window.addEventListener("online", sync); window.addEventListener("offline", onLine); window.addEventListener("dira-offline-queue-change", onQueueChange);
    return () => { active = false; window.removeEventListener("online", sync); window.removeEventListener("offline", onLine); window.removeEventListener("dira-offline-queue-change", onQueueChange); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const activeBranches = (session.branches ?? []).filter((branch) => branch.status !== "inactive");
    const savedId = window.localStorage.getItem("bizpro.desktop.branchId");
    const nextId = activeBranches.find((branch) => branch.id === savedId)?.id ?? activeBranches.find((branch) => branch.isDefault)?.id ?? activeBranches[0]?.id ?? "";
    setSelectedBranchId(nextId);
  }, [session?.user.id, session?.branches]);

  useEffect(() => {
    if (selectedBranchId) window.localStorage.setItem("bizpro.desktop.branchId", selectedBranchId);
    else window.localStorage.removeItem("bizpro.desktop.branchId");
  }, [selectedBranchId]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("products");
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function toggleTheme() { const next = theme === "dark" ? "light" : "dark"; setTheme(next); window.localStorage.setItem("bizpro.desktop.theme", next); }
  if (!session) return <LoginScreen onLogin={(next) => { writeSession(next); setSession(next); }} />;

  const activeBranches = (session.branches ?? []).filter((branch) => branch.status !== "inactive");
  const activeBranch = selectedBranchId ? activeBranches.find((branch) => branch.id === selectedBranchId) ?? activeBranches.find((branch) => branch.isDefault) ?? activeBranches[0] : null;
  const activeSession = selectedBranchId && activeBranch ? { ...session, branches: [activeBranch] } : { ...session, branches: [] };
  const inventoryEnabled = resolveBusinessTypeConfig({ businessType: session.business?.businessType, industryKey: session.business?.industryKey }).capabilities.inventory;
  const visibleNav = nav.filter((item) => (!item.permission || canAccess(session, item.permission)) && (item.id !== "finance" || canAccess(session, "manageExpenses") || canAccess(session, "viewReports")) && (!( ["purchaseOrders", "transfers"] as View[]).includes(item.id) || inventoryEnabled));
  return <div className={`desktop-app ${theme}`} style={(theme === "light" ? lightThemeVars : darkThemeVars) as CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src="/dira-os-logo.png" alt="Dira OS" /><div><strong>Dira OS</strong><span>Business OS</span></div></div>
      <div className="workspace-pill"><span className="status-dot" />{text(session.business?.name, "My business")}<span className="chevron">⌄</span></div>
      <nav aria-label="Main navigation">{["Workspace", "Manage", "Insights", "Admin"].map((group) => <div className="nav-group" key={group}><small>{group}</small>{visibleNav.filter((item) => item.group === group).map((item) => <button className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)} aria-current={view === item.id ? "page" : undefined} title={item.label} key={item.id}><i><NavIcon name={item.icon} /></i><span>{item.label}</span></button>)}</div>)}</nav>
      <div className="sidebar-footer"><div className="sync-line"><span className={offline || pendingWrites ? "status-dot amber" : "status-dot"} />{offline ? "Offline mode" : pendingWrites ? `${pendingWrites} changes waiting` : "Connected"}<span className="sync-count">{pendingWrites}</span></div><button className="theme-button" onClick={toggleTheme}><NavIcon name={theme === "dark" ? "sun" : "moon"} />{theme === "dark" ? "Light appearance" : "Dark appearance"}</button><button className="profile" onClick={() => setView("profile")}><span className="avatar">{text(session.user.fullName, "U").slice(0, 1).toUpperCase()}</span><span><strong>{text(session.user.fullName, "User")}</strong><small>{text(session.user.role, "Owner")}</small></span><span className="more">•••</span></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Dira OS</span><b>/</b><strong>{visibleNav.find((item) => item.id === view)?.label ?? (view === "profile" ? "Your profile" : "Workspace")}</strong></div><div className="top-actions"><kbd>Ctrl K</kbd><button className="icon-button" aria-label="Search products" title="Search products (Ctrl+K)" onClick={() => setView("products")}><NavIcon name="search" /></button><button className="icon-button" onClick={() => setView("notifications")} aria-label="Notifications" title="Notifications"><NavIcon name="bell" /></button><select className="branch-select" aria-label="Current branch" value={selectedBranchId} disabled={activeBranches.length < 2} onChange={(event) => setSelectedBranchId(event.target.value)}>{session.user.role === "owner" && activeBranches.length > 1 ? <option value="">All branches</option> : null}{activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div></header><div className="content"><ViewContent view={view} session={activeSession} allBranches={session.branches ?? []} onBranchesChange={updateBranches} offline={offline} pendingWrites={pendingWrites} onNavigate={setView} selectedBranchId={selectedBranchId} onSelectBranch={setSelectedBranchId} requiresBranchScope={session.user.role === "owner" && activeBranches.length > 1 && !selectedBranchId} onLogout={() => { clearSession(); window.location.reload(); }} /></div></main>
  </div>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [showOnboarding, setShowOnboarding] = useState(false); const [showRecovery, setShowRecovery] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { onLogin(await login(identifier, password)); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in"); } finally { setLoading(false); } }
  if (showOnboarding) return <OnboardingForm onCancel={() => setShowOnboarding(false)} onComplete={onLogin} />;
  if (showRecovery) return <PasswordRecovery onBack={() => setShowRecovery(false)} />;
  return <div className="login-page"><div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="login-brand"><img className="brand-logo large" src="/dira-os-logo.png" alt="Dira OS" /><strong>Dira OS</strong></div><div className="login-quote"><p>“The calm, clear way to run your business.”</p><span>Sales, stock and growth in one focused workspace.</span></div></div><div className="login-panel"><div className="login-inner"><span className="eyebrow">WELCOME BACK</span><h1>Run your business<br /><span>with clarity.</span></h1><p className="muted">Sign in to your Dira OS workspace to continue.</p><form onSubmit={submit}><label>Phone or email<input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@business.com" required /></label><label>Password or PIN<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Enter your password" required /></label><div className="form-links"><button type="button" className="text-button" onClick={() => setShowRecovery(true)}>Forgot your password?</button></div>{error && <div className="error-banner">{error}</div>}<button className="primary full" disabled={loading}>{loading ? "Signing in..." : "Continue  →"}</button></form><p className="login-help">Protected by Dira OS access controls · <button type="button" className="text-button" onClick={() => setShowOnboarding(true)}>Create owner account</button></p></div></div></div>;
}

function PasswordRecovery({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"request" | "reset" | "complete">("request");
  const [identifier, setIdentifier] = useState(""); const [code, setCode] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [debugCode, setDebugCode] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function requestCode(event: React.FormEvent) { event.preventDefault(); if (identifier.trim().length < 2) { setError("Enter your phone number or account name."); return; } setBusy(true); setError(""); try { const result = await requestPasswordReset(identifier); setDebugCode(result.debugCode ?? ""); setMessage(result.message); setStep("reset"); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "We couldn’t start password recovery. Try again."); } finally { setBusy(false); } }
  async function submitReset(event: React.FormEvent) { event.preventDefault(); if (identifier.trim().length < 2) { setError("Enter your phone number or account name."); return; } if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit reset code."); return; } if (password.length < 6 || password.length > 128) { setError("Use a password between 6 and 128 characters."); return; } if (password !== confirmPassword) { setError("Passwords do not match."); return; } setBusy(true); setError(""); try { const result = await resetPassword({ identifier: identifier.trim(), code, password }); setMessage(result.message || "Your password has been changed securely."); setStep("complete"); } catch (resetError) { setError(resetError instanceof Error ? resetError.message : "We couldn’t reset your password. Request a new code and try again."); } finally { setBusy(false); } }
  const title = step === "request" ? "Forgot your password?" : step === "reset" ? "Set a new password" : "Password updated";
  return <div className="login-page"><div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="login-brand"><img className="brand-logo large" src="/dira-os-logo.png" alt="Dira OS" /><strong>Dira OS</strong></div><div className="login-quote"><p>“The calm, clear way to run your business.”</p><span>Secure account recovery.</span></div></div><div className="login-panel"><div className="login-inner"><span className="eyebrow">PASSWORD RECOVERY</span><h1>{title}</h1>{step === "request" ? <><p className="muted">Enter the phone number or account name you use to sign in.</p><form onSubmit={requestCode}><label>Phone or account name<input autoFocus value={identifier} onChange={(event) => { setIdentifier(event.target.value); setError(""); }} placeholder="07… or your account name" required minLength={2} /></label><p className="muted">If the account matches, a one-time reset code will be sent. This confirmation doesn’t reveal whether an account exists.</p>{error && <div className="error-banner" role="alert">{error}</div>}<button className="primary full" disabled={busy}>{busy ? "Sending code…" : "Send reset code"}</button></form><p className="login-help">Reset codes expire quickly and can only be used once.</p></> : step === "reset" ? <><p className="muted">Enter the one-time code and choose a new password.</p>{message && <div className="success-banner">{message}</div>}{debugCode && <div className="info-banner">Local testing code: {debugCode}</div>}<form onSubmit={submitReset}><label>Phone or account name<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required minLength={2} /></label><label>6-digit reset code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" /></label><label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} maxLength={128} /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{error && <div className="error-banner" role="alert">{error}</div>}<button className="primary full" disabled={busy}>{busy ? "Updating password…" : "Reset password"}</button></form></> : <><p className="muted">{message || "Your Dira OS account is ready for a fresh sign in."}</p><div className="success-banner">Your password has been changed securely. The reset code can’t be used again.</div></>}<div className="form-links"><button type="button" className="text-button" onClick={step === "complete" ? onBack : () => { setStep("request"); setError(""); }}>Back to sign in</button>{step === "reset" && <button type="button" className="text-button" onClick={() => { setStep("request"); setCode(""); setError(""); }}>Request another code</button>}</div></div></div></div>;
}

function OnboardingForm({ onCancel, onComplete }: { onCancel: () => void; onComplete: (session: Session) => void }) {
  const industries = listIndustryModules();
  const initialIndustry = industries[0]!;
  const [values, setValues] = useState({ ownerName: "", phone: "", countryCode: "+254", password: "", businessName: "", industryKey: initialIndustry.key, businessType: initialIndustry.businessTypes[0]!.value, planTier: PLAN_TIERS[0], currency: "KES", branchName: "Main Branch", cashierPin: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const selectedIndustry = industries.find((industry) => industry.key === values.industryKey) ?? initialIndustry;
  function update(key: keyof typeof values, value: string) { setValues((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const localPhone = values.phone.trim();
    const normalizedPhone = `${values.countryCode}${localPhone.replace(/^0+/, "").replace(/[\s()-]/g, "")}`;
    const parsed = businessSetupSchema.safeParse({ ...values, phone: normalizedPhone, phoneLocal: localPhone, industryKey: resolveIndustryKey({ industryKey: values.industryKey, businessType: values.businessType }) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the setup details and try again."); return; }
    setBusy(true); setError("");
    try { onComplete(await registerBusiness({ ...parsed.data, industryKey: resolveIndustryKey({ industryKey: parsed.data.industryKey, businessType: parsed.data.businessType }), phoneLocal: parsed.data.phoneLocal ?? localPhone, cashierPin: parsed.data.cashierPin || null })); }
    catch (registerError) { setError(registerError instanceof Error ? registerError.message : "Could not create the business account."); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="login-brand"><img className="brand-logo large" src="/dira-os-logo.png" alt="Dira OS" /><strong>Dira OS</strong></div><div className="login-quote"><p>Set up your workspace.</p><span>Choose the business type and tools that fit your work.</span></div></div><div className="login-panel"><form className="login-inner" onSubmit={submit}><span className="eyebrow">NEW WORKSPACE</span><h1>Create your<br /><span>business account.</span></h1><p className="muted">The first account is the business owner.</p>
    <div className="onboarding-fields">
      <label>Owner full name<input autoFocus value={values.ownerName} onChange={(event) => update("ownerName", event.target.value)} required minLength={2} /></label>
      <label>Phone number<div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}><input aria-label="Country calling code" value={values.countryCode} onChange={(event) => update("countryCode", event.target.value)} pattern="\+[0-9]{1,4}" required /><input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} required minLength={7} /></div></label>
      <label>Business name<input value={values.businessName} onChange={(event) => update("businessName", event.target.value)} required minLength={2} /></label>
      <label>Industry<select value={values.industryKey} onChange={(event) => { const industry = industries.find((item) => item.key === event.target.value) ?? initialIndustry; setValues((current) => ({ ...current, industryKey: industry.key, businessType: industry.businessTypes[0]!.value })); }}>{industries.map((industry) => <option key={industry.key} value={industry.key}>{industry.label}</option>)}</select></label>
      <label>Business type<select value={values.businessType} onChange={(event) => update("businessType", event.target.value)}>{selectedIndustry.businessTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label>Starting plan<select value={values.planTier} onChange={(event) => update("planTier", event.target.value)}>{PLAN_TIERS.map((plan) => <option key={plan} value={plan}>{PLAN_NAMES[plan]} · KES {PLAN_PRICING[plan].toLocaleString()}/month · {PLAN_EMPLOYEE_LIMITS[plan]} team members</option>)}</select></label>
      <label>Currency<input value={values.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} required minLength={3} maxLength={3} /></label>
      <label>First branch name<input value={values.branchName} onChange={(event) => update("branchName", event.target.value)} required minLength={2} /></label>
      <label>Password<input type="password" autoComplete="new-password" value={values.password} onChange={(event) => update("password", event.target.value)} required minLength={6} /></label>
      <label>Cashier PIN (optional)<input type="password" inputMode="numeric" autoComplete="new-password" value={values.cashierPin} onChange={(event) => update("cashierPin", event.target.value)} pattern="[0-9]{4,8}" minLength={4} maxLength={8} /></label>
    </div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="heading-actions"><button type="button" className="secondary" onClick={onCancel}>Back to sign in</button><button className="primary" disabled={busy}>{busy ? "Creating workspace…" : "Create workspace"}</button></div>
  </form></div></div>;
}

function ViewContent({ view, session, allBranches, onBranchesChange, offline, pendingWrites, onNavigate, selectedBranchId, onSelectBranch, requiresBranchScope, onLogout }: { view: View; session: Session; allBranches: Branch[]; onBranchesChange: (branches: Branch[]) => void; offline: boolean; pendingWrites: number; onNavigate: (view: View) => void; selectedBranchId: string; onSelectBranch: (branchId: string) => void; requiresBranchScope: boolean; onLogout: () => void }) {
  if (view === "workspace") return <WorkspaceView session={session} branches={allBranches} selectedBranchId={selectedBranchId} onSelectBranch={onSelectBranch} onContinue={() => onNavigate("dashboard")} onManageBranches={() => onNavigate("settings")} />;
  if (view === "profile") return <ProfileView session={session} onLogout={onLogout} />;
  if (view === "subscription") return <SubscriptionView session={session} />;
  if (requiresBranchScope && (["pos", "products", "inventory", "purchaseOrders", "transfers", "customers", "suppliers", "expenses", "finance", "operations", "team", "settings"] as View[]).includes(view)) return <BranchScopeRequired onChooseBranch={() => onNavigate("workspace")} />;
  if (view === "dashboard") return <Dashboard session={session} offline={offline} pendingWrites={pendingWrites} onNavigate={onNavigate} />;
  if (view === "pos") return <DesktopPos session={session} />;
  if (view === "purchaseOrders") return <DesktopPurchaseOrders session={session} />;
  if (view === "transfers") return <DesktopStockTransfers session={session} />;
  if (view === "products" || view === "inventory") return <IndustryProducts session={session} inventory={view === "inventory"} />;
  if (view === "customers") return <DataView session={session} title="Customers" subtitle="Keep every customer relationship in one place." endpoint="customers" columns={["Name", "Phone", "Email", "Balance", "Last visit"]} />;
  if (view === "suppliers") return <DesktopSuppliers session={session} />;
  if (view === "expenses") return <DataView session={session} title="Expenses" subtitle="Track operating costs and keep your margins visible." endpoint="expenses" columns={["Description", "Category", "Amount", "Date", "Recorded by"]} />;
  if (view === "sales") return <DesktopSalesHistory session={session} />;
  if (view === "reports") return <ReportView session={session} />;
  if (view === "finance") return <FinanceView session={session} />;
  if (view === "insights") return <InsightsView session={session} />;
  if (view === "operations") return <DesktopOperations session={session} />;
  if (view === "team") return <TeamView session={session} allBranches={allBranches} />;
  if (view === "teamAccess") return <TeamAccessView session={session} onNavigate={onNavigate} />;
  if (view === "notifications") return <DesktopNotifications onNavigate={onNavigate} />;
  return <SettingsView view={view} session={session} allBranches={allBranches} onBranchesChange={onBranchesChange} onLogout={onLogout} />;
}

function WorkspaceView({ session, branches, selectedBranchId, onSelectBranch, onContinue, onManageBranches }: { session: Session; branches: Branch[]; selectedBranchId: string; onSelectBranch: (branchId: string) => void; onContinue: () => void; onManageBranches: () => void }) {
  const activeBranches = branches.filter((branch) => branch.status !== "inactive");
  const selectedBranch = activeBranches.find((branch) => branch.id === selectedBranchId);
  const canChooseAll = session.user.role === "owner" && activeBranches.length > 1;
  return <>
    <PageHeading eyebrow="WORKSPACE" title="Choose workspace" subtitle="Select the business view and branch data you want to work in." />
    <section className="panel">
      <div className="panel-heading"><h2>{text(session.business?.name, "Dira OS")}</h2><span className="badge success">{formatRoleLabel(session.user.role)}</span></div>
      <p className="muted">{text(session.user.fullName, "Team member")} · {selectedBranch?.name ?? (canChooseAll && !selectedBranchId ? "All branches" : activeBranches[0]?.name ?? "Workspace")}</p>
      <div className="settings-list" role="radiogroup" aria-label="Workspace scope">
        {canChooseAll ? <button type="button" className="setting-row" role="radio" aria-checked={!selectedBranchId} onClick={() => onSelectBranch("")}><span className="setting-icon">▦</span><div><strong>All branches</strong><small>View consolidated business activity</small></div><span className={!selectedBranchId ? "badge success" : "badge"}>{!selectedBranchId ? "Selected" : "Select"}</span></button> : null}
        {activeBranches.map((branch) => <button type="button" className="setting-row" role="radio" aria-checked={selectedBranchId === branch.id} onClick={() => onSelectBranch(branch.id)} key={branch.id}><span className="setting-icon">⌂</span><div><strong>{branch.name}</strong><small>{branch.isDefault ? "Default branch" : "Business branch"}</small></div><span className={selectedBranchId === branch.id ? "badge success" : "badge"}>{selectedBranchId === branch.id ? "Selected" : "Select"}</span></button>)}
        {!activeBranches.length ? <Empty text="No active branches are assigned to this account." /> : null}
      </div>
      <div className="heading-actions"><button type="button" className="primary" onClick={onContinue} disabled={!activeBranches.length}>Continue to overview →</button>{canAccess(session, "manageBranches") ? <button type="button" className="secondary" onClick={onManageBranches}>Manage branches</button> : null}</div>
    </section>
  </>;
}

function ProfileView({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const initials = text(session.user.fullName, "User").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const role = formatRoleLabel(session.user.role);
  return <>
    <PageHeading eyebrow="ACCOUNT" title="Profile" subtitle="Review your signed-in account and workspace details." />
    <div className="settings-grid">
      <Panel title="Account profile"><div className="settings-list"><div className="setting-row"><span className="avatar">{initials}</span><div><strong>{text(session.user.fullName, "User")}</strong><small>{role}</small></div><span className="badge success">Active</span></div><div className="setting-row"><span className="setting-icon">⌘</span><div><strong>Business</strong><small>{text(session.business?.name, "Dira OS workspace")}</small></div></div><div className="setting-row"><span className="setting-icon">◇</span><div><strong>Business status</strong><small>{text(session.business?.billingStatus, "Status unavailable").replaceAll("_", " ")}</small></div></div></div></Panel>
      <Panel title="Account actions"><p className="muted">Profile editing and password changes depend on account APIs that are not available in this workspace.</p><button type="button" className="secondary" onClick={onLogout}>Sign out</button></Panel>
    </div>
  </>;
}

function SubscriptionView({ session }: { session: Session }) {
  const plan = PLAN_TIERS.includes(session.business.planTier as typeof PLAN_TIERS[number]) ? session.business.planTier as typeof PLAN_TIERS[number] : PLAN_TIERS[0];
  return <>
    <PageHeading eyebrow="ADMINISTRATION" title="Subscription" subtitle="Review the plan and billing status configured for this workspace." />
    <section className="panel"><div className="panel-heading"><h2>{PLAN_NAMES[plan]}</h2><span className="badge success">Current plan</span></div><div className="metric-grid"><Metric label="Monthly plan price" value={`KES ${PLAN_PRICING[plan].toLocaleString()}`} delta="Plan price" tone="blue" /><Metric label="Team capacity" value={`${PLAN_EMPLOYEE_LIMITS[plan]}`} delta="Team members" tone="green" /><Metric label="Workspace status" value={text(session.business.billingStatus, "Unavailable").replaceAll("_", " ")} delta="From account" tone="amber" /></div><p className="muted">Plan changes, payment methods, and billing history are not exposed by the current account API.</p></section>
  </>;
}

function BranchScopeRequired({ onChooseBranch }: { onChooseBranch: () => void }) {
  return <><PageHeading eyebrow="CHOOSE A BRANCH" title="Select one branch to continue" subtitle="This workspace scope is read-only for branch-specific actions." /><section className="panel"><p className="muted">Choose a single active branch before recording sales, managing inventory, editing customers or suppliers, or changing team and business settings.</p><button type="button" className="primary" onClick={onChooseBranch}>Choose a branch</button></section></>;
}

function Dashboard({ session, offline, pendingWrites, onNavigate }: { session: Session; offline: boolean; pendingWrites: number; onNavigate: (view: View) => void }) {
  const [data, setData] = useState<DailySummary | null>(null); const [error, setError] = useState("");
  useEffect(() => { api.dashboard(session.branches?.[0]?.id).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard")); }, [session]);
  const summary = data as RecordItem | null; const catalogContext = resolveCatalogCreationContext({ industryKey: session.business?.industryKey ?? null, businessType: session.business?.businessType ?? null });
  return <><PageHeading eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()} title={`Good morning, ${text(session.user.fullName, "there").split(" ")[0]}.`} subtitle="Here is what is happening across your business today." actions={<><button className="secondary" onClick={() => onNavigate("reports")}>View reports</button><button className="primary" onClick={() => onNavigate("pos")}>+ Record sale</button></>} /><div className="status-banner"><span className={offline || pendingWrites ? "status-dot amber" : "status-dot"} /><div><strong>{offline ? "Working offline" : pendingWrites ? `${pendingWrites} changes waiting to sync` : "Connected to your workspace"}</strong><span>{offline ? "Queued changes will sync when the connection returns." : pendingWrites ? "Queued changes are retained on this device until the server accepts them." : "Server data is available. Recent activity below comes from synchronized records."}</span></div><button onClick={() => onNavigate("settings")}>Sync details →</button></div>{error && <div className="error-banner">{error}</div>}<div className="metric-grid"><Metric label="Today’s sales" value={money(summary?.totalSales)} delta="Live summary" tone="blue" /><Metric label="Transactions" value={text(summary?.transactionCount, "0")} delta="Live summary" tone="green" /><Metric label="Items sold" value={text(summary?.itemsSold, "0")} delta="Live summary" tone="amber" /><Metric label="Low stock" value={text(summary?.lowStockCount, "0")} delta="Needs attention" tone="red" /></div><div className="dashboard-grid"><Panel title="Sales performance" action="Last 7 days"><SalesChart session={session} /></Panel><Panel title="Quick actions"><div className="quick-actions">{[["▣", "New sale", "pos"], ["▤", catalogContext.status === "ready" ? catalogContext.context.config.title : "Create catalog item", "products"], ["◎", "Add customer", "customers"], ["⌁", "View reports", "reports"]].map(([icon, label, target]) => <button onClick={() => onNavigate(target as View)} key={label}><i>{icon}</i><span>{label}</span><b>→</b></button>)}</div></Panel></div><div className="dashboard-grid lower"><Panel title="Top products" action="View all" onAction={() => onNavigate("products")}><TopProducts session={session} /></Panel><Panel title="Recent activity" action="See all" onAction={() => onNavigate("sales")}><Activity session={session} /></Panel></div></>;
}

function SalesChart({ session }: { session: Session }) { const [sales, setSales] = useState<Sale[]>([]); const [error, setError] = useState(""); useEffect(() => { api.sales(session.branches?.[0]?.id).then(setSales).catch((err) => setError(err instanceof Error ? err.message : "Could not load sales trend")); }, [session]); const days = useMemo(() => { const today = new Date(); return Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setHours(0, 0, 0, 0); date.setDate(today.getDate() - (6 - index)); return date; }); }, []); const values = days.map((day) => sales.filter((sale) => { const date = new Date(sale.createdAt); return date >= day && date < new Date(day.getTime() + 86400000); }).reduce((sum, sale) => sum + Number(sale.grandTotal ?? 0), 0)); const max = Math.max(...values, 1); const points = values.map((value, index) => `${(index / 6) * 100},${100 - (value / max) * 82 - 8}`).join(" "); return <div className="sales-chart" aria-label="Sales performance for the last seven days">{error ? <Empty text={error} /> : sales.length === 0 ? <Empty text="Sales performance will appear after sales are synchronized." /> : <><svg className="sales-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs><path d={`M ${points.split(" ")[0]} L ${points} L 100,100 L 0,100 Z`} fill="url(#sales-fill)" /><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />{points.split(" ").map((point) => { const [cx, cy] = point.split(","); return <circle key={point} cx={cx} cy={cy} r="1.4" fill="var(--surface)" stroke="var(--primary)" strokeWidth=".8" vectorEffect="non-scaling-stroke" />; })}</svg><div className="sales-chart-labels">{days.map((day) => <span key={day.toISOString()}>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>)}</div></>}</div>; }
function Metric({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: string }) { return <div className={`metric-card ${tone}`}><div className="metric-icon">{tone === "blue" ? "↗" : tone === "green" ? "✓" : tone === "amber" ? "◫" : "!"}</div><span>{label}</span><strong>{value}</strong><small className={tone === "red" ? "negative" : "positive"}>{tone === "red" ? "● " : "↗ "}{delta}</small></div>; }
function PageHeading({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: React.ReactNode }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{actions}</div></div>; }
function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action && <button className="text-button" onClick={onAction}>{action} →</button>}</div>{children}</section>; }
function TopProducts({ session }: { session: Session }) { const [products, setProducts] = useState<Product[]>([]); useEffect(() => { api.products(session.branches?.[0]?.id).then((items) => setProducts(items.slice(0, 4))).catch(() => undefined); }, [session]); return <div className="product-list">{products.length ? products.map((product, index) => <div className="product-row" key={product.id}><span className={`product-thumb p${index}`}>{text(product.name, "P").slice(0, 1)}</span><div><strong>{text(product.name)}</strong><small>{text(product.categoryId, "General")}</small></div><b>{money(product.sellingPrice)}</b></div>) : <Empty text="Product performance will appear here." />}</div>; }
function Activity({ session }: { session: Session }) {
  const [entries, setEntries] = useState<Array<{ id: string; title: string; detail: string; createdAt: string; tone: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const branchId = session.branches?.[0]?.id;
    Promise.all([api.sales(branchId), api.expenses(branchId)]).then(([sales, expenses]) => {
      const recentSales = sales.map((sale) => ({ id: `sale-${sale.id}`, title: "Sale recorded", detail: `Receipt ${text(sale.receiptNumber, sale.id)} · ${money(sale.grandTotal)}`, createdAt: sale.createdAt, tone: "green" }));
      const recentExpenses = expenses.map((expense) => ({ id: `expense-${expense.id}`, title: "Expense recorded", detail: `${text(expense.note, "Expense")} · ${money(expense.amount)}`, createdAt: expense.createdAt ?? expense.expenseDate, tone: "amber" }));
      setEntries([...recentSales, ...recentExpenses].filter((entry) => entry.createdAt).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 4));
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load recent activity."));
  }, [session]);
  return <div className="activity-list">{error ? <Empty text={error} /> : entries.length ? entries.map((entry) => <div className="activity-row" key={entry.id}><span className={`activity-dot ${entry.tone}`} /><div><strong>{entry.title}</strong><small>{entry.detail}</small></div><time>{new Date(entry.createdAt).toLocaleString()}</time></div>) : <Empty text="Recent sales and expenses will appear here." />}</div>;
}


function DataView({ title, subtitle, endpoint, columns, session }: { title: string; subtitle: string; endpoint: "customers" | "suppliers" | "expenses" | "sales"; columns: string[]; session: Session }) {
  const [items, setItems] = useState<unknown[]>([]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<RecordItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<RecordItem | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<RecordItem | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const branchId = session.branches?.[0]?.id ?? null;
  const canCreate = endpoint === "customers" ? canAccess(session, "manageCustomers") : endpoint === "suppliers" ? canAccess(session, "manageSuppliers") : endpoint === "expenses" ? canAccess(session, "manageExpenses") : false;
  const fieldMap: Record<typeof endpoint, string[]> = {
    customers: ["name", "phone", "email", "balance", "lastVisit"],
    suppliers: ["name", "phone", "email", "balance", "isActive"],
    expenses: ["note", "categoryId", "amount", "expenseDate", "recordedById"],
    sales: ["receiptNumber", "customerName", "items", "paymentMethod", "grandTotal"]
  };
  useEffect(() => {
    const loader = endpoint === "suppliers" ? api.suppliers() : api[endpoint](branchId);
    loader.then(setItems).catch((loadError) => setError(loadError instanceof Error ? loadError.message : `Could not load ${title.toLowerCase()}.`));
  }, [endpoint, branchId, reload, title]);
  const rows = items.filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
  const addLabel = endpoint === "customers" ? "customer" : endpoint === "suppliers" ? "supplier" : "expense";
  async function createRecord(values: Record<string, string>) {
    setError("");
    const externalId = crypto.randomUUID();
    const common = { businessId: session.user.businessId, branchId, externalId };
    const body = endpoint === "customers" ? {
      ...common, name: (values.name ?? "").trim(), businessName: (values.businessName ?? "").trim() || null, phone: (values.phone ?? "").trim() || null, email: (values.email ?? "").trim() || null,
      address: (values.address ?? "").trim() || null, taxPin: (values.taxPin ?? "").trim() || null,
      creditLimit: Number(values.creditLimit || 0), loyaltyPoints: 0, notes: (values.notes ?? "").trim() || null, balance: 0
    } : endpoint === "suppliers" ? {
      ...common, name: (values.name ?? "").trim(), phone: (values.phone ?? "").trim() || null, email: (values.email ?? "").trim() || null,
      contactName: (values.contactName ?? "").trim() || null, notes: (values.notes ?? "").trim() || null, isActive: true
    } : {
      ...common, categoryId: null, amount: Number(values.amount), note: (values.note ?? "").trim(),
      expenseDate: values.expenseDate ?? "", recordedById: session.user.id
    };
    if (endpoint === "expenses") {
      const parsed = expenseCreateSchema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter valid expense details.");
    }
    try {
      const created = endpoint === "customers" ? await api.createCustomer(body) : endpoint === "suppliers" ? await api.createSupplier(body) : await api.createExpense(body);
      setItems((current) => [created, ...current]);
      setShowCreate(false);
    } catch (createError) {
      if (!isOfflineError(createError)) { setError(createError instanceof Error ? createError.message : `Could not save ${addLabel}.`); return; }
      try {
        queueOffline(`/${endpoint}`, body);
        setItems((current) => [{ ...body, id: externalId, pendingSync: true }, ...current]);
        setShowCreate(false);
      } catch (queueError) { setError(queueError instanceof Error ? queueError.message : `Could not queue ${addLabel}.`); }
    }
  }
  async function updateCustomer(customer: RecordItem, values: Record<string, string>) {
    const id = text(customer.id, "");
    if (!id) throw new Error("This customer cannot be updated because its server ID is missing.");
    const updated = await api.updateCustomer(id, {
      branchId,
      name: (values.name ?? "").trim(),
      businessName: (values.businessName ?? "").trim() || null,
      phone: (values.phone ?? "").trim() || null,
      email: (values.email ?? "").trim() || null,
      address: (values.address ?? "").trim() || null,
      taxPin: (values.taxPin ?? "").trim() || null,
      creditLimit: Number(values.creditLimit || 0),
      notes: (values.notes ?? "").trim() || null
    });
    setItems((current) => current.map((item) => text((item as RecordItem).id) === id ? updated : item));
    setEditingCustomer(null);
  }
  async function updateSupplier(supplier: RecordItem, values: Record<string, string>) {
    const id = text(supplier.id, "");
    if (!id) throw new Error("This supplier cannot be updated because its server ID is missing.");
    const updated = await api.updateSupplier(id, {
      name: (values.name ?? "").trim(), contactName: (values.contactName ?? "").trim() || null,
      phone: (values.phone ?? "").trim() || null, email: (values.email ?? "").trim() || null,
      notes: (values.notes ?? "").trim() || null
    });
    setItems((current) => current.map((item) => text((item as RecordItem).id) === id ? updated : item));
    setEditingSupplier(null);
  }
  async function archiveSupplier(supplier: RecordItem) {
    const id = text(supplier.id, "");
    if (!id) { setError("This supplier cannot be archived because its server ID is missing."); return; }
    try {
      const archived = await api.archiveSupplier(id);
      setItems((current) => current.map((item) => text((item as RecordItem).id) === id ? archived : item));
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive supplier."); }
  }
  async function recordCustomerPayment(customer: RecordItem, values: { amount: number; method: string; reference: string; note: string }) {
    const id = text(customer.id, "");
    if (!id) throw new Error("This customer cannot receive a payment because its server ID is missing.");
    const body = { businessId: session.user.businessId, branchId, externalId: crypto.randomUUID(), amount: values.amount, method: values.method, reference: values.reference.trim() || null, note: values.note.trim() || null };
    let pendingSync = false;
    try { await api.recordCustomerPayment(id, body); }
    catch (paymentError) {
      if (!isOfflineError(paymentError)) throw paymentError;
      queueOffline(`/customers/${encodeURIComponent(id)}/payments`, body);
      pendingSync = true;
    }
    setItems((current) => current.map((item) => { const row = item as RecordItem; return text(row.id) === id ? { ...row, balance: Math.max(0, Number(row.balance ?? 0) - values.amount), pendingPaymentSync: pendingSync || Boolean(row.pendingPaymentSync) } : item; }));
    setPaymentCustomer(null);
  }
  return <>
    <PageHeading eyebrow={title.toUpperCase()} title={title} subtitle={subtitle} actions={canCreate ? <button className="primary" onClick={() => setShowCreate(true)}>+ Add {addLabel}</button> : undefined} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="toolbar"><div className="search-field">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`} /></div><button className="filter-button" onClick={() => setReload((value) => value + 1)}>Refresh</button><span className="toolbar-count">{rows.length} records</span></div>
    <div className="table-panel panel"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{rows.slice(0, 100).map((item, index) => { const record = item as RecordItem; return <tr key={String(record.id ?? index)}>{columns.map((_, columnIndex) => { const field = fieldMap[endpoint][columnIndex] ?? ""; const value = record[field]; const display = endpoint === "sales" && columnIndex === 2 ? Array.isArray(value) ? `${value.length} items` : text(value, "0") : endpoint === "suppliers" && columnIndex === 4 ? record.isActive === false ? "Archived" : "Active" : text(value); return <td key={columnIndex}>{columnIndex === 0 ? <strong>{display}</strong> : display}</td>; })}<td className="record-actions">{endpoint === "customers" && canCreate ? <><button className="text-button" onClick={() => setEditingCustomer(record)}>Edit</button><button className="text-button" onClick={() => setPaymentCustomer(record)}>Payment history</button></> : null}{endpoint === "suppliers" && canCreate && record.isActive !== false ? <><button className="text-button" onClick={() => setEditingSupplier(record)}>Edit</button><button className="text-button" onClick={() => void archiveSupplier(record)}>Archive</button></> : null}{record.pendingSync || record.pendingPaymentSync ? <span className="badge warning">Pending sync</span> : null}</td></tr>; })}</tbody></table>{!rows.length && <Empty text={error ? "Could not load records." : `No ${title.toLowerCase()} to display yet.`} />}</div>
    {showCreate ? <DataCreateModal endpoint={endpoint} title={addLabel} onClose={() => setShowCreate(false)} onSave={createRecord} /> : null}
    {editingCustomer ? <CustomerEditModal customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSave={(values) => updateCustomer(editingCustomer, values)} /> : null}
    {editingSupplier ? <SupplierEditModal supplier={editingSupplier} onClose={() => setEditingSupplier(null)} onSave={(values) => updateSupplier(editingSupplier, values)} /> : null}
    {paymentCustomer ? <CustomerPaymentModal customer={paymentCustomer} branchId={branchId} onClose={() => setPaymentCustomer(null)} onSave={(values) => recordCustomerPayment(paymentCustomer, values)} /> : null}
  </>;
}

function SupplierEditModal({ supplier, onClose, onSave }: { supplier: RecordItem; onClose: () => void; onSave: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({ name: text(supplier.name, ""), contactName: text(supplier.contactName, ""), phone: text(supplier.phone, ""), email: text(supplier.email, ""), notes: text(supplier.notes, "") });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return;
    if ((values.name ?? "").trim().length < 2) { setError("Supplier name must contain at least two characters."); return; }
    setSaving(true); setError(""); try { await onSave(values); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not update supplier."); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card customer-modal" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">SUPPLIER RECORD</span><h2>Edit supplier</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {([ ["name", "Supplier name", "text"], ["contactName", "Contact name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["notes", "Notes", "text"] ] as const).map(([key, title, type]) => <label key={key}>{title}<input type={type} required={key === "name"} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
  </form></div>;
}

function CustomerEditModal({ customer, onClose, onSave }: { customer: RecordItem; onClose: () => void; onSave: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({ name: text(customer.name, ""), businessName: text(customer.businessName, ""), phone: text(customer.phone, ""), email: text(customer.email, ""), address: text(customer.address, ""), taxPin: text(customer.taxPin, ""), creditLimit: String(customer.creditLimit ?? 0), notes: text(customer.notes, "") });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return;
    if ((values.name ?? "").trim().length < 2) { setError("Customer name must contain at least two characters."); return; }
    if (!Number.isFinite(Number(values.creditLimit)) || Number(values.creditLimit) < 0) { setError("Credit limit must be a non-negative amount."); return; }
    setSaving(true); setError(""); try { await onSave(values); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not update customer."); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card customer-modal" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">CUSTOMER RECORD</span><h2>Edit customer</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {([ ["name", "Customer name", "text"], ["businessName", "Business name", "text"], ["phone", "Phone", "tel"], ["email", "Email", "email"], ["address", "Address", "text"], ["taxPin", "Tax PIN", "text"], ["creditLimit", "Credit limit (KES)", "number"], ["notes", "Notes", "text"] ] as const).map(([key, title, type]) => <label key={key}>{title}<input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} required={key === "name"} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
  </form></div>;
}

function CustomerPaymentModal({ customer, branchId, onClose, onSave }: { customer: RecordItem; branchId?: string | null; onClose: () => void; onSave: (values: { amount: number; method: string; reference: string; note: string }) => Promise<void> }) {
  const [payments, setPayments] = useState<RecordItem[]>([]);
  const [values, setValues] = useState({ amount: "", method: "cash", reference: "", note: "" });
  const [saving, setSaving] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { const id = text(customer.id, ""); if (!id) { setLoading(false); return; } api.customerPayments(id, branchId).then(setPayments).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load payment history.")).finally(() => setLoading(false)); }, [customer.id, branchId]);
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return;
    const amount = Number(values.amount); if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a payment amount greater than zero."); return; }
    setSaving(true); setError(""); try { await onSave({ ...values, amount }); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not record payment."); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card customer-modal" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">CUSTOMER BALANCE · {money(customer.balance)}</span><h2>{text(customer.name, "Customer payments")}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    <div className="customer-payment-history">{loading ? <p className="muted">Loading payment history…</p> : payments.length ? payments.slice(0, 8).map((payment) => <div className="finance-row" key={String(payment.id)}><strong>{text(payment.method, "Payment")} · {money(payment.amount)}</strong><small>{payment.paymentDate ? new Date(String(payment.paymentDate)).toLocaleDateString() : "Date unavailable"}{payment.reference ? ` · ${String(payment.reference)}` : ""}</small></div>) : <p className="muted">No standalone payments recorded for this customer.</p>}</div>
    <label>Amount (KES)<input autoFocus type="number" min="0.01" step="0.01" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} required /></label>
    <label>Method<select value={values.method} onChange={(event) => setValues((current) => ({ ...current, method: event.target.value }))}>{["cash", "mpesa", "bank", "credit"].map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}</select></label>
    <label>Reference<input value={values.reference} onChange={(event) => setValues((current) => ({ ...current, reference: event.target.value }))} /></label>
    <label>Note<input value={values.note} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} /></label>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Close</button><button className="primary" disabled={saving}>{saving ? "Recording…" : "Record payment"}</button></div>
  </form></div>;
}

function DataCreateModal({ endpoint, title, onClose, onSave }: { endpoint: "customers" | "suppliers" | "expenses" | "sales"; title: string; onClose: () => void; onSave: (values: Record<string, string>) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({ name: "", businessName: "", address: "", taxPin: "", phone: "", email: "", contactName: "", notes: "", creditLimit: "0", amount: "", note: "", expenseDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isExpense = endpoint === "expenses";
  const fields = isExpense ? [
    { key: "note", label: "Description", required: true }, { key: "amount", label: "Amount (KES)", type: "number", required: true }, { key: "expenseDate", label: "Expense date", type: "date", required: true }
  ] : endpoint === "suppliers" ? [
    { key: "name", label: "Supplier name", required: true }, { key: "contactName", label: "Contact name" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email", type: "email" }, { key: "notes", label: "Notes" }
  ] : [
    { key: "name", label: "Customer name", required: true }, { key: "businessName", label: "Business name" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email", type: "email" }, { key: "address", label: "Address" }, { key: "taxPin", label: "Tax PIN" }, { key: "creditLimit", label: "Credit limit (KES)", type: "number" }, { key: "notes", label: "Notes" }
  ];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const nameValue = (values.name ?? values.note ?? "").trim();
    if (nameValue.length < (isExpense ? 1 : 2)) { setError(isExpense ? "Enter an expense description." : `Enter a ${title} name with at least two characters.`); return; }
    if (isExpense && (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0)) { setError("Enter an amount greater than zero."); return; }
    if (!isExpense && values.creditLimit && (!Number.isFinite(Number(values.creditLimit)) || Number(values.creditLimit) < 0)) { setError("Enter a valid non-negative credit limit."); return; }
    setSaving(true); setError("");
    try { await onSave(values); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : `Could not save ${title}.`); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">NEW RECORD</span><h2>Add {title}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {fields.map((field) => <label key={field.key}>{field.label}<input autoFocus={field.key === (isExpense ? "note" : "name")} type={field.type ?? "text"} min={field.type === "number" ? (isExpense ? 0.01 : 0) : undefined} step={field.key === "amount" || field.key === "creditLimit" ? "0.01" : undefined} value={values[field.key] ?? ""} required={field.required} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /></label>)}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving..." : `Save ${title}`}</button></div>
  </form></div>;
}

function ReportView({ session }: { session: Session }) {
  const initialRange = reportPresetRange("week");
  const [preset, setPreset] = useState<"today" | "week" | "month" | "year" | "custom">("week");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState<DailySummary | null>(null);
  const [payments, setPayments] = useState<Array<{ _id?: string; total?: number; count?: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ _id?: string; productName?: string; quantity?: number; total?: number }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const branchId = session.branches?.[0]?.id;
  useEffect(() => {
    if (from > to) { setError("Start date must be on or before the end date."); return; }
    let active = true; setLoading(true); setError("");
    Promise.all([api.reports(branchId, from, to), api.paymentBreakdown(branchId, from, to), api.topProducts(branchId, from, to)])
      .then(([summary, breakdown, products]) => { if (active) { setData(summary); setPayments(breakdown); setTopProducts(products); } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the selected report period."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, from, to]);
  function selectPreset(next: typeof preset) {
    setPreset(next);
    if (next !== "custom") { const range = reportPresetRange(next); setFrom(range.from); setTo(range.to); }
  }
  function exportReport() {
    if (!data) return;
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["Section", "Name", "Value", "Count"], ["Period", "From", from, ""], ["Period", "To", to, ""], ["Summary", "Revenue", String(data.salesTotal ?? 0), ""], ["Summary", "Profit", String(data.estimatedProfit ?? 0), ""], ["Summary", "Cost of goods sold", String(data.cogsTotal ?? 0), ""], ["Summary", "Expenses", String(data.expensesTotal ?? 0), ""], ["Summary", "Debt", String(data.debtTotal ?? 0), ""], ["Summary", "Transactions", String(data.transactionsCount ?? 0), ""], ...payments.map((payment) => ["Payment method", String(payment._id ?? "Other"), String(payment.total ?? 0), String(payment.count ?? 0)]), ...topProducts.map((product) => ["Top product", String(product.productName ?? product._id ?? "Item"), String(product.total ?? 0), String(product.quantity ?? 0)])];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `dira-os-report-${from}-to-${to}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const transactionCount = Number(data?.transactionsCount ?? 0);
  return <><PageHeading eyebrow="BUSINESS INTELLIGENCE" title="Reports" subtitle="Review and export business performance for a selected date range." actions={<button className="secondary" onClick={exportReport} disabled={!data || loading}>Export CSV</button>} />
    <section className="panel report-filters"><div className="preference-list"><label>Reporting period<select value={preset} onChange={(event) => selectPreset(event.target.value as typeof preset)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom range</option></select></label><label>From<input type="date" value={from} max={to} onChange={(event) => { setPreset("custom"); setFrom(event.target.value); }} /></label><label>To<input type="date" value={to} min={from} max={reportToday()} onChange={(event) => { setPreset("custom"); setTo(event.target.value); }} /></label></div></section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="metric-grid"><Metric label="Revenue" value={money(data?.salesTotal)} delta="Selected period" tone="blue" /><Metric label="Profit" value={money(data?.estimatedProfit)} delta="After expenses" tone="green" /><Metric label="Cost of goods sold" value={money(data?.cogsTotal)} delta="Selected period" tone="amber" /><Metric label="Margin" value={`${data?.salesTotal ? Math.round(((data.estimatedProfit ?? 0) / data.salesTotal) * 100) : 0}%`} delta="Net profit / revenue" tone="red" /><Metric label="Expenses" value={money(data?.expensesTotal)} delta="Selected period" tone="amber" /><Metric label="Debt" value={money(data?.debtTotal)} delta="Outstanding" tone="red" /><Metric label="Transactions" value={String(transactionCount)} delta="Selected period" tone="green" /></div>
    <div className="dashboard-grid"><Panel title={`Revenue trend · ${from} to ${to}`}><ReportSalesChart session={session} from={from} to={to} /></Panel><Panel title="Payment mix"><div className="finance-breakdown">{payments.length ? payments.map((payment) => <div className="finance-row" key={String(payment._id)}><strong>{text(payment._id, "Other")}</strong><span>{money(payment.total)}</span><small>{text(payment.count, "0")} payments</small></div>) : <Empty text={loading ? "Loading report data…" : "No payments in the selected period."} />}</div></Panel></div>
    <section className="panel"><div className="panel-heading"><h2>Top products</h2><span className="muted">Selected period</span></div><div className="finance-breakdown">{topProducts.length ? topProducts.map((product) => <div className="finance-row" key={String(product._id)}><strong>{text(product.productName ?? product._id, "Item")}</strong><span>{money(product.total)}</span><small>{text(product.quantity, "0")} units</small></div>) : <Empty text={loading ? "Loading report data…" : "No product activity in this period."} />}</div></section>
  </>;
}

function reportToday() { return reportDateKey(new Date()); }
function reportDateKey(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); }
function reportPresetRange(preset: Exclude<"today" | "week" | "month" | "year" | "custom", "custom">) {
  const today = new Date(); const start = new Date(today); start.setHours(0, 0, 0, 0);
  if (preset === "week") start.setDate(start.getDate() - 6);
  if (preset === "month") start.setDate(1);
  if (preset === "year") { start.setMonth(0, 1); }
  return { from: reportDateKey(start), to: reportDateKey(today) };
}

function ReportSalesChart({ session, from, to }: { session: Session; from: string; to: string }) {
  const [sales, setSales] = useState<Sale[]>([]); const [error, setError] = useState("");
  const branchId = session.branches?.[0]?.id;
  useEffect(() => { let active = true; api.sales(branchId).then((items) => { if (active) { setSales(items); setError(""); } }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load the selected period trend."); }); return () => { active = false; }; }, [branchId]);
  const chart = useMemo(() => {
    const start = new Date(`${from}T00:00:00`); const end = new Date(`${to}T23:59:59.999`); const span = Math.max(1, end.getTime() - start.getTime() + 1); const totals = Array.from({ length: 7 }, () => 0);
    for (const sale of sales) { const date = new Date(sale.createdAt); if (date < start || date > end) continue; const index = Math.min(6, Math.floor(((date.getTime() - start.getTime()) / span) * 7)); totals[index] = (totals[index] ?? 0) + Number(sale.grandTotal ?? 0); }
    const max = Math.max(...totals, 1); const points = totals.map((value, index) => `${(index / 6) * 100},${100 - (value / max) * 82 - 8}`).join(" ");
    const labels = Array.from({ length: 7 }, (_, index) => { const date = new Date(start.getTime() + span * (index / 6)); return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); });
    return { totals, max, points, labels };
  }, [sales, from, to]);
  if (error) return <div className="sales-chart"><Empty text={error} /></div>;
  if (sales.length === 0) return <div className="sales-chart"><Empty text="Sales performance will appear after sales are synchronized." /></div>;
  return <div className="sales-chart" aria-label={`Sales performance from ${from} to ${to}`}><svg className="sales-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img"><defs><linearGradient id="report-sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs><path d={`M ${chart.points.split(" ")[0]} L ${chart.points} L 100,100 L 0,100 Z`} fill="url(#report-sales-fill)" /><polyline points={chart.points} fill="none" stroke="var(--primary)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />{chart.points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle key={index} cx={cx} cy={cy} r="1.4" fill="var(--surface)" stroke="var(--primary)" strokeWidth=".8" vectorEffect="non-scaling-stroke" />; })}</svg><div className="sales-chart-labels">{chart.labels.map((label, index) => <span key={index}>{label}</span>)}</div></div>;
}

function FinanceView({ session }: { session: Session }) { return <><DesktopFinance session={session} /><DesktopInvoices session={session} /></>; }

function InsightsView({ session }: { session: Session }) {
  const [data, setData] = useState<import("@vbo/shared").EnterpriseAnalytics | null>(null);
  const businessConfig = resolveBusinessTypeConfig({ businessType: session.business?.businessType, industryKey: session.business?.industryKey });
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year" | "custom">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const range = useMemo(() => {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (period === "custom") return { from: customFrom, to: customTo };
    const from = period === "today" ? today : period === "week" ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6) : period === "year" ? new Date(today.getFullYear(), 0, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(from), to: iso(today) };
  }, [period, customFrom, customTo]);
  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const branchId = session.branches?.[0]?.id;
  useEffect(() => {
    if (!validRange) return;
    let active = true;
    setLoading(true); setError("");
    api.enterpriseAnalytics(branchId, range.from, range.to).then((result) => { if (active) setData(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load business insights."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, range.from, range.to, validRange, reload]);
  const summary = data?.summary;
  const renderRows = (title: string, rows: Array<{ key: string; label: string; primary: string; secondary?: string }>, empty: string) => <Panel title={title}><div className="finance-breakdown">{rows.length ? rows.slice(0, 8).map((row) => <div className="finance-row" key={row.key}><strong>{row.label}</strong><span>{row.primary}</span>{row.secondary ? <small>{row.secondary}</small> : null}</div>) : <Empty text={error ? "Could not load this insight." : empty} />}</div></Panel>;
  return <><PageHeading eyebrow="INSIGHTS" title="Business insights" subtitle="Performance signals calculated from the business analytics service." actions={<button className="secondary" disabled={loading || !validRange} onClick={() => setReload((value) => value + 1)}>{loading ? "Refreshing…" : "Refresh"}</button>} />
    <Panel title="Date range"><div className="finance-filters">{([["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"]] as const).map(([value, label]) => <button key={value} className={period === value ? "primary" : "secondary"} onClick={() => setPeriod(value)}>{label}</button>)}<button className={period === "custom" ? "primary" : "secondary"} onClick={() => setPeriod("custom")}>Custom</button></div>{period === "custom" ? <div className="form-grid"><label>From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label><label>To<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label></div> : null}<small className="muted">Showing {data?.range.label ?? (validRange ? `${range.from} – ${range.to}` : "Choose a valid date range")}</small></Panel>
    {error && <div className="error-banner" role="alert">{error}</div>}{!validRange ? <div className="error-banner" role="alert">Choose a valid start and end date.</div> : null}
    <div className="metric-grid"><Metric label="Revenue" value={money(summary?.revenueTotal)} delta={data?.range.label ?? "Selected period"} tone="blue" /><Metric label="Gross profit" value={money(summary?.profitTotal)} delta={`${text(summary?.monthlyGrowthPercent, "0")}% monthly growth`} tone="green" /><Metric label="Average order" value={money(summary?.averageOrderValue)} delta={`${text(summary?.salesCount, "0")} sales`} tone="amber" />{businessConfig.capabilities.inventory ? <Metric label="Inventory turnover" value={text(summary?.inventoryTurnover, "0")} delta="Selected period" tone="red" /> : null}</div>
    {loading && !data ? <Empty text="Loading business insights…" /> : null}
    <div className="dashboard-grid">
      {renderRows("Revenue trend", (data?.revenueTrend ?? []).map((p) => ({ key: p.period, label: p.period, primary: money(p.revenue), secondary: `${p.salesCount} sales · profit ${money(p.profit)}` })), "Revenue trends will appear after sales.")}
      {renderRows("Sales trend", (data?.salesTrend ?? []).map((p, i) => ({ key: `${p.label}-${i}`, label: p.label, primary: `${p.value.toLocaleString()} sales`, secondary: money(p.secondaryValue) })), "Sales trends will appear after sales.")}
      {businessConfig.capabilities.products ? renderRows("Top products", (data?.productPerformance ?? []).map((p) => ({ key: p.productId, label: p.label, primary: money(p.revenue), secondary: `${p.value.toLocaleString()} units` })), "Product performance will appear after sales.") : <Panel title={`${businessConfig.workspace.activityLabel} analytics`}><p className="muted">{businessConfig.workflow.steps.join("  →  ")}</p></Panel>}
      {renderRows("Top customers", (data?.customerPerformance ?? []).map((p) => ({ key: p.customerId, label: p.label, primary: money(p.value), secondary: `${p.secondaryValue ?? 0} visits · ${money(p.balance)} balance` })), "Customer performance will appear after sales.")}
      {renderRows("Peak hours", (data?.peakHours ?? []).map((p, i) => ({ key: `${p.label}-${i}`, label: p.label, primary: `${p.value.toLocaleString()} sales`, secondary: money(p.secondaryValue) })), "Peak hours will appear after sales.")}
      {renderRows("Staff performance", (data?.staffPerformance ?? []).map((p, i) => ({ key: p.staffId || `${p.label}-${i}`, label: p.label, primary: money(p.value), secondary: `${p.secondaryValue ?? 0} orders · avg ${money(p.averageTicket)}` })), "Staff performance will appear after sales.")}
      {businessConfig.capabilities.inventory ? renderRows("Inventory turnover", (data?.inventoryTurnover ?? []).map((p, i) => ({ key: p.productId || `${p.label}-${i}`, label: p.label, primary: `${p.value.toFixed(2)} turns`, secondary: `${p.secondaryValue ?? 0} sold · ${p.stockOnHand} on hand` })), "Inventory movement will appear after sales.") : null}
      {renderRows("Profit trends", (data?.profitTrends ?? []).map((p) => ({ key: p.period, label: p.period, primary: money(p.profit), secondary: `${p.salesCount} sales · expenses ${money(p.expenses)}` })), "Profit trends will appear after sales.")}
      {renderRows("Forecast", (data?.forecast ?? []).map((p) => ({ key: p.month, label: p.month, primary: money(p.revenue), secondary: "Forecast revenue" })), "Forecast will appear when enough data is available.")}
      {renderRows("Monthly growth", (data?.monthlyGrowth ?? []).map((p) => ({ key: p.month, label: p.month, primary: `${p.growthPercent.toFixed(1)}%`, secondary: money(p.revenue) })), "Monthly growth will appear after sales.")}
    </div>
  </>;
}

function TeamView({ session, allBranches }: { session: Session; allBranches: Branch[] }) {
  const [items, setItems] = useState<unknown[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [reload, setReload] = useState(0);
  const branchId = session.branches?.[0]?.id;
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.employees(branchId).then((next) => { if (active) setItems(next); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load team members."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, reload]);
  async function toggleEmployee(record: RecordItem) {
    const id = text(record.id, "");
    if (!id || busyId) return;
    setBusyId(id); setError("");
    try {
      if (record.isActive === false) await api.restoreEmployee(id);
      else await api.suspendEmployee(id);
      setReload((value) => value + 1);
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Could not update this employee."); }
    finally { setBusyId(""); }
  }
  async function invite(values: { fullName: string; phone: string; password: string; pin: string; role: "manager" | "cashier" }) {
    setError("");
    await api.createEmployee({ ...values, phone: values.phone || null, pin: values.pin || null, branchId: branchId ?? null });
    setShowInvite(false);
    setReload((value) => value + 1);
  }
  async function updateEmployee(record: RecordItem, values: { fullName: string; phone: string; role: UserRole; roleLabel: string; branchId: string; permissions: AccessPermission[] }) {
    const id = text(record.id, "");
    if (!id) throw new Error("This employee cannot be updated because the server ID is missing.");
    const updated = await api.updateEmployee(id, {
      fullName: values.fullName.trim(), phone: values.phone.trim() || null, role: values.role,
      roleLabel: values.roleLabel.trim() || null, permissions: values.permissions,
      ...(session.user.role === "owner" ? { branchId: values.branchId || null } : {})
    });
    setItems((current) => current.map((item) => text((item as RecordItem).id) === id ? updated : item));
    setEditing(null);
  }
  return <>
    <PageHeading eyebrow="TEAM & ACCESS" title="Team members" subtitle="Review staff access and roles for this workspace." actions={<button className="primary" onClick={() => setShowInvite(true)}>+ Invite teammate</button>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="table-panel panel"><table><thead><tr><th>Name</th><th>Role</th><th>Branch</th><th>Status</th><th /></tr></thead><tbody>{items.map((item, index) => { const record = item as RecordItem; const id = text(record.id, ""); const active = record.isActive !== false; return <tr key={id || index}><td><strong>{text(record.fullName ?? record.name, `Team member ${index + 1}`)}</strong><small>{text(record.phone)}</small></td><td>{text(record.roleLabel ?? record.role)}</td><td>{text(record.branchName, text(allBranches.find((branch) => branch.id === record.branchId)?.name, "Workspace"))}</td><td><span className={`badge ${active ? "success" : "warning"}`}>{active ? "Active" : "Inactive"}</span></td><td>{record.role !== "owner" && id ? <><button className="text-button" onClick={() => setEditing(record)}>Edit access</button><button className="text-button" disabled={busyId === id} onClick={() => void toggleEmployee(record)}>{busyId === id ? "Saving…" : active ? "Suspend" : "Restore"}</button></> : null}</td></tr>; })}</tbody></table>{loading ? <Empty text="Loading team members…" /> : !items.length && <Empty text={error ? "Could not load team members." : "No team members are available for this branch."} />}</div>
    {showInvite ? <TeamInviteModal onClose={() => setShowInvite(false)} onSave={invite} /> : null}
    {editing ? <EmployeeAccessModal employee={editing} branches={allBranches} canAssignBranch={session.user.role === "owner"} onClose={() => setEditing(null)} onSave={(values) => updateEmployee(editing, values)} /> : null}
  </>;
}

function EmployeeAccessModal({ employee, branches, canAssignBranch, onClose, onSave }: { employee: RecordItem; branches: Branch[]; canAssignBranch: boolean; onClose: () => void; onSave: (values: { fullName: string; phone: string; role: UserRole; roleLabel: string; branchId: string; permissions: AccessPermission[] }) => Promise<void> }) {
  const initialRole = ROLE_PRESETS.some((preset) => preset.role === employee.role) ? employee.role as UserRole : "cashier";
  const initialPermissions = Array.isArray(employee.permissions) ? employee.permissions.filter((permission): permission is AccessPermission => ACCESS_PERMISSIONS.includes(permission as AccessPermission)) : [...ROLE_ACCESS[initialRole]];
  const [values, setValues] = useState({ fullName: text(employee.fullName, ""), phone: text(employee.phone, ""), role: initialRole, roleLabel: text(employee.roleLabel, formatRoleLabel(initialRole)), branchId: text(employee.branchId, ""), permissions: initialPermissions });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  function changeRole(role: UserRole) { setValues((current) => ({ ...current, role, roleLabel: formatRoleLabel(role), permissions: [...ROLE_ACCESS[role]] })); }
  function toggle(permission: AccessPermission) { setValues((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] })); }
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return;
    if (values.fullName.trim().length < 2) { setError("Employee name must contain at least two characters."); return; }
    setSaving(true); setError(""); try { await onSave(values); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not update employee access."); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card customer-modal" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">EMPLOYEE ACCESS</span><h2>Edit {text(employee.fullName, "employee")}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    <label>Full name<input autoFocus value={values.fullName} onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))} required minLength={2} /></label>
    <label>Phone<input type="tel" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} /></label>
    <label>Role preset<select value={values.role} onChange={(event) => changeRole(event.target.value as UserRole)}>{ROLE_PRESETS.filter((preset) => preset.role !== "owner").map((preset) => <option key={preset.role} value={preset.role}>{preset.label}</option>)}</select></label>
    <label>Display label<input value={values.roleLabel} onChange={(event) => setValues((current) => ({ ...current, roleLabel: event.target.value }))} /></label>
    {canAssignBranch ? <label>Branch<select value={values.branchId} onChange={(event) => setValues((current) => ({ ...current, branchId: event.target.value }))}><option value="">No branch assignment</option>{branches.filter((branch) => branch.status !== "inactive").map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label> : <p className="muted">Branch assignment is controlled by the business owner.</p>}
    <div><strong>Permissions ({values.permissions.length})</strong><p className="muted">Choose the permissions granted to this employee. The API applies its role and tenant rules.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 7, maxHeight: 230, overflowY: "auto", padding: "4px 0" }}>{ACCESS_PERMISSIONS.map((permission) => { const selected = values.permissions.includes(permission); return <label key={permission} style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, padding: "7px 9px", border: "1px solid var(--line)", borderRadius: 8, fontWeight: 500 }}><input type="checkbox" checked={selected} onChange={() => toggle(permission)} />{formatPermissionLabel(permission)}</label>; })}</div></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save access"}</button></div>
  </form></div>;
}

function TeamAccessView({ session, onNavigate }: { session: Session; onNavigate: (view: View) => void }) {
  const role = session.user.role as UserRole;
  const currentPermissions = getEffectivePermissions({ role, permissions: session.user.permissions?.filter((value): value is AccessPermission => ACCESS_PERMISSIONS.includes(value as AccessPermission)) ?? null });
  return <>
    <PageHeading eyebrow="TEAM ACCESS" title="Roles and permissions" subtitle="Review the shared role presets and the permissions active for this account." actions={<button className="primary" onClick={() => onNavigate("team")}>Open employees →</button>} />
    <div className="dashboard-grid">
      <Panel title="Access snapshot"><div className="settings-list">
        <div className="setting-row"><span className="avatar">{text(session.user.fullName, "U").slice(0, 1).toUpperCase()}</span><div><strong>{text(session.user.fullName)}</strong><small>{text(session.business?.name, "Workspace")}</small></div><span className="badge primary">{formatRoleLabel(role)}</span></div>
        <div className="setting-row"><span className="setting-icon">⛨</span><div><strong>Effective access</strong><small>{role === "owner" ? "Owners retain all business permissions." : "Permission overrides are applied by the API."}</small></div><span className="badge success">{currentPermissions.length} permissions</span></div>
      </div><div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>{currentPermissions.map((permission) => <span className="badge success" key={permission}>{formatPermissionLabel(permission)}</span>)}</div></Panel>
      <Panel title="Permission coverage"><div className="finance-breakdown">{[["Roles", String(ROLE_PRESETS.length)], ["Available permissions", String(ACCESS_PERMISSIONS.length)], ["Current role", formatRoleLabel(role)]].map(([label, value]) => <div className="finance-row" key={label}><strong>{label}</strong><span>{value}</span></div>)}</div><p className="muted">Employee permission overrides are edited from the employee workspace. Role rules are shared with mobile and enforced by the API.</p></Panel>
    </div>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 18 }} aria-label="Role permission matrix">
      {ROLE_PRESETS.map((preset) => { const isCurrent = role === preset.role; const permissions = ROLE_ACCESS[preset.role]; return <article className="panel" key={preset.role} style={{ borderColor: isCurrent ? "var(--primary)" : undefined }}>
        <div className="panel-heading"><div><span className="eyebrow">{permissions.length} PERMISSIONS</span><h2>{preset.label}</h2></div>{isCurrent ? <span className="badge success">Current role</span> : null}</div>
        <p className="muted">{preset.description}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{permissions.map((permission) => <span className="badge primary" key={permission}>{formatPermissionLabel(permission)}</span>)}</div>
      </article>; })}
    </section>
  </>;
}

function TeamInviteModal({ onClose, onSave }: { onClose: () => void; onSave: (values: { fullName: string; phone: string; password: string; pin: string; role: "manager" | "cashier" }) => Promise<void> }) {
  const [values, setValues] = useState({ fullName: "", phone: "", password: "", pin: "", role: "cashier" as "manager" | "cashier" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (values.fullName.trim().length < 2) { setError("Enter the teammate’s full name."); return; }
    if (values.phone.trim().length < 7) { setError("Enter a valid phone number."); return; }
    if (values.password.length < 6) { setError("The temporary password must have at least 6 characters."); return; }
    if (values.pin && values.pin.length < 4) { setError("The PIN must have at least 4 characters."); return; }
    setSaving(true); setError("");
    try { await onSave({ ...values, fullName: values.fullName.trim(), phone: values.phone.trim() }); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not invite this teammate."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">TEAM ACCESS</span><h2>Invite teammate</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    <label>Full name<input autoFocus value={values.fullName} onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))} required /></label>
    <label>Phone number<input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} required /></label>
    <label>Role<select value={values.role} onChange={(event) => setValues((current) => ({ ...current, role: event.target.value as "manager" | "cashier" }))}><option value="cashier">Cashier</option><option value="manager">Manager</option></select></label>
    <label>Temporary password<input type="password" autoComplete="new-password" minLength={6} value={values.password} onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))} required /></label>
    <label>PIN (optional)<input type="password" inputMode="numeric" autoComplete="new-password" minLength={4} value={values.pin} onChange={(event) => setValues((current) => ({ ...current, pin: event.target.value }))} /></label>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Inviting…" : "Create teammate"}</button></div>
  </form></div>;
}


function SettingsView({ view, session, allBranches, onBranchesChange, onLogout }: { view: View; session: Session; allBranches: Branch[]; onBranchesChange: (branches: Branch[]) => void; onLogout: () => void }) { const titles: Record<string, [string, string]> = { team: ["Team & access", "Manage roles, permissions and branch access."], settings: ["Business settings", "Your workspace preferences and branch configuration."], notifications: ["Notifications", "Stay on top of important activity and sync events."], subscription: ["Subscription", "Manage your Dira OS plan and account billing."] }; const [title, subtitle] = titles[view] ?? ["Business settings", "Your workspace preferences and branch configuration."]; function savePreferences() { window.localStorage.setItem("bizpro.desktop.businessName", text(session.business?.name)); } return <><PageHeading eyebrow="ADMINISTRATION" title={title} subtitle={subtitle} /><div className="settings-grid"><Panel title="Workspace profile"><div className="settings-list"><div className="setting-row"><span className="avatar">{text(session.user.fullName, "U").slice(0, 1)}</span><div><strong>{text(session.user.fullName)}</strong><small>{text(session.user.role, "Owner")} · {text(session.user.businessId)}</small></div><span className="badge success">Active</span></div><div className="setting-row"><span className="setting-icon">⌘</span><div><strong>Permissions and access</strong><small>Roles are enforced consistently across every device.</small></div><span className="badge success">Protected</span></div><div className="setting-row"><span className="setting-icon">⇄</span><div><strong>Offline & synchronization</strong><small>{queuedCount()} actions waiting to sync.</small></div><span className="badge success">Ready</span></div></div></Panel><Panel title="Quick preferences"><div className="preference-list"><label>Business name<input defaultValue={text(session.business?.name)} /></label><label>Currency<select defaultValue={session.business?.currency ?? "KES"}><option>{session.business?.currency ?? "KES"}</option></select></label></div><div className="heading-actions"><button className="primary" onClick={savePreferences}>Save changes</button><button className="secondary" onClick={onLogout}>Sign out</button></div></Panel></div>{view === "settings" && canAccess(session, "manageBranches") ? <DesktopBranches session={{ ...session, branches: allBranches }} onBranchesChange={onBranchesChange} /> : null}</>; }
function Empty({ text: label }: { text: string }) { return <div className="empty"><span>◌</span><p>{label}</p></div>; }
