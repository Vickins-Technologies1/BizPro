"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Customer, DailySummary, Product, Sale } from "@vbo/shared";
import { api, clearSession, login, queueOffline, queuedCount, readSession, writeSession, type Session } from "../lib/desktop-api";

type View = "dashboard" | "pos" | "products" | "inventory" | "customers" | "suppliers" | "expenses" | "sales" | "reports" | "team" | "settings" | "notifications" | "subscription";
type RecordItem = Record<string, unknown>;

const nav: Array<{ id: View; label: string; icon: string; group: string }> = [
  { id: "dashboard", label: "Overview", icon: "⌂", group: "Workspace" },
  { id: "pos", label: "Point of sale", icon: "▣", group: "Workspace" },
  { id: "products", label: "Products", icon: "▤", group: "Manage" },
  { id: "inventory", label: "Inventory", icon: "◫", group: "Manage" },
  { id: "customers", label: "Customers", icon: "◎", group: "Manage" },
  { id: "suppliers", label: "Suppliers", icon: "⇄", group: "Manage" },
  { id: "expenses", label: "Expenses", icon: "−", group: "Manage" },
  { id: "sales", label: "Sales history", icon: "◷", group: "Insights" },
  { id: "reports", label: "Reports", icon: "⌁", group: "Insights" },
  { id: "team", label: "Team & access", icon: "♙", group: "Admin" },
  { id: "settings", label: "Business settings", icon: "⚙", group: "Admin" },
  { id: "notifications", label: "Notifications", icon: "◉", group: "Admin" },
  { id: "subscription", label: "Subscription", icon: "◇", group: "Admin" }
];

const lightThemeVars = {
  "--bg": "#f8fafc",
  "--surface": "#ffffff",
  "--surface-2": "#f1f7fb",
  "--line": "#d7e3ee",
  "--text": "#0f172a",
  "--muted": "#52637a",
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
  "--bg": "#0d1420",
  "--surface": "#151e2c",
  "--surface-2": "#101925",
  "--line": "#263449",
  "--text": "#eef4ff",
  "--muted": "#8d9bb0",
  "--primary": "#2559d6",
  "--primary-2": "#1745bb",
  "--green": "#17a673",
  "--amber": "#d58b16",
  "--red": "#dd5b64",
  "--purple": "#7b61c9",
  "--shadow": "0 18px 50px rgba(0,0,0,.2)",
  "--shadow-strong": "0 12px 28px rgba(0,0,0,.24)"
} as const;

