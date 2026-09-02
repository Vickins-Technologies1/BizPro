import React from "react";
import { Pressable, Text, View, useWindowDimensions, StyleSheet } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear, subMonths } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  hasPermission,
  resolveBusinessTypeConfig,
  resolveIndustryModule,
  formatRoleLabel,
  type DailySummary,
  type EnterpriseAnalytics
} from "@shared";
import {
  AppScrollView,
  Avatar,
  Badge,
  BottomSheet,
  Card,
  DateRangePickerModal,
  Dropdown,
  EmptyState,
  ErrorState,
  GradientHeader,
  InfoIcon,
  PrimaryButton,
  Screen,
  SkeletonBlock,
  Tag
} from "@/components/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { getEnterpriseAnalytics, getPaymentBreakdown, getReportsSummary, getTopProducts, listEmployees, listNotificationsPage } from "@/services/apiClient";
import { useMoreDrawer } from "@/navigation/moreDrawerContext";

type ReportRow = { productId: string; productName: string; quantity: number; total: number };
type PaymentRow = { _id: string; total: number; count: number };
type Filter = "today" | "week" | "month" | "year" | "custom";
type RangeState = { from: string; to: string };

const DASHBOARD_TREND_WINDOW = 6;
export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { openMore } = useMoreDrawer();
  const { width } = useWindowDimensions();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const products = useAppStore((state) => state.products);
  const customers = useAppStore((state) => state.customers);
  const sales = useAppStore((state) => state.sales);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const syncNow = useAppStore((state) => state.syncNow);
  const canViewDashboard = hasPermission(user, "viewDashboard");
  const industry = resolveIndustryModule({ industryKey: business?.industryKey, businessType: business?.businessType });
  const businessConfig = resolveBusinessTypeConfig({ industryKey: business?.industryKey, businessType: business?.businessType });

  const [activeFilter, setActiveFilter] = React.useState<Filter>("month");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [topProducts, setTopProducts] = React.useState<ReportRow[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentRow[]>([]);
  const [analytics, setAnalytics] = React.useState<EnterpriseAnalytics | null>(null);
  const [employeesCount, setEmployeesCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [filtersVisible, setFiltersVisible] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);
  const requestIdRef = React.useRef(0);
  const initializedRef = React.useRef(false);

  const trendRange = React.useMemo(() => buildTrendRange(), []);
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
  }, [sales.length, products.length, customers.length, currentRange?.from, currentRange?.to, selectedBranchId]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      async function refreshNotificationCount() {
        const page = await listNotificationsPage({ page: 1, pageSize: 1 }).catch(() => null);
        if (!cancelled) setUnreadNotificationCount(page?.unreadCount ?? 0);
      }
      void refreshNotificationCount();
      const timer = setInterval(() => void refreshNotificationCount(), 30000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [])
  );

  async function loadDashboard(from: string, to: string, mode: "replace" | "refresh" = "replace") {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const [summaryResponse, topProductsResponse, paymentResponse, employeesResponse, analyticsResponse] = await Promise.all([
        getReportsSummary(from, to, selectedBranchId),
        getTopProducts(from, to, selectedBranchId),
        getPaymentBreakdown(from, to, selectedBranchId),
        listEmployees(selectedBranchId).catch(() => null),
        getEnterpriseAnalytics(trendRange.from, trendRange.to, selectedBranchId).catch(() => null)
      ]);
      if (requestId !== requestIdRef.current) return;
      setSummary(summaryResponse);
      setTopProducts(topProductsResponse);
      setPaymentBreakdown(paymentResponse);
      setEmployeesCount(employeesResponse ? employeesResponse.length : null);
      setAnalytics(analyticsResponse);
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

  const revenueTotal = summary?.salesTotal ?? analytics?.summary.revenueTotal ?? 0;
  const outstandingDebt = summary?.debtTotal ?? 0;
  const lowStockCount = summary?.lowStockCount ?? 0;
  const paymentTotal = paymentBreakdown.reduce((sum, row) => sum + row.total, 0);
  const paymentCount = paymentBreakdown.reduce((sum, row) => sum + row.count, 0);
  const customerCount = analytics?.summary.customerCount ?? customers.length;
  const staffCount = analytics?.summary.staffCount ?? employeesCount ?? 0;
  const salesCount = analytics?.summary.salesCount ?? sales.length;
  const productCount = analytics?.summary.productCount ?? products.length;
  const inventoryValue = products.reduce((total, product) => total + product.stockOnHand * product.buyingPrice, 0);
  const overdueCustomers = customers.filter((customer) => (customer.balance ?? 0) > 0).length;
  const trendSeries = analytics?.revenueTrend ?? [];
  const trendLabels = trendSeries.map((point) => point.period);
  const trendValues = trendSeries.map((point) => point.revenue);
  const growthPercent = analytics?.summary.monthlyGrowthPercent ?? 0;
  const forecastRevenue = analytics?.summary.forecastRevenue ?? 0;
  const averageOrderValue = analytics?.summary.averageOrderValue ?? 0;
  const activeBranchLabel = resolveBranchLabel(branches, selectedBranchId, user?.role);
  const firstName = getFirstName(user?.fullName);
  const roleLabel = user?.roleLabel ?? formatRoleLabel(user?.role ?? "cashier");
  const isMobile = width < 700;
  const metricWrapStyle = width >= 900 ? [styles.metricWrap, styles.metricWrapWide] : styles.metricWrap;
  const hasContent =
    Boolean(summary) &&
    (revenueTotal > 0 ||
      outstandingDebt > 0 ||
      paymentTotal > 0 ||
      customerCount > 0 ||
      lowStockCount > 0 ||
      trendValues.length > 0 ||
      topProducts.length > 0);

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
      <AppScrollView refreshing={refreshing} onRefresh={handleRefresh} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            onPress={openMore}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open more menu"
          >
            <Ionicons name="menu-outline" size={28} color={tokens.colors.text} />
          </Pressable>

          <View style={styles.brandCluster}>
            <BrandLogo style={styles.brandLogo} />
            <View style={{ alignItems: "center" }}>
              <Text style={styles.brandTitle}>Biz Pro</Text>
              <Text style={styles.brandSubtitle}>Business OS</Text>
            </View>
          </View>

          <Pressable
            onPress={() => (navigation.getParent?.() ?? navigation).navigate("Notifications")}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={tokens.colors.text} />
            {unreadNotificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{Math.min(unreadNotificationCount, 99)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Card style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Welcome back</Text>
            <Text style={styles.heroName}>
              {firstName}
              {firstName === "there" ? "" : "!"} <Text style={styles.heroWave}>👋</Text>
            </Text>
            <View style={styles.heroPills}>
              <Badge label={roleLabel} tone="primary" />
              <Badge label={pendingSync ? `${pendingSync} pending sync` : "Synced"} tone={pendingSync ? "warning" : "success"} />
              <Badge label={activeBranchLabel} tone="primary" />
              {staffCount ? <Badge label={`${staffCount} team`} tone="success" /> : null}
            </View>
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMeta}>{industry.label}</Text>
              <Text style={styles.heroMetaDot}>•</Text>
              <Text style={styles.heroMeta}>{currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Current period"}</Text>
            </View>
            <View style={styles.heroDebtRow}>
              <Text style={styles.heroDebtLabel}>Outstanding debt</Text>
              <Text style={styles.heroDebtValue}>{formatMoney(outstandingDebt, business?.currency)}</Text>
            </View>
          </View>

          <View style={styles.heroAvatarColumn}>
            <View style={styles.heroRing}>
              <Avatar name={user?.fullName ?? null} size={54} tone="primary" />
            </View>
            <View style={styles.heroRolePill}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroRoleText}>{roleLabel}</Text>
            </View>
          </View>
        </Card>

        {isMobile ? (
          <View style={styles.mobileFilterBar}>
            <PrimaryButton title="Filters" variant="secondary" iconLeft="options-outline" onPress={() => setFiltersVisible(true)} />
            <Badge label={currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading"} tone="primary" />
          </View>
        ) : (
          <DashboardFilters
            activeFilter={activeFilter}
            selectedBranchId={selectedBranchId}
            branches={branches}
            canChooseBranch={user?.role === "owner" && branches.length > 1}
            currentRange={currentRange}
            onFilterChange={(filter) => filter === "custom" ? setPickerVisible(true) : setActiveFilter(filter)}
            onBranchChange={(branchId) => void setSelectedBranchId(branchId === "all" ? null : branchId)}
          />
        )}

        {loading && !summary ? (
          <View style={{ gap: 14 }}>
            <SkeletonBlock height={210} radius={28} />
            <View style={styles.metricGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
              <View key={index} style={metricWrapStyle}>
                  <SkeletonBlock height={132} radius={24} />
                </View>
              ))}
            </View>
            <SkeletonBlock height={300} radius={28} />
            <SkeletonBlock height={170} radius={28} />
            <SkeletonBlock height={220} radius={28} />
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
            <View style={styles.metricGrid}>
              {industry.dashboard.widgets.map((widget) => (
                <View key={widget.key} style={metricWrapStyle}>
                  <MetricCard
                    label={widget.label}
                    value={dashboardMetricValue(widget.metric, { revenueTotal, paymentTotal, customerCount, lowStockCount, salesCount, productCount, inventoryValue, business, analytics, employeesCount })}
                    hint={widget.description ?? `${businessConfig.label} activity`}
                    icon={(widget.icon ?? "analytics-outline") as any}
                    tone={widget.tone ?? "primary"}
                  />
                </View>
              ))}
            </View>

            <Card style={styles.chartCard}>
              <View style={styles.sectionHeadingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Revenue Overview</Text>
                  <View style={styles.sectionMetaRow}>
                    <Text style={styles.sectionSubtitle}>6-month trend</Text>
                    <InfoIcon message="Revenue trend across the last six completed monthly periods." />
                  </View>
                </View>
                <Tag label="Last 6 months" tone="primary" selected />
              </View>

              <View style={styles.chartSummaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chartValue}>{formatMoney(revenueTotal, business?.currency)}</Text>
                  <Text style={styles.chartCaption}>Total Revenue</Text>
                </View>
                <Badge label={`↑ ${formatPercent(growthPercent)}`} tone="success" />
              </View>

              <MiniLineChart
                data={trendValues.length ? trendValues : [0]}
                labels={trendLabels.length ? trendLabels : ["No data"]}
                tone={tokens.colors.primaryStrong}
              />

              <View style={styles.chartFooter}>
                <InfoPill label="Profit" value={formatMoney(analytics?.summary.profitTotal ?? 0, business?.currency)} tone="success" />
                <InfoPill label="Forecast" value={formatMoney(forecastRevenue, business?.currency)} tone="primary" />
                <InfoPill label="Avg. Ticket" value={formatMoney(averageOrderValue, business?.currency)} tone="warning" />
              </View>
            </Card>

            <Card style={styles.quickCard}>
              <View style={styles.sectionHeadingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <Text style={styles.sectionSubtitle}>Common actions</Text>
                </View>
                <Pressable onPress={openMore} accessibilityRole="button">
                  <Text style={styles.viewAllText}>View All</Text>
                </Pressable>
              </View>
              <View style={styles.actionGrid}>
                {availableQuickActions({
                  onNewSale: () => navigation.navigate("POS"),
                  onAddCustomer: () => navigation.navigate("Customers"),
                  onInventory: () => navigation.navigate("Catalog"),
                  onFinance: () => navigation.navigate("Finance"),
                  onMore: openMore,
                  canCreateSales: hasPermission(user, "createSales"),
                  canManageCustomers: hasPermission(user, "manageCustomers"),
                  canManageInventory: hasPermission(user, "manageInventory"),
                  canManageExpenses: hasPermission(user, "manageExpenses")
                }).map((action) => (
                  <QuickAction key={action.label} {...action} />
                ))}
              </View>
            </Card>

            <Card style={styles.productsCard}>
              <View style={styles.sectionHeadingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Top Products</Text>
                  <Text style={styles.sectionSubtitle}>Best sellers</Text>
                </View>
                <Badge label={`${topProducts.length} items`} tone="primary" />
              </View>
              {topProducts.length ? (
                <View style={{ gap: 10 }}>
                  {topProducts.slice(0, 4).map((row) => (
                    <View key={row.productId} style={styles.productRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {row.productName}
                        </Text>
                        <Text style={styles.productMeta}>{row.quantity} sold</Text>
                      </View>
                      <Text style={styles.productValue}>{formatMoney(row.total, business?.currency)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCopy}>No product movement yet. Sales activity will populate this list automatically.</Text>
              )}
            </Card>

            <Card style={styles.statusCard}>
              <View style={styles.sectionHeadingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Tasks Overview</Text>
                  <View style={styles.sectionMetaRow}>
                    <Text style={styles.sectionSubtitle}>Activity status</Text>
                    <InfoIcon message="Completed payments, sales activity, low-stock items, and customers with balances." />
                  </View>
                </View>
                <Tag label="This Week" tone="primary" selected />
              </View>

              <View style={styles.statusContent}>
                <StatusRing
                  total={paymentCount + salesCount + lowStockCount + overdueCustomers}
                  items={[
                    { label: "Completed", value: paymentCount, tone: tokens.colors.success },
                    { label: "In Progress", value: salesCount, tone: tokens.colors.primary },
                    { label: "Pending", value: lowStockCount, tone: tokens.colors.warning },
                    { label: "Overdue", value: overdueCustomers, tone: tokens.colors.danger }
                  ]}
                />

                <View style={{ flex: 1, gap: 14 }}>
                  {[
                    { label: "Completed", value: paymentCount, tone: "success" as const },
                    { label: "In Progress", value: salesCount, tone: "primary" as const },
                    { label: "Pending", value: lowStockCount, tone: "warning" as const },
                    { label: "Overdue", value: overdueCustomers, tone: "danger" as const }
                  ].map((item) => (
                    <StatusRow
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      total={Math.max(1, paymentCount + salesCount + lowStockCount + overdueCustomers)}
                      tone={item.tone}
                    />
                  ))}
                </View>

                <Pressable
                  onPress={() => navigation.navigate("Reports")}
                  style={({ pressed }) => [styles.statusArrowButton, pressed && styles.iconButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open reports"
                >
                  <Ionicons name="chevron-forward" size={22} color={tokens.colors.text} />
                </Pressable>
              </View>
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
      <BottomSheet visible={filtersVisible} title="Dashboard filters" subtitle="Choose the period and workspace scope." onClose={() => setFiltersVisible(false)}>
        <DashboardFilters
          activeFilter={activeFilter}
          selectedBranchId={selectedBranchId}
          branches={branches}
          canChooseBranch={user?.role === "owner" && branches.length > 1}
          currentRange={currentRange}
          compact
          onFilterChange={(filter) => {
            if (filter === "custom") {
              setFiltersVisible(false);
              setPickerVisible(true);
            } else {
              setActiveFilter(filter);
            }
          }}
          onBranchChange={(branchId) => void setSelectedBranchId(branchId === "all" ? null : branchId)}
        />
      </BottomSheet>
    </Screen>
  );
}

function DashboardFilters({
  activeFilter,
  selectedBranchId,
  branches,
  canChooseBranch,
  currentRange,
  compact = false,
  onFilterChange,
  onBranchChange
}: {
  activeFilter: Filter;
  selectedBranchId: string | null;
  branches: Array<{ id: string; name: string }>;
  canChooseBranch: boolean;
  currentRange: RangeState | null;
  compact?: boolean;
  onFilterChange: (filter: Filter) => void;
  onBranchChange: (branchId: string) => void;
}) {
  const periodOptions = [
    { label: "Today", value: "today" },
    { label: "This week", value: "week" },
    { label: "This month", value: "month" },
    { label: "This year", value: "year" },
    { label: "Custom range", value: "custom" }
  ];
  const branchOptions = [
    { label: "All branches", value: "all" },
    ...branches.map((branch) => ({ label: branch.name, value: branch.id }))
  ];
  const selectedBranchValue = selectedBranchId ?? "all";

  return (
    <View style={[styles.filterControls, compact && styles.filterControlsCompact]}>
      {compact ? (
        <View style={styles.filterControlGroup}>
          <View style={styles.filterLabelRow}>
            <Text style={styles.filterLabel}>Period</Text>
            <InfoIcon message="Choose the date window used for dashboard metrics and reports." />
          </View>
          <View style={styles.filterTagRow}>
            {periodOptions.map((option) => (
              <Tag
                key={option.value}
                label={option.label}
                tone={option.value === "custom" ? "warning" : "primary"}
                selected={activeFilter === option.value}
                onPress={() => onFilterChange(option.value as Filter)}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.filterControlRow}>
          <Dropdown
            label="Period"
            value={activeFilter}
            options={periodOptions}
            onChange={(value) => onFilterChange(value as Filter)}
          />
          {canChooseBranch ? (
            <Dropdown label="Branch" value={selectedBranchValue} options={branchOptions} onChange={onBranchChange} />
          ) : null}
          <View style={styles.filterRangeBadge}>
            <Text style={styles.filterRangeLabel}>Showing</Text>
            <Badge label={currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading"} tone="primary" />
          </View>
        </View>
      )}
      {compact && canChooseBranch ? (
        <View style={styles.filterControlGroup}>
          <View style={styles.filterLabelRow}>
            <Text style={styles.filterLabel}>Branch</Text>
            <InfoIcon message="Limit dashboard data to one branch or view the consolidated business." />
          </View>
          <View style={styles.filterTagRow}>
            {branchOptions.map((option) => (
              <Tag key={option.value} label={option.label} tone="primary" selected={selectedBranchValue === option.value} onPress={() => onBranchChange(option.value)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone
}: {
  label: string;
  value: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  const accent = toneColor(tone);
  return (
    <Card style={styles.metricCard}>
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIconWrap, { backgroundColor: withAlpha(accent, 0.14) }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
        <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </Card>
  );
}

function QuickAction({
  label,
  icon,
  tone,
  onPress
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "success" | "warning" | "danger";
  onPress: () => void;
}) {
  const accent = toneColor(tone);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.actionTile, pressed && styles.actionTilePressed]}>
      <View style={[styles.actionIconWrap, { backgroundColor: withAlpha(accent, 0.14) }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function StatusRing({
  total,
  items
}: {
  total: number;
  items: Array<{ label: string; value: number; tone: string }>;
}) {
  const [completed, inProgress, pending, overdue] = items;
  return (
    <View style={styles.ringShell}>
      <View
        style={[
          styles.ring,
          {
            borderTopColor: withAlpha(completed?.tone ?? tokens.colors.success, (completed?.value ?? 0) > 0 ? 1 : 0.24),
            borderRightColor: withAlpha(inProgress?.tone ?? tokens.colors.primary, (inProgress?.value ?? 0) > 0 ? 1 : 0.24),
            borderBottomColor: withAlpha(pending?.tone ?? tokens.colors.warning, (pending?.value ?? 0) > 0 ? 1 : 0.24),
            borderLeftColor: withAlpha(overdue?.tone ?? tokens.colors.danger, (overdue?.value ?? 0) > 0 ? 1 : 0.24)
          }
        ]}
      />
      <View style={styles.ringCenter}>
        <Text style={styles.ringTotal}>{total}</Text>
        <Text style={styles.ringLabel}>Total</Text>
      </View>
    </View>
  );
}

function StatusRow({
  label,
  value,
  total,
  tone
}: {
  label: string;
  value: number;
  total: number;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  const accent = toneColor(tone);
  const percent = Math.round((value / Math.max(total, 1)) * 100);
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusRowLeft}>
        <View style={[styles.statusDot, { backgroundColor: accent }]} />
        <Text style={styles.statusLabel}>{label}</Text>
      </View>
      <Text style={styles.statusValue}>
        {value} <Text style={styles.statusPercent}>({percent}%)</Text>
      </Text>
    </View>
  );
}

function InfoPill({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillLabel}>{label}</Text>
      <Text style={[styles.infoPillValue, { color: toneColor(tone) }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MiniLineChart({
  data,
  labels,
  tone
}: {
  data: number[];
  labels: string[];
  tone: string;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(280, width - 64);
  const plotWidth = chartWidth - 20;
  const plotHeight = 118;
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const points = data.map((value, index) => {
    const denominator = Math.max(max - min, 1);
    const x = data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth;
    const y = plotHeight - ((value - min) / denominator) * (plotHeight - 6);
    return { x: x + 10, y: y + 12, value };
  });
  const yValues = [max, Math.round(max * 0.66), Math.round(max * 0.33), 0].map((value) => formatCompactValue(value));

  return (
    <View style={[styles.chartShell, { width: chartWidth }]}>
      <View style={styles.chartYAxis}>
        {yValues.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.chartYAxisLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.chartCanvas}>
        <View style={styles.chartArea}>
          <View style={styles.chartGridLine} />
          <View style={[styles.chartGridLine, { top: "33%" }]} />
          <View style={[styles.chartGridLine, { top: "66%" }]} />

          {points.slice(1).map((current, index) => {
            const previous = points[index];
            if (!previous) return null;
            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            return (
              <View
                key={`segment-${index}`}
                style={[
                  styles.chartSegment,
                  {
                    left: previous.x + (current.x - previous.x) / 2 - distance / 2,
                    top: previous.y + (current.y - previous.y) / 2 - 1.5,
                    width: distance,
                    backgroundColor: tone,
                    transform: [{ rotate: `${angle}rad` }]
                  }
                ]}
              />
            );
          })}

          {points.map((point, index) => (
            <View
              key={`point-${index}`}
              style={[
                styles.chartPoint,
                {
                  left: point.x - 5,
                  top: point.y - 5,
                  borderColor: "#FFFFFF",
                  backgroundColor: tone
                }
              ]}
            />
          ))}
        </View>

        <View style={styles.chartLabelsRow}>
          {labels.map((label) => (
            <Text key={label} style={styles.chartLabel}>
              {formatTrendLabel(label)}
            </Text>
          ))}
        </View>
      </View>
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

function buildTrendRange() {
  const today = new Date();
  const start = startOfMonth(subMonths(today, DASHBOARD_TREND_WINDOW - 1));
  return {
    from: format(startOfDay(start), "yyyy-MM-dd"),
    to: format(endOfDay(today), "yyyy-MM-dd")
  };
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

function formatTrendLabel(label: string) {
  return label.split(" ")[0] ?? label;
}

function formatGrowth(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatCompactValue(value: number) {
  if (value === 0) return "0";
  if (value < 1000) return String(Math.round(value));
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function getFirstName(fullName?: string | null) {
  const name = fullName?.trim();
  if (!name) return "there";
  return name.split(/\s+/)[0] ?? "there";
}

function resolveBranchLabel(
  branches: Array<{ id: string; name: string; isDefault?: boolean }>,
  selectedBranchId: string | null,
  role?: string | null
) {
  if (role === "owner" && selectedBranchId === null) return "All branches";
  if (selectedBranchId) {
    return branches.find((branch) => branch.id === selectedBranchId)?.name ?? "Assigned branch";
  }
  return branches[0]?.name ?? "Workspace";
}

function availableQuickActions(input: {
  canCreateSales: boolean;
  canManageCustomers: boolean;
  canManageInventory: boolean;
  canManageExpenses: boolean;
  onNewSale: () => void;
  onAddCustomer: () => void;
  onInventory: () => void;
  onFinance: () => void;
  onMore: () => void;
}) {
  return [
    input.canCreateSales
      ? { label: "New Sale", icon: "scan-outline" as const, tone: "primary" as const, onPress: input.onNewSale }
      : null,
    input.canManageCustomers
      ? { label: "Add Customer", icon: "person-add-outline" as const, tone: "success" as const, onPress: input.onAddCustomer }
      : null,
    input.canManageInventory
      ? { label: "Inventory", icon: "cube-outline" as const, tone: "warning" as const, onPress: input.onInventory }
      : null,
    input.canManageExpenses
      ? { label: "Finance", icon: "wallet-outline" as const, tone: "danger" as const, onPress: input.onFinance }
      : null,
    { label: "More", icon: "apps-outline" as const, tone: "primary" as const, onPress: input.onMore }
  ].filter(Boolean) as Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    tone: "primary" | "success" | "warning" | "danger";
    onPress: () => void;
  }>;
}

function toneColor(tone: "primary" | "success" | "warning" | "danger") {
  if (tone === "success") return tokens.colors.success;
  if (tone === "warning") return tokens.colors.warning;
  if (tone === "danger") return tokens.colors.danger;
  return tokens.colors.primary;
}

function dashboardMetricValue(
  metric: string,
  input: {
    revenueTotal: number;
    paymentTotal: number;
    customerCount: number;
    lowStockCount: number;
    salesCount: number;
    productCount: number;
    inventoryValue: number;
    business: { currency?: string | null } | null;
    analytics: EnterpriseAnalytics | null;
    employeesCount: number | null;
  }
) {
  switch (metric) {
    case "salesTotal":
    case "revenueTotal":
      return formatMoney(input.revenueTotal, input.business?.currency ?? undefined);
    case "inventoryValue":
      return formatMoney(input.inventoryValue, input.business?.currency ?? undefined);
    case "customersCount":
    case "clientsCount":
    case "patientsCount":
      return String(input.customerCount);
    case "lowStockCount":
      return String(input.lowStockCount);
    case "ordersCount":
      return String(input.salesCount);
    case "staffCount":
    case "stylistsCount":
    case "mechanicsCount":
      return String(input.employeesCount ?? input.analytics?.summary.staffCount ?? 0);
    default:
      return String(input.salesCount || input.productCount);
  }
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 10
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  brandCluster: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  brandLogo: {
    width: 44,
    height: 34
  },
  brandTitle: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 24
  },
  brandSubtitle: {
    color: tokens.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    position: "relative"
  },
  iconButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }]
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    backgroundColor: tokens.colors.danger,
    borderWidth: 2,
    borderColor: tokens.colors.surface
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900"
  },
  heroCard: {
    minHeight: 126,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: withAlpha(tokens.colors.primaryStrong, 0.16),
    flexDirection: "row",
    alignItems: "stretch",
    padding: 13,
    gap: 10
  },
  heroGlowOne: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: withAlpha(tokens.colors.primaryStrong, 0.08)
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: -100,
    left: -70,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: withAlpha(tokens.colors.success, 0.06)
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    zIndex: 1
  },
  heroEyebrow: {
    color: tokens.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  heroName: {
    color: tokens.colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 28
  },
  heroWave: {
    fontSize: 18
  },
  heroText: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  heroMeta: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  heroMetaDot: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: "900"
  },
  heroDebtRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 6
  },
  heroDebtLabel: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  heroDebtValue: {
    color: tokens.colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  heroAvatarColumn: {
    width: 94,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  heroRing: {
    width: 76,
    height: 76,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: withAlpha(tokens.colors.primaryStrong, 0.18),
    backgroundColor: withAlpha(tokens.colors.surface, 0.72)
  },
  heroRolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: tokens.colors.primaryStrong
  },
  heroRoleText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800"
  },
  mobileFilterBar: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  filterControls: {
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface
  },
  filterControlsCompact: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent"
  },
  filterControlRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
  },
  filterControlGroup: { gap: 7 },
  filterLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  filterLabel: { color: tokens.colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  filterTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterRangeBadge: { minWidth: 118, gap: 5, alignItems: "flex-start" },
  filterRangeLabel: { color: tokens.colors.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2
  },
  sectionSubtitle: {
    color: tokens.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2
  },
  sectionMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metricWrap: {
    width: "48%"
  },
  metricWrapWide: {
    width: "23.5%"
  },
  metricCard: {
    minHeight: 104,
    padding: 11,
    borderRadius: 14,
    gap: 5
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  metricAccent: {
    width: 42,
    height: 4,
    borderRadius: 999,
    opacity: 0.9
  },
  metricLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  metricValue: {
    color: tokens.colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
    lineHeight: 24
  },
  metricHint: {
    color: tokens.colors.textSecondary,
    fontSize: 10,
    lineHeight: 14
  },
  chartCard: {
    gap: 9,
    borderRadius: 14
  },
  chartSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12
  },
  chartValue: {
    color: tokens.colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5
  },
  chartCaption: {
    color: tokens.colors.textSecondary,
    fontSize: 11,
    marginTop: 2
  },
  chartFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  infoPill: {
    flexGrow: 1,
    minWidth: "31%",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 3
  },
  infoPillLabel: {
    color: tokens.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  infoPillValue: {
    fontSize: 13,
    fontWeight: "800"
  },
  chartShell: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch"
  },
  chartYAxis: {
    width: 42,
    justifyContent: "space-between",
    paddingVertical: 12
  },
  chartYAxisLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  chartCanvas: {
    flex: 1,
    gap: 10
  },
  chartArea: {
    height: 152,
    borderRadius: 12,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden"
  },
  chartGridLine: {
    position: "absolute",
    left: 12,
    right: 12,
    top: "50%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(tokens.colors.textMuted, 0.18)
  },
  chartSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 999
  },
  chartPoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2
  },
  chartLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 8
  },
  chartLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  quickCard: {
    gap: 9,
    borderRadius: 14
  },
  productsCard: {
    gap: 9,
    borderRadius: 14
  },
  viewAllText: {
    color: tokens.colors.primaryStrong,
    fontSize: 14,
    fontWeight: "800"
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10
  },
  actionTile: {
    width: "18%",
    minWidth: 68,
    flexGrow: 1,
    alignItems: "center",
    gap: 8
  },
  actionTilePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }]
  },
  actionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: withAlpha(tokens.colors.primaryStrong, 0.12)
  },
  actionLabel: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border
  },
  productName: {
    color: tokens.colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  productMeta: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  productValue: {
    color: tokens.colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  emptyCopy: {
    color: tokens.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19
  },
  statusCard: {
    gap: 9,
    borderRadius: 14
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  ringShell: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center"
  },
  ring: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 999,
    borderWidth: 11,
    borderTopColor: tokens.colors.success,
    borderRightColor: tokens.colors.primary,
    borderBottomColor: tokens.colors.warning,
    borderLeftColor: tokens.colors.danger,
    backgroundColor: tokens.colors.surface
  },
  ringCenter: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border
  },
  ringTotal: {
    color: tokens.colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  ringLabel: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  statusRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  statusLabel: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  statusValue: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  statusPercent: {
    color: tokens.colors.textSecondary,
    fontWeight: "700"
  },
  statusArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border
  }
});
