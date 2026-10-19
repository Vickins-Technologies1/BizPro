"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ACCESS_PERMISSIONS, PLAN_EMPLOYEE_LIMITS, PLAN_NAMES, PLAN_PRICING, PLAN_TIERS, ROLE_ACCESS, ROLE_PRESETS, businessSetupSchema, formatPermissionLabel, formatRoleLabel, getEffectivePermissions, hasPermission, listIndustryModules, resolveBusinessTypeConfig, resolveCatalogCreationConfig, resolveCatalogCreationContext, resolveIndustryKey, type AccessPermission, type Branch, type Customer, type DailySummary, type Product, type Sale, type UserRole } from "@vbo/shared";
import { api, clearSession, DesktopApiError, flushOfflineQueue, isOfflineError, login, queueOffline, queuedCount, readSession, registerBusiness, writeSession, type Session } from "../lib/desktop-api";
import { IndustryProducts } from "./DesktopCatalog";
import { DesktopInvoices } from "./DesktopInvoices";
import { DesktopBranches } from "./DesktopBranches";
import { DesktopPos } from "./DesktopPos";
import { DesktopSalesHistory } from "./DesktopSalesHistory";
import { DesktopPurchaseOrders } from "./DesktopPurchaseOrders";
import { DesktopStockTransfers } from "./DesktopStockTransfers";

type View = "dashboard" | "pos" | "products" | "inventory" | "purchaseOrders" | "transfers" | "customers" | "suppliers" | "expenses" | "sales" | "reports" | "finance" | "insights" | "operations" | "team" | "teamAccess" | "settings" | "notifications" | "subscription";
type RecordItem = Record<string, unknown>;

const nav: Array<{ id: View; label: string; icon: string; group: string; permission?: AccessPermission }> = [
  { id: "dashboard", label: "Overview", icon: "⌂", group: "Workspace" },
  { id: "pos", label: "Point of sale", icon: "▣", group: "Workspace", permission: "createSales" },
  { id: "products", label: "Products", icon: "▤", group: "Manage", permission: "manageInventory" },
  { id: "inventory", label: "Inventory", icon: "◫", group: "Manage", permission: "manageInventory" },
  { id: "purchaseOrders", label: "Purchase orders", icon: "⇩", group: "Manage", permission: "manageInventory" },
  { id: "transfers", label: "Stock transfers", icon: "⇄", group: "Manage", permission: "manageInventory" },
  { id: "customers", label: "Customers", icon: "◎", group: "Manage", permission: "manageCustomers" },
  { id: "suppliers", label: "Suppliers", icon: "⇄", group: "Manage", permission: "manageSuppliers" },
  { id: "expenses", label: "Expenses", icon: "−", group: "Manage", permission: "manageExpenses" },
  { id: "sales", label: "Sales history", icon: "◷", group: "Insights", permission: "manageSales" },
  { id: "reports", label: "Reports", icon: "⌁", group: "Insights", permission: "viewReports" },
  { id: "finance", label: "Finance", icon: "¤", group: "Insights", permission: "manageExpenses" },
  { id: "insights", label: "Insights", icon: "◒", group: "Insights", permission: "viewReports" },
  { id: "operations", label: "Operations", icon: "▦", group: "Manage", permission: "manageOperations" },
  { id: "team", label: "Team & access", icon: "♙", group: "Admin", permission: "manageEmployees" },
  { id: "teamAccess", label: "Team access", icon: "⛨", group: "Admin", permission: "manageEmployees" },
  { id: "settings", label: "Business settings", icon: "⚙", group: "Admin", permission: "manageSettings" },
  { id: "notifications", label: "Notifications", icon: "◉", group: "Admin" },
  { id: "subscription", label: "Subscription", icon: "◇", group: "Admin", permission: "manageSettings" }
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
  "--bg": "#08111f",
  "--surface": "#0d1929",
  "--surface-2": "#132238",
  "--line": "#223a57",
  "--text": "#f5f7fa",
  "--muted": "#a9b8ca",
  "--primary": "#3b82f6",
  "--primary-2": "#2563eb",
  "--green": "#32d583",
  "--amber": "#fdb022",
  "--red": "#f97066",
  "--purple": "#7b61c9",
  "--shadow": "0 18px 50px rgba(0,0,0,.2)",
  "--shadow-strong": "0 12px 28px rgba(0,0,0,.24)"
} as const;

