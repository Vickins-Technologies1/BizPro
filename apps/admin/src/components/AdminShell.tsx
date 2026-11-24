"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { hasPlatformAdminPermission, PLATFORM_ADMIN_ROLE_LABELS, type PlatformAdminPermission, type PlatformAdminRole } from "@vbo/shared";
import { adminAuthClient } from "../lib/auth-client";
import { AdminSection } from "./AdminSection";

type NavIconName = "dashboard" | "businesses" | "employees" | "devices" | "sync" | "errors" | "subscriptions" | "payments" | "reports" | "health" | "api" | "support" | "settings" | "audit" | "admins";
type NavEntry = { label: string; href: string; permission: PlatformAdminPermission; icon: NavIconName };
const NAV: Array<{ group: string; entries: NavEntry[] }> = [
  { group: "Overview", entries: [{ label: "Dashboard", href: "/", permission: "dashboard:view", icon: "dashboard" }] },
  { group: "Operations", entries: [
    { label: "Businesses", href: "/businesses", permission: "businesses:view", icon: "businesses" },
    { label: "Employees", href: "/employees", permission: "employees:view", icon: "employees" },
    { label: "Devices", href: "/devices", permission: "devices:view", icon: "devices" },
    { label: "Synchronization", href: "/sync", permission: "sync:view", icon: "sync" },
    { label: "System errors", href: "/system-errors", permission: "errors:view", icon: "errors" }
  ] },
  { group: "Commercial", entries: [
    { label: "Subscriptions", href: "/subscriptions", permission: "subscriptions:view", icon: "subscriptions" },
    { label: "Payments", href: "/payments", permission: "payments:view", icon: "payments" },
    { label: "Reports", href: "/reports", permission: "reports:view", icon: "reports" }
  ] },
  { group: "Platform", entries: [
    { label: "System health", href: "/system-health", permission: "health:view", icon: "health" },
    { label: "API monitoring", href: "/api-monitoring", permission: "health:view", icon: "api" },
    { label: "Support centre", href: "/support", permission: "support:view", icon: "support" },
    { label: "Configuration", href: "/settings", permission: "settings:view", icon: "settings" },
    { label: "Audit logs", href: "/audit-logs", permission: "audit:view", icon: "audit" },
    { label: "Admin users", href: "/admin-users", permission: "platform_users:view", icon: "admins" }
  ] }
];

const NAV_ICONS: Record<NavIconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></>,
  businesses: <><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M9 7h2M9 11h2M9 15h2M17 9h2v12"/></>,
  employees: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1zM16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.6V20"/></>,
  devices: <><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M10 5h4M11 18h2"/></>,
  sync: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3"/></>,
  errors: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></>,
  subscriptions: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  payments: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
  reports: <><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx=".5"/><rect x="13" y="8" width="3" height="10" rx=".5"/><rect x="19" y="5" width="2" height="13" rx=".5"/></>,
  health: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
  api: <><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01M12 7h4M12 17h4"/></>,
  support: <><path d="M3 13v-1a9 9 0 0 1 18 0v1"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/><path d="M17 19a5 3 0 0 1-5 3h-1"/></>,
  settings: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M2 14h4M10 8h4M18 16h4"/></>,
  audit: <><path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><path d="M9 4a3 3 0 0 1 6 0v2H9zM8 12h8M8 16h5"/></>,
  admins: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><circle cx="12" cy="9" r="2.5"/><path d="M7.5 17a4.5 4.5 0 0 1 9 0"/></>
};

