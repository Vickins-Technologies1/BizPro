"use client";

import { useEffect, useState } from "react";
import { BUSINESS_TYPES } from "@vbo/shared";
import { DashboardCard } from "./DashboardCard";
import { fetchJson } from "../lib/api";
import { listBusinesses, resolveBusinessId, type AdminBusiness, type AdminDevice, type AdminReconciliationLog, type AdminSubscription, type AdminSyncHealth } from "../lib/admin-api";

type Row = {
  business: AdminBusiness;
  devices: AdminDevice[];
  subscription: AdminSubscription | null;
  syncHealth: AdminSyncHealth;
  logs: AdminReconciliationLog[];
};

function LoadingState() {
  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: 20 }}>
      <DashboardCard title="Loading dashboard">
        <div style={{ color: "var(--text-secondary)" }}>Fetching live operations data from Cloud Run...</div>
      </DashboardCard>
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: 20 }}>
      <DashboardCard title="Dashboard unavailable" accent="rgba(239,68,68,0.35)">
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ color: "var(--text-secondary)" }}>{message}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Check that the Vercel secret <code>SUPPORT_API_KEY</code> matches the Cloud Run API secret.
          </div>
        </div>
      </DashboardCard>
    </main>
  );
}

async function loadData() {
  const businesses = await listBusinesses();
  const rows = await Promise.all(
    businesses.slice(0, 5).map(async (business) => {
      const businessId = resolveBusinessId(business);
      const [devices, subscription, syncHealth, logs] = await Promise.all([
        fetchJson<AdminDevice[]>(`/devices?businessId=${encodeURIComponent(businessId)}`),
        fetchJson<AdminSubscription | null>(`/subscriptions/current?businessId=${encodeURIComponent(businessId)}`),
        fetchJson<AdminSyncHealth>(`/sync/health?businessId=${encodeURIComponent(businessId)}`),
        fetchJson<AdminReconciliationLog[]>("/webhooks/tuma/logs", {
          method: "POST",
          body: JSON.stringify({ businessId })
        })
      ]);
      return { business, devices, subscription, syncHealth, logs };
    })
  );
  return rows;
}

export function AdminDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      try {
        const data = await loadData();
        if (!controller.signal.aborted) {
          setRows(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load dashboard");
        }
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, []);

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!rows) {
    return <LoadingState />;
  }

  const totalBusinesses = rows.length;
  const activePlans = rows.filter((row) => row.subscription?.status === "active").length;
  const pendingSync = rows.reduce((sum, row) => sum + row.syncHealth.pendingEvents, 0);
  const trustRate = rows.reduce((sum, row) => sum + row.devices.filter((device) => device.trusted).length, 0);

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: 20 }}>
      <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ textTransform: "uppercase", letterSpacing: 1.8, color: "var(--text-muted)", fontSize: 11 }}>Biz Pro Support Console</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 32, lineHeight: 1.05, fontFamily: "var(--font-grotesk)" }}>Executive operations dashboard</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", maxWidth: 640 }}>Business coverage, subscription posture, sync health, and payment reconciliation.</p>
        </div>
        <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "rgba(17,24,39,0.7)" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Business types supported</div>
          <div style={{ color: "var(--text)", fontWeight: 700 }}>{BUSINESS_TYPES.length}</div>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        {([
          ["Businesses", totalBusinesses, "rgba(59,130,246,0.35)"],
          ["Active plans", activePlans, "rgba(16,185,129,0.35)"],
          ["Pending sync", pendingSync, "rgba(245,158,11,0.35)"],
          ["Trusted devices", trustRate, "rgba(239,68,68,0.32)"]
        ] as Array<[string, number, string]>).map(([label, value, accent]) => (
          <DashboardCard key={label} title={label} accent={accent}>
            <div style={{ fontSize: 30, lineHeight: 1, fontFamily: "var(--font-grotesk)", fontWeight: 700 }}>{value}</div>
          </DashboardCard>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 1fr)", gap: 12 }}>
        <DashboardCard title="Businesses">
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map(({ business, devices, subscription, syncHealth }) => (
              <div
                key={business._id}
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{business.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 3 }}>
                      {business.slug} • {business.businessType}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: "rgba(37,99,235,0.18)", color: "var(--text)", fontSize: 11, fontWeight: 700 }}>
                      {subscription?.planCode ?? business.planTier}
                    </span>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: "rgba(16,185,129,0.18)", color: "var(--text)", fontSize: 11, fontWeight: 700 }}>
                      {syncHealth.pendingEvents} pending
                    </span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 3 }}>Devices</div>
                    <div>{devices.length}</div>
                  </div>
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 3 }}>Last sync</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {syncHealth.checkpoints[0]?.lastPulledAt ? new Date(syncHealth.checkpoints[0].lastPulledAt).toLocaleString() : "No sync yet"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
        <div style={{ display: "grid", gap: 16 }}>
          <DashboardCard title="Subscription snapshot" accent="rgba(16,185,129,0.4)">
            <div style={{ display: "grid", gap: 8 }}>
              {rows.map(({ business, subscription }) => (
                <div key={business._id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{business.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>{subscription?.status ?? "trial"}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
          <DashboardCard title="Payment reconciliation" accent="rgba(37,99,235,0.4)">
            <div style={{ display: "grid", gap: 8, maxHeight: 340, overflow: "auto" }}>
              {rows
                .flatMap((row) => row.logs.slice(0, 3).map((log) => ({ ...log, businessName: row.business.name })))
                .map((log) => (
                  <div key={log._id} style={{ padding: 11, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>{log.reference || "Unmatched"}</strong>
                      <span style={{ color: "var(--text-muted)" }}>{log.status}</span>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{log.businessName}</div>
                  </div>
                ))}
            </div>
          </DashboardCard>
        </div>
      </section>
    </main>
  );
}
