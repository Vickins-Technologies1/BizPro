"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PLATFORM_ADMIN_ROLE_LABELS, type PlatformAdminPermission, type PlatformAdminRole, hasPlatformAdminPermission } from "@vbo/shared";
import { EmployeeManagementPanel } from "./EmployeeManagementPanel";
import { type AdminBusiness, type EmployeeRecord, type AuditLogRecord, type PermissionCatalog, getEmployeeCatalog, listBusinessAuditLogs, listBusinessEmployees } from "../lib/admin-api";

type Row = Record<string, any>;
type PageData = { items: Row[]; page: number; limit: number; total: number; pages: number };
const API = "/api-proxy/platform-admin";
const TITLES: Record<string, string> = {
  dashboard: "Platform overview", businesses: "Business management", employees: "Employee directory", subscriptions: "Subscriptions",
  payments: "Payment reconciliation", devices: "Device management", sync: "Synchronization", "system-errors": "System errors and incidents",
  incidents: "System errors and incidents", "system-health": "System health", "api-monitoring": "API monitoring", settings: "Platform configuration",
  support: "Support centre", reports: "Reports and analytics", "audit-logs": "Security and audit", "admin-users": "Platform administrators"
};

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path.startsWith("/") ? path : `/${path}`}`, { ...init, cache: "no-store", headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : `Request failed (${response.status})`);
  return body as T;
}
function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(Boolean(path)); const [error, setError] = useState(""); const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!path) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError("");
    request<T>(path, { signal: controller.signal }).then((next) => { if (!controller.signal.aborted) setData(next); }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load this view"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, nonce]);
  return { data, loading, error, refresh: () => setNonce((value) => value + 1), setData };
}
function Panel({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) { return <section className="panel"><div className="panel-heading">{title && <h2>{title}</h2>}{action}</div>{children}</section>; }
function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">DIRA OS · PLATFORM OPERATIONS</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
function Loading({ label = "Loading platform data…" }: { label?: string }) { return <Panel title="Loading"><div className="loading-line"><span className="spinner"/>{label}</div><div className="skeleton-grid"><i/><i/><i/></div></Panel>; }
function Problem({ message, retry }: { message: string; retry: () => void }) { return <div className="inline-alert danger"><div><strong>This section could not load</strong><p>{message}</p></div><button className="secondary-button" onClick={retry}>Retry</button></div>; }
function Metric({ label, value, hint, tone = "blue" }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) { return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty-state"><span className="empty-icon">⌁</span><strong>Nothing to show yet</strong><p>{children}</p></div>; }
function human(value: unknown) { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "boolean") return value ? "Yes" : "No"; if (typeof value === "object") return JSON.stringify(value); return String(value).replace(/_/g, " "); }
function date(value: unknown) { if (!value) return "—"; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString(); }
function statusClass(value: unknown) { const name = String(value ?? "unknown").toLowerCase(); return `status-pill ${["active", "healthy", "applied", "resolved", "matched", "paid"].includes(name) ? "good" : ["failed", "suspended", "critical", "unavailable"].includes(name) ? "bad" : ["pending", "trial", "open", "investigating", "past_due", "degraded"].includes(name) ? "warn" : "neutral"}`; }
function Status({ value }: { value: unknown }) { return <span className={statusClass(value)}>{human(value)}</span>; }
function formatMoney(value: unknown, currency = "KES") { return typeof value === "number" ? new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(value) : "—"; }
function can(role: PlatformAdminRole, permission: PlatformAdminPermission) { return hasPlatformAdminPermission(role, permission); }
function Table({ columns, rows, empty, onRow }: { columns: Array<{ key: string; label: string; render?: (row: Row) => React.ReactNode }>; rows: Row[]; empty?: string; onRow?: (row: Row) => void }) {
  if (!rows.length) return <Empty>{empty ?? "Records will appear here when available."}</Empty>;
  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row._id ?? row.id ?? row.eventId ?? row.errorId ?? row.ticketNumber ?? index)} className={onRow ? "clickable-row" : ""} onClick={() => onRow?.(row)}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : human(row[column.key])}</td>)}</tr>)}</tbody></table></div>;
}
function Pager({ page, total, limit, change }: { page: number; total: number; limit: number; change: (page: number) => void }) { const pages = Math.max(1, Math.ceil(total / limit)); return <div className="pager"><span>{total.toLocaleString()} records · page {page} of {pages}</span><div><button className="secondary-button" disabled={page <= 1} onClick={() => change(page - 1)}>Previous</button><button className="secondary-button" disabled={page >= pages} onClick={() => change(page + 1)}>Next</button></div></div>; }

export function AdminSection({ section, businessId, role, range }: { section: string; businessId?: string; role: PlatformAdminRole; range: string }) {
  const root = section.split("/")[0] || "dashboard";
  if (root === "dashboard") return <Dashboard range={range}/>;
  if (root === "businesses") return businessId ? <BusinessDetail id={businessId} role={role}/> : <Businesses role={role}/>;
  if (root === "employees") return <Employees role={role}/>;
  if (root === "subscriptions") return <Subscriptions role={role}/>;
  if (root === "payments") return <Payments/>;
  if (root === "devices") return <Devices role={role}/>;
  if (root === "sync") return <Sync role={role}/>;
  if (root === "system-errors" || root === "incidents") return <Errors role={role}/>;
  if (root === "system-health") return <SystemHealth/>;
  if (root === "api-monitoring") return <ApiMonitoring/>;
  if (root === "settings") return <Settings role={role}/>;
  if (root === "support") return <Support role={role}/>;
  if (root === "reports") return <Reports/>;
  if (root === "audit-logs") return <AuditLogs/>;
  if (root === "admin-users") return <AdminUsers role={role}/>;
  return <Empty>This admin section is not available.</Empty>;
}

function Dashboard({ range }: { range: string }) {
  const state = useData<Row>(`/dashboard?range=${encodeURIComponent(range)}`);
  if (state.loading && !state.data) return <><PageHeader title="Platform overview" subtitle="A live view across businesses, subscriptions, devices, synchronization and system health."/><Loading/></>;
  if (state.error && !state.data) return <><PageHeader title="Platform overview" subtitle="A live view across platform operations."/><Problem message={state.error} retry={state.refresh}/></>;
  const data = state.data ?? {};
  const byStatus = data.subscriptions?.byStatus ?? {};
  return <><PageHeader title="Platform overview" subtitle={`Live platform data · ${new Date(data.generatedAt ?? Date.now()).toLocaleString()}`}/>
    {state.error && <Problem message={state.error} retry={state.refresh}/>}
    <div className="metric-grid">
      <Metric label="Businesses" value={data.businesses?.total ?? "—"} hint={`${data.businesses?.newInRange ?? 0} registered in selected range`}/>
      <Metric label="Active businesses" value={data.businesses?.active ?? "—"} hint={`${data.businesses?.suspended ?? 0} suspended`} tone="green"/>
      <Metric label="Registered users" value={data.users?.totalRegistered ?? "—"} hint={`${data.users?.employees ?? 0} employees`} tone="purple"/>
      <Metric label="Active subscriptions" value={data.subscriptions?.active ?? "—"} hint={`${byStatus.TRIAL ?? 0} trials · ${byStatus.EXPIRED ?? 0} expired`} tone="green"/>
      <Metric label="Devices" value={data.devices?.total ?? "—"} hint={`${data.devices?.activeLast7Days ?? 0} active in 7 days`} tone="blue"/>
      <Metric label="Failed sync events" value={data.synchronization?.failed ?? "—"} hint={`${data.synchronization?.pending ?? 0} pending`} tone="orange"/>
      <Metric label="Open incidents" value={data.errors?.unresolved ?? "—"} hint="Application errors still being handled" tone="red"/>
      <Metric label="API requests / hour" value={data.api?.requestCountLastHour ?? "—"} hint={data.api?.averageResponseMs == null ? "Collecting request metrics" : `${data.api.averageResponseMs} ms average`} tone="purple"/>
    </div>
    <div className="dashboard-grid">
      <Panel title="Businesses by industry"><Bars rows={data.businesses?.byIndustry ?? []} labelKey="industry" valueKey="count"/></Panel>
      <Panel title="Subscription distribution"><div className="distribution-list">{Object.entries(byStatus).map(([key, value]) => <div className="distribution-row" key={key}><Status value={key}/><strong>{String(value)}</strong></div>)}{!Object.keys(byStatus).length && <Empty>No subscription records are available.</Empty>}</div><p className="data-note">Expected monthly value: {data.subscriptions?.expectedMonthlyValue?.available ? formatMoney(data.subscriptions.expectedMonthlyValue.amount) : "Unavailable"}. This is list price, not recognized revenue.</p></Panel>
      <Panel title="Recent incidents" action={<Link className="quiet-link" href="/system-errors">View all →</Link>}><Table rows={data.errors?.recent ?? []} empty="No application errors have been collected." columns={[{ key: "title", label: "Error" }, { key: "severity", label: "Severity", render: (row) => <Status value={row.severity}/> }, { key: "source", label: "Source" }, { key: "occurrenceCount", label: "Hits" }]}/></Panel>
      <Panel title="Recent admin activity" action={<Link className="quiet-link" href="/audit-logs">Audit trail →</Link>}><Table rows={data.recentActivity ?? []} empty="Admin activity will appear here." columns={[{ key: "action", label: "Action" }, { key: "actorEmail", label: "Administrator" }, { key: "targetType", label: "Target" }, { key: "createdAt", label: "Time", render: (row) => date(row.createdAt) }]}/></Panel>
    </div>
    <div className="data-note wide-note">Data coverage: payments received, daily/monthly active users and external uptime are unavailable until verified ledgers, activity events and an external monitor are connected. The dashboard does not treat unavailable values as zero.</div>
  </>;
}
function Bars({ rows, labelKey, valueKey }: { rows: Row[]; labelKey: string; valueKey: string }) { const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] ?? 0))); return rows.length ? <div className="bar-list">{rows.slice(0, 8).map((row) => <div className="bar-row" key={String(row[labelKey])}><span>{human(row[labelKey])}</span><div className="bar-track"><i style={{ width: `${Math.max(2, Number(row[valueKey] ?? 0) / max * 100)}%` }}/></div><strong>{row[valueKey]}</strong></div>)}</div> : <Empty>No registrations are available in this range.</Empty>; }

function Businesses({ role }: { role: PlatformAdminRole }) {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [filterStatus, setFilterStatus] = useState("");
  const query = new URLSearchParams({ page: String(page), limit: "25", ...(search ? { search } : {}), ...(filterStatus ? { status: filterStatus } : {}) }).toString();
  const state = useData<PageData>(`/businesses?${query}`);
  return <><PageHeader title="Business management" subtitle="Search and manage every DIRA OS business with complete server-side pagination."/><Panel title="Businesses" action={<span className="record-count">{state.data?.total ?? "—"} total</span>}>
    <div className="toolbar"><input placeholder="Search name, slug, email or phone" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/><select value={filterStatus} onChange={(event) => { setFilterStatus(event.target.value); setPage(1); }}><option value="">All billing states</option><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option></select><button className="secondary-button" onClick={state.refresh}>Refresh</button></div>
    {state.error && <Problem message={state.error} retry={state.refresh}/>} {state.loading && !state.data ? <Loading/> : state.data && <><Table rows={state.data.items} empty="No businesses matched these filters." onRow={(row) => { window.location.href = `/businesses/${encodeURIComponent(row.resolvedBusinessId ?? row.externalId ?? row._id)}`; }} columns={[{ key: "name", label: "Business", render: (row) => <div className="primary-cell"><strong>{row.name}</strong><small>{row.slug}</small></div> }, { key: "owner", label: "Owner", render: (row) => row.owner?.name ?? "—" }, { key: "industryKey", label: "Industry", render: (row) => human(row.industryKey ?? row.businessType) }, { key: "billingStatus", label: "Business status", render: (row) => <Status value={row.billingStatus}/> }, { key: "currentSubscription", label: "Subscription", render: (row) => row.currentSubscription ? <>{human(row.currentSubscription.planCode)} · <Status value={row.currentSubscription.status}/></> : "No subscription" }, { key: "createdAt", label: "Registered", render: (row) => date(row.createdAt) }, { key: "action", label: "", render: (row) => <Link className="quiet-link" href={`/businesses/${encodeURIComponent(row.resolvedBusinessId ?? row.externalId ?? row._id)}`}>Open →</Link> }]}/><Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/></>}
  </Panel></>;
}

function BusinessDetail({ id, role }: { id: string; role: PlatformAdminRole }) {
  const state = useData<Row>(`/businesses/${encodeURIComponent(id)}`); const [tab, setTab] = useState("Overview"); const [actionError, setActionError] = useState(""); const [busy, setBusy] = useState(false);
  const business = state.data?.business; const businessId = state.data?.businessId ?? id;
  async function act(path: string, body?: Row) { setBusy(true); setActionError(""); try { await request(path, { method: body ? "POST" : "POST", body: JSON.stringify(body ?? {}) }); state.refresh(); } catch (error) { setActionError(error instanceof Error ? error.message : "Action failed"); } finally { setBusy(false); } }
  if (state.loading && !state.data) return <><PageHeader title="Business profile" subtitle="Loading business details…"/><Loading/></>;
  if (state.error && !state.data) return <Problem message={state.error} retry={state.refresh}/>;
  const tabs = ["Overview", "Users", "Devices", "Subscription", "Payments", "Synchronization", "Activity", "Technical health"];
  return <><PageHeader title={business?.name ?? "Business profile"} subtitle={`${human(business?.businessType)} · ${business?.slug ?? businessId}`} action={<Link href="/businesses" className="secondary-button">← Businesses</Link>}/>
    {actionError && <Problem message={actionError} retry={() => setActionError("")}/>}<div className="business-banner"><div className="business-avatar">{String(business?.name ?? "D").slice(0,1).toUpperCase()}</div><div><strong>{business?.name}</strong><span>{business?.email || business?.phone || "Contact details not recorded"}</span></div><Status value={business?.billingStatus}/><span className="grow"/>{can(role,"businesses:manage") && (business?.billingStatus === "suspended" ? <button disabled={busy} className="primary-button" onClick={() => confirm("Reactivate this business account?") && act(`/businesses/${encodeURIComponent(id)}/restore`)}>Reactivate</button> : <button disabled={busy} className="danger-button" onClick={() => { const reason = prompt("Reason for suspension (visible to platform administrators):"); if (reason !== null && confirm("Suspend this business and prevent future sign-ins?")) act(`/businesses/${encodeURIComponent(id)}/suspend`, { reason }); }}>Suspend</button>)}</div>
    <div className="tabs">{tabs.map((label) => <button className={tab === label ? "is-active" : ""} key={label} onClick={() => setTab(label)}>{label}</button>)}</div>
    {tab === "Overview" && <div className="detail-grid"><Panel title="Business details"><KeyValues values={{ Business: business?.name, Slug: business?.slug, Industry: business?.industryKey ?? business?.businessType, Currency: business?.currency, Email: business?.email, Phone: business?.phone, Address: business?.address, Registered: date(business?.createdAt), "Billing status": business?.billingStatus }}/></Panel><Panel title="Business owner"><KeyValues values={{ Name: state.data?.owner?.fullName, Phone: state.data?.owner?.phone, Role: state.data?.owner?.role, Status: state.data?.owner?.isActive ? "Active" : "Suspended" }}/></Panel><Panel title="Service posture"><div className="distribution-list"><div>Subscription <Status value={state.data?.subscription?.status ?? "Not configured"}/></div><div>Devices <strong>{state.data?.devices?.length ?? 0}</strong></div><div>Pending sync <strong>{state.data?.synchronization?.pending ?? 0}</strong></div><div>Failed sync <strong>{state.data?.synchronization?.failed ?? 0}</strong></div></div></Panel><Panel title="Account controls" action={can(role,"businesses:manage") && <span className="small-label">Actions are audited</span>}><p className="data-note">Business account suspension preserves local offline data. Existing customer sessions are rejected on their next API request.</p></Panel></div>}
    {tab === "Users" && <Panel title="Employees and users"><Table rows={state.data?.employees ?? []} columns={[{key:"fullName",label:"Name"},{key:"phone",label:"Phone"},{key:"roleLabel",label:"Role",render:(row)=><>{human(row.roleLabel ?? row.role)} <Status value={row.isActive ? "active" : "suspended"}/></>},{key:"createdAt",label:"Created",render:(row)=>date(row.createdAt)}]}/><Link href={`/employees?businessId=${encodeURIComponent(businessId)}`} className="text-link">Open employee management →</Link></Panel>}
    {tab === "Devices" && <Panel title="Registered devices"><DeviceTable rows={state.data?.devices ?? []} role={role} onChanged={state.refresh}/></Panel>}
    {tab === "Subscription" && <SubscriptionProfile subscription={state.data?.subscription} businessId={businessId} role={role} refresh={state.refresh}/>}
    {tab === "Payments" && <Panel title="Reconciliation history"><div className="inline-alert warn">A verified subscription payment ledger is not present. These records are reconciliation logs and must not be treated as receipts.</div><Table rows={state.data?.payments?.records ?? []} columns={[{key:"reference",label:"Reference"},{key:"status",label:"Reconciliation",render:(row)=><Status value={row.status}/>},{key:"createdAt",label:"Logged",render:(row)=>date(row.createdAt)}]}/></Panel>}
    {tab === "Synchronization" && <SyncTable rows={state.data?.synchronization?.checkpoints ?? []} summary={state.data?.synchronization} role={role}/>}
    {tab === "Activity" && <Panel title="Business activity"><Table rows={state.data?.activity ?? []} empty="No business activity records are available." columns={[{key:"action",label:"Action"},{key:"entityType",label:"Type"},{key:"entityId",label:"Record"},{key:"createdAt",label:"Time",render:(row)=>date(row.createdAt)}]}/></Panel>}
    {tab === "Technical health" && <Panel title="Technical health"><KeyValues values={{"Database-backed API": "Available", "Sync status": `${state.data?.synchronization?.failed ?? 0} failed · ${state.data?.synchronization?.pending ?? 0} pending`, "Latest successful push": date(state.data?.synchronization?.latestSuccessfulPush), "Latest successful pull": date(state.data?.synchronization?.latestSuccessfulPull), "External uptime": "Unavailable — no external monitor configured" }}/></Panel>}
  </>;
}
function KeyValues({ values }: { values: Record<string, unknown> }) { return <dl className="key-values">{Object.entries(values).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{human(value)}</dd></div>)}</dl>; }

function Employees({ role }: { role: PlatformAdminRole }) {
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]); const [selected, setSelected] = useState(""); const [employees, setEmployees] = useState<EmployeeRecord[]>([]); const [logs, setLogs] = useState<AuditLogRecord[]>([]); const [catalog, setCatalog] = useState<PermissionCatalog | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { const query = new URLSearchParams(window.location.search); const requested = query.get("businessId") ?? ""; let active = true; request<PageData>("/businesses?limit=100&page=1").then((result) => { if (!active) return; const items = result.items as AdminBusiness[]; setBusinesses(items); const id = requested || (items[0] ? String((items[0] as any).resolvedBusinessId ?? items[0].externalId ?? items[0]._id) : ""); setSelected(id); }).catch((cause) => setError(cause.message ?? "Unable to load businesses")); getEmployeeCatalog().then(setCatalog).catch(()=>undefined); return ()=>{active=false;}; }, []);
  const refresh = async () => { if (!selected) return; setLoading(true); setError(""); try { const [nextEmployees,nextLogs] = await Promise.all([listBusinessEmployees(selected), listBusinessAuditLogs(selected)]); setEmployees(nextEmployees); setLogs(nextLogs); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load employee directory"); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, [selected]);
  const business = businesses.find((item) => String((item as any).resolvedBusinessId ?? item.externalId ?? item._id) === selected) ?? null;
  if (!can(role,"employees:view")) return <Empty>Your administrator role cannot view the employee directory.</Empty>;
  return <><PageHeader title="Employee directory" subtitle="Manage business users, employee roles and access. Platform administrators remain a separate identity type."/><Panel title="Business context" action={<label className="inline-select"><span>Business</span><select value={selected} onChange={(event)=>setSelected(event.target.value)}><option value="">Choose a business</option>{businesses.map((item)=><option key={item._id} value={String((item as any).resolvedBusinessId ?? item.externalId ?? item._id)}>{item.name}</option>)}</select></label>}>{error && <Problem message={error} retry={refresh}/>}<EmployeeManagementPanel business={business} employees={employees} catalog={catalog} auditLogs={logs} loading={loading} error={error || null} onRefresh={refresh}/></Panel></>;
}

function Subscriptions({ role }: { role: PlatformAdminRole }) {
  const [page,setPage]=useState(1); const [search,setSearch]=useState(""); const [status,setStatus]=useState("");
  const query=new URLSearchParams({page:String(page),limit:"25",...(search?{search}:{}),...(status?{status}:{})}).toString(); const state=useData<PageData>(`/subscriptions?${query}`); const plansState=useData<Row[]>("/subscriptions/plans");
  return <><PageHeader title="Subscriptions" subtitle="Review actual backend states, assign plans and extend terms. Plan changes never record a payment."/><Panel title="Subscription directory" action={<span className="record-count">{state.data?.total ?? "—"} subscriptions</span>}><div className="toolbar"><input placeholder="Search business identifier" value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}}/><select value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}><option value="">All states</option>{["TRIAL","ACTIVE","EXPIRED","PAST_DUE","CANCELLED"].map((x)=><option key={x}>{x}</option>)}</select><button className="secondary-button" onClick={state.refresh}>Refresh</button></div>{state.error&&<Problem message={state.error} retry={state.refresh}/>}<Table rows={state.data?.items??[]} columns={[{key:"businessId",label:"Business ID",render:(row)=><Link className="text-link" href={`/businesses/${encodeURIComponent(row.businessId)}`}>{row.businessId}</Link>},{key:"planName",label:"Plan"},{key:"status",label:"Status",render:(row)=><Status value={row.status}/>},{key:"paymentStatus",label:"Payment status",render:(row)=><Status value={row.paymentStatus}/>},{key:"monthlyPrice",label:"List price",render:(row)=>formatMoney(row.monthlyPrice)},{key:"expiresAt",label:"Expiry",render:(row)=>date(row.expiresAt)},{key:"actions",label:"Actions",render:(row)=>can(role,"subscriptions:manage")?<div className="table-actions"><button onClick={async()=>{const code=prompt(`Available plans: ${(plansState.data??[]).map((plan)=>plan.code).join(", ")}`,row.planCode); if(code&&confirm(`Change ${row.businessId} to ${code}? This does not mark payment as received.`)){try{await request(`/subscriptions/${encodeURIComponent(row.businessId)}/plan`,{method:"POST",body:JSON.stringify({planCode:code})});state.refresh();}catch(error){alert(error instanceof Error?error.message:"Plan change failed");}}}}>Change plan</button><button onClick={async()=>{if(confirm(`Extend this subscription by 30 days? No payment will be recorded.`)){try{await request(`/subscriptions/${encodeURIComponent(row.businessId)}/extend`,{method:"POST",body:JSON.stringify({days:30})});state.refresh();}catch(error){alert(error instanceof Error?error.message:"Extension failed");}}}}>+30 days</button></div>:"View only"}]}/>{state.data&&<Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}</Panel></>;
}

function SubscriptionProfile({ subscription, businessId, role, refresh }: { subscription: Row | null; businessId: string; role: PlatformAdminRole; refresh: () => void }) { return <Panel title="Current subscription">{subscription?<><KeyValues values={{Plan:subscription.planName,Code:subscription.planCode,Status:subscription.status,"Payment status":subscription.paymentStatus,"Monthly list price":formatMoney(subscription.monthlyPrice),"Employee limit":subscription.employeeLimit,"Expires":date(subscription.expiresAt),"Started":date(subscription.startedAt)}}/>{can(role,"subscriptions:manage")&&<div className="detail-actions"><button className="secondary-button" onClick={async()=>{const code=prompt("Enter the plan code");if(code&&confirm(`Change to ${code}? Payment remains unverified.`)){try{await request(`/subscriptions/${encodeURIComponent(businessId)}/plan`,{method:"POST",body:JSON.stringify({planCode:code})});refresh();}catch(error){alert(error instanceof Error?error.message:"Action failed");}}}}>Change plan</button><button className="primary-button" onClick={async()=>{const days=Number(prompt("Extend by how many days?", "30"));if(days&&confirm(`Extend by ${days} days?`)){try{await request(`/subscriptions/${encodeURIComponent(businessId)}/extend`,{method:"POST",body:JSON.stringify({days})});refresh();}catch(error){alert(error instanceof Error?error.message:"Action failed");}}}}>Extend term</button></div>}</>:<Empty>No subscription record is configured for this business.</Empty>}</Panel>; }

function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [businessId, setBusinessId] = useState("");
  const query = new URLSearchParams({ page: String(page), limit: "25", ...(status ? { status } : {}), ...(businessId ? { businessId } : {}) }).toString();
  const state = useData<PageData>(`/payments?${query}`);
  return <>
    <PageHeader title="Payment reconciliation" subtitle="Reconciliation observations from existing payment callbacks. These are not a verified platform billing ledger."/>
    <div className="inline-alert warn">Receipt totals, refunds and recognized revenue remain unavailable because the current repository has no verified platform subscription payment ledger. Reconciliation records below show callback matching only.</div>
    <Panel title="Callback reconciliation" action={<span className="record-count">{state.data?.total ?? "—"} records</span>}>
      <div className="toolbar"><input placeholder="Filter by business ID" value={businessId} onChange={(event) => { setBusinessId(event.target.value); setPage(1); }}/><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All reconciliation states</option>{["matched", "pending", "manual", "failed"].map((value) => <option key={value}>{value}</option>)}</select><button className="secondary-button" onClick={state.refresh}>Refresh</button></div>
      {state.error && <Problem message={state.error} retry={state.refresh}/>}
      <Table rows={state.data?.items ?? []} empty={state.loading ? "Loading reconciliation records…" : "No callback reconciliation records match these filters."} columns={[{key:"createdAt",label:"Received",render:(row)=>date(row.createdAt)},{key:"businessId",label:"Business",render:(row)=><Link className="text-link" href={`/businesses/${encodeURIComponent(row.businessId)}`}>{row.businessId}</Link>},{key:"reference",label:"Provider reference"},{key:"paymentId",label:"Payment ID"},{key:"status",label:"Reconciliation",render:(row)=><Status value={row.status}/>}]} />
      {state.data && <Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}
    </Panel>
  </>;
}

function DeviceTable({ rows, role, onChanged }: { rows: Row[]; role: PlatformAdminRole; onChanged: () => void }) { return <Table rows={rows} columns={[{key:"deviceName",label:"Device"},{key:"businessId",label:"Business",render:(row)=><Link className="text-link" href={`/businesses/${encodeURIComponent(row.businessId)}`}>{row.businessId}</Link>},{key:"platform",label:"Platform"},{key:"deviceKey",label:"Device key",render:(row)=>row.deviceKey??row._id},{key:"trusted",label:"Trusted",render:(row)=><Status value={row.trusted?"trusted":"untrusted"}/>},{key:"lastSeenAt",label:"Last activity",render:(row)=>date(row.lastSeenAt)},{key:"revoke",label:"",render:(row)=>can(role,"devices:manage")&&row.deletedAt==null?<button className="text-danger" onClick={async()=>{if(confirm("Revoke this device? Future sync will be blocked; unsynchronized local business data will remain on the device.")){try{await request(`/devices/${encodeURIComponent(row._id)}/revoke`,{method:"POST",body:"{}"});onChanged();}catch(error){alert(error instanceof Error?error.message:"Revoke failed");}}}}>Revoke</button>:null}]}/>; }
function Devices({ role }: { role: PlatformAdminRole }) { const [page,setPage]=useState(1);const [search,setSearch]=useState("");const [status,setStatus]=useState("");const q=new URLSearchParams({page:String(page),limit:"25",...(search?{search}:{}),...(status?{status}:{})}).toString();const state=useData<PageData>(`/devices?${q}`);return <><PageHeader title="Device management" subtitle="Inspect registered clients and revoke access while preserving their offline data."/><Panel title="Registered devices" action={<span className="record-count">{state.data?.total??"—"} total</span>}><div className="toolbar"><input placeholder="Search device or business" value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}}/><select value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}><option value="">All activity</option><option value="active">Seen in 7 days</option><option value="inactive">Inactive</option></select><button className="secondary-button" onClick={state.refresh}>Refresh</button></div>{state.error&&<Problem message={state.error} retry={state.refresh}/>}<DeviceTable rows={state.data?.items??[]} role={role} onChanged={state.refresh}/>{state.data&&<Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}</Panel></>; }

function SyncTable({ rows, summary, role }: { rows: Row[]; summary?: Row; role: PlatformAdminRole }) { return <><div className="metric-grid compact-metrics"><Metric label="Pending" value={summary?.pending??"—"} tone="orange"/><Metric label="Failed" value={summary?.failed??"—"} tone="red"/><Metric label="Completed" value={summary?.applied??"—"} tone="green"/><Metric label="Last successful push" value={date(summary?.latestSuccessfulPush)} tone="blue"/><Metric label="Last successful pull" value={date(summary?.latestSuccessfulPull)} tone="blue"/></div><Panel title="Device checkpoints"><Table rows={summary?.checkpoints??rows} empty="No successful sync checkpoint has been recorded." columns={[{key:"businessId",label:"Business"},{key:"deviceId",label:"Device"},{key:"lastPushedAt",label:"Last successful push",render:(row)=>date(row.lastPushedAt)},{key:"lastPulledAt",label:"Last successful pull",render:(row)=>date(row.lastPulledAt)}]}/></Panel></>; }
function Sync({ role }: { role: PlatformAdminRole }) { const [page,setPage]=useState(1);const [status,setStatus]=useState("");const [search,setSearch]=useState("");const q=new URLSearchParams({page:String(page),limit:"25",...(status?{status}:{}),...(search?{search}:{})}).toString();const state=useData<PageData>(`/sync/events?${q}`);const overview=useData<Row>(`/dashboard?range=30d`);return <><PageHeader title="Synchronization" subtitle="Separate event states and review retries, last attempts and device checkpoints."/><div className="metric-grid compact-metrics"><Metric label="Pending" value={overview.data?.synchronization?.pending??"—"} tone="orange"/><Metric label="Failed" value={overview.data?.synchronization?.failed??"—"} tone="red"/></div><Panel title="Sync event history"><div className="toolbar"><input placeholder="Find event, entity or failure" value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}}/><select value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}><option value="">All event states</option>{["pending","failed","retrying","applied"].map((x)=><option key={x}>{x}</option>)}</select><button className="secondary-button" onClick={state.refresh}>Refresh</button></div>{state.error&&<Problem message={state.error} retry={state.refresh}/>}<Table rows={state.data?.items??[]} columns={[{key:"eventId",label:"Event"},{key:"businessId",label:"Business"},{key:"deviceId",label:"Device"},{key:"entityType",label:"Entity"},{key:"status",label:"Status",render:(row)=><Status value={row.status}/>},{key:"retryCount",label:"Retries"},{key:"lastAttemptAt",label:"Last attempt",render:(row)=>date(row.lastAttemptAt??row.serverReceivedAt)},{key:"lastError",label:"Last error"},{key:"retry",label:"",render:(row)=>row.status==="failed"&&can(role,"sync:retry")?<button className="text-link" onClick={async()=>{if(confirm("Retry this event? The server will process its original event ID and payload.")){try{await request(`/sync/events/${encodeURIComponent(row.eventId)}/retry`,{method:"POST",body:"{}"});state.refresh();}catch(error){alert(error instanceof Error?error.message:"Retry failed");}}}}>Retry</button>:null}]}/>{state.data&&<Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}</Panel></>; }

function Errors({ role }: { role: PlatformAdminRole }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const query = new URLSearchParams({ page: String(page), limit: "25", ...(status ? { status } : {}), ...(severity ? { severity } : {}), ...(source ? { source } : {}), ...(search ? { search } : {}) }).toString();
  const state = useData<PageData>(`/errors?${query}`);
  const detail = useData<Row>(selected ? `/errors/${encodeURIComponent(selected)}` : null);
  const canManage = can(role, "errors:manage");
  return <>
    <PageHeader title="System errors and incidents" subtitle="Grouped application failures with severity, affected entities and an Open → Investigating → Resolved workflow."/>
    <Panel title="Incident queue" action={<span className="record-count">{state.data?.total ?? "—"} groups</span>}>
      <div className="toolbar"><input placeholder="Search errors or business" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{["open", "investigating", "resolved"].map((value) => <option key={value}>{value}</option>)}</select><select value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }}><option value="">All severity</option>{["critical", "high", "medium", "low"].map((value) => <option key={value}>{value}</option>)}</select><select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}><option value="">All sources</option>{["api", "mobile", "admin", "database", "sync", "background", "payment", "integration"].map((value) => <option key={value}>{value}</option>)}</select></div>
      {state.error && <Problem message={state.error} retry={state.refresh}/>}
      <Table rows={state.data?.items ?? []} columns={[
        {key:"title",label:"Error",render:(row)=><div className="primary-cell"><strong>{row.title}</strong><small>{row.module ?? row.endpoint ?? row.source} · {row.errorId}</small></div>},
        {key:"severity",label:"Severity",render:(row)=><Status value={row.severity}/>},
        {key:"status",label:"Status",render:(row)=><Status value={row.status}/>},
        {key:"source",label:"Source"}, {key:"occurrenceCount",label:"Occurrences"},
        {key:"businessId",label:"Business"}, {key:"deviceId",label:"Device"},
        {key:"requestId",label:"Request ID"}, {key:"lastOccurrence",label:"Last seen",render:(row)=>date(row.lastOccurrence)},
        {key:"actions",label:"",render:(row)=><div className="table-actions"><button onClick={()=>setSelected(row.errorId)}>Details</button>{canManage && <><select aria-label={`Set incident state for ${row.errorId}`} value={row.status} onChange={async(event)=>{try{await request(`/errors/${encodeURIComponent(row.errorId)}`,{method:"PATCH",body:JSON.stringify({status:event.target.value})});state.refresh();if(selected===row.errorId)detail.refresh();}catch(error){alert(error instanceof Error?error.message:"Status change failed");}}}>{["open","investigating","resolved"].map((value)=><option key={value}>{value}</option>)}</select><button onClick={async()=>{const assignedTo=prompt("Assign this incident to (email or name)",row.assignedTo??"");if(assignedTo!==null){try{await request(`/errors/${encodeURIComponent(row.errorId)}`,{method:"PATCH",body:JSON.stringify({assignedTo})});state.refresh();}catch(error){alert(error instanceof Error?error.message:"Assignment failed");}}}}>Assign</button><button onClick={async()=>{const body=prompt("Add an internal incident note");if(body?.trim()){try{await request(`/errors/${encodeURIComponent(row.errorId)}/notes`,{method:"POST",body:JSON.stringify({body})});state.refresh();if(selected===row.errorId)detail.refresh();}catch(error){alert(error instanceof Error?error.message:"Note failed");}}}}>Add note</button></>}</div>}
      ]}/>
      {state.data && <Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}
    </Panel>
    {selected && <Panel title="Incident details" action={<button className="secondary-button" onClick={()=>setSelected("")}>Close</button>}>
      {detail.error && <Problem message={detail.error} retry={detail.refresh}/>}
      {detail.loading && !detail.data ? <Loading label="Loading error details…"/> : detail.data && <>
        <KeyValues values={{Title:detail.data.title,Severity:detail.data.severity,Status:detail.data.status,Source:detail.data.source,Environment:detail.data.environment,Module:detail.data.module,Endpoint:detail.data.endpoint,"HTTP status":detail.data.httpStatus,Business:detail.data.businessId,Device:detail.data.deviceId,"App version":detail.data.appVersion,"Request ID":detail.data.requestId,Occurrences:detail.data.occurrenceCount,"First seen":date(detail.data.firstOccurrence),"Last seen":date(detail.data.lastOccurrence),Assignee:detail.data.assignedTo,"Resolution note":detail.data.resolutionComment}}/>
        <Panel title="Error message"><pre className="code-block">{detail.data.message}</pre></Panel>
        <Panel title="Stack trace"><pre className="code-block">{detail.data.stackTrace || "No stack trace was captured."}</pre></Panel>
        <Panel title="Internal notes">{detail.data.internalNotes?.length ? detail.data.internalNotes.map((note: Row,index: number)=><div className="audit-note" key={`${note.createdAt}-${index}`}><strong>{note.email}</strong><small>{date(note.createdAt)}</small><p>{note.body}</p></div>) : <Empty>No internal notes yet.</Empty>}</Panel>
      </>}
    </Panel>}
  </>;
}

function SystemHealth() { const state=useData<Row>("/health"); if(state.loading&&!state.data)return <><PageHeader title="System health" subtitle="Current API process and dependency state; external uptime is reported separately."/><Loading/></>;const data=state.data??{};return <><PageHeader title="System health" subtitle={`Checked ${date(data.checkedAt)} · Process health is not an uptime guarantee`}/>{state.error&&<Problem message={state.error} retry={state.refresh}/>}<div className="metric-grid">{Object.entries(data).filter(([key])=>!["checkedAt","databaseReadyState"].includes(key)).map(([key,value]:any)=><Metric key={key} label={key.replace(/([A-Z])/g," $1")} value={value?.available===false?"Unavailable":human(value)} hint={value?.reason} tone={value==="healthy"?"green":value==="unavailable"?"red":"blue"}/>)}</div><Panel title="Health interpretation"><p className="data-note">Healthy means this API process responded and MongoDB reports a ready connection. Background jobs, queues, email delivery, webhook completion and external uptime are unavailable because no reliable status provider exists in the current repository.</p></Panel></>; }
function ApiMonitoring() { const [range,setRange]=useState("1h");const state=useData<Row>(`/api-metrics?range=${range}`);return <><PageHeader title="API monitoring" subtitle="Endpoint request counts, observed response times and HTTP error rates from aggregated server metrics." action={<select value={range} onChange={(e)=>setRange(e.target.value)}><option value="1h">Last hour</option><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option></select>}/><Panel title="Endpoint statistics">{state.error&&<Problem message={state.error} retry={state.refresh}/>}<Table rows={state.data?.items??[]} empty={state.loading?"Collecting request metrics…":"No API requests have been recorded in this time range."} columns={[{key:"method",label:"Method"},{key:"route",label:"Endpoint"},{key:"requestCount",label:"Requests"},{key:"averageResponseMs",label:"Avg. response",render:(row)=>`${row.averageResponseMs} ms`},{key:"maxDurationMs",label:"Max response",render:(row)=>`${row.maxDurationMs} ms`},{key:"errorRate",label:"Error rate",render:(row)=>`${(row.errorRate*100).toFixed(1)}%`}]}/></Panel></>; }

function Settings({ role }: { role: PlatformAdminRole }) {
  const state = useData<Row>("/settings");
  const [form, setForm] = useState<Row | null>(null);
  useEffect(() => { if (state.data) setForm(state.data); }, [state.data]);

  async function save() {
    if (!form) return;
    if (!can(role, "settings:manage")) { alert("Your role cannot change platform configuration."); return; }
    if (form.maintenanceMode && !confirm("Enable maintenance mode? The API will return 503 for application requests while administrator controls, authentication and health endpoints remain available.")) return;
    try { await request("/settings", { method: "PATCH", body: JSON.stringify(form) }); state.refresh(); alert("Settings saved."); }
    catch (error) { alert(error instanceof Error ? error.message : "Settings could not be saved"); }
  }

  const textFields = [
    ["maintenanceMessage", "Maintenance message"],
    ["latestAppVersion", "Latest mobile app version"],
    ["minimumAppVersion", "Minimum supported version"],
    ["announcement", "System announcement"]
  ] as const;

  return <>
    <PageHeader title="Platform configuration" subtitle="Validated operational settings. Secrets remain in environment configuration and are never displayed here." action={can(role, "settings:manage") ? <button className="primary-button" onClick={save}>Save changes</button> : <Status value="read only"/>}/>
    <Panel title="Operational settings">
      {state.error && <Problem message={state.error} retry={state.refresh}/>}
      {!form && state.loading ? <Loading/> : form && <div className="settings-grid">
        <label className="setting-toggle"><span><strong>Maintenance mode</strong><small>Returns a maintenance response for application API requests. Administrator controls and health remain available.</small></span><input type="checkbox" checked={Boolean(form.maintenanceMode)} disabled={!can(role, "settings:manage")} onChange={(event) => setForm({ ...form, maintenanceMode: event.target.checked })}/></label>
        {textFields.map(([key, label]) => <label key={key}>{label}<input value={form[key] ?? ""} disabled={!can(role, "settings:manage")} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></label>)}
        <label>Feature flags (JSON)<textarea rows={5} value={JSON.stringify(form.featureFlags ?? {}, null, 2)} disabled={!can(role, "settings:manage")} onChange={(event) => { try { setForm({ ...form, featureFlags: JSON.parse(event.target.value) }); } catch { /* Keep the last valid draft until the JSON is complete. */ } }}/></label>
        <label>Operational limits (JSON)<textarea rows={5} value={JSON.stringify(form.operationalLimits ?? {}, null, 2)} disabled={!can(role, "settings:manage")} onChange={(event) => { try { setForm({ ...form, operationalLimits: JSON.parse(event.target.value) }); } catch { /* Keep the last valid draft until the JSON is complete. */ } }}/></label>
      </div>}
    </Panel>
  </>;
}

function Support({ role }: { role: PlatformAdminRole }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const query = new URLSearchParams({ page: String(page), limit: "25", ...(status ? { status } : {}), ...(priority ? { priority } : {}), ...(search ? { search } : {}) }).toString();
  const state = useData<PageData>(`/support/tickets?${query}`);
  const canManage = can(role, "support:manage");

  async function create() {
    const subject = prompt("Ticket subject"); if (!subject?.trim()) return;
    const description = prompt("Describe the request"); if (!description?.trim()) return;
    const contactName = prompt("Customer contact name"); if (!contactName?.trim()) return;
    const contactEmail = prompt("Customer email (optional)") || null;
    const businessId = prompt("Business ID (optional)") || null;
    const category = prompt("Category: technical, payment, subscription, complaint, other", "technical") || "technical";
    const ticketPriority = prompt("Priority: low, normal, high, urgent", "normal") || "normal";
    try {
      await request("/support/tickets", { method: "POST", body: JSON.stringify({ subject, description, contactName, contactEmail, businessId, category, priority: ticketPriority }) });
      state.refresh();
    } catch (error) { alert(error instanceof Error ? error.message : "Ticket could not be created"); }
  }

  async function update(ticketNumber: string, patch: Row) {
    try { await request(`/support/tickets/${encodeURIComponent(ticketNumber)}`, { method: "PATCH", body: JSON.stringify(patch) }); state.refresh(); }
    catch (error) { alert(error instanceof Error ? error.message : "Ticket update failed"); }
  }

  async function addNote(ticketNumber: string) {
    const body = prompt("Add an internal support note"); if (!body?.trim()) return;
    try { const saved = await request<Row>(`/support/tickets/${encodeURIComponent(ticketNumber)}/notes`, { method: "POST", body: JSON.stringify({ body }) }); state.refresh(); if (selected?.ticketNumber === ticketNumber) setSelected(saved); }
    catch (error) { alert(error instanceof Error ? error.message : "Note could not be saved"); }
  }

  return <>
    <PageHeader title="Support centre" subtitle="Track customer requests, ownership, internal notes and resolution history." action={canManage ? <button className="primary-button" onClick={create}>New ticket</button> : null}/>
    <Panel title="Support tickets" action={<span className="record-count">{state.data?.total ?? "—"} tickets</span>}>
      <div className="toolbar"><input placeholder="Search subject or ticket number" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{["open", "in_progress", "waiting_customer", "resolved", "closed"].map((value) => <option key={value}>{value}</option>)}</select><select value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}><option value="">All priorities</option>{["low", "normal", "high", "urgent"].map((value) => <option key={value}>{value}</option>)}</select><button className="secondary-button" onClick={state.refresh}>Refresh</button></div>
      {state.error && <Problem message={state.error} retry={state.refresh}/>}
      <Table rows={state.data?.items ?? []} columns={[
        {key:"ticketNumber",label:"Ticket",render:(row)=><button className="text-link" onClick={()=>setSelected(row)}>{row.ticketNumber}</button>},
        {key:"subject",label:"Subject"}, {key:"businessId",label:"Business"}, {key:"contactName",label:"Contact"}, {key:"category",label:"Category"},
        {key:"priority",label:"Priority",render:(row)=>canManage?<select value={row.priority} onChange={(event)=>void update(row.ticketNumber,{priority:event.target.value})}>{["low","normal","high","urgent"].map((value)=><option key={value}>{value}</option>)}</select>:<Status value={row.priority}/>},
        {key:"status",label:"Status",render:(row)=>canManage?<select value={row.status} onChange={(event)=>void update(row.ticketNumber,{status:event.target.value})}>{["open","in_progress","waiting_customer","resolved","closed"].map((value)=><option key={value}>{value}</option>)}</select>:<Status value={row.status}/>},
        {key:"assignedTo",label:"Assigned to",render:(row)=>canManage?<button onClick={async()=>{const assignedTo=prompt("Assign ticket to (email or name)",row.assignedTo??"");if(assignedTo!==null)await update(row.ticketNumber,{assignedTo});}}>{row.assignedTo || "Assign"}</button>:row.assignedTo || "—"},
        {key:"activity",label:"Activity",render:(row)=><div className="table-actions"><button onClick={()=>setSelected(row)}>History ({row.history?.length ?? 0})</button>{canManage&&<button onClick={()=>void addNote(row.ticketNumber)}>Note ({row.internalNotes?.length ?? 0})</button>}</div>},
        {key:"createdAt",label:"Opened",render:(row)=>date(row.createdAt)}
      ]}/>
      {state.data && <Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}
    </Panel>
    {selected && <Panel title={`Ticket ${selected.ticketNumber}`} action={<button className="secondary-button" onClick={()=>setSelected(null)}>Close</button>}>
      <KeyValues values={{Subject:selected.subject,Category:selected.category,Priority:selected.priority,Status:selected.status,Business:selected.businessId,Contact:selected.contactName,Email:selected.contactEmail,Assignee:selected.assignedTo}}/>
      <Panel title="Request"><p className="data-note">{selected.description}</p></Panel>
      <Panel title="Internal notes">{selected.internalNotes?.length ? selected.internalNotes.map((note:Row,index:number)=><div className="audit-note" key={`${note.createdAt}-${index}`}><strong>{note.email}</strong><small>{date(note.createdAt)}</small><p>{note.body}</p></div>) : <Empty>No internal notes yet.</Empty>}</Panel>
      <Panel title="Resolution history">{selected.history?.length ? selected.history.map((entry:Row,index:number)=><div className="audit-note" key={`${entry.createdAt}-${index}`}><strong>{human(entry.action)}</strong><small>{date(entry.createdAt)}</small><p>{entry.details || ""}</p></div>) : <Empty>No history recorded.</Empty>}</Panel>
    </Panel>}
    <div className="data-note">Tickets are internal support records. Customer email delivery and communication history are not configured.</div>
  </>;
}

function Reports() {const [name,setName]=useState("business-growth");const state=useData<any>(`/reports/${name}`);const payload=state.data;const rows=Array.isArray(payload)?payload:Array.isArray(payload?.items)?payload.items:[];function exportCsv(){if(payload?.available===false){alert(payload.reason);return;}if(!rows.length){alert("No rows to export.");return;}const keys=Object.keys(rows[0]);const csv=[keys.join(","),...rows.map((row:any)=>keys.map((key)=>`"${String(row[key]??"").replace(/"/g,'""')}"`).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download=`dira-${name}-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);}return <><PageHeader title="Reports and analytics" subtitle="Server-aggregated business, subscription, synchronization and monitoring reports." action={<button className="secondary-button" onClick={exportCsv}>Export CSV</button>}/><Panel title="Report"><div className="toolbar"><select value={name} onChange={(e)=>setName(e.target.value)}>{["business-growth","subscriptions","sync","errors","api-performance","payments","revenue","user-activity","employee-activity","retention","churn"].map((x)=><option key={x} value={x}>{x.replace(/-/g," ")}</option>)}</select></div>{state.error&&<Problem message={state.error} retry={state.refresh}/>} {payload?.available===false?<div className="inline-alert warn">{payload.reason}</div>:<Table rows={rows} empty="No report rows are available." columns={(rows[0]?Object.keys(rows[0]):["_id","count"]).map((key:string)=>({key,label:key.replace(/_/g," ")}))}/>}</Panel></>;}

