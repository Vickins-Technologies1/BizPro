import React from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getEffectivePermissions, hasPermission } from "@shared";
import type { DailySummary } from "@shared";
import { AppScrollView, Badge, Card, DateRangePickerModal, EmptyState, GradientHeader, PrimaryButton, Screen, SkeletonBlock, StatCard } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { getPaymentBreakdown, getReportsSummary, getTopProducts } from "@/services/apiClient";

type ReportRow = { productId: string; productName: string; quantity: number; total: number };
type PaymentRow = { _id: string; total: number; count: number };
type Filter = "today" | "week" | "month" | "year" | "custom";
type RangeState = { from: string; to: string };

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const user = useAppStore((state) => state.user);
  const syncNow = useAppStore((state) => state.syncNow);
  const permissions = getEffectivePermissions(user);
  const canViewDashboard = hasPermission(user, "viewDashboard");

  const [activeFilter, setActiveFilter] = React.useState<Filter>("week");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = React.useState<ReportRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const currentRange = React.useMemo(() => {
    if (activeFilter === "custom") return customRange;
    return presetRange(activeFilter);
  }, [activeFilter, customRange]);

  React.useEffect(() => {
    if (!currentRange) return;
    void loadDashboard(currentRange.from, currentRange.to);
  }, [currentRange?.from, currentRange?.to]);

  async function loadDashboard(from: string, to: string, mode: "replace" | "refresh" = "replace") {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const [summaryResponse, topProductsResponse, paymentResponse] = await Promise.all([
        getReportsSummary(from, to),
        getTopProducts(from, to),
        getPaymentBreakdown(from, to)
      ]);
      if (requestId !== requestIdRef.current) return;
      setSummary(summaryResponse);
      setTopProducts(topProductsResponse);
      setPaymentBreakdown(paymentResponse);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    if (!currentRange || loading || refreshing) return;
    await loadDashboard(currentRange.from, currentRange.to, "refresh");
  }

  function handleSync() {
    setSyncing(true);
    syncNow()
      .catch(() => undefined)
      .finally(() => setSyncing(false));
  }

  function applyCustomRange(range: { startDate: string; endDate: string }) {
    setCustomRange({ from: range.startDate, to: range.endDate });
    setActiveFilter("custom");
  }

  const rangeLabel = currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading";
  const totalBars = Math.max(1, summary?.salesTotal ?? 0, summary?.expensesTotal ?? 0, summary?.estimatedProfit ?? 0, summary?.debtTotal ?? 0);
  const hasContent = Boolean(summary) && (summary!.salesTotal > 0 || summary!.expensesTotal > 0 || summary!.debtTotal > 0 || topProducts.length > 0 || paymentBreakdown.length > 0);

  if (!canViewDashboard) {
    return (
      <Screen>
        <GradientHeader title={business?.name ?? "Business"} subtitle={`${business?.businessType?.replaceAll("_", " ")} • limited access`} />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Dashboard access restricted"
            subtitle="This account does not have permission to view the dashboard metrics. Ask an owner or manager to grant view access."
            action={<PrimaryButton title="Open settings" onPress={() => navigation.navigate("Settings")} />}
            icon="speedometer-outline"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title={business?.name ?? "Dashboard"}
        subtitle={`${rangeLabel} • ${pendingSync} pending sync`}
        right={
          <Pressable onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={24} color={tokens.colors.text} />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={handleRefresh}>
        <Card style={{ gap: 12, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Operations snapshot</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "900" }}>A cleaner view of sales, profit, and stock pressure.</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                Pick a time frame and the charts will update immediately. Pull down to refresh the latest numbers.
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 10 }}>
              <Badge label={pendingSync ? `${pendingSync} pending sync` : "Fully synced"} tone={pendingSync ? "warning" : "success"} />
              <PrimaryButton title={syncing ? "Syncing..." : "Sync now"} onPress={handleSync} loading={syncing} />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["year", "This Year"]
            ] as Array<[Exclude<Filter, "custom">, string]>).map(([filter, label]) => (
              <Pressable key={filter} onPress={() => setActiveFilter(filter)} disabled={loading && !summary}>
                <Badge label={label} tone={activeFilter === filter ? "success" : "primary"} />
              </Pressable>
            ))}
            <Pressable onPress={() => setPickerVisible(true)}>
              <Badge label="Custom Range" tone={activeFilter === "custom" ? "success" : "warning"} />
            </Pressable>
          </View>
        </Card>

        {loading && !summary ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <SkeletonBlock height={132} style={{ flex: 1 }} />
              <SkeletonBlock height={132} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <SkeletonBlock height={132} style={{ flex: 1 }} />
              <SkeletonBlock height={132} style={{ flex: 1 }} />
            </View>
            <SkeletonBlock height={220} />
            <SkeletonBlock height={180} />
          </View>
        ) : error && !summary ? (
          <Card style={{ gap: 12, alignItems: "center" }}>
            <Ionicons name="alert-circle-outline" size={30} color={tokens.colors.danger} />
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Dashboard unavailable</Text>
            <Text style={{ color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 20 }}>{error}</Text>
            <PrimaryButton title="Try again" onPress={() => currentRange && void loadDashboard(currentRange.from, currentRange.to)} />
          </Card>
        ) : !hasContent ? (
          <EmptyState
            title="Nothing to show yet"
            subtitle="This period does not have enough sales or payment activity. Try a wider range or record a few sales first."
            icon="speedometer-outline"
          />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard label="Sales" value={formatMoney(summary?.salesTotal ?? 0, business?.currency)} icon="cash-outline" tone="primary" />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard label="Profit" value={formatMoney(summary?.estimatedProfit ?? 0, business?.currency)} icon="analytics-outline" tone="success" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard label="Expenses" value={formatMoney(summary?.expensesTotal ?? 0, business?.currency)} icon="trending-down-outline" tone="warning" />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard label="Debts" value={formatMoney(summary?.debtTotal ?? 0, business?.currency)} icon="person-remove-outline" tone="danger" />
              </View>
            </View>
            <StatCard label="Low stock items" value={`${summary?.lowStockCount ?? 0}`} icon="warning-outline" tone="warning" />

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Financial mix</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>A quick view of the selected period.</Text>
              <ChartBar label="Sales" value={summary?.salesTotal ?? 0} max={totalBars} tone="primary" currency={business?.currency ?? "KES"} />
              <ChartBar label="Expenses" value={summary?.expensesTotal ?? 0} max={totalBars} tone="warning" currency={business?.currency ?? "KES"} />
              <ChartBar label="Profit" value={summary?.estimatedProfit ?? 0} max={totalBars} tone="success" currency={business?.currency ?? "KES"} />
              <ChartBar label="Debt" value={summary?.debtTotal ?? 0} max={totalBars} tone="danger" currency={business?.currency ?? "KES"} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Payment mix</Text>
              {paymentBreakdown.length ? (
                paymentBreakdown.map((row) => <PaymentBar key={row._id} row={row} max={maxPayment(paymentBreakdown)} currency={business?.currency ?? "KES"} />)
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No payments were recorded in this period.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Top products</Text>
              {topProducts.length ? (
                topProducts.map((row) => <ProductBar key={row.productId} row={row} max={maxQuantity(topProducts)} />)
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No product movement yet. Top products will appear after sales come in.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Quick actions</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "New sale", permission: "createSales" as const, handler: () => navigation.navigate("POS") },
                  { label: "Catalog", permission: "manageInventory" as const, handler: () => navigation.navigate("Catalog") },
                  { label: "Customers", permission: "manageCustomers" as const, handler: () => navigation.navigate("Customers") },
                  { label: "Expenses", permission: "manageExpenses" as const, handler: () => navigation.navigate("Expenses") },
                  { label: "Insights", permission: "viewReports" as const, handler: () => navigation.navigate("Reports") },
                  { label: "Settings", permission: "manageSettings" as const, handler: () => navigation.navigate("Settings") }
                ]
                  .filter((item) => hasPermission(user, item.permission))
                  .map((item) => (
                    <View key={item.label} style={{ width: "48%" }}>
                      <PrimaryButton title={item.label} variant="secondary" onPress={item.handler} />
                    </View>
                  ))}
              </View>
              <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
                {permissions.length} permissions active on this account.
              </Text>
            </Card>
          </>
        )}
      </AppScrollView>

      <DateRangePickerModal
        visible={pickerVisible}
        title="Custom dashboard range"
        startDate={customRange?.from ?? currentRange?.from ?? null}
        endDate={customRange?.to ?? currentRange?.to ?? null}
        onClose={() => setPickerVisible(false)}
        onApply={(range) => applyCustomRange(range)}
      />
    </Screen>
  );
}

