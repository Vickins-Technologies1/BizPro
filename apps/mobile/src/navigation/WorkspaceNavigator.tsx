import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { Badge, Card } from "@/components/Primitives";
import { MoreDrawer } from "@/components/MoreDrawer";
import { MoreDrawerProvider } from "@/navigation/moreDrawerContext";
import { tokens } from "@/theme/tokens";
import { useThemeTokens } from "@/theme";
import { useAppStore } from "@/store/useAppStore";
import { getEffectivePermissions, resolveBusinessTypeConfig, type WorkspaceRoute } from "@shared";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { PosScreen } from "@/screens/PosScreen";
import { ProductsScreen } from "@/screens/ProductsScreen";
import { CustomersScreen } from "@/screens/CustomersScreen";
import { EmployeesScreen } from "@/screens/EmployeesScreen";
import { AnalyticsScreen } from "@/screens/AnalyticsScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { ExpensesScreen } from "@/screens/ExpensesScreen";
import { FinanceScreen } from "@/screens/FinanceScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { BusinessOperationsScreen } from "@/screens/BusinessOperationsScreen";

type WorkspaceTabParamList = {
  Dashboard: undefined;
  POS: undefined;
  Catalog: undefined;
  Customers: undefined;
  Employees: undefined;
  Reports: undefined;
  Finance: undefined;
  Insights: undefined;
  Settings: undefined;
  Operations: undefined;
};

const WorkspaceTabs = createBottomTabNavigator<WorkspaceTabParamList>();
type WorkspaceNavItem = WorkspaceRoute;