function money(value: unknown) { return `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function text(value: unknown, fallback = "-") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function canAccess(session: Session, permission: AccessPermission) {
  const permissions = session.user.permissions?.filter((value): value is AccessPermission => ACCESS_PERMISSIONS.includes(value as AccessPermission)) ?? null;
  return hasPermission({ role: session.user.role, permissions }, permission);
}

export function DesktopShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("dashboard");
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
  const activeBranch = activeBranches.find((branch) => branch.id === selectedBranchId) ?? activeBranches.find((branch) => branch.isDefault) ?? activeBranches[0];
  const activeSession = activeBranch ? { ...session, branches: [activeBranch] } : session;
  const inventoryEnabled = resolveBusinessTypeConfig({ businessType: session.business?.businessType, industryKey: session.business?.industryKey }).capabilities.inventory;
  const visibleNav = nav.filter((item) => (!item.permission || canAccess(session, item.permission)) && (!(["purchaseOrders", "transfers"] as View[]).includes(item.id) || inventoryEnabled));
  return <div className={`desktop-app ${theme}`} style={(theme === "light" ? lightThemeVars : darkThemeVars) as CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src="/dira-os-logo.png" alt="Dira OS" /><div><strong>Dira OS</strong><span>Business OS</span></div></div>
      <div className="workspace-pill"><span className="status-dot" />{text(session.business?.name, "My business")}<span className="chevron">⌄</span></div>
      <nav>{["Workspace", "Manage", "Insights", "Admin"].map((group) => <div className="nav-group" key={group}><small>{group}</small>{visibleNav.filter((item) => item.group === group).map((item) => <button className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)} key={item.id}><i>{item.icon}</i><span>{item.label}</span></button>)}</div>)}</nav>
      <div className="sidebar-footer"><div className="sync-line"><span className={offline || pendingWrites ? "status-dot amber" : "status-dot"} />{offline ? "Offline mode" : pendingWrites ? `${pendingWrites} changes waiting` : "Connected"}<span className="sync-count">{pendingWrites}</span></div><button className="theme-button" onClick={toggleTheme}>{theme === "dark" ? "☼  Light appearance" : "☾  Dark appearance"}</button><button className="profile" onClick={() => setView("settings")}><span className="avatar">{text(session.user.fullName, "U").slice(0, 1).toUpperCase()}</span><span><strong>{text(session.user.fullName, "User")}</strong><small>{text(session.user.role, "Owner")}</small></span><span className="more">•••</span></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Dira OS</span><b>/</b><strong>{visibleNav.find((item) => item.id === view)?.label}</strong></div><div className="top-actions"><kbd>Ctrl K</kbd><button className="icon-button" aria-label="Search" onClick={() => setView("products")}>⌕</button><button className="icon-button" onClick={() => setView("notifications")} aria-label="Notifications">◉</button><select className="branch-select" aria-label="Current branch" value={activeBranch?.id ?? ""} disabled={activeBranches.length < 2} onChange={(event) => setSelectedBranchId(event.target.value)}>{activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div></header><div className="content"><ViewContent view={view} session={activeSession} allBranches={session.branches ?? []} onBranchesChange={updateBranches} offline={offline} pendingWrites={pendingWrites} onNavigate={setView} /></div></main>
  </div>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [showOnboarding, setShowOnboarding] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { onLogin(await login(identifier, password)); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in"); } finally { setLoading(false); } }
  if (showOnboarding) return <OnboardingForm onCancel={() => setShowOnboarding(false)} onComplete={onLogin} />;
  return <div className="login-page"><div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="login-brand"><img className="brand-logo large" src="/dira-os-logo.png" alt="Dira OS" /><strong>Dira OS</strong></div><div className="login-quote"><p>“The calm, clear way to run your business.”</p><span>Sales, stock and growth in one focused workspace.</span></div></div><div className="login-panel"><div className="login-inner"><span className="eyebrow">WELCOME BACK</span><h1>Run your business<br /><span>with clarity.</span></h1><p className="muted">Sign in to your Dira OS workspace to continue.</p><form onSubmit={submit}><label>Phone or email<input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@business.com" required /></label><label>Password or PIN<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Enter your password" required /></label>{error && <div className="error-banner">{error}</div>}<button className="primary full" disabled={loading}>{loading ? "Signing in..." : "Continue  →"}</button></form><p className="login-help">Protected by Dira OS access controls · <button type="button" className="text-button" onClick={() => setShowOnboarding(true)}>Create owner account</button></p></div></div></div>;
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

function ViewContent({ view, session, allBranches, onBranchesChange, offline, pendingWrites, onNavigate }: { view: View; session: Session; allBranches: Branch[]; onBranchesChange: (branches: Branch[]) => void; offline: boolean; pendingWrites: number; onNavigate: (view: View) => void }) {
  if (view === "dashboard") return <Dashboard session={session} offline={offline} pendingWrites={pendingWrites} onNavigate={onNavigate} />;
  if (view === "pos") return <DesktopPos session={session} />;
  if (view === "purchaseOrders") return <DesktopPurchaseOrders session={session} />;
  if (view === "transfers") return <DesktopStockTransfers session={session} />;
  if (view === "products" || view === "inventory") return <IndustryProducts session={session} inventory={view === "inventory"} />;
  if (view === "customers") return <DataView session={session} title="Customers" subtitle="Keep every customer relationship in one place." endpoint="customers" columns={["Name", "Phone", "Email", "Balance", "Last visit"]} />;
  if (view === "suppliers") return <DataView session={session} title="Suppliers" subtitle="Manage purchasing partners and supplier balances." endpoint="suppliers" columns={["Supplier", "Phone", "Email", "Balance", "Status"]} />;
  if (view === "expenses") return <DataView session={session} title="Expenses" subtitle="Track operating costs and keep your margins visible." endpoint="expenses" columns={["Description", "Category", "Amount", "Date", "Recorded by"]} />;
  if (view === "sales") return <DesktopSalesHistory session={session} />;
  if (view === "reports") return <ReportView session={session} />;
  if (view === "finance") return <FinanceView session={session} />;
  if (view === "insights") return <InsightsView session={session} />;
  if (view === "operations") return <OperationsView session={session} />;
  if (view === "team") return <TeamView session={session} />;
  if (view === "teamAccess") return <TeamAccessView session={session} onNavigate={onNavigate} />;
  if (view === "notifications") return <NotificationsView />;
  return <SettingsView view={view} session={session} allBranches={allBranches} onBranchesChange={onBranchesChange} onLogout={() => { clearSession(); window.location.reload(); }} />;
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
      const recentExpenses = expenses.map((expense) => { const row = expense as RecordItem; return { id: `expense-${text(row.id)}`, title: "Expense recorded", detail: `${text(row.note, "Expense")} · ${money(row.amount)}`, createdAt: String(row.createdAt ?? row.expenseDate ?? ""), tone: "amber" }; });
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
    if (isExpense && (!Number.isFinite(Number(values.amount)) || Number(values.amount) < 0)) { setError("Enter a valid non-negative amount."); return; }
    if (!isExpense && values.creditLimit && (!Number.isFinite(Number(values.creditLimit)) || Number(values.creditLimit) < 0)) { setError("Enter a valid non-negative credit limit."); return; }
    setSaving(true); setError("");
    try { await onSave(values); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : `Could not save ${title}.`); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">NEW RECORD</span><h2>Add {title}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {fields.map((field) => <label key={field.key}>{field.label}<input autoFocus={field.key === (isExpense ? "note" : "name")} type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} step={field.key === "amount" || field.key === "creditLimit" ? "0.01" : undefined} value={values[field.key] ?? ""} required={field.required} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /></label>)}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving..." : `Save ${title}`}</button></div>
  </form></div>;
}

function ReportView({ session }: { session: Session }) {
  const defaultTo = new Date().toISOString().slice(0, 10);
  const defaultFromDate = new Date(); defaultFromDate.setDate(defaultFromDate.getDate() - 29);
  const [from, setFrom] = useState(defaultFromDate.toISOString().slice(0, 10));
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<DailySummary | null>(null);
  const [payments, setPayments] = useState<Array<{ _id?: string; total?: number; count?: number }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const branchId = session.branches?.[0]?.id;
  useEffect(() => {
    if (from > to) { setError("Start date must be on or before the end date."); return; }
    let active = true; setLoading(true); setError("");
    Promise.all([api.reports(branchId, from, to), api.paymentBreakdown(branchId, from, to)])
      .then(([summary, breakdown]) => { if (active) { setData(summary); setPayments(breakdown); } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load the selected report period."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, from, to]);
  function exportReport() {
    if (!data) return;
    const summary = data as unknown as RecordItem;
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [["Metric", "Value"], ["From", from], ["To", to], ["Revenue", String(summary.totalSales ?? 0)], ["Transactions", String(summary.transactionCount ?? 0)], ["Items sold", String(summary.itemsSold ?? 0)], ...payments.map((payment) => [String(payment._id ?? "Other"), String(payment.total ?? 0)])];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `dira-os-report-${from}-to-${to}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  const summary = data as RecordItem | null;
  return <><PageHeading eyebrow="BUSINESS INTELLIGENCE" title="Reports" subtitle="Review and export business performance for a selected date range." actions={<button className="secondary" onClick={exportReport} disabled={!data || loading}>Export CSV</button>} />
    <section className="panel report-filters"><div className="preference-list"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setTo(event.target.value)} /></label></div></section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="metric-grid"><Metric label="Revenue" value={money(summary?.totalSales)} delta={loading ? "Loading…" : `${from} to ${to}`} tone="blue" /><Metric label="Transactions" value={text(summary?.transactionCount, "0")} delta="Selected period" tone="green" /><Metric label="Average sale" value={money(Number(summary?.totalSales ?? 0) / Math.max(Number(summary?.transactionCount ?? 0), 1))} delta="Across transactions" tone="amber" /><Metric label="Items sold" value={text(summary?.itemsSold, "0")} delta="Selected period" tone="red" /></div>
    <div className="dashboard-grid"><Panel title="Revenue trend"><SalesChart session={session} /></Panel><Panel title="Payment mix"><div className="finance-breakdown">{payments.length ? payments.map((payment) => <div className="finance-row" key={String(payment._id)}><strong>{text(payment._id, "Other")}</strong><span>{money(payment.total)}</span><small>{text(payment.count, "0")} payments</small></div>) : <Empty text={loading ? "Loading report data…" : "No payments in the selected period."} />}</div></Panel></div>
  </>;
}

