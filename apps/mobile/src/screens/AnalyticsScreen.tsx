import React from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import { hasPermission } from "@shared";
import type { EnterpriseAnalytics } from "@shared";
import { AppScrollView, Badge, Card, DateRangePickerModal, EmptyState, ErrorState, GradientHeader, PrimaryButton, Screen, SkeletonBlock, StatCard, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { getEnterpriseAnalytics } from "@/services/apiClient";

type Filter = "today" | "week" | "month" | "year" | "custom";
type RangeState = { from: string; to: string };

export function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const liveDataVersion = useAppStore((state) => `${state.sales.length}:${state.expenses.length}:${state.products.length}:${state.customers.length}`);
  const canViewAnalytics = hasPermission(user, "viewReports");

  const [activeFilter, setActiveFilter] = React.useState<Filter>("month");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [analytics, setAnalytics] = React.useState<EnterpriseAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const initializedRef = React.useRef(false);

  const currentRange = React.useMemo(() => {
    if (activeFilter === "custom") return customRange;
    return presetRange(activeFilter);
  }, [activeFilter, customRange]);

  React.useEffect(() => {
    if (!currentRange) return;
    const range = toApiRange(currentRange);
    void loadAnalytics(range.from, range.to);
  }, [currentRange?.from, currentRange?.to, selectedBranchId]);

  React.useEffect(() => {
    if (!initializedRef.current || !currentRange) return;
    const range = toApiRange(currentRange);
    void loadAnalytics(range.from, range.to, "refresh");
  }, [liveDataVersion, currentRange?.from, currentRange?.to, selectedBranchId]);

  async function loadAnalytics(from: string, to: string, mode: "replace" | "refresh" = "replace") {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const response = await getEnterpriseAnalytics(from, to, selectedBranchId);
      if (requestId !== requestIdRef.current) return;
      setAnalytics(response);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load analytics");
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
    await loadAnalytics(range.from, range.to, "refresh");
  }

  function openCustomRange() {
    setPickerVisible(true);
  }

  function applyCustomRange(range: { startDate: string; endDate: string }) {
    setCustomRange({ from: range.startDate, to: range.endDate });
    setActiveFilter("custom");
  }

  const rangeLabel = analytics?.range.label ?? (currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading");
  const summary = analytics?.summary;
  const hasContent = Boolean(analytics) && Boolean(
    (summary?.revenueTotal ?? 0) > 0 ||
      (summary?.salesCount ?? 0) > 0 ||
      (summary?.productCount ?? 0) > 0 ||
      (summary?.customerCount ?? 0) > 0 ||
      (analytics?.revenueTrend.length ?? 0) > 0
  );

  if (!canViewAnalytics) {
    return (
      <Screen>
        <GradientHeader title="Enterprise Analytics" subtitle="Revenue, performance, and forecasting" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Analytics access restricted"
            subtitle="This account cannot view enterprise analytics. Ask an owner or manager to grant reporting access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
            icon="analytics-outline"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Enterprise Analytics"
        subtitle={`${rangeLabel} • executive performance view`}
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
              Switch the window to refresh all charts, summaries, and forecast output together.
            </Text>
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
            <Tag label="Custom Range" tone="warning" selected={activeFilter === "custom"} onPress={openCustomRange} />
          </View>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>Showing {rangeLabel}.</Text>
          {error ? <Text style={{ color: tokens.colors.danger, lineHeight: 18 }}>{error}</Text> : null}
        </Card>

        {loading && !analytics ? (
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
              <SkeletonBlock height={18} width="48%" />
              <SkeletonBlock height={180} />
            </Card>
            <Card style={{ gap: 12 }}>
              <SkeletonBlock height={18} width="40%" />
              {[1, 2, 3, 4].map((item) => (
                <View key={item} style={{ gap: 8 }}>
                  <SkeletonBlock height={12} width={`${60 + item * 7}%`} />
                  <SkeletonBlock height={10} width={`${82 - item * 10}%`} />
                </View>
              ))}
            </Card>
          </View>
        ) : error && !analytics ? (
          <ErrorState
            title="Analytics unavailable"
            subtitle={error}
            action={
              <PrimaryButton
                title="Try again"
                onPress={() => {
                  if (!currentRange) return;
                  const range = toApiRange(currentRange);
                  void loadAnalytics(range.from, range.to);
                }}
              />
            }
          />
        ) : !hasContent ? (
          <EmptyState
            title="Nothing to show yet"
            subtitle="This period does not have enough sales or operations data. Try a wider range or record a few more transactions."
            icon="analytics-outline"
          />
        ) : (
          <>
            <SummaryGrid analytics={analytics} currency={business?.currency ?? "KES"} />
            <AnimatedSection index={0}>
              <TrendCard
                title="Revenue"
                subtitle="Monthly revenue trend"
                accent="primary"
                points={analytics?.revenueTrend.map((point) => ({ label: point.period, value: point.revenue, note: `${point.salesCount} sales` })) ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
              />
            </AnimatedSection>
            <AnimatedSection index={1}>
              <TrendCard
                title="Sales"
                subtitle="Orders processed over time"
                accent="success"
                points={analytics?.salesTrend.map((point) => ({ label: point.label, value: point.value, note: formatMoney(point.secondaryValue ?? 0, business?.currency) })) ?? []}
                valueFormatter={(value) => formatCount(value)}
              />
            </AnimatedSection>
            <AnimatedSection index={2}>
              <RankedChart
                title="Products"
                subtitle="Top product performers"
                accent="primary"
                rows={analytics?.productPerformance ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
                secondaryFormatter={(row) => `${formatCount(row.secondaryValue ?? 0)} units`}
              />
            </AnimatedSection>
            <AnimatedSection index={3}>
              <RankedChart
                title="Customers"
                subtitle="Top customer revenue and balance"
                accent="warning"
                rows={analytics?.customerPerformance ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
                secondaryFormatter={(row) => `${formatCount(row.secondaryValue ?? 0)} visits`}
                tertiaryFormatter={(row) => `${formatMoney(row.balance ?? 0, business?.currency)} balance`}
              />
            </AnimatedSection>
            <AnimatedSection index={4}>
              <RankedChart
                title="Peak Hours"
                subtitle="Busy times by sales count"
                accent="success"
                rows={analytics?.peakHours ?? []}
                valueFormatter={(value) => formatCount(value)}
                secondaryFormatter={(row) => `${formatMoney(row.secondaryValue ?? 0, business?.currency)} revenue`}
              />
            </AnimatedSection>
            <AnimatedSection index={5}>
              <RankedChart
                title="Staff Performance"
                subtitle="Revenue contribution by team member"
                accent="primary"
                rows={analytics?.staffPerformance ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
                secondaryFormatter={(row) => `${formatCount(row.secondaryValue ?? 0)} orders`}
                tertiaryFormatter={(row) => `${formatMoney(row.averageTicket ?? 0, business?.currency)} avg ticket`}
              />
            </AnimatedSection>
            <AnimatedSection index={6}>
              <RankedChart
                title="Inventory Turnover"
                subtitle="Fast-moving stock and sell-through"
                accent="danger"
                rows={analytics?.inventoryTurnover ?? []}
                valueFormatter={(value) => formatDecimal(value, 2)}
                secondaryFormatter={(row) => `${formatCount(row.secondaryValue ?? 0)} sold`}
                tertiaryFormatter={(row) => `${formatCount(row.stockOnHand ?? 0)} on hand`}
              />
            </AnimatedSection>
            <AnimatedSection index={7}>
              <TrendCard
                title="Profit Trends"
                subtitle="Profit after estimated costs and expenses"
                accent="warning"
                points={analytics?.profitTrends.map((point) => ({ label: point.period, value: point.profit, note: formatMoney(point.expenses, business?.currency) })) ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
              />
            </AnimatedSection>
            <AnimatedSection index={8}>
              <MonthlyGrowthCard growth={analytics?.monthlyGrowth ?? []} currency={business?.currency ?? "KES"} />
            </AnimatedSection>
            <AnimatedSection index={9}>
              <ForecastCard forecast={analytics?.forecast ?? []} currency={business?.currency ?? "KES"} />
            </AnimatedSection>
          </>
        )}
      </AppScrollView>

      <DateRangePickerModal
        visible={pickerVisible}
        title="Custom analytics range"
        startDate={customRange?.from ?? currentRange?.from ?? null}
        endDate={customRange?.to ?? currentRange?.to ?? null}
        onClose={() => setPickerVisible(false)}
        onApply={(range) => applyCustomRange(range)}
      />
    </Screen>
  );
}

function SummaryGrid({ analytics, currency }: { analytics: EnterpriseAnalytics | null; currency: string }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <StatCard label="Revenue" value={formatMoney(analytics?.summary.revenueTotal ?? 0, currency)} icon="cash-outline" tone="primary" />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Sales" value={formatCount(analytics?.summary.salesCount ?? 0)} icon="cart-outline" tone="success" />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <StatCard label="Products" value={formatCount(analytics?.summary.productCount ?? 0)} icon="cube-outline" tone="warning" />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Customers" value={formatCount(analytics?.summary.customerCount ?? 0)} icon="people-outline" tone="primary" />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <StatCard label="Profit" value={formatMoney(analytics?.summary.profitTotal ?? 0, currency)} icon="analytics-outline" tone="success" />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Forecast" value={formatMoney(analytics?.summary.forecastRevenue ?? 0, currency)} icon="trending-up-outline" tone="warning" />
        </View>
      </View>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Badge label={`Peak hour ${analytics?.summary.peakHour ?? "n/a"}`} tone="primary" />
          <Badge label={`${formatCount(analytics?.summary.peakHourSales ?? 0)} sales at peak`} tone="success" />
          <Badge label={`Growth ${formatPercent(analytics?.summary.monthlyGrowthPercent ?? 0)}`} tone="warning" />
          <Badge label={`Inventory turnover ${formatDecimal(analytics?.summary.inventoryTurnover ?? 0, 2)}`} tone="danger" />
        </View>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
          {analytics?.summary.averageOrderValue ? `Average order value is ${formatMoney(analytics.summary.averageOrderValue, currency)}.` : "Average order value will appear as sales come in."}
        </Text>
      </Card>
    </View>
  );
}

function TrendCard({
  title,
  subtitle,
  accent,
  points,
  valueFormatter
}: {
  title: string;
  subtitle: string;
  accent: "primary" | "success" | "warning" | "danger";
  points: Array<{ label: string; value: number; note?: string }>;
  valueFormatter: (value: number) => string;
}) {
  const values = React.useMemo(() => points.map((point) => Number(point.value ?? 0)), [points]);
  const max = React.useMemo(() => Math.max(1, ...values), [values]);
  const animatedValues = React.useRef<Animated.Value[]>([]);

  React.useEffect(() => {
    animatedValues.current = points.map((_, index) => animatedValues.current[index] ?? new Animated.Value(0));
    Animated.stagger(
      45,
      animatedValues.current.map((value) => Animated.timing(value, { toValue: 1, duration: 420, useNativeDriver: false }))
    ).start();
  }, [points.length]);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{subtitle}</Text>
      </View>
      {points.length ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, minHeight: 190 }}>
          {points.map((point, index) => {
            const barHeight = 120 * (Number(point.value ?? 0) / max);
            const animatedHeight = animatedValues.current[index]?.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(8, barHeight)] }) ?? barHeight;
            return (
              <View key={`${title}-${point.label}-${index}`} style={{ flex: 1, alignItems: "center", gap: 8 }}>
                <View style={{ height: 128, width: "100%", justifyContent: "flex-end" }}>
                  <Animated.View
                    style={{
                      height: animatedHeight,
                      borderRadius: 16,
                      backgroundColor: toneColor(accent, 1),
                      opacity: 0.92
                    }}
                  />
                </View>
                <View style={{ gap: 2, alignItems: "center" }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                    {point.label}
                  </Text>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }} numberOfLines={1}>
                    {valueFormatter(point.value)}
                  </Text>
                  {point.note ? <Text style={{ color: tokens.colors.textMuted, fontSize: 10 }} numberOfLines={1}>{point.note}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No data was recorded for this period.</Text>
      )}
    </Card>
  );
}

function RankedChart<T extends { label: string; value: number; secondaryValue?: number; tertiaryValue?: number }>({
  title,
  subtitle,
  accent,
  rows,
  valueFormatter,
  secondaryFormatter,
  tertiaryFormatter
}: {
  title: string;
  subtitle: string;
  accent: "primary" | "success" | "warning" | "danger";
  rows: T[];
  valueFormatter: (value: number) => string;
  secondaryFormatter?: (row: T) => string;
  tertiaryFormatter?: (row: T) => string;
}) {
  const max = React.useMemo(() => Math.max(1, ...rows.map((row) => Number(row.value ?? 0))), [rows]);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{subtitle}</Text>
      </View>
      {rows.length ? (
        <View style={{ gap: 12 }}>
          {rows.map((row, index) => (
            <RankedBarRow
              key={`${title}-${row.label}-${index}`}
              label={row.label}
              value={row.value}
              max={max}
              accent={accent}
              valueText={valueFormatter(row.value)}
              secondaryText={secondaryFormatter ? secondaryFormatter(row) : undefined}
              tertiaryText={tertiaryFormatter ? tertiaryFormatter(row) : undefined}
            />
          ))}
        </View>
      ) : (
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No data was recorded for this period.</Text>
      )}
    </Card>
  );
}

const RankedBarRow = React.memo(function RankedBarRow({
  label,
  value,
  max,
  accent,
  valueText,
  secondaryText,
  tertiaryText
}: {
  label: string;
  value: number;
  max: number;
  accent: "primary" | "success" | "warning" | "danger";
  valueText: string;
  secondaryText?: string | undefined;
  tertiaryText?: string | undefined;
}) {
  const percentage = Math.max(0.08, Math.min(1, Number(value ?? 0) / Math.max(1, max)));
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: tokens.colors.text, fontWeight: "800" }} numberOfLines={1}>
            {label}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {secondaryText ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>{secondaryText}</Text> : null}
            {tertiaryText ? <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{tertiaryText}</Text> : null}
          </View>
        </View>
        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{valueText}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${percentage * 100}%`, height: "100%", borderRadius: 999, backgroundColor: toneColor(accent, 1) }} />
      </View>
    </View>
  );
});

function MonthlyGrowthCard({ growth, currency }: { growth: Array<{ month: string; revenue: number; growthPercent: number }>; currency: string }) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Monthly Growth</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>Month-over-month revenue movement.</Text>
      </View>
      {growth.length ? (
        <View style={{ gap: 10 }}>
          {growth.map((point) => {
            const positive = point.growthPercent >= 0;
            return (
              <View key={point.month} style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceAlt, gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{point.month}</Text>
                  <Text style={{ color: positive ? tokens.colors.success : tokens.colors.danger, fontWeight: "800" }}>{formatPercent(point.growthPercent)}</Text>
                </View>
                <Text style={{ color: tokens.colors.textSecondary }}>{formatMoney(point.revenue, currency)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No monthly growth data yet.</Text>
      )}
    </Card>
  );
}

function ForecastCard({ forecast, currency }: { forecast: Array<{ month: string; revenue: number }>; currency: string }) {
  const max = React.useMemo(() => Math.max(1, ...forecast.map((point) => Number(point.revenue ?? 0))), [forecast]);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Forecasting</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>A simple trend projection based on the current period.</Text>
      </View>
      {forecast.length ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, minHeight: 160 }}>
          {forecast.map((point, index) => (
            <View key={`${point.month}-${index}`} style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <View style={{ height: 108, width: "100%", justifyContent: "flex-end" }}>
                <View style={{ height: Math.max(10, 96 * (Number(point.revenue ?? 0) / max)), borderRadius: 16, backgroundColor: tokens.colors.primaryStrong, opacity: 0.85 }} />
              </View>
              <View style={{ gap: 2, alignItems: "center" }}>
                <Text style={{ color: tokens.colors.text, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
                  {point.month}
                </Text>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }} numberOfLines={1}>
                  {formatMoney(point.revenue, currency)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>Forecast data will appear after the selected period has enough history.</Text>
      )}
    </Card>
  );
}

function AnimatedSection({ index, children }: { index: number; children: React.ReactNode }) {
  const animated = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animated, {
      toValue: 1,
      duration: 420,
      delay: index * 70,
      useNativeDriver: true
    }).start();
  }, [animated, index]);

  return (
    <Animated.View
      style={{
        opacity: animated,
        transform: [
          {
            translateY: animated.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0]
            })
          }
        ]
      }}
    >
      {children}
    </Animated.View>
  );
}

function presetRange(filter: Exclude<Filter, "custom">): RangeState {
  const today = new Date();
  if (filter === "today") {
    return { from: format(startOfDay(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  if (filter === "week") {
    return { from: format(startOfDay(addDays(today, -6)), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  if (filter === "month") {
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  }
  return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
}

function toApiRange(range: RangeState) {
  return {
    from: `${range.from}T00:00:00.000Z`,
    to: `${range.to}T23:59:59.999Z`
  };
}

function formatRangeLabel(from: string, to: string) {
  return `${format(new Date(from), "MMM d, yyyy")} - ${format(new Date(to), "MMM d, yyyy")}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value ?? 0));
}

function formatPercent(value: number) {
  const formatted = formatDecimal(Math.abs(value), 1);
  return `${value >= 0 ? "+" : "-"}${formatted}%`;
}

function toneColor(tone: "primary" | "success" | "warning" | "danger", alpha = 1) {
  const map = {
    primary: tokens.colors.primaryStrong,
    success: tokens.colors.success,
    warning: tokens.colors.warning,
    danger: tokens.colors.danger
  } as const;
  return withAlpha(map[tone], alpha);
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) return hexColor;
  const value = Math.max(0, Math.min(1, alpha));
  const suffix = Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${normalized}${suffix}`;
}
