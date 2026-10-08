import React from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { hasPermission, resolveBusinessTypeConfig } from "@shared";
import type { DailySummary } from "@shared";
import {
  AppScrollView,
  BottomSheet,
  Card,
  DateRangePickerModal,
  EmptyState,
  ErrorState,
  GradientHeader,
  PrimaryButton,
  Screen,
  SkeletonBlock
} from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { getPaymentBreakdown, getReportsSummary, getTopProducts, listBusinessOperationsOfflineFirst } from "@/services/apiClient";

type ReportRow = { productId: string; productName: string; quantity: number; total: number };
type PaymentRow = { _id: string; total: number; count: number };
type Filter = "today" | "week" | "month" | "year" | "custom";

type RangeState = { from: string; to: string };

export function ReportsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const liveDataVersion = useAppStore((state) => `${state.sales.length}:${state.expenses.length}`);
  const canViewReports = hasPermission(user, "viewReports");
  const businessConfig = resolveBusinessTypeConfig({ businessType: business?.businessType, industryKey: business?.industryKey });

  const [activeFilter, setActiveFilter] = React.useState<Filter>("week");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = React.useState<ReportRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentRow[]>([]);
  const [operations, setOperations] = React.useState<Array<{ status: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [rangeSheetVisible, setRangeSheetVisible] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const initializedRef = React.useRef(false);

  const currentRange = React.useMemo(() => {
    if (activeFilter === "custom") return customRange;
    return presetRange(activeFilter);
  }, [activeFilter, customRange]);

  React.useEffect(() => {
    if (!currentRange) return;
    const range = toApiRange(currentRange);
    void loadReports(range.from, range.to);
  }, [currentRange?.from, currentRange?.to, selectedBranchId]);

  React.useEffect(() => {
    if (!initializedRef.current || !currentRange) return;
    const range = toApiRange(currentRange);
    void loadReports(range.from, range.to, "refresh");
  }, [liveDataVersion, currentRange?.from, currentRange?.to, selectedBranchId]);

  async function loadReports(from: string, to: string, mode: "replace" | "refresh" = "replace") {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const operationKind = businessConfig.capabilities.projects
        ? "project"
        : businessConfig.capabilities.workOrders
          ? "work_order"
          : businessConfig.capabilities.appointments || businessConfig.capabilities.reservations
            ? "appointment"
            : businessConfig.capabilities.orders
              ? "order"
              : undefined;
      const [summaryResponse, topProductsResponse, paymentResponse, operationsResponse] = await Promise.all([
        getReportsSummary(from, to, selectedBranchId),
        getTopProducts(from, to, selectedBranchId),
        getPaymentBreakdown(from, to, selectedBranchId),
        operationKind ? listBusinessOperationsOfflineFirst({ businessId: business?.id ?? "", kind: operationKind, branchId: selectedBranchId }) : Promise.resolve([])
      ]);
      if (requestId !== requestIdRef.current) return;
      setSummary(summaryResponse);
      setTopProducts(topProductsResponse);
      setPaymentBreakdown(paymentResponse);
      setOperations(operationsResponse);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load insights");
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
    await loadReports(range.from, range.to, "refresh");
  }

  function openCustomRange() {
    setPickerVisible(true);
  }

  function applyCustomRange(range: { startDate: string; endDate: string }) {
    setCustomRange({ from: range.startDate, to: range.endDate });
    setActiveFilter("custom");
  }

  const rangeLabel = currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading";
  const hasContent = Boolean(summary) && (summary!.salesTotal > 0 || summary!.expensesTotal > 0 || summary!.debtTotal > 0 || topProducts.length > 0 || paymentBreakdown.length > 0 || operations.length > 0);

  if (!canViewReports) {
    return (
      <Screen>
        <GradientHeader title="Reports" subtitle="Daily performance, top movers, and margins" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Reports access restricted"
            subtitle="This account cannot view business reports. Ask an owner or manager to grant reporting access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
            icon="bar-chart-outline"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title={`${businessConfig.label} reports`}
        subtitle={`${rangeLabel} • ${businessConfig.reports.slice(0, 2).join(" and ")}`}
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={handleRefresh}>
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setRangeSheetVisible(true)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" }}>Reporting period</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "700" }}>{rangeLabel}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={tokens.colors.textSecondary} />
          </Pressable>
          {error ? <Text style={{ color: tokens.colors.danger, lineHeight: 18 }}>{error}</Text> : null}
        </View>

        {loading && !summary ? (
          <View style={{ gap: 16 }}>
            <Card style={{ gap: 12 }}>
              <SkeletonBlock height={18} width="52%" />
              <SkeletonBlock height={14} width="78%" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <SkeletonBlock height={104} style={{ flex: 1 }} />
                <SkeletonBlock height={104} style={{ flex: 1 }} />
              </View>
            </Card>
            <Card style={{ gap: 12 }}>
              <SkeletonBlock height={18} width="40%" />
              {[1, 2, 3].map((item) => (
                <View key={item} style={{ gap: 8 }}>
                  <SkeletonBlock height={12} width={`${65 + item * 8}%`} />
                  <SkeletonBlock height={10} width={`${80 - item * 12}%`} />
                </View>
              ))}
            </Card>
          </View>
        ) : error && !summary ? (
          <ErrorState
            title="Reports unavailable"
            subtitle={error}
            action={
              <PrimaryButton
                title="Try again"
                onPress={() => {
                  if (!currentRange) return;
                  const range = toApiRange(currentRange);
                  void loadReports(range.from, range.to);
                }}
              />
            }
          />
        ) : !hasContent ? (
          <EmptyState
            title="Nothing to show yet"
            subtitle="This period does not have enough sales or payment activity. Try a wider range or record a few sales first."
            icon="bar-chart-outline"
          />
        ) : (
          <>
            <View style={{ gap: 14, paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <ReportMetric label="Revenue" value={formatMoney(summary?.salesTotal ?? 0, business?.currency)} />
                <ReportMetric label="Profit" value={formatMoney(summary?.estimatedProfit ?? 0, business?.currency)} tone="success" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <ReportMetric label="COGS" value={formatMoney(summary?.cogsTotal ?? 0, business?.currency)} />
                <ReportMetric label="Margin" value={`${summary?.salesTotal ? Math.round(((summary.estimatedProfit ?? 0) / summary.salesTotal) * 100) : 0}%`} tone="success" />
              </View>
              <View style={{ height: 1, backgroundColor: tokens.colors.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <ReportMetric label="Expenses" value={formatMoney(summary?.expensesTotal ?? 0, business?.currency)} tone="warning" />
                <ReportMetric label="Debt" value={formatMoney(summary?.debtTotal ?? 0, business?.currency)} tone="danger" />
              </View>
            </View>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Financial mix</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Sales, expenses, and profit for the selected period.</Text>
              <BarMeter label="Sales" value={summary?.salesTotal ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="primary" currency={business?.currency ?? "KES"} />
              <BarMeter label="Expenses" value={summary?.expensesTotal ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="warning" currency={business?.currency ?? "KES"} />
              <BarMeter label="Profit" value={summary?.estimatedProfit ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="success" currency={business?.currency ?? "KES"} />
              <BarMeter label="Debt" value={summary?.debtTotal ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="danger" currency={business?.currency ?? "KES"} />
            </Card>

            <IndustryReportFocus config={businessConfig} summary={summary} topProducts={topProducts} operations={operations} currency={business?.currency ?? "KES"} />

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Payment mix</Text>
              {paymentBreakdown.length ? (
                paymentBreakdown.map((row) => <PaymentBar key={row._id} row={row} currency={business?.currency ?? "KES"} max={maxPayment(paymentBreakdown)} />)
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No payments were recorded in this period.</Text>
              )}
            </Card>

            {businessConfig.capabilities.products ? <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{businessConfig.terminology.catalogItem} performance</Text>
              {topProducts.length ? (
                topProducts.map((row) => <ProductBar key={row.productId} row={row} max={maxQuantity(topProducts)} />)
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No {businessConfig.terminology.catalogItem.toLowerCase()} movement yet. Performance will appear after transactions come in.</Text>
              )}
            </Card> : (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{businessConfig.workspace.activityLabel} performance</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>Use the {businessConfig.workspace.activityLabel.toLowerCase()} workflow to track {businessConfig.workflow.steps.join(", ").toLowerCase()}.</Text>
                <PrimaryButton title={`Open ${businessConfig.workspace.activityLabel.toLowerCase()}`} variant="secondary" onPress={() => navigation.navigate("Operations")} />
              </Card>
            )}

            {businessConfig.capabilities.inventory ? <Card style={{ gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Stock pressure</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>
                {summary?.lowStockCount ?? 0} items are close to running out. Review them before the next busy period.
              </Text>
            </Card> : null}
          </>
        )}
      </AppScrollView>

      <BottomSheet visible={rangeSheetVisible} title="Reporting period" subtitle="Choose the window used for every calculation on this report." onClose={() => setRangeSheetVisible(false)}>
        <View style={{ gap: 8 }}>
          {([
            ["today", "Today"],
            ["week", "This week"],
            ["month", "This month"],
            ["year", "This year"]
          ] as Array<[Exclude<Filter, "custom">, string]>).map(([filter, label]) => (
            <Pressable key={filter} onPress={() => { setActiveFilter(filter); setRangeSheetVisible(false); }} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: tokens.colors.border }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "600" }}>{label}</Text>
              {activeFilter === filter ? <Ionicons name="checkmark" size={18} color={tokens.colors.primaryStrong} /> : null}
            </Pressable>
          ))}
          <Pressable onPress={() => { setRangeSheetVisible(false); openCustomRange(); }} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "600" }}>Custom range</Text>
            {activeFilter === "custom" ? <Ionicons name="checkmark" size={18} color={tokens.colors.primaryStrong} /> : null}
          </Pressable>
        </View>
      </BottomSheet>

      <DateRangePickerModal
        visible={pickerVisible}
        title="Custom date range"
        startDate={customRange?.from ?? currentRange?.from ?? null}
        endDate={customRange?.to ?? currentRange?.to ?? null}
        onClose={() => setPickerVisible(false)}
        onApply={(range) => applyCustomRange(range)}
      />
    </Screen>
  );
}

function IndustryReportFocus({ config, summary, topProducts, operations, currency }: { config: ReturnType<typeof resolveBusinessTypeConfig>; summary: DailySummary | null; topProducts: ReportRow[]; operations: Array<{ status: string }>; currency: string }) {
  const activityCount = summary?.transactionsCount ?? operations.length;
  const completedCount = operations.filter((operation) => ["completed", "served", "picked_up", "checked_out", "closed"].includes(operation.status)).length;
  const rows = config.capabilities.kitchen
    ? [
        ["Sales by menu item", topProducts.length ? topProducts[0]!.productName : "No menu activity yet"],
        ["Ingredient consumption", `${summary?.cogsTotal ? formatMoney(summary.cogsTotal, currency) : "—"} estimated cost`],
        ["Food cost", summary?.salesTotal ? `${Math.round(((summary.cogsTotal ?? 0) / summary.salesTotal) * 100)}%` : "—"],
        ["Daily orders", String(activityCount)]
      ]
    : config.operatingModel === "appointment"
      ? [
          ["Revenue by service", topProducts.length ? topProducts[0]!.productName : "No service activity yet"],
          ["Appointments", String(activityCount)],
          ["Customer visits", String(activityCount)],
          ["Product sales", topProducts.length ? `${topProducts.length} catalog items` : "—"]
        ]
      : config.operatingModel === "hospitality"
        ? [
            ["Occupancy", "Track from room status"],
              ["Reservations", String(activityCount)],
            ["Guest balances", formatMoney(summary?.debtTotal ?? 0, currency)],
            ["Service revenue", formatMoney(summary?.salesTotal ?? 0, currency)]
          ]
        : config.operatingModel === "care"
          ? [
              ["Patient visits", String(activityCount)],
              ["Service revenue", formatMoney(summary?.salesTotal ?? 0, currency)],
              ["Outstanding billing", formatMoney(summary?.debtTotal ?? 0, currency)],
              ["Top service/medicine", topProducts.length ? topProducts[0]!.productName : "—"]
            ]
          : config.operatingModel === "work_order"
            ? [
                ["Jobs completed", String(completedCount || activityCount)],
                ["Revenue by service", formatMoney(summary?.salesTotal ?? 0, currency)],
                ["Parts usage", topProducts.length ? topProducts[0]!.productName : "—"],
                ["Technician performance", "Use staff performance" ]
              ]
            : config.operatingModel === "project"
              ? [
                  ["Revenue by client", formatMoney(summary?.salesTotal ?? 0, currency)],
                  ["Revenue by matter/project", formatMoney(summary?.salesTotal ?? 0, currency)],
                  ["Billable work", String(activityCount)],
                  ["Outstanding invoices", formatMoney(summary?.debtTotal ?? 0, currency)]
                ]
              : [
                  ["Jobs completed", String(completedCount || activityCount)],
                  ["Service revenue", formatMoney(summary?.salesTotal ?? 0, currency)],
                  ["Outstanding invoices", formatMoney(summary?.debtTotal ?? 0, currency)],
                  ["Top service", topProducts.length ? topProducts[0]!.productName : "—"]
                ];
  const title = config.capabilities.kitchen ? "Food & Beverage reports" : config.operatingModel === "appointment" ? "Beauty reports" : config.operatingModel === "hospitality" ? "Hospitality reports" : config.operatingModel === "care" ? (config.businessType === "pharmacy" ? "Pharmacy reports" : "Clinic reports") : config.operatingModel === "work_order" ? "Workshop reports" : config.operatingModel === "project" ? "Professional services reports" : "Service reports";
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: tokens.colors.textSecondary }}>Operational reporting for the selected business model.</Text>
      {rows.map(([label, value]) => <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 }}><Text style={{ color: tokens.colors.textSecondary, flex: 1 }}>{label}</Text><Text style={{ color: tokens.colors.text, fontWeight: "800", textAlign: "right" }}>{value}</Text></View>)}
    </Card>
  );
}

function ReportMetric({ label, value, tone = "primary" }: { label: string; value: string; tone?: "primary" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? tokens.colors.success : tone === "warning" ? tokens.colors.warning : tone === "danger" ? tokens.colors.danger : tokens.colors.text;
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: tokens.colors.textMuted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>{value}</Text>
    </View>
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

function formatPaymentLabel(value: string) {
  if (value === "mpesa") return "M-Pesa";
  if (value === "cash") return "Cash";
  if (value === "bank") return "Bank";
  if (value === "credit") return "Credit";
  return value.replaceAll("_", " ");
}

function maxPayment(rows: PaymentRow[]) {
  return Math.max(1, ...rows.map((row) => row.total));
}

function maxQuantity(rows: ReportRow[]) {
  return Math.max(1, ...rows.map((row) => row.quantity));
}

function BarMeter({ label, value, max, tone, currency }: { label: string; value: number; max: number; tone: "primary" | "success" | "warning" | "danger"; currency: string }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: tokens.colors.textSecondary, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatMoney(value, currency)}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${percentage}%`, height: "100%", borderRadius: 999, backgroundColor: toneColor(tone) }} />
      </View>
    </View>
  );
}

function PaymentBar({ row, currency, max }: { row: PaymentRow; currency: string; max: number }) {
  const percentage = Math.max(0, Math.min(100, (row.total / max) * 100));
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: tokens.colors.textSecondary, fontWeight: "700" }}>{formatPaymentLabel(row._id)}</Text>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatMoney(row.total, currency)}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${percentage}%`, height: "100%", borderRadius: 999, backgroundColor: tokens.colors.primary }} />
      </View>
    </View>
  );
}

function ProductBar({ row, max }: { row: ReportRow; max: number }) {
  const percentage = Math.max(0, Math.min(100, (row.quantity / max) * 100));
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: tokens.colors.textSecondary, fontWeight: "700", flex: 1 }}>{row.productName}</Text>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{row.quantity}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${percentage}%`, height: "100%", borderRadius: 999, backgroundColor: tokens.colors.success }} />
      </View>
    </View>
  );
}

function toneColor(tone: "primary" | "success" | "warning" | "danger") {
  if (tone === "success") return tokens.colors.success;
  if (tone === "warning") return tokens.colors.warning;
  if (tone === "danger") return tokens.colors.danger;
  return tokens.colors.primary;
}