function money(value: unknown) { return `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function text(value: unknown, fallback = "-") { return value === null || value === undefined || value === "" ? fallback : String(value); }

export function DesktopShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setTheme((window.localStorage.getItem("bizpro.desktop.theme") as "light" | "dark" | null) ?? "dark");
    const onLine = () => setOffline(!navigator.onLine);
    onLine(); window.addEventListener("online", onLine); window.addEventListener("offline", onLine);
    return () => { window.removeEventListener("online", onLine); window.removeEventListener("offline", onLine); };
  }, []);

  function toggleTheme() { const next = theme === "dark" ? "light" : "dark"; setTheme(next); window.localStorage.setItem("bizpro.desktop.theme", next); }
  if (!session) return <LoginScreen onLogin={(next) => { writeSession(next); setSession(next); }} />;

  return <div className={`desktop-app ${theme}`} style={(theme === "light" ? lightThemeVars : darkThemeVars) as CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src="/dira-os-logo.png" alt="Dira OS" /><div><strong>Dira OS</strong><span>Business OS</span></div></div>
      <div className="workspace-pill"><span className="status-dot" />{text(session.business?.name, "My business")}<span className="chevron">⌄</span></div>
      <nav>{["Workspace", "Manage", "Insights", "Admin"].map((group) => <div className="nav-group" key={group}><small>{group}</small>{nav.filter((item) => item.group === group).map((item) => <button className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)} key={item.id}><i>{item.icon}</i><span>{item.label}</span>{item.id === "notifications" && <b>3</b>}</button>)}</div>)}</nav>
      <div className="sidebar-footer"><div className="sync-line"><span className={offline ? "status-dot amber" : "status-dot"} />{offline ? "Offline mode" : "All changes synced"}<span className="sync-count">{queuedCount()}</span></div><button className="theme-button" onClick={toggleTheme}>{theme === "dark" ? "☼  Light appearance" : "☾  Dark appearance"}</button><button className="profile" onClick={() => setView("settings")}><span className="avatar">{text(session.user.fullName, "U").slice(0, 1).toUpperCase()}</span><span><strong>{text(session.user.fullName, "User")}</strong><small>{text(session.user.role, "Owner")}</small></span><span className="more">•••</span></button></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Dira OS</span><b>/</b><strong>{nav.find((item) => item.id === view)?.label}</strong></div><div className="top-actions"><kbd>⌘ K</kbd><button className="icon-button" aria-label="Search">⌕</button><button className="icon-button" onClick={() => setView("notifications")} aria-label="Notifications">◉<em>3</em></button><div className="branch-select">{text(session.branches?.[0]?.name, "Main branch")}⌄</div></div></header><div className="content"><ViewContent view={view} session={session} offline={offline} onNavigate={setView} /></div></main>
  </div>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { onLogin(await login(identifier, password)); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in"); } finally { setLoading(false); } }
  return <div className="login-page"><div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="login-brand"><img className="brand-logo large" src="/dira-os-logo.png" alt="Dira OS" /><strong>Dira OS</strong></div><div className="login-quote"><p>“The calm, clear way to run your business.”</p><span>Sales, stock and growth in one focused workspace.</span></div></div><div className="login-panel"><div className="login-inner"><span className="eyebrow">WELCOME BACK</span><h1>Run your business<br /><span>with clarity.</span></h1><p className="muted">Sign in to your Dira OS workspace to continue.</p><form onSubmit={submit}><label>Phone or email<input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@business.com" required /></label><label>Password or PIN<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Enter your password" required /></label>{error && <div className="error-banner">{error}</div>}<button className="primary full" disabled={loading}>{loading ? "Signing in..." : "Continue  →"}</button></form><p className="login-help">Protected by Dira OS access controls · <a href="#help">Need help?</a></p></div></div></div>;
}

function ViewContent({ view, session, offline, onNavigate }: { view: View; session: Session; offline: boolean; onNavigate: (view: View) => void }) {
  if (view === "dashboard") return <Dashboard session={session} offline={offline} onNavigate={onNavigate} />;
  if (view === "pos") return <Pos session={session} />;
  if (view === "products" || view === "inventory") return <Products session={session} inventory={view === "inventory"} />;
  if (view === "customers") return <DataView title="Customers" subtitle="Keep every customer relationship in one place." endpoint="customers" columns={["Name", "Phone", "Email", "Balance", "Last visit"]} />;
  if (view === "suppliers") return <DataView title="Suppliers" subtitle="Manage purchasing partners and supplier balances." endpoint="suppliers" columns={["Supplier", "Phone", "Email", "Balance", "Status"]} />;
  if (view === "expenses") return <DataView title="Expenses" subtitle="Track operating costs and keep your margins visible." endpoint="expenses" columns={["Description", "Category", "Amount", "Date", "Recorded by"]} />;
  if (view === "sales") return <DataView title="Sales history" subtitle="Search, review and reconcile every sale." endpoint="sales" columns={["Receipt", "Customer", "Items", "Payment", "Total"]} />;
  if (view === "reports") return <Reports session={session} />;
  return <SettingsView view={view} session={session} onLogout={() => { clearSession(); window.location.reload(); }} />;
}

function Dashboard({ session, offline, onNavigate }: { session: Session; offline: boolean; onNavigate: (view: View) => void }) {
  const [data, setData] = useState<DailySummary | null>(null); const [error, setError] = useState("");
  useEffect(() => { api.dashboard(session.branches?.[0]?.id).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard")); }, [session]);
  const summary = data as RecordItem | null;
  return <><PageHeading eyebrow="WEDNESDAY, 02 SEPTEMBER 2026" title={`Good morning, ${text(session.user.fullName, "there").split(" ")[0]}.`} subtitle="Here is what is happening across your business today." actions={<><button className="secondary" onClick={() => onNavigate("reports")}>View reports</button><button className="primary" onClick={() => onNavigate("pos")}>+ Record sale</button></>} /><div className="status-banner"><span className={offline ? "status-dot amber" : "status-dot"} /><div><strong>{offline ? "Working offline" : "Your workspace is up to date"}</strong><span>{offline ? "Sales will be queued locally and synchronized when you reconnect." : "Last synchronized just now across all active branches."}</span></div><button onClick={() => onNavigate("settings")}>View sync details →</button></div>{error && <div className="error-banner">{error}</div>}<div className="metric-grid"><Metric label="Today’s sales" value={money(summary?.totalSales)} delta="+12.8%" tone="blue" /><Metric label="Transactions" value={text(summary?.transactionCount, "0")} delta="+8.4%" tone="green" /><Metric label="Items sold" value={text(summary?.itemsSold, "0")} delta="+5.2%" tone="amber" /><Metric label="Low stock" value={text(summary?.lowStockCount, "0")} delta="Needs attention" tone="red" /></div><div className="dashboard-grid"><Panel title="Sales performance" action="Last 7 days"><div className="chart"><div className="chart-y"><span>80k</span><span>60k</span><span>40k</span><span>20k</span><span>0</span></div><div className="chart-body"><div className="chart-line" />{["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Today"].map((day, i) => <span className="chart-label" style={{ left: `${i * 16.6}%` }} key={day}>{day}</span>)}</div></div></Panel><Panel title="Quick actions" action="Customize"><div className="quick-actions">{[["▣", "New sale", "pos"], ["▤", "Add product", "products"], ["◎", "Add customer", "customers"], ["⌁", "View reports", "reports"]].map(([icon, label, target]) => <button onClick={() => onNavigate(target as View)} key={label}><i>{icon}</i><span>{label}</span><b>→</b></button>)}</div></Panel></div><div className="dashboard-grid lower"><Panel title="Top products" action="View all"><TopProducts session={session} /></Panel><Panel title="Recent activity" action="See all"><Activity /></Panel></div></>;
}

function Metric({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: string }) { return <div className={`metric-card ${tone}`}><div className="metric-icon">{tone === "blue" ? "↗" : tone === "green" ? "✓" : tone === "amber" ? "◫" : "!"}</div><span>{label}</span><strong>{value}</strong><small className={tone === "red" ? "negative" : "positive"}>{tone === "red" ? "● " : "↗ "}{delta}</small></div>; }
function PageHeading({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: React.ReactNode }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{actions}</div></div>; }
function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) { return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action && <button className="text-button">{action} →</button>}</div>{children}</section>; }
function TopProducts({ session }: { session: Session }) { const [products, setProducts] = useState<Product[]>([]); useEffect(() => { api.products(session.branches?.[0]?.id).then((items) => setProducts(items.slice(0, 4))).catch(() => undefined); }, [session]); return <div className="product-list">{products.length ? products.map((product, index) => <div className="product-row" key={product.id}><span className={`product-thumb p${index}`}>{text(product.name, "P").slice(0, 1)}</span><div><strong>{text(product.name)}</strong><small>{text(product.categoryId, "General")}</small></div><b>{money(product.sellingPrice)}</b></div>) : <Empty text="Product performance will appear here." />}</div>; }
function Activity() { return <div className="activity-list">{[["Sale recorded", "Receipt #BP-1048", "2 min ago", "green"], ["Stock adjusted", "Green tea · 12 units", "38 min ago", "blue"], ["Expense added", "Delivery · KES 1,250", "1 hr ago", "amber"], ["New customer", "Wanjiku Mwangi", "2 hrs ago", "purple"]].map(([title, detail, time, tone]) => <div className="activity-row" key={title}><span className={`activity-dot ${tone}`} /><div><strong>{title}</strong><small>{detail}</small></div><time>{time}</time></div>)}</div>; }

function Pos({ session }: { session: Session }) { const [products, setProducts] = useState<Product[]>([]); const [query, setQuery] = useState(""); const [cart, setCart] = useState<Product[]>([]); const [saved, setSaved] = useState(false); useEffect(() => { api.products(session.branches?.[0]?.id).then(setProducts).catch(() => undefined); }, [session]); useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); setSaved(true); } if (event.key === "Escape") setQuery(""); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []); const filtered = products.filter((p) => `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8); const total = cart.reduce((sum, p) => sum + Number(p.sellingPrice ?? 0), 0); return <><PageHeading eyebrow="POINT OF SALE" title="Record a sale" subtitle="Scan a barcode or search your catalog to build the basket." actions={<><span className="shortcut-hint"><kbd>⌘ ↵</kbd> Complete sale</span><button className="secondary">Hold draft</button></>} /><div className="pos-layout"><section className="pos-catalog panel"><div className="pos-search"><span>⌕</span><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scan barcode or search products..." /><kbd>⌘ K</kbd></div><div className="category-row"><button className="selected">All products</button><button>Popular</button><button>Low stock</button></div><div className="catalog-grid">{filtered.map((product) => <button className="catalog-card" onClick={() => setCart((current) => [...current, product])} key={product.id}><span className="catalog-image">{text(product.name, "P").slice(0, 1)}</span><strong>{text(product.name)}</strong><small>{text(product.stockOnHand, "0")} in stock</small><b>{money(product.sellingPrice)}</b></button>)}{!filtered.length && <Empty text="No matching products. Scan another barcode or add the product first." />}</div></section><section className="basket panel"><div className="panel-heading"><div><h2>Current basket</h2><small>{cart.length} items</small></div><button className="text-button" onClick={() => setCart([])}>Clear</button></div><div className="basket-items">{cart.length ? cart.map((product, index) => <div className="basket-item" key={`${product.id}-${index}`}><span className="basket-thumb">{text(product.name, "P").slice(0, 1)}</span><div><strong>{text(product.name)}</strong><small>1 × {money(product.sellingPrice)}</small></div><b>{money(product.sellingPrice)}</b></div>) : <Empty text="Your basket is ready." />}</div><div className="basket-total"><span>Subtotal</span><b>{money(total)}</b><span>Tax</span><b>{money(0)}</b><strong>Total</strong><strong>{money(total)}</strong></div><button className="primary full" onClick={async () => { if (!cart.length) return; const body = { businessId: session.user.businessId, branchId: session.branches?.[0]?.id, items: cart.map((p) => ({ productId: p.id, quantity: 1, unitPrice: p.sellingPrice })), payments: [{ method: "cash", amount: total }], totalAmount: total }; try { await api.createSale(body); setCart([]); setSaved(true); } catch { queueOffline("/sales", body); setSaved(true); } }}>{saved ? "Sale queued / completed  ✓" : "Complete sale  →"}</button><div className="payment-note">Cash selected · You can split payment at checkout</div></section></div></>; }