function FinanceView({ session }: { session: Session }) { const [overview, setOverview] = useState<RecordItem | null>(null); const [payments, setPayments] = useState<Array<{ _id?: string; total?: number; count?: number }>>([]); useEffect(() => { const branchId = session.branches?.[0]?.id; Promise.all([api.financeOverview(branchId), api.paymentBreakdown(branchId)]).then(([nextOverview, nextPayments]) => { setOverview(nextOverview); setPayments(nextPayments); }).catch(() => undefined); }, [session]); return <><PageHeading eyebrow="FINANCE" title="Finance overview" subtitle="Keep revenue, payments, and cash movement visible in one workspace." /><div className="metric-grid"><Metric label="Revenue" value={money(overview?.revenue ?? overview?.totalRevenue ?? overview?.totalSales)} delta="Synced data" tone="blue" /><Metric label="Expenses" value={money(overview?.expenses ?? overview?.totalExpenses)} delta="Synced data" tone="amber" /><Metric label="Net result" value={money(overview?.net ?? overview?.netProfit)} delta="Calculated by API" tone="green" /><Metric label="Payments" value={text(overview?.paymentCount, String(payments.reduce((sum, item) => sum + Number(item.count ?? 0), 0)))} delta="Recorded" tone="red" /></div><section className="panel"><div className="panel-heading"><h2>Payment breakdown</h2><span className="muted">Live API data</span></div><div className="finance-breakdown">{payments.length ? payments.map((item) => <div className="finance-row" key={String(item._id)}><strong>{text(item._id, "Other")}</strong><span>{money(item.total)}</span><small>{text(item.count, "0")} payments</small></div>) : <Empty text="Payment data will appear after synchronization." />}</div></section><DesktopInvoices session={session} /></>; }