function AuditLogs() {
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"actions" | "logins">("actions");
  const actions = useData<PageData>(view === "actions" ? `/audit?page=${page}&limit=50` : null);
  const logins = useData<PageData>(view === "logins" ? `/audit/login-events?page=${page}&limit=50` : null);
  const state = view === "actions" ? actions : logins;
  return <>
    <PageHeader title="Security and audit" subtitle="Append-only administrator actions and authentication history, with request correlation and sensitive values excluded."/>
    <div className="toolbar"><button className={view === "actions" ? "primary-button" : "secondary-button"} onClick={() => { setView("actions"); setPage(1); }}>Administrator actions</button><button className={view === "logins" ? "primary-button" : "secondary-button"} onClick={() => { setView("logins"); setPage(1); }}>Login history</button></div>
    <Panel title={view === "actions" ? "Administrator activity" : "Administrator sign-in history"}>
      {state.error && <Problem message={state.error} retry={state.refresh}/>}
      {view === "actions" ? <Table rows={state.data?.items ?? []} columns={[{key:"createdAt",label:"Time",render:(row)=>date(row.createdAt)},{key:"actorEmail",label:"Administrator"},{key:"actorRole",label:"Role",render:(row)=>human(PLATFORM_ADMIN_ROLE_LABELS[row.actorRole as PlatformAdminRole] ?? row.actorRole)},{key:"action",label:"Action"},{key:"targetType",label:"Resource"},{key:"targetId",label:"Resource ID"},{key:"requestId",label:"Request ID"}]}/> : <Table rows={state.data?.items ?? []} columns={[{key:"createdAt",label:"Time",render:(row)=>date(row.createdAt)},{key:"email",label:"Account"},{key:"outcome",label:"Outcome",render:(row)=><Status value={row.outcome}/>},{key:"reason",label:"Reason"},{key:"userAgent",label:"Client"}]}/>}
      {state.data && <Pager page={state.data.page} total={state.data.total} limit={state.data.limit} change={setPage}/>}
    </Panel>
  </>;
}

