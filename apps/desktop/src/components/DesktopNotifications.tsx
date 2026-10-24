"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { BusinessNotification } from "@vbo/shared";
import { api } from "../lib/desktop-api";

type NotificationTarget =
  | "workspace" | "dashboard" | "pos" | "products" | "purchaseOrders" | "transfers" | "customers"
  | "suppliers" | "expenses" | "reports" | "finance" | "insights" | "operations" | "team"
  | "teamAccess" | "settings" | "profile" | "notifications";

const routeTargets: Record<string, NotificationTarget> = {
  launchpad: "workspace", main: "dashboard", dashboard: "dashboard", pos: "pos", catalog: "products", brands: "products",
  productdetail: "products", products: "products", customers: "customers", employees: "team", reports: "reports",
  finance: "finance", invoices: "finance", insights: "insights", analytics: "insights", operations: "operations",
  settings: "settings", branches: "settings", notifications: "notifications", suppliers: "suppliers",
  purchaseorders: "purchaseOrders", stocktransfers: "transfers", expenses: "expenses", teamaccess: "teamAccess", profile: "profile"
};

export function DesktopNotifications({ onNavigate }: { onNavigate: (view: NotificationTarget) => void }) {
  const [items, setItems] = useState<BusinessNotification[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.notificationsPage({ page, pageSize: 12, search: deferredSearch }).then((result) => {
      if (!active) return;
      setItems(result.items); setPage(result.page); setTotalPages(result.totalPages); setUnreadCount(result.unreadCount);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, deferredSearch, reload]);

  async function markRead(id: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      await api.markNotificationRead(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((current) => Math.max(0, current - (items.find((item) => item.id === id)?.readAt ? 0 : 1)));
      return true;
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not update notification.");
      return false;
    } finally { setBusy(false); }
  }

  async function openNotification(notification: BusinessNotification) {
    if (!notification.readAt && !(await markRead(notification.id))) return;
    const target = notification.routeName ? routeTargets[notification.routeName.trim().toLowerCase()] : undefined;
    if (target) onNavigate(target);
  }

  async function markAllRead() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api.markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      setUnreadCount(0);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not update notifications.");
    } finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">NOTIFICATIONS</span><h1>Notification center</h1><p>{unreadCount ? unreadCount + " unread business updates" : "You are all caught up."}</p></div><div className="heading-actions">{unreadCount ? <button className="secondary" onClick={() => void markAllRead()} disabled={busy}>Mark all read</button> : null}<button className="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>Refresh</button></div></div>
    {error ? <div className="error-banner" role="alert">{error}<button className="text-button" onClick={() => setReload((value) => value + 1)}>Try again</button></div> : null}
    <div className="notification-toolbar"><input aria-label="Search notifications" placeholder="Search notifications" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><span className="badge">{unreadCount} unread</span><span className="muted">{loading ? "Loading…" : page + " / " + totalPages}</span></div>
    <div className="notification-list">{loading ? <div className="panel"><Empty text="Loading notifications…" /></div> : items.length ? items.map((notification) => {
      const routeTarget = notification.routeName ? routeTargets[notification.routeName.trim().toLowerCase()] : undefined;
      const timestamp = notification.sentAt ?? notification.createdAt;
      const timeLabel = timestamp ? new Date(timestamp).toLocaleString() : "Just now";
      const priority = notification.priority ?? "normal";
      return <article className={"notification-row panel" + (notification.readAt ? "" : " unread")} key={notification.id}>
        <button type="button" className="notification-open" onClick={() => void openNotification(notification)} disabled={busy} aria-label={routeTarget ? "Open " + notification.title : "Mark notification read"}>
          <span className={"activity-dot" + (notification.readAt ? "" : " blue")} />
          <span className="notification-copy"><strong>{notification.title || "Notification"}</strong><small>{notification.body || "No additional details"}</small><time>{timeLabel}</time></span>
          <span className={"badge " + (priority === "critical" || priority === "high" ? "warning" : "primary")}>{priority}</span>
          {routeTarget ? <span className="notification-route">Open details →</span> : null}
        </button>
        {!notification.readAt ? <button type="button" className="text-button" onClick={() => void markRead(notification.id)} disabled={busy}>Mark read</button> : <span className="muted">Read</span>}
      </article>;
    }) : <div className="panel"><Empty text={search ? "No matching notifications." : "No notifications are available."} /></div>}</div>
    {!loading && !error && totalPages > 1 ? <div className="notification-pagination"><button className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>← Previous</button><span>Page {page} of {totalPages}</span><button className="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next →</button></div> : null}
  </>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>◌</span><p>{text}</p></div>; }