function InsightsView({ session }: { session: Session }) {
  const [data, setData] = useState<import("@vbo/shared").EnterpriseAnalytics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.enterpriseAnalytics(session.branches?.[0]?.id).then(setData).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load business insights.")); }, [session]);
  const summary = data?.summary;
  return <><PageHeading eyebrow="INSIGHTS" title="Business insights" subtitle="Performance signals calculated from the business analytics service." />{error && <div className="error-banner" role="alert">{error}</div>}<div className="metric-grid"><Metric label="Revenue" value={money(summary?.revenueTotal)} delta={data?.range.label ?? "Last 12 months"} tone="blue" /><Metric label="Gross profit" value={money(summary?.profitTotal)} delta="Calculated by analytics" tone="green" /><Metric label="Average order" value={money(summary?.averageOrderValue)} delta={`${text(summary?.salesCount, "0")} sales`} tone="amber" /><Metric label="Inventory turnover" value={text(summary?.inventoryTurnover, "0")} delta="Selected period" tone="red" /></div><div className="dashboard-grid"><Panel title="Top products"><div className="product-list">{data?.productPerformance.length ? data.productPerformance.slice(0, 8).map((product) => <div className="product-row" key={product.productId}><span className="product-thumb">{product.label.slice(0, 1)}</span><div><strong>{product.label}</strong><small>{product.value.toLocaleString()} units</small></div><b>{money(product.revenue)}</b></div>) : <Empty text={error ? "Could not load product insights." : "Product performance will appear after there are sales."} />}</div></Panel><Panel title="Monthly revenue"><div className="finance-breakdown">{data?.revenueTrend.length ? data.revenueTrend.slice(-6).map((point) => <div className="finance-row" key={point.period}><strong>{point.period}</strong><span>{money(point.revenue)}</span><small>{point.salesCount} sales</small></div>) : <Empty text={error ? "Could not load revenue insights." : "Revenue trends will appear after there are sales."} />}</div></Panel></div></>;
}

