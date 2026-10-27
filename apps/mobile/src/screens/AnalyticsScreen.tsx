import React from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import { hasPermission, resolveBusinessTypeConfig } from "@shared";
import type { EnterpriseAnalytics } from "@shared";
import { AppScrollView, Badge, Card, DateRangePickerModal, EmptyState, ErrorState, GradientHeader, PrimaryButton, Screen, SkeletonBlock, Tag } from "@/components/Primitives";
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
  const businessConfig = resolveBusinessTypeConfig({ businessType: business?.businessType, industryKey: business?.industryKey });

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
    (summary?.revenueTotal ?? 0) !== 0 ||
      (summary?.profitTotal ?? 0) !== 0 ||
      (summary?.salesCount ?? 0) > 0 ||
      (summary?.productCount ?? 0) > 0 ||
      (summary?.customerCount ?? 0) > 0 ||
      (analytics?.revenueTrend.some((point) => point.revenue !== 0 || point.salesCount > 0 || point.expenses !== 0 || point.profit !== 0) ?? false)
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

      <AppScrollView refreshing={refreshing} onRefresh={handleRefresh} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 }}>
        <View style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: tokens.colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" }}>Reporting period</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{rangeLabel}</Text>
            </View>
            <Pressable onPress={openCustomRange} accessibilityRole="button" accessibilityLabel="Choose custom reporting dates" style={{ minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}>
              <Ionicons name="calendar-outline" size={15} color={tokens.colors.icon} />
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "700" }}>Custom</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 7 }} accessibilityLabel="Analytics reporting periods">
            {([
              ["today", "Today"],
              ["week", "7 days"],
              ["month", "This month"],
              ["year", "Year to date"]
            ] as Array<[Exclude<Filter, "custom">, string]>).map(([filter, label]) => (
              <Tag key={filter} label={label} tone="primary" selected={activeFilter === filter} onPress={() => setActiveFilter(filter)} />
            ))}
            {activeFilter === "custom" ? <Tag label="Custom range" tone="primary" selected onPress={openCustomRange} /> : null}
          </ScrollView>
          {error ? <Text style={{ color: tokens.colors.danger, lineHeight: 18 }}>{error}</Text> : null}
        </View>

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
            <SummaryGrid analytics={analytics} currency={business?.currency ?? "KES"} config={businessConfig} />
            <AnimatedSection index={0}>
              <TrendCard
                title="Revenue"
                subtitle="Monthly buckets within the selected dates"
                accent="primary"
                points={analytics?.revenueTrend.map((point) => ({ label: point.period, value: point.revenue, note: `${point.salesCount} sales` })) ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
              />
            </AnimatedSection>
            <AnimatedSection index={1}>
              <TrendCard
                title="Sales"
                subtitle="Monthly order totals within the selected dates"
                accent="success"
                points={analytics?.salesTrend.map((point) => ({ label: point.label, value: point.value, note: formatMoney(point.secondaryValue ?? 0, business?.currency) })) ?? []}
                valueFormatter={(value) => formatCount(value)}
              />
            </AnimatedSection>
            {businessConfig.capabilities.products ? <AnimatedSection index={2}>
              <RankedChart
                title="Products"
                subtitle="Top product performers"
                accent="primary"
                rows={analytics?.productPerformance ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
                secondaryFormatter={(row) => `${formatCount(row.secondaryValue ?? 0)} units`}
              />
            </AnimatedSection> : (
              <AnimatedSection index={2}>
                <Card style={{ gap: 8 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "900" }}>{businessConfig.workspace.activityLabel} analytics</Text>
                  <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{businessConfig.workflow.steps.join("  →  ")}</Text>
                </Card>
              </AnimatedSection>
            )}
            <AnimatedSection index={3}>
              <RankedChart
                title="Customers"
                subtitle="Revenue in range · current outstanding balance"
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
            {businessConfig.capabilities.inventory ? <AnimatedSection index={6}>
              <RankedChart
                title="Inventory Turnover"
                subtitle="Fast-moving stock and sell-through"
                accent="danger"
                rows={analytics?.inventoryTurnover ?? []}
                valueFormatter={(value) => formatDecimal(value, 2)}
                secondaryFormatter={(row) => `${formatCount(row.secondaryValue ?? 0)} sold`}
                tertiaryFormatter={(row) => `${formatCount(row.stockOnHand ?? 0)} on hand`}
              />
            </AnimatedSection> : null}
            <AnimatedSection index={7}>
              <TrendCard
                title="Profit Trends"
                subtitle="Estimated monthly profit within the selected dates"
                accent="warning"
                points={analytics?.profitTrends.map((point) => ({ label: point.period, value: point.profit, note: formatMoney(point.expenses, business?.currency) })) ?? []}
                valueFormatter={(value) => formatMoney(value, business?.currency)}
              />
            </AnimatedSection>
            <AnimatedSection index={8}>
              <MonthlyGrowthCard growth={analytics?.monthlyGrowth ?? []} currency={business?.currency ?? "KES"} />
            </AnimatedSection>
            {(analytics?.revenueTrend.length ?? 0) > 1 && analytics?.revenueTrend.some((point) => point.revenue !== 0) ? <AnimatedSection index={9}>
              <ForecastCard forecast={analytics?.forecast ?? []} currency={business?.currency ?? "KES"} />
            </AnimatedSection> : null}
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

function SummaryGrid({ analytics, currency, config }: { analytics: EnterpriseAnalytics | null; currency: string; config: ReturnType<typeof resolveBusinessTypeConfig> }) {
  return (
    <Card style={{ gap: 11, padding: 14 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <AnalyticsMetric label="Revenue" value={formatMoney(analytics?.summary.revenueTotal ?? 0, currency)} prominent />
        <AnalyticsMetric label="Est. net profit" value={formatMoney(analytics?.summary.profitTotal ?? 0, currency)} prominent tone={(analytics?.summary.profitTotal ?? 0) < 0 ? "danger" : "success"} />
      </View>
      <View style={{ height: 1, backgroundColor: tokens.colors.border }} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <AnalyticsMetric label={config.workspace.activityLabel} value={formatCount(analytics?.summary.salesCount ?? 0)} />
        <AnalyticsMetric label={config.capabilities.products ? "Catalog total" : `${config.navigation.catalogLabel} total`} value={formatCount(analytics?.summary.productCount ?? 0)} />
        <AnalyticsMetric label="Customers total" value={formatCount(analytics?.summary.customerCount ?? 0)} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
        <Badge label={`Avg. order ${formatMoney(analytics?.summary.averageOrderValue ?? 0, currency)}`} tone="primary" />
        {analytics?.summary.peakHour ? <Badge label={`Peak ${formatCount(analytics.summary.peakHourSales)} at ${analytics.summary.peakHour}`} tone="primary" /> : null}
        {config.capabilities.inventory ? <Badge label={`Turnover ${formatDecimal(analytics?.summary.inventoryTurnover ?? 0, 2)}`} tone="primary" /> : null}
      </View>
      <Text style={{ color: tokens.colors.textMuted, fontSize: 10 }}>Profit is estimated from revenue, product costs, and recorded expenses.</Text>
    </Card>
  );
}

function AnalyticsMetric({ label, value, prominent = false, tone = "primary" }: { label: string; value: string; prominent?: boolean; tone?: "primary" | "success" | "danger" }) {
  const color = tone === "success" ? tokens.colors.success : tone === "danger" ? tokens.colors.danger : tokens.colors.text;
  return <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
    <Text style={{ color: tokens.colors.textMuted, fontSize: 10 }} numberOfLines={1}>{label}</Text>
    <Text style={{ color, fontSize: prominent ? 17 : 12, fontWeight: "700", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{value}</Text>
  </View>;
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
  const maxMagnitude = React.useMemo(() => Math.max(1, ...values.map((value) => Math.abs(value))), [values]);
  const hasNegative = values.some((value) => value < 0);
  const [chartWidth, setChartWidth] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  React.useEffect(() => setSelectedIndex(Math.max(0, points.length - 1)), [points]);
  const selectedPoint = points[selectedIndex];
  const plotHeight = 112;
  const inset = 7;
  const plotInsetY = 8;
  const plotWidth = Math.max(0, chartWidth - inset * 2);
  const zeroY = hasNegative ? plotHeight / 2 : plotHeight - plotInsetY;
  const coordinates = React.useMemo(() => points.map((point, index) => {
    const value = Number(point.value ?? 0);
    const x = inset + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = hasNegative
      ? plotHeight / 2 - (value / maxMagnitude) * (plotHeight / 2 - plotInsetY)
      : plotHeight - plotInsetY - (value / maxMagnitude) * (plotHeight - plotInsetY * 2);
    return { x, y };
  }), [hasNegative, maxMagnitude, plotHeight, plotInsetY, plotWidth, points]);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{subtitle}</Text>
      </View>
      {points.length ? (
        <View accessible accessibilityLabel={`${title} chart. ${points.length} labeled periods. ${selectedPoint ? `Selected ${selectedPoint.label}, ${valueFormatter(selectedPoint.value)}${selectedPoint.note ? `, ${selectedPoint.note}` : ""}.` : ""}`}>
          {selectedPoint ? <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7, marginBottom: 8 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>{selectedPoint.label}</Text>
            <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "700" }}>{valueFormatter(selectedPoint.value)}</Text>
            {selectedPoint.note ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{selectedPoint.note}</Text> : null}
          </View> : null}
          <View
            onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
            style={{ height: plotHeight, position: "relative", borderBottomWidth: 1, borderBottomColor: tokens.colors.border }}
          >
            {hasNegative ? <View style={{ position: "absolute", top: zeroY, left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed", borderColor: tokens.colors.textMuted }} /> : null}
            {chartWidth > 0 ? points.slice(0, -1).map((point, index) => {
              const from = coordinates[index];
              const to = coordinates[index + 1];
              if (!from || !to) return null;
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = `${Math.atan2(dy, dx)}rad`;
              return <View key={`segment-${point.label}-${index}`} style={{ position: "absolute", left: (from.x + to.x - length) / 2, top: (from.y + to.y) / 2 - 1, width: length, height: 2, borderRadius: 2, backgroundColor: toneColor(accent, 1), transform: [{ rotate: angle }] }} />;
            }) : null}
            {chartWidth > 0 ? points.map((point, index) => {
              const coordinate = coordinates[index];
              if (!coordinate) return null;
              const isSelected = selectedIndex === index;
              const pointColor = point.value < 0 ? tokens.colors.danger : toneColor(accent, 1);
              const size = isSelected ? 10 : 7;
              return <View key={`point-${point.label}-${index}`} style={{ position: "absolute", left: coordinate.x - size / 2, top: coordinate.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: pointColor, borderWidth: isSelected ? 2 : 0, borderColor: tokens.colors.surface }} />;
            }) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "stretch" }}>
            {points.map((point, index) => {
              const isSelected = selectedIndex === index;
              return <Pressable key={`${title}-${point.label}-${index}`} onPress={() => setSelectedIndex(index)} accessibilityRole="button" accessibilityState={{ selected: isSelected }} accessibilityLabel={`${point.label}: ${valueFormatter(point.value)}${point.note ? `, ${point.note}` : ""}`} style={{ flex: 1, minWidth: 0, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 1 }}>
                <Text style={{ color: isSelected ? tokens.colors.text : tokens.colors.textSecondary, fontSize: 9, fontWeight: isSelected ? "700" : "500" }} numberOfLines={1}>{point.label}</Text>
              </Pressable>;
            })}
          </View>
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
  const max = React.useMemo(() => Math.max(1, ...rows.map((row) => Math.abs(Number(row.value ?? 0)))), [rows]);
  const hasNegative = rows.some((row) => Number(row.value ?? 0) < 0);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
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
              signedScale={hasNegative}
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
  signedScale,
  valueText,
  secondaryText,
  tertiaryText
}: {
  label: string;
  value: number;
  max: number;
  accent: "primary" | "success" | "warning" | "danger";
  signedScale: boolean;
  valueText: string;
  secondaryText?: string | undefined;
  tertiaryText?: string | undefined;
}) {
  const magnitude = Math.abs(Number(value ?? 0));
  const percentage = magnitude === 0 ? 0 : Math.max(0.02, Math.min(1, magnitude / Math.max(1, max)));
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
        {signedScale ? (
          <>
            <View style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, backgroundColor: tokens.colors.border }} />
            {percentage > 0 ? <View style={{ position: "absolute", top: 0, bottom: 0, left: value < 0 ? undefined : "50%", right: value < 0 ? "50%" : undefined, width: `${percentage * 50}%`, backgroundColor: value < 0 ? tokens.colors.danger : toneColor(accent, 1) }} /> : null}
          </>
        ) : percentage > 0 ? <View style={{ width: `${percentage * 100}%`, height: "100%", borderRadius: 999, backgroundColor: toneColor(accent, 1) }} /> : null}
      </View>
    </View>
  );
});

function MonthlyGrowthCard({ growth, currency }: { growth: Array<{ month: string; revenue: number; growthPercent: number }>; currency: string }) {
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Month-bucket revenue change</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18, fontSize: 12 }}>Adjacent buckets in the selected dates; partial months are not normalized.</Text>
      </View>
      {growth.length ? (
        <View>
          {growth.map((point, index) => {
            const hasPreviousPeriod = index > 0 && (growth[index - 1]?.revenue ?? 0) > 0;
            const positive = point.growthPercent >= 0;
            return (
              <View key={point.month} style={{ minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 7, borderTopWidth: 1, borderColor: tokens.colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{point.month}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ color: hasPreviousPeriod ? positive ? tokens.colors.success : tokens.colors.danger : tokens.colors.textMuted, fontSize: 11, fontWeight: "800" }}>{hasPreviousPeriod ? formatPercent(point.growthPercent) : "No baseline"}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{formatMoney(point.revenue, currency)}</Text>
                </View>
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
        <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Trend projection</Text>
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18, fontSize: 12 }}>A simple linear projection from the selected months; it is not a target or guaranteed result.</Text>
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
