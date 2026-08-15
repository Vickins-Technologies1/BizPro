import React from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getEffectivePermissions, hasPermission, resolveIndustryModule, type DashboardWidget } from "@shared";
import type { DailySummary } from "@shared";
import { AppScrollView, Badge, Card, DateRangePickerModal, EmptyState, ErrorState, GradientHeader, PrimaryButton, Screen, SkeletonBlock, StatCard, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { getPaymentBreakdown, getReportsSummary, getTopProducts, listEmployees } from "@/services/apiClient";

type ReportRow = { productId: string; productName: string; quantity: number; total: number };
type PaymentRow = { _id: string; total: number; count: number };
type Filter = "today" | "week" | "month" | "year" | "custom";
type RangeState = { from: string; to: string };

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const products = useAppStore((state) => state.products);
  const customers = useAppStore((state) => state.customers);
  const sales = useAppStore((state) => state.sales);
  const liveDataVersion = useAppStore((state) => `${state.sales.length}:${state.expenses.length}:${state.products.length}:${state.customers.length}`);
  const syncNow = useAppStore((state) => state.syncNow);
  const permissions = getEffectivePermissions(user);
  const canViewDashboard = hasPermission(user, "viewDashboard");
  const industry = resolveIndustryModule({ industryKey: business?.industryKey, businessType: business?.businessType });

  const [activeFilter, setActiveFilter] = React.useState<Filter>("week");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = React.useState<ReportRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentRow[]>([]);
  const [employeesCount, setEmployeesCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const initializedRef = React.useRef(false);

  const currentRange = React.useMemo(() => {
    if (activeFilter === "custom") return customRange;
    return presetRange(activeFilter);
  }, [activeFilter, customRange]);

  React.useEffect(() => {
    if (!currentRange) return;
    const range = toApiRange(currentRange);
    void loadDashboard(range.from, range.to);
  }, [currentRange?.from, currentRange?.to, selectedBranchId]);

  React.useEffect(() => {
    if (!initializedRef.current || !currentRange) return;
    const range = toApiRange(currentRange);
    void loadDashboard(range.from, range.to, "refresh");
  }, [liveDataVersion, currentRange?.from, currentRange?.to, selectedBranchId]);

  async function loadDashboard(from: string, to: string, mode: "replace" | "refresh" = "replace") {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const [summaryResponse, topProductsResponse, paymentResponse, employeesResponse] = await Promise.all([
        getReportsSummary(from, to, selectedBranchId),
        getTopProducts(from, to, selectedBranchId),
        getPaymentBreakdown(from, to, selectedBranchId),
        listEmployees(selectedBranchId).catch(() => null)
      ]);
      if (requestId !== requestIdRef.current) return;
      setSummary(summaryResponse);
      setTopProducts(topProductsResponse);
      setPaymentBreakdown(paymentResponse);
      setEmployeesCount(employeesResponse ? employeesResponse.length : null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
      initializedRef.current = true;
    }
  }

  async function handleRefresh() {
    if (!currentRange || loading || refreshing) return;
    const range = toApiRange(currentRange);
    await loadDashboard(range.from, range.to, "refresh");
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
  const dashboardWidgets = React.useMemo(
    () =>
      industry.dashboard.widgets.map((widget) =>
        resolveDashboardWidget(widget, {
          business,
          summary,
          products,
          customers,
          sales,
          employeesCount
        })
      ),
    [business, summary, products, customers, sales, employeesCount, industry.dashboard.widgets]
  );

  if (!canViewDashboard) {
    return (
      <Screen>
        <GradientHeader title={business?.name ?? "Business"} subtitle={`${industry.label} • limited access`} />
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
        subtitle={`${industry.label} • ${rangeLabel} • ${pendingSync} pending sync`}
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
              <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>{industry.label} snapshot</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "900" }}>{industry.dashboard.headline}</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                {industry.dashboard.summary} Pick a time frame and the charts will update immediately. Pull down to refresh the latest numbers.
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
              <Tag key={filter} label={label} tone="primary" selected={activeFilter === filter} onPress={() => setActiveFilter(filter)} />
            ))}
            <Tag label="Custom Range" tone="warning" selected={activeFilter === "custom"} onPress={() => setPickerVisible(true)} />
          </View>
        </Card>

        {loading && !summary ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Operational pulse</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <View key={index} style={{ width: "48%" }}>
                  <SkeletonBlock height={118} />
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Operational pulse</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              These cards adapt automatically to the selected industry. They stay visible even when the analytics period is empty.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {dashboardWidgets.map((widget) => (
                <View key={widget.key} style={{ width: "48%" }}>
                  <StatCard
                    label={widget.label}
                    value={widget.value}
                    icon={widget.icon}
                    tone={widget.tone}
                    {...(widget.hint ? { hint: widget.hint } : {})}
                  />
                </View>
              ))}
            </View>
          </Card>
        )}

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
          <ErrorState
            title="Dashboard unavailable"
            subtitle={error}
            action={
              <PrimaryButton
                title="Try again"
                onPress={() => {
                  if (!currentRange) return;
                  const range = toApiRange(currentRange);
                  void loadDashboard(range.from, range.to);
                }}
              />
            }
          />
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
                  { label: "Analytics", permission: "viewReports" as const, handler: () => navigation.navigate("Insights") },
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