function OperationsView({ session }: { session: Session }) { const [items, setItems] = useState<unknown[]>([]); useEffect(() => { api.operations(session.branches?.[0]?.id).then(setItems).catch(() => undefined); }, [session]); return <><PageHeading eyebrow="OPERATIONS" title="Business operations" subtitle="Track orders, jobs, and operational work from the desktop workspace." actions={<button className="primary">+ New operation</button>} /><div className="table-panel panel"><table><thead><tr><th>Operation</th><th>Type</th><th>Status</th><th>Updated</th></tr></thead><tbody>{items.slice(0, 50).map((item, index) => { const record = item as RecordItem; return <tr key={String(record.id ?? index)}><td><strong>{text(record.title ?? record.name, `Operation ${index + 1}`)}</strong></td><td>{text(record.kind)}</td><td><span className="badge success">{text(record.status, "Open")}</span></td><td>{text(record.updatedAt ?? record.createdAt)}</td></tr>; })}</tbody></table>{!items.length && <Empty text="No operations are currently recorded." />}</div></>; }

function TeamView({ session }: { session: Session }) {
  const [items, setItems] = useState<unknown[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [showInvite, setShowInvite] = useState(false);
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
  return <>
    <PageHeading eyebrow="TEAM & ACCESS" title="Team members" subtitle="Review staff access and roles for this workspace." actions={<button className="primary" onClick={() => setShowInvite(true)}>+ Invite teammate</button>} />
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="table-panel panel"><table><thead><tr><th>Name</th><th>Role</th><th>Branch</th><th>Status</th><th /></tr></thead><tbody>{items.map((item, index) => { const record = item as RecordItem; const id = text(record.id, ""); const active = record.isActive !== false; return <tr key={id || index}><td><strong>{text(record.fullName ?? record.name, `Team member ${index + 1}`)}</strong><small>{text(record.phone)}</small></td><td>{text(record.roleLabel ?? record.role)}</td><td>{text(record.branchName, "Workspace")}</td><td><span className={`badge ${active ? "success" : "warning"}`}>{active ? "Active" : "Inactive"}</span></td><td>{record.role !== "owner" && id ? <button className="text-button" disabled={busyId === id} onClick={() => void toggleEmployee(record)}>{busyId === id ? "Saving…" : active ? "Suspend" : "Restore"}</button> : null}</td></tr>; })}</tbody></table>{loading ? <Empty text="Loading team members…" /> : !items.length && <Empty text={error ? "Could not load team members." : "No team members are available for this branch."} />}</div>
    {showInvite ? <TeamInviteModal onClose={() => setShowInvite(false)} onSave={invite} /> : null}
  </>;
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

function NotificationsView() {
  const [items, setItems] = useState<unknown[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => { api.notifications().then(setItems).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load notifications.")); }, [reload]);
  async function markRead(id: string) {
    if (busy) return;
    setBusy(true); setError("");
    try { await api.markNotificationRead(id); setItems((current) => current.map((item) => { const record = item as RecordItem; return record.id === id ? { ...record, readAt: new Date().toISOString() } : item; })); }
    catch (readError) { setError(readError instanceof Error ? readError.message : "Could not update notification."); }
    finally { setBusy(false); }
  }
  async function markAllRead() {
    if (busy) return;
    setBusy(true); setError("");
    try { await api.markAllNotificationsRead(); const readAt = new Date().toISOString(); setItems((current) => current.map((item) => ({ ...(item as RecordItem), readAt }))); }
    catch (readError) { setError(readError instanceof Error ? readError.message : "Could not update notifications."); }
    finally { setBusy(false); }
  }
  const unread = items.some((item) => !(item as RecordItem).readAt);
  return <><PageHeading eyebrow="NOTIFICATIONS" title="Notification center" subtitle="Review sync, account, and business activity alerts." actions={unread ? <button className="secondary" onClick={() => void markAllRead()} disabled={busy}>Mark all read</button> : undefined} />{error && <div className="error-banner" role="alert">{error}</div>}<div className="notification-list panel">{items.length ? items.map((item, index) => { const record = item as RecordItem; const id = String(record.id ?? ""); return <div className="notification-row" key={id || index}><span className={`activity-dot ${record.readAt ? "" : "blue"}`} /><div><strong>{text(record.title ?? record.subject, "Notification")}</strong><small>{text(record.body ?? record.message, "No additional details")}</small></div><time>{text(record.createdAt)}</time>{!record.readAt && id ? <button className="text-button" onClick={() => void markRead(id)} disabled={busy}>Mark read</button> : <span className="muted">Read</span>}</div>; }) : <Empty text={error ? "Could not load notifications." : "No notifications are available."} />}</div></>;
}

function Reports({ session }: { session: Session }) { const [data, setData] = useState<DailySummary | null>(null); const [payments, setPayments] = useState<Array<{ _id?: string; total?: number; count?: number }>>([]); useEffect(() => { const branchId = session.branches?.[0]?.id; Promise.all([api.reports(branchId), api.paymentBreakdown(branchId)]).then(([summaryData, paymentData]) => { setData(summaryData); setPayments(paymentData); }).catch(() => undefined); }, [session]); function exportReport() { const rows = [["Metric", "Value"], ["Revenue", String((data as RecordItem | null)?.totalSales ?? 0)], ["Transactions", String((data as RecordItem | null)?.transactionCount ?? 0)], ["Items sold", String((data as RecordItem | null)?.itemsSold ?? 0)], ...payments.map((payment) => [String(payment._id ?? "Other"), String(payment.total ?? 0)])]; const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `dira-os-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); } return <><PageHeading eyebrow="BUSINESS INTELLIGENCE" title="Reports" subtitle="Turn daily activity into decisions with a clear view of performance." actions={<><button className="secondary" onClick={exportReport}>Export CSV</button><span className="secondary">Live reporting period</span></>} /><div className="metric-grid"><Metric label="Revenue" value={money((data as RecordItem | null)?.totalSales)} delta="This period" tone="blue" /><Metric label="Transactions" value={text((data as RecordItem | null)?.transactionCount, "0")} delta="Live data" tone="green" /><Metric label="Average sale" value={money(Number((data as RecordItem | null)?.totalSales ?? 0) / Math.max(Number((data as RecordItem | null)?.transactionCount ?? 0), 1))} delta="Across transactions" tone="amber" /><Metric label="Items sold" value={text((data as RecordItem | null)?.itemsSold, "0")} delta="Live data" tone="red" /></div><div className="dashboard-grid"><Panel title="Revenue trend"><SalesChart session={session} /></Panel><Panel title="Payment mix"><div className="payment-mix"><div className="donut" /><div>{payments.length ? payments.map((payment) => <p key={String(payment._id)}><i className="legend cash" />{text(payment._id, "Other")} <b>{money(payment.total)}</b></p>) : <Empty text="Payment data will appear after synchronization." />}</div></div></Panel></div></>; }

function SettingsView({ view, session, allBranches, onBranchesChange, onLogout }: { view: View; session: Session; allBranches: Branch[]; onBranchesChange: (branches: Branch[]) => void; onLogout: () => void }) { const titles: Record<string, [string, string]> = { team: ["Team & access", "Manage roles, permissions and branch access."], settings: ["Business settings", "Your workspace preferences and branch configuration."], notifications: ["Notifications", "Stay on top of important activity and sync events."], subscription: ["Subscription", "Manage your Dira OS plan and account billing."] }; const [title, subtitle] = titles[view] ?? ["Business settings", "Your workspace preferences and branch configuration."]; function savePreferences() { window.localStorage.setItem("bizpro.desktop.businessName", text(session.business?.name)); } return <><PageHeading eyebrow="ADMINISTRATION" title={title} subtitle={subtitle} /><div className="settings-grid"><Panel title="Workspace profile"><div className="settings-list"><div className="setting-row"><span className="avatar">{text(session.user.fullName, "U").slice(0, 1)}</span><div><strong>{text(session.user.fullName)}</strong><small>{text(session.user.role, "Owner")} · {text(session.user.businessId)}</small></div><span className="badge success">Active</span></div><div className="setting-row"><span className="setting-icon">⌘</span><div><strong>Permissions and access</strong><small>Roles are enforced consistently across every device.</small></div><span className="badge success">Protected</span></div><div className="setting-row"><span className="setting-icon">⇄</span><div><strong>Offline & synchronization</strong><small>{queuedCount()} actions waiting to sync.</small></div><span className="badge success">Ready</span></div></div></Panel><Panel title="Quick preferences"><div className="preference-list"><label>Business name<input defaultValue={text(session.business?.name)} /></label><label>Currency<select defaultValue={session.business?.currency ?? "KES"}><option>{session.business?.currency ?? "KES"}</option></select></label></div><div className="heading-actions"><button className="primary" onClick={savePreferences}>Save changes</button><button className="secondary" onClick={onLogout}>Sign out</button></div></Panel></div>{view === "settings" && canAccess(session, "manageBranches") ? <DesktopBranches session={{ ...session, branches: allBranches }} onBranchesChange={onBranchesChange} /> : null}</>; }
function Empty({ text: label }: { text: string }) { return <div className="empty"><span>◌</span><p>{label}</p></div>; }