function Products({ session, inventory }: { session: Session; inventory: boolean }) { const [products, setProducts] = useState<Product[]>([]); const [query, setQuery] = useState(""); useEffect(() => { api.products(session.branches?.[0]?.id).then(setProducts).catch(() => undefined); }, [session]); const filtered = products.filter((p) => text(p.name).toLowerCase().includes(query.toLowerCase()) || text(p.sku).toLowerCase().includes(query.toLowerCase())); return <><PageHeading eyebrow={inventory ? "STOCK CONTROL" : "CATALOG"} title={inventory ? "Inventory" : "Products"} subtitle={inventory ? "Know what is moving, what is low, and what needs attention." : "Manage your product catalog, pricing and availability."} actions={<><button className="secondary">Import CSV</button><button className="primary">+ Add product</button></>} /><div className="toolbar"><div className="search-field">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." /></div><button className="filter-button">Category⌄</button><button className="filter-button">Status⌄</button><span className="toolbar-count">{filtered.length} products</span></div><div className="table-panel panel"><table><thead><tr><th>Product</th><th>SKU / Barcode</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((product) => { const stock = Number(product.stockOnHand ?? 0); return <tr key={product.id}><td><div className="table-product"><span className="product-thumb">{text(product.name, "P").slice(0, 1)}</span><strong>{text(product.name)}</strong></div></td><td>{text(product.sku, text(product.barcode))}</td><td>{text(product.categoryId, "General")}</td><td><strong>{money(product.sellingPrice)}</strong></td><td><strong>{stock}</strong> <span className="muted">{text(product.unit, "pcs")}</span></td><td><span className={`badge ${stock <= Number(product.lowStockThreshold ?? 5) ? "warning" : "success"}`}>{stock <= Number(product.lowStockThreshold ?? 5) ? "Low stock" : "In stock"}</span></td><td><button className="row-menu">•••</button></td></tr>; })}</tbody></table>{!filtered.length && <Empty text="No products found." />}</div></>; }

function DataView({ title, subtitle, endpoint, columns }: { title: string; subtitle: string; endpoint: "customers" | "suppliers" | "expenses" | "sales"; columns: string[] }) { const [items, setItems] = useState<unknown[]>([]); const [query, setQuery] = useState(""); useEffect(() => { api[endpoint]().then(setItems).catch(() => undefined); }, [endpoint]); const rows = items.filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase())); return <><PageHeading eyebrow={title.toUpperCase()} title={title} subtitle={subtitle} actions={<button className="primary">+ Add {title.slice(0, -1).toLowerCase()}</button>} /><div className="toolbar"><div className="search-field">⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`} /></div><button className="filter-button">Filters⌄</button><span className="toolbar-count">{rows.length} records</span></div><div className="table-panel panel"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th /></tr></thead><tbody>{rows.slice(0, 30).map((item, index) => { const record = item as RecordItem; const values = Object.values(record).filter((value) => typeof value !== "object").slice(0, columns.length); return <tr key={String(record.id ?? index)}>{columns.map((_, columnIndex) => <td key={columnIndex}>{columnIndex === 0 ? <strong>{text(values[columnIndex], `Record ${index + 1}`)}</strong> : text(values[columnIndex])}</td>)}<td><button className="row-menu">•••</button></td></tr>; })}</tbody></table>{!rows.length && <Empty text={`No ${title.toLowerCase()} to display yet.`} />}</div></>; }

function Reports({ session }: { session: Session }) { const [data, setData] = useState<DailySummary | null>(null); useEffect(() => { api.reports(session.branches?.[0]?.id).then(setData).catch(() => undefined); }, [session]); return <><PageHeading eyebrow="BUSINESS INTELLIGENCE" title="Reports" subtitle="Turn daily activity into decisions with a clear view of performance." actions={<><button className="secondary">Export</button><button className="primary">Date range⌄</button></>} /><div className="metric-grid"><Metric label="Revenue" value={money((data as RecordItem | null)?.totalSales)} delta="This period" tone="blue" /><Metric label="Gross profit" value={money(0)} delta="Coming from synced data" tone="green" /><Metric label="Average sale" value={money(0)} delta="Across transactions" tone="amber" /><Metric label="Outstanding credit" value={money(0)} delta="Review accounts" tone="red" /></div><div className="dashboard-grid"><Panel title="Revenue trend" action="Daily"><div className="empty-chart"><span>Revenue trend will populate after your first synced sales period.</span></div></Panel><Panel title="Payment mix"><div className="payment-mix"><div className="donut" /><div><p><i className="legend cash" />Cash <b>--</b></p><p><i className="legend mpesa" />M-Pesa <b>--</b></p><p><i className="legend credit" />Credit <b>--</b></p></div></div></Panel></div></>; }

function SettingsView({ view, session, onLogout }: { view: View; session: Session; onLogout: () => void }) { const titles: Record<string, [string, string]> = { team: ["Team & access", "Manage roles, permissions and branch access."], settings: ["Business settings", "Your workspace preferences and branch configuration."], notifications: ["Notifications", "Stay on top of important activity and sync events."], subscription: ["Subscription", "Manage your Dira OS plan and account billing."] }; const [title, subtitle] = titles[view] ?? ["Business settings", "Your workspace preferences and branch configuration."]; return <><PageHeading eyebrow="ADMINISTRATION" title={title} subtitle={subtitle} actions={view === "team" ? <button className="primary">+ Invite teammate</button> : undefined} /><div className="settings-grid"><Panel title={view === "team" ? "People with access" : view === "notifications" ? "Recent alerts" : "Workspace profile"}><div className="settings-list"><div className="setting-row"><span className="avatar">{text(session.user.fullName, "U").slice(0, 1)}</span><div><strong>{text(session.user.fullName)}</strong><small>{text(session.user.role, "Owner")} · {text(session.user.businessId)}</small></div><span className="badge success">Active</span></div><div className="setting-row"><span className="setting-icon">⌘</span><div><strong>Permissions and access</strong><small>Roles are enforced consistently across every device.</small></div><button className="text-button">Manage →</button></div><div className="setting-row"><span className="setting-icon">⇄</span><div><strong>Offline & synchronization</strong><small>{queuedCount()} actions waiting to sync.</small></div><span className="badge success">Ready</span></div></div></Panel><Panel title="Quick preferences"><div className="preference-list"><label>Business name<input defaultValue={text(session.business?.name)} /></label><label>Currency<select defaultValue="KES"><option>KES · Kenyan Shilling</option></select></label><label>Default branch<select><option>{text(session.branches?.[0]?.name, "Main branch")}</option></select></label></div><button className="primary" onClick={view === "settings" ? onLogout : undefined}>{view === "settings" ? "Sign out" : "Save changes"}</button></Panel></div></>; }
function Empty({ text: label }: { text: string }) { return <div className="empty"><span>◌</span><p>{label}</p></div>; }