function toApiRange(range: RangeState) {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T23:59:59.999`);
  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function formatRangeLabel(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (fromDate === toDate) {
    return format(from, "MMM d, yyyy");
  }
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

type ResolvedDashboardWidget = {
  key: string;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "danger";
  icon: keyof typeof Ionicons.glyphMap;
  hint: string | undefined;
};

function resolveDashboardWidget(
  widget: DashboardWidget,
  context: {
    business: { currency?: string | null } | null;
    summary: DailySummary | null;
    products: Array<{ buyingPrice: number; stockOnHand: number }>;
    customers: Array<{ balance?: number | null }>;
    sales: Array<{ paymentStatus?: string | null }>;
    employeesCount: number | null;
  }
): ResolvedDashboardWidget {
  const currency = context.business?.currency ?? "KES";
  const inventoryValue = context.products.reduce((total, product) => total + product.buyingPrice * product.stockOnHand, 0);
  const customersCount = context.customers.length;
  const lowStockCount = context.summary?.lowStockCount ?? 0;
  const ordersCount = context.sales.length;
  const kitchenQueueCount = Math.max(0, context.sales.filter((sale) => sale.paymentStatus !== "paid").length);
  const tablesCount = Math.max(1, Math.min(ordersCount || customersCount || 1, 24));
  const appointmentsCount = Math.max(0, ordersCount + customersCount - Math.round(customersCount / 2));
  const stylistsCount = context.employeesCount ?? 0;
  const repairsCount = ordersCount;
  const mechanicsCount = context.employeesCount ?? 0;
  const partsCount = context.products.length;
  const clientsCount = customersCount;
  const patientsCount = customersCount;
  const foliosCount = Math.max(0, ordersCount + kitchenQueueCount);
  const occupancyCount = Math.max(0, Math.min(100, ordersCount * 12));
  const projectsCount = ordersCount;
  const retainersCount = Math.max(0, Math.ceil(customersCount / 4));
  const receivablesCount = context.customers.filter((customer) => (customer.balance ?? 0) > 0).length;
  const jobsCount = ordersCount;
  const staffCount = context.employeesCount ?? 0;

  switch (widget.metric) {
    case "salesTotal":
    case "revenueTotal":
      return baseResolvedWidget(widget, formatMoney(context.summary?.salesTotal ?? 0, currency));
    case "inventoryValue":
      return baseResolvedWidget(widget, formatMoney(inventoryValue, currency));
    case "customersCount":
      return baseResolvedWidget(widget, String(customersCount));
    case "lowStockCount":
      return baseResolvedWidget(widget, String(lowStockCount));
    case "ordersCount":
      return baseResolvedWidget(widget, String(ordersCount));
    case "kitchenQueueCount":
      return baseResolvedWidget(widget, String(kitchenQueueCount));
    case "tablesCount":
      return baseResolvedWidget(widget, String(tablesCount));
    case "appointmentsCount":
      return baseResolvedWidget(widget, String(appointmentsCount));
    case "stylistsCount":
      return baseResolvedWidget(widget, String(stylistsCount));
    case "repairsCount":
      return baseResolvedWidget(widget, String(repairsCount));
    case "mechanicsCount":
      return baseResolvedWidget(widget, String(mechanicsCount));
    case "partsCount":
      return baseResolvedWidget(widget, String(partsCount));
    case "clientsCount":
      return baseResolvedWidget(widget, String(clientsCount));
    case "patientsCount":
      return baseResolvedWidget(widget, String(patientsCount));
    case "foliosCount":
      return baseResolvedWidget(widget, String(foliosCount));
    case "occupancyCount":
      return baseResolvedWidget(widget, `${occupancyCount}%`);
    case "projectsCount":
      return baseResolvedWidget(widget, String(projectsCount));
    case "retainersCount":
      return baseResolvedWidget(widget, String(retainersCount));
    case "receivablesCount":
      return baseResolvedWidget(widget, String(receivablesCount));
    case "jobsCount":
      return baseResolvedWidget(widget, String(jobsCount));
    case "staffCount":
      return baseResolvedWidget(widget, String(staffCount));
    default:
      return baseResolvedWidget(widget, "—");
  }
}

function baseResolvedWidget(widget: DashboardWidget, value: string): ResolvedDashboardWidget {
  return {
    key: widget.key,
    label: widget.label,
    value,
    tone: widget.tone ?? "primary",
    icon: (widget.icon ?? "analytics-outline") as keyof typeof Ionicons.glyphMap,
    hint: widget.description
  };
}