function AdminUsers({ role }: { role: PlatformAdminRole }) {const state=useData<Row[]>("/admin-users");const [createOpen,setCreateOpen]=useState(false);const [form,setForm]=useState({name:"",email:"",password:"",role:"read_only"});async function create(event:FormEvent){event.preventDefault();if(!confirm(`Create a ${PLATFORM_ADMIN_ROLE_LABELS[form.role as PlatformAdminRole]} account for ${form.email}?`))return;try{await request("/admin-users",{method:"POST",body:JSON.stringify(form)});setCreateOpen(false);setForm({name:"",email:"",password:"",role:"read_only"});state.refresh();}catch(error){alert(error instanceof Error?error.message:"Administrator could not be created");}}return <><PageHeader title="Platform administrators" subtitle="Separate platform identities with explicit roles and session revocation." action={can(role,"platform_users:manage")?<button className="primary-button" onClick={()=>setCreateOpen(!createOpen)}>Add administrator</button>:null}/>{createOpen&&<Panel title="Create administrator"><form className="inline-form" onSubmit={create}><label>Name<input required maxLength={120} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>Email<input type="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label>Temporary password<input type="password" required minLength={12} maxLength={128} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})}/></label><label>Role<select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}>{Object.entries(PLATFORM_ADMIN_ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="primary-button">Create identity</button></form></Panel>}<Panel title="Administrator directory">{state.error&&<Problem message={state.error} retry={state.refresh}/>}<Table rows={state.data??[]} columns={[{key:"name",label:"Administrator"},{key:"email",label:"Email"},{key:"role",label:"Role",render:(row)=><select value={row.role} disabled={!can(role,"platform_users:manage")} onChange={async(e)=>{if(confirm(`Change ${row.email} to ${PLATFORM_ADMIN_ROLE_LABELS[e.target.value as PlatformAdminRole]}? Existing sessions will be revoked.`)){try{await request(`/admin-users/${encodeURIComponent(row.id)}`,{method:"PATCH",body:JSON.stringify({role:e.target.value})});state.refresh();}catch(error){alert(error instanceof Error?error.message:"Role update failed");}}}}>{Object.entries(PLATFORM_ADMIN_ROLE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>},{key:"isActive",label:"Access",render:(row)=><Status value={row.isActive?"active":"suspended"}/>},{key:"emailVerified",label:"Email verified",render:(row)=><Status value={row.emailVerified?"verified":"unverified"}/>},{key:"sessions",label:"Sessions",render:(row)=>can(role,"platform_users:manage")?<button onClick={async()=>{if(confirm(`Revoke active sessions for ${row.email}?`)){try{await request(`/admin-users/${encodeURIComponent(row.id)}/revoke-sessions`,{method:"POST",body:"{}"});alert("Administrator sessions revoked.");}catch(error){alert(error instanceof Error?error.message:"Could not revoke sessions");}}}}>Revoke all</button>:null}]}/></Panel></>;}
