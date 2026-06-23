import { fetchJson } from "../lib/api";
import { DashboardCard } from "../components/DashboardCard";
import { BUSINESS_TYPES } from "@vbo/shared";

type Business = {
  _id: string;
  externalId?: string | null;
  name: string;
  slug: string;
  businessType: string;
  currency: string;
  planTier: string;
  billingStatus: string;
  createdAt: string;
};

type Device = { _id: string; deviceName: string; platform: string; trusted: boolean; lastSeenAt?: string };
type Subscription = { _id: string; planCode: string; status: string; expiresAt?: string };
type SyncHealth = { pendingEvents: number; checkpoints: Array<{ lastPulledAt?: string; lastPushedAt?: string; serverCursor?: string }> };
type ReconciliationLog = { _id: string; reference: string; status: string; createdAt: string };

async function loadData() {
  const businesses = await fetchJson<Business[]>("/businesses");
  const primary = businesses.slice(0, 5);
  const rows = await Promise.all(
    primary.map(async (business) => {
      const businessId = business.externalId ?? business._id;
      const [devices, subscription, syncHealth, logs] = await Promise.all([
        fetchJson<Device[]>(`/devices?businessId=${businessId}`),
        fetchJson<Subscription | null>(`/subscriptions/current?businessId=${businessId}`),
        fetchJson<SyncHealth>(`/sync/health?businessId=${businessId}`),
        fetchJson<ReconciliationLog[]>(`/webhooks/tuma/logs`, {
          method: "POST",
          body: JSON.stringify({ businessId })
        })
      ]);
      return { business, devices, subscription, syncHealth, logs };
    })
  );
  return rows;
}

export default async function Page() {
  const rows = await loadData();
  const totalBusinesses = rows.length;
  const activePlans = rows.filter((row) => row.subscription?.status === "active").length;
  const pendingSync = rows.reduce((sum, row) => sum + row.syncHealth.pendingEvents, 0);
  const trustRate = rows.reduce((sum, row) => sum + row.devices.filter((device) => device.trusted).length, 0);

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16 }}>
        <div>
          <div style={{ textTransform: "uppercase", letterSpacing: 2, color: "var(--text-muted)", fontSize: 12 }}>Vickins Support Console</div>
          <h1 style={{ margin: "8px 0 0", fontSize: 40, fontFamily: "var(--font-grotesk)" }}>Executive operations dashboard</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>Business coverage, subscription posture, sync health, and payment reconciliation.</p>
        </div>
        <div style={{ padding: "12px 16px", border: "1px solid var(--border)", borderRadius: 16, background: "rgba(17,24,39,0.7)" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Business types supported</div>
          <div style={{ color: "var(--text)", fontWeight: 700 }}>{BUSINESS_TYPES.length}</div>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          ["Businesses", totalBusinesses, "rgba(59,130,246,0.35)"],
          ["Active plans", activePlans, "rgba(16,185,129,0.35)"],
          ["Pending sync", pendingSync, "rgba(245,158,11,0.35)"],
          ["Trusted devices", trustRate, "rgba(239,68,68,0.32)"]
        ].map(([label, value, accent]) => (
          <DashboardCard key={label as string} title={label as string} accent={accent as string}>
            <div style={{ fontSize: 34, fontFamily: "var(--font-grotesk)", fontWeight: 700 }}>{value as number}</div>
          </DashboardCard>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <DashboardCard title="Businesses">
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map(({ business, devices, subscription, syncHealth }) => (
              <div
                key={business._id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.9fr 0.8fr",
                  gap: 12,
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)"
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{business.name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{business.slug} • {business.businessType}</div>
                </div>
                <div>{subscription?.planCode ?? business.planTier}</div>
                <div>{devices.length} devices</div>
                <div>{syncHealth.pendingEvents} pending</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {syncHealth.checkpoints[0]?.lastPulledAt
                    ? new Date(syncHealth.checkpoints[0].lastPulledAt).toLocaleString()
                    : "No sync yet"}
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
        <div style={{ display: "grid", gap: 16 }}>
          <DashboardCard title="Subscription snapshot" accent="rgba(16,185,129,0.4)">
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map(({ business, subscription }) => (
                <div key={business._id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{business.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>{subscription?.status ?? "trial"}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
          <DashboardCard title="Payment reconciliation" accent="rgba(37,99,235,0.4)">
            <div style={{ display: "grid", gap: 10, maxHeight: 360, overflow: "auto" }}>
              {rows.flatMap((row) => row.logs.slice(0, 3).map((log) => ({ ...log, businessName: row.business.name }))).map((log) => (
                <div key={log._id} style={{ padding: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background: "rgba(255,255,255,0.02)" }}>
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