function presetRange(filter: Exclude<Filter, "custom">): RangeState {
  const today = new Date();
  if (filter === "today") {
    return { from: format(startOfDay(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  if (filter === "month") {
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  }
  if (filter === "year") {
    return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  const start = addDays(today, -6);
  return { from: format(startOfDay(start), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
}

function formatRangeLabel(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`;
}

function maxPayment(rows: PaymentRow[]) {
  return Math.max(1, ...rows.map((row) => row.total));
}

function maxQuantity(rows: ReportRow[]) {
  return Math.max(1, ...rows.map((row) => row.quantity));
}

function ChartBar({ label, value, max, tone, currency }: { label: string; value: number; max: number; tone: "primary" | "success" | "warning" | "danger"; currency: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: tokens.colors.textSecondary, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatMoney(value, currency)}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: toneColor(tone) }} />
      </View>
    </View>
  );
}

function PaymentBar({ row, max, currency }: { row: PaymentRow; max: number; currency: string }) {
  const pct = Math.max(0, Math.min(100, (row.total / max) * 100));
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: tokens.colors.textSecondary, fontWeight: "700" }}>{formatPaymentLabel(row._id)}</Text>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatMoney(row.total, currency)}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: tokens.colors.primary }} />
      </View>
    </View>
  );
}

function ProductBar({ row, max }: { row: ReportRow; max: number }) {
  const pct = Math.max(0, Math.min(100, (row.quantity / max) * 100));
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: tokens.colors.textSecondary, fontWeight: "700", flex: 1 }}>{row.productName}</Text>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{row.quantity}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: tokens.colors.success }} />
      </View>
    </View>
  );
}

function formatPaymentLabel(value: string) {
  if (value === "mpesa") return "M-Pesa";
  if (value === "cash") return "Cash";
  if (value === "bank") return "Bank";
  if (value === "credit") return "Credit";
  return value.replaceAll("_", " ");
}

function toneColor(tone: "primary" | "success" | "warning" | "danger") {
  if (tone === "success") return tokens.colors.success;
  if (tone === "warning") return tokens.colors.warning;
  if (tone === "danger") return tokens.colors.danger;
  return tokens.colors.primary;
}
