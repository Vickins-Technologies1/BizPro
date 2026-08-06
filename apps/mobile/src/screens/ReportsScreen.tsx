import React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, StatCard, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { hasPermission } from "@shared";
import { getPaymentBreakdown, getReportsSummary, getTopProducts } from "@/services/apiClient";
import type { DailySummary } from "@shared";

type ReportRow = { productId: string; productName: string; quantity: number; total: number };
type PaymentRow = { _id: string; total: number; count: number };
type RangePreset = "today" | "7d" | "30d" | "month";

const presetLabels: Record<RangePreset, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  month: "This month"
};

export function ReportsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const canViewReports = hasPermission(user, "viewReports");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = React.useState<ReportRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentRow[]>([]);
  const [activePreset, setActivePreset] = React.useState<RangePreset>("7d");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  React.useEffect(() => {
    void applyPreset("7d");
  }, []);

  async function loadInsights(from?: string, to?: string) {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, topProductsResponse, paymentResponse] = await Promise.all([
        getReportsSummary(from, to),
        getTopProducts(from, to),
        getPaymentBreakdown(from, to)
      ]);
      setSummary(summaryResponse);
      setTopProducts(topProductsResponse);
      setPaymentBreakdown(paymentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  }

  async function applyPreset(preset: RangePreset) {
    if (loading) return;
    const { from, to } = presetRange(preset);
    setActivePreset(preset);
    setFromDate(from);
    setToDate(to);
    await loadInsights(fromToIso(from, true) ?? undefined, fromToIso(to, false) ?? undefined);
  }

  async function applyCustomRange() {
    if (loading) return;
    if (!fromDate.trim() || !toDate.trim()) {
      Alert.alert("Choose a range", "Enter both a start date and an end date.");
      return;
    }

    const from = fromToIso(fromDate.trim(), true);
    const to = fromToIso(toDate.trim(), false);
    if (!from || !to) {
      Alert.alert("Check the dates", "Use the format YYYY-MM-DD for both dates.");
      return;
    }

    setActivePreset("7d");
    await loadInsights(from, to);
  }

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

  const rangeLabel = formatRangeLabel(fromDate, toDate);

  return (
    <Screen>
      <GradientHeader
        title="Insights"
        subtitle="Review sales, profit, stock pressure, and best sellers"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Date filters</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Choose a preset or set a custom date range to focus the numbers.
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["today", "7d", "30d", "month"] as RangePreset[]).map((preset) => (
              <Pressable key={preset} disabled={loading} onPress={() => applyPreset(preset)} style={({ pressed }) => [{ opacity: loading ? 0.5 : pressed ? 0.85 : 1 }]}>
                <Badge label={presetLabels[preset]} tone={activePreset === preset ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="From" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" helperText="Start date for the report." />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="To" value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" helperText="End date for the report." />
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <PrimaryButton title="Apply filters" onPress={applyCustomRange} loading={loading} />
            <PrimaryButton
              title="Use 7 days"
              variant="secondary"
              loading={loading}
              onPress={() => {
                void applyPreset("7d");
              }}
            />
          </View>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>Showing {rangeLabel}.</Text>
          {error ? <Text style={{ color: tokens.colors.danger, lineHeight: 18 }}>{error}</Text> : null}
        </Card>

        {loading ? (
          <Card style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
            <ActivityIndicator size="large" color={tokens.colors.primaryStrong} />
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Loading insights</Text>
            <Text style={{ color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
              Fetching the latest figures for this date range.
            </Text>
          </Card>
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

            <Card style={{ gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Payment mix</Text>
              {paymentBreakdown.length ? (
                paymentBreakdown.map((row) => (
                  <View key={row._id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                    <Text style={{ color: tokens.colors.textSecondary, flex: 1 }}>{formatPaymentLabel(row._id)}</Text>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatMoney(row.total, business?.currency)}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No payments were recorded in this range.</Text>
              )}
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Top products</Text>
              {topProducts.length ? (
                topProducts.map((item) => (
                  <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                    <Text style={{ color: tokens.colors.textSecondary, flex: 1 }}>{item.productName}</Text>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{item.quantity}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No sales yet in this period. Try a different date range or make a few sales first.</Text>
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
      </ScrollView>
    </Screen>
  );
}

function presetRange(preset: RangePreset) {
  const today = new Date();
  if (preset === "today") {
    return { from: format(startOfDay(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  if (preset === "month") {
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  }
  if (preset === "30d") {
    const start = addDays(today, -29);
    return { from: format(startOfDay(start), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  const start = addDays(today, -6);
  return { from: format(startOfDay(start), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
}

function fromToIso(value: string, start: boolean) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return (start ? startOfDay(parsed) : endOfDay(parsed)).toISOString();
}

function formatRangeLabel(fromDate: string, toDate: string) {
  if (!fromDate || !toDate) return "the selected period";
  return `${fromDate} to ${toDate}`;
}

function formatPaymentLabel(value: string) {
  if (value === "mpesa") return "M-Pesa";
  if (value === "cash") return "Cash";
  if (value === "bank") return "Bank";
  if (value === "credit") return "Credit";
  return value.replaceAll("_", " ");
}