export function AdaptiveWorkspaceNavigator() {
  useThemeTokens();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const navigation = useNavigation<any>();
  const currentRoute = useNavigationState((state) => state.routes[state.index]?.name);
  const [moreOpen, setMoreOpen] = React.useState(false);

  return (
    <MoreDrawerProvider openMore={() => setMoreOpen(true)}>
      <>
      <WorkspaceTabs.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: "transparent",
            borderTopWidth: 0,
            elevation: 0
          },
          tabBarActiveTintColor: tokens.colors.primaryStrong,
          tabBarInactiveTintColor: tokens.colors.textMuted
        }}
        tabBar={(props) => <AdaptiveTabBar {...props} isDesktop={isDesktop} onMorePress={() => setMoreOpen(true)} />}
        sceneContainerStyle={{
          backgroundColor: tokens.colors.background,
          paddingLeft: isDesktop ? 288 : 0
        }}
      >
      <WorkspaceTabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="POS"
        component={PosScreen}
        options={{
          tabBarLabel: "Sales",
          tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Catalog"
        component={ProductsScreen}
        options={{
          tabBarLabel: "Inventory",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          tabBarLabel: "Customers",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Employees"
        component={EmployeesScreen}
        options={{
          tabBarLabel: "Employees",
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: "Reports",
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Finance"
        component={FinanceScreen}
        options={{
          tabBarLabel: "Finance",
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Insights"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: "Insights",
          tabBarIcon: ({ color, size }) => <Ionicons name="analytics-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Operations"
        component={BusinessOperationsScreen}
        options={{
          tabBarLabel: "Operations",
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" color={color} size={size} />
        }}
      />
      <WorkspaceTabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />
        }}
      />
      </WorkspaceTabs.Navigator>
      <MoreDrawer
        visible={moreOpen}
        currentRoute={currentRoute}
        onClose={() => setMoreOpen(false)}
        onNavigate={(routeName) => navigation.navigate(routeName)}
      />
      </>
    </MoreDrawerProvider>
  );
}

function AdaptiveTabBar({ state, descriptors, navigation, isDesktop, onMorePress }: BottomTabBarProps & { isDesktop: boolean; onMorePress: () => void }) {
  useThemeTokens();
  const insets = useSafeAreaInsets();
  const business = useAppStore((store) => store.business);
  const user = useAppStore((store) => store.user);
  const pendingSync = useAppStore((store) => store.pendingSync);
  const syncProgress = useAppStore((store) => store.syncProgress);
  const themeMode = useAppStore((store) => store.themeMode);
  const setThemeMode = useAppStore((store) => store.setThemeMode);
  const permissions = React.useMemo(() => getEffectivePermissions(user), [user]);
  const businessConfig = React.useMemo(
    () => resolveBusinessTypeConfig({ businessType: business?.businessType, industryKey: business?.industryKey }),
    [business?.businessType, business?.industryKey]
  );
  const configuredRoutes = isDesktop ? businessConfig.navigation.sidebarRoutes : businessConfig.navigation.primaryRoutes;
  const visibleRoutes = configuredRoutes.filter((routeName) => {
    if (routeName === "Catalog") return businessConfig.capabilities.catalog;
    if (routeName === "Customers") return businessConfig.capabilities.customers;
    if (routeName === "Operations") return businessConfig.capabilities.orders || businessConfig.capabilities.appointments || businessConfig.capabilities.workOrders;
    if (routeName === "Finance") return businessConfig.capabilities.payments;
    return true;
  });

  return (
    <View
      style={[
        isDesktop
            ? {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 288,
              backgroundColor: tokens.colors.surface,
              borderRightWidth: 1,
              borderRightColor: tokens.colors.border,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
              paddingHorizontal: 12
            }
        : {
              marginHorizontal: 10,
              marginBottom: Math.max(insets.bottom, 4),
              marginTop: 2,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,
              paddingTop: 2,
              paddingBottom: Math.max(insets.bottom, 4),
              paddingHorizontal: 0,
              backgroundColor: "transparent"
            }
      ]}
    >
      {isDesktop ? (
        <View style={{ gap: 12, flex: 1 }}>
          <LinearGradient colors={tokens.gradients.premium} style={{ borderRadius: 22, padding: 14, gap: 8, borderWidth: 1, borderColor: tokens.colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colors.surface,
                  borderWidth: 1,
                  borderColor: tokens.colors.border
                }}
              >
                <Text style={{ color: tokens.colors.text, fontWeight: "900", fontSize: 18 }}>B</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "900" }} numberOfLines={1}>
                  {business?.name ?? "Dira OS"}
                </Text>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {user?.roleLabel ?? "Workspace"} • {permissions.length} permissions
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Badge label={pendingSync ? `${pendingSync} pending sync` : "Synced"} tone={pendingSync ? "warning" : "success"} />
            </View>
            {syncProgress ? (
              <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: tokens.colors.surfaceElevated, borderWidth: 1, borderColor: tokens.colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>Syncing</Text>
                  <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
                    {syncProgress.completed}/{syncProgress.total}
                  </Text>
                </View>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                  {syncProgress.currentLabel ?? "Processing queued actions"}
                </Text>
                <View style={{ height: 7, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
                  <View
                    style={{
                      width: `${Math.max(8, Math.min(100, Math.round((syncProgress.completed / Math.max(syncProgress.total, 1)) * 100)))}%`,
                      height: "100%",
                      borderRadius: 999,
                      backgroundColor: tokens.colors.primaryStrong
                    }}
                  />
                </View>
              </View>
            ) : null}
          </LinearGradient>

          <View style={{ gap: 8, flex: 1 }}>
            {visibleRoutes.map((routeName) => renderWorkspaceItem({ routeName, state, descriptors, navigation, isDesktop, onMorePress, businessConfig }))}
          </View>

          <Card style={{ gap: 8, padding: 12 }}>
            <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>Navigation</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Use the sidebar to switch between the main work areas without losing your place.
            </Text>
          </Card>
          <SidebarThemeToggle themeMode={themeMode} onToggle={() => void setThemeMode(themeMode === "dark" ? "light" : "dark")} />
        </View>
          ) : (
            <View style={{ flex: 1, gap: 8 }}>
              {syncProgress ? (
                <View style={{ gap: 6, paddingHorizontal: 12, paddingTop: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 }}>Syncing</Text>
                <Text style={{ color: tokens.colors.textMuted, fontSize: 11 }}>
                  {syncProgress.completed}/{syncProgress.total}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${Math.max(8, Math.min(100, Math.round((syncProgress.completed / Math.max(syncProgress.total, 1)) * 100)))}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: tokens.colors.primaryStrong
                  }}
                />
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              {visibleRoutes.map((routeName) => renderWorkspaceItem({ routeName, state, descriptors, navigation, isDesktop, onMorePress, businessConfig }))}
          </View>
        </View>
      )}
    </View>
  );
}

function SidebarThemeToggle({ themeMode, onToggle }: { themeMode: "light" | "dark"; onToggle: () => void }) {
  const theme = useThemeTokens();
  const progress = React.useRef(new Animated.Value(themeMode === "dark" ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: themeMode === "dark" ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [progress, themeMode]);

  const knobTranslate = progress.interpolate({ inputRange: [0, 1], outputRange: [2, 108] });
  const isDark = themeMode === "dark";

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel="Toggle light and dark theme"
      style={({ pressed }) => ({
        minHeight: 66,
        borderRadius: 16,
        padding: 5,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }]
      })}
    >
      <View style={{ flex: 1, borderRadius: 12, overflow: "hidden", justifyContent: "center" }}>
        <LinearGradient
          colors={isDark ? ["#172A45", "#0D1728"] : ["#EEF5FF", "#F7FAFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 2,
            bottom: 2,
            width: 108,
            borderRadius: 13,
            backgroundColor: isDark ? theme.colors.surfaceElevated : theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.primaryStrong,
            shadowColor: isDark ? "#000" : theme.colors.primaryStrong,
            shadowOpacity: isDark ? 0.24 : 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
            transform: [{ translateX: knobTranslate }]
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 4 }} pointerEvents="none">
          <View style={{ width: 108, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Ionicons name="sunny-outline" size={16} color={isDark ? theme.colors.textMuted : theme.colors.primaryStrong} />
            <Text style={{ color: isDark ? theme.colors.textMuted : theme.colors.text, fontSize: 12, fontWeight: "900" }}>Light</Text>
          </View>
          <View style={{ width: 108, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Ionicons name="moon-outline" size={15} color={isDark ? theme.colors.primaryStrong : theme.colors.textMuted} />
            <Text style={{ color: isDark ? theme.colors.text : theme.colors.textMuted, fontSize: 12, fontWeight: "900" }}>Dark</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function renderWorkspaceItem({
  routeName,
  state,
  descriptors,
  navigation,
  isDesktop,
  onMorePress,
  businessConfig
}: {
  routeName: WorkspaceNavItem;
  state: BottomTabBarProps["state"];
  descriptors: BottomTabBarProps["descriptors"];
  navigation: BottomTabBarProps["navigation"];
  isDesktop: boolean;
  onMorePress: () => void;
  businessConfig: ReturnType<typeof resolveBusinessTypeConfig>;
}) {
  const route = state.routes.find((candidate) => candidate.name === routeName);
  const currentRouteName = state.routes[state.index]?.name as keyof WorkspaceTabParamList | undefined;
  const focused = currentRouteName === routeName;
  const options = route ? descriptors[route.key]?.options : undefined;
  const label = routeName === "More"
    ? "More"
    : routeName === "Catalog"
      ? businessConfig.navigation.catalogLabel
      : routeName === "POS"
        ? businessConfig.navigation.posLabel
        : routeName === "Customers"
          ? businessConfig.navigation.customersLabel
          : routeName === "Operations"
            ? businessConfig.capabilities.appointments ? "Appointments" : businessConfig.capabilities.workOrders ? "Jobs" : "Orders"
            : typeof options?.tabBarLabel === "string" ? options.tabBarLabel : routeName;
  const icon = routeName === "More" ? (
    <Ionicons name="apps-outline" color={tokens.colors.textMuted} size={isDesktop ? 22 : 20} />
  ) : options?.tabBarIcon?.({
    focused,
    color: focused ? tokens.colors.primaryStrong : tokens.colors.textMuted,
    size: isDesktop ? 22 : 20
  });

  return (
    <Pressable
      key={routeName}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={() => {
        if (routeName === "More") {
          onMorePress();
          return;
        }
        const event = navigation.emit({ type: "tabPress", target: route?.key ?? routeName, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) {
          navigation.navigate(routeName);
        }
      }}
      style={({ pressed }) => [
        isDesktop
          ? {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: focused ? `${tokens.colors.primary}22` : "transparent",
              borderWidth: 1,
              borderColor: focused ? tokens.colors.primaryStrong : "transparent"
            }
          : {
              flex: 1,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0,
              borderBottomWidth: focused ? 2 : 0,
              borderBottomColor: tokens.colors.primaryStrong,
              backgroundColor: "transparent"
            },
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }
      ]}
    >
      {icon}
      {isDesktop ? (
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: focused ? tokens.colors.text : tokens.colors.textSecondary, fontSize: 14, fontWeight: "800" }}>{label}</Text>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{routeDescription(routeName, businessConfig)}</Text>
        </View>
        ) : (
        <Text style={{ color: focused ? tokens.colors.primaryStrong : tokens.colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.25, marginTop: 2 }}>{label}</Text>
      )}
    </Pressable>
  );
}

function routeDescription(routeName: WorkspaceNavItem, businessConfig: ReturnType<typeof resolveBusinessTypeConfig>) {
  switch (routeName) {
    case "Dashboard":
      return "Overview";
    case "POS":
      return businessConfig.workflow.steps.join("  >  ");
    case "Catalog":
      return businessConfig.navigation.catalogDescription;
    case "Customers":
      return `${businessConfig.terminology.customers} and payments`;
    case "Operations":
      return businessConfig.workflow.headline;
    case "Employees":
      return "Team access";
    case "Reports":
      return "Business reports";
    case "Finance":
      return "Expenses and costs";
    case "Insights":
      return "Trends and margins";
    case "Settings":
      return "Sync and device";
    case "More":
      return "Business tools";
  }
}
