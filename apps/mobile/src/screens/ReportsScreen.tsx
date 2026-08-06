import React from "react";
import { Pressable, Text, View } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { hasPermission } from "@shared";
import type { DailySummary } from "@shared";
import {
  AppScrollView,
  Badge,
  Card,
  DateRangePickerModal,
  EmptyState,
  GradientHeader,
  PrimaryButton,
  Screen,
  SkeletonBlock,
  StatCard
} from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { getPaymentBreakdown, getReportsSummary, getTopProducts } from "@/services/apiClient";

type ReportRow = { productId: string; productName: string; quantity: number; total: number };
type PaymentRow = { _id: string; total: number; count: number };
type Filter = "today" | "week" | "month" | "year" | "custom";

type RangeState = { from: string; to: string };

export function ReportsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const canViewReports = hasPermission(user, "viewReports");

  const [activeFilter, setActiveFilter] = React.useState<Filter>("week");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = React.useState<ReportRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const requestIdRef = React.useRef(0);

  const currentRange = React.useMemo(() => {
    if (activeFilter === "custom") return customRange;
    return presetRange(activeFilter);
  }, [activeFilter, customRange]);

  React.useEffect(() => {
    if (!currentRange) return;
    void loadReports(currentRange.from, currentRange.to);
  }, [currentRange?.from, currentRange?.to]);

  async function loadReports(from: string, to: string, mode: "replace" | "refresh" = "replace") {
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
      setError(err instanceof Error ? err.message : "Unable to load insights");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    if (!currentRange || loading || refreshing) return;
    await loadReports(currentRange.from, currentRange.to, "refresh");
  }

  function openCustomRange() {
    setPickerVisible(true);
  }

  function applyCustomRange(range: { startDate: string; endDate: string }) {
    setCustomRange({ from: range.startDate, to: range.endDate });
    setActiveFilter("custom");
  }

  const rangeLabel = currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading";
  const hasContent = Boolean(summary) && (summary!.salesTotal > 0 || summary!.expensesTotal > 0 || summary!.debtTotal > 0 || topProducts.length > 0 || paymentBreakdown.length > 0);

  if (!canViewReports) {
    return (
      <Screen>
        <GradientHeader title="Insights" subtitle="Daily performance, top movers, and margins" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Insights access restricted"
            subtitle="This account cannot view business insights. Ask an owner or manager to grant reporting access."
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
        title="Insights"
        subtitle={`${rangeLabel} • trend and performance overview`}
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={handleRefresh}>
        <Card style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Date range</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Use a preset or pick a custom date range to update the numbers instantly.
            </Text>
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
            <Pressable onPress={openCustomRange}>
              <Badge label="Custom Range" tone={activeFilter === "custom" ? "success" : "warning"} />
            </Pressable>
          </View>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>Showing {rangeLabel}.</Text>
          {error ? <Text style={{ color: tokens.colors.danger, lineHeight: 18 }}>{error}</Text> : null}
        </Card>

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
          <Card style={{ gap: 12, alignItems: "center" }}>
            <Ionicons name="alert-circle-outline" size={30} color={tokens.colors.danger} />
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Insights unavailable</Text>
            <Text style={{ color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
              {error}
            </Text>
            <PrimaryButton title="Try again" onPress={() => currentRange && void loadReports(currentRange.from, currentRange.to)} />
          </Card>
        ) : !hasContent ? (
          <EmptyState
            title="Nothing to show yet"
            subtitle="This period does not have enough sales or payment activity. Try a wider range or record a few sales first."
            icon="bar-chart-outline"
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

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Financial mix</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Sales, expenses, and profit for the selected period.</Text>
              <BarMeter label="Sales" value={summary?.salesTotal ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="primary" currency={business?.currency ?? "KES"} />
              <BarMeter label="Expenses" value={summary?.expensesTotal ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="warning" currency={business?.currency ?? "KES"} />
              <BarMeter label="Profit" value={summary?.estimatedProfit ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="success" currency={business?.currency ?? "KES"} />
              <BarMeter label="Debt" value={summary?.debtTotal ?? 0} max={Math.max(summary?.salesTotal ?? 1, summary?.expensesTotal ?? 1, summary?.estimatedProfit ?? 1, summary?.debtTotal ?? 1)} tone="danger" currency={business?.currency ?? "KES"} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Payment mix</Text>
              {paymentBreakdown.length ? (
                paymentBreakdown.map((row) => <PaymentBar key={row._id} row={row} currency={business?.currency ?? "KES"} max={maxPayment(paymentBreakdown)} />)
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

            <Card style={{ gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Stock pressure</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>
                {summary?.lowStockCount ?? 0} items are close to running out. Review them before the next busy period.
              </Text>
            </Card>
          </>
        )}
      </AppScrollView>

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
