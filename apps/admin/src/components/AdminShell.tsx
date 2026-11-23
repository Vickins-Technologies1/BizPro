"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasPlatformAdminPermission, PLATFORM_ADMIN_ROLE_LABELS, type PlatformAdminPermission, type PlatformAdminRole } from "@vbo/shared";
import { adminAuthClient } from "../lib/auth-client";
import { AdminSection } from "./AdminSection";

type NavEntry = { label: string; href: string; permission: PlatformAdminPermission };
const NAV: Array<{ group: string; entries: NavEntry[] }> = [
  { group: "Overview", entries: [{ label: "Dashboard", href: "/", permission: "dashboard:view" }] },
  { group: "Operations", entries: [
    { label: "Businesses", href: "/businesses", permission: "businesses:view" },
    { label: "Employees", href: "/employees", permission: "employees:view" },
    { label: "Devices", href: "/devices", permission: "devices:view" },
    { label: "Synchronization", href: "/sync", permission: "sync:view" },
    { label: "System errors", href: "/system-errors", permission: "errors:view" }
  ] },
  { group: "Commercial", entries: [
    { label: "Subscriptions", href: "/subscriptions", permission: "subscriptions:view" },
    { label: "Payments", href: "/payments", permission: "payments:view" },
    { label: "Reports", href: "/reports", permission: "reports:view" }
  ] },
  { group: "Platform", entries: [
    { label: "System health", href: "/system-health", permission: "health:view" },
    { label: "API monitoring", href: "/api-monitoring", permission: "health:view" },
    { label: "Support centre", href: "/support", permission: "support:view" },
    { label: "Configuration", href: "/settings", permission: "settings:view" },
    { label: "Audit logs", href: "/audit-logs", permission: "audit:view" },
    { label: "Admin users", href: "/admin-users", permission: "platform_users:view" }
  ] }
];

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
      <Link className="brand-lockup" href="/" onClick={() => setMobileOpen(false)}><span className="brand-mark">D</span><span className="brand-copy"><strong>DIRA OS</strong><small>Platform control</small></span></Link>
      <button className="sidebar-collapse" aria-label="Collapse sidebar" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "»" : "«"}</button>
      <nav className="side-nav">
        {visibleNav.map((group) => <section className="nav-group" key={group.group}><h2>{group.group}</h2>{group.entries.map((entry) => <Link key={entry.href} href={entry.href} className={`nav-link ${section === entry.href.slice(1) || (entry.href === "/" && !section) ? "is-active" : ""}`} onClick={() => setMobileOpen(false)}><span className="nav-dot" />{entry.label}{entry.label === "System errors" && unresolved ? <span className="nav-count">{unresolved}</span> : null}</Link>)}</section>)}
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