function NavIcon({ name }: { name: NavIconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{NAV_ICONS[name]}</svg>;
}

export function AdminShell({ role, email, name, section, businessId }: { role: PlatformAdminRole; email: string; name: string; section: string; businessId?: string }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unresolved, setUnresolved] = useState<number | null>(null);
  const [range, setRange] = useState("30d");
  const [theme, setTheme] = useState("light");

  const visibleNav = useMemo(() => NAV.map((group) => ({ ...group, entries: group.entries.filter((entry) => hasPlatformAdminPermission(role, entry.permission)) })).filter((group) => group.entries.length), [role]);
  useEffect(() => {
    const saved = localStorage.getItem("dira-admin-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(saved); document.documentElement.dataset.theme = saved;
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api-proxy/platform-admin/errors?limit=1&status=open", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((body) => { if (!cancelled && body) setUnresolved(body.total ?? 0); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    await adminAuthClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = search.trim();
    if (value) router.push(`/businesses?search=${encodeURIComponent(value)}`);
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem("dira-admin-theme", next);
  }

  return <div className={`admin-frame ${collapsed ? "is-collapsed" : ""}`}>
    <aside className={`admin-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}>
      <Link className="brand-lockup" href="/" aria-label="DIRA OS Platform control" onClick={() => setMobileOpen(false)}><Image className="brand-logo" src="/dira-os-logo.png" alt="" width={40} height={40} priority/><span className="brand-copy"><strong>DIRA OS</strong><small>Platform control</small></span></Link>
      <button className="sidebar-collapse" aria-label="Collapse sidebar" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "»" : "«"}</button>
      <nav className="side-nav">
        {visibleNav.map((group) => <section className="nav-group" key={group.group}><h2>{group.group}</h2>{group.entries.map((entry) => {
          const active = section === entry.href.slice(1) || (entry.href === "/" && !section);
          return <Link key={entry.href} href={entry.href} className={`nav-link ${active ? "is-active" : ""}`} aria-label={entry.label} aria-current={active ? "page" : undefined} title={collapsed ? entry.label : undefined} onClick={() => setMobileOpen(false)}><NavIcon name={entry.icon}/><span className="nav-link-label">{entry.label}</span>{entry.label === "System errors" && unresolved ? <span className="nav-count">{unresolved}</span> : null}</Link>;
        })}</section>)}
      </nav>
      <div className="sidebar-foot"><span className="status-pulse" />Secure administrator session</div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="admin-main">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button><div className="breadcrumbs"><span>DIRA OS</span><b>/</b><strong>{section ? section.split("/").map((part) => part.replace(/-/g, " ")).join(" / ") : "Overview"}</strong></div></div>
        <form className="global-search" onSubmit={submitSearch}><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses, owners…" aria-label="Global search"/><kbd>Enter</kbd></form>
        <div className="topbar-actions">
          {!section && <select aria-label="Dashboard date range" value={range} onChange={(event) => setRange(event.target.value)}><option value="today">Today</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></select>}
          <button className="icon-button" onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }} aria-label="Notifications" aria-expanded={showNotifications}>♧{unresolved ? <i /> : null}</button>
          <button className="icon-button" onClick={toggleTheme} aria-label="Switch theme">{theme === "dark" ? "☼" : "◐"}</button>
          <div className="profile-menu"><button className="profile-trigger" onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }} aria-expanded={showProfile}><span className="avatar">{(name || email).slice(0, 1).toUpperCase()}</span><span className="profile-label"><strong>{name || email}</strong><small>{PLATFORM_ADMIN_ROLE_LABELS[role]}</small></span><span>⌄</span></button>
            {showProfile && <div className="profile-popover"><strong>{name || email}</strong><span>{email}</span><small>{PLATFORM_ADMIN_ROLE_LABELS[role]}</small><button className="profile-signout" onClick={signOut}>Sign out</button></div>}
          </div>
        </div>
        {showNotifications && <div className="notification-popover"><div className="popover-heading"><strong>Operations alerts</strong><button onClick={() => setShowNotifications(false)} aria-label="Close alerts">×</button></div><p>{unresolved === null ? "Checking incident queue…" : unresolved ? `${unresolved} open incident${unresolved === 1 ? "" : "s"} need attention.` : "No open incidents."}</p><Link href="/system-errors" onClick={() => setShowNotifications(false)}>Review incidents →</Link><div className="popover-divider"/><strong className="small-label">Signed in as</strong><span className="muted-small">{email}</span></div>}
      </header>
      <main className="content-area"><AdminSection section={section} {...(businessId ? { businessId } : {})} role={role} range={range}/></main>
      <footer className="page-footer"><span>Vickins Technologies · DIRA OS Platform</span><span>Administrator actions are recorded</span></footer>
    </div>
  </div>;
}
