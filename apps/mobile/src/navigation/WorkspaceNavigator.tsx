import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator } from "react-native";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Badge, Card } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { getEffectivePermissions } from "@shared";

const DashboardScreen = React.lazy(() => import("@/screens/DashboardScreen").then((module) => ({ default: module.DashboardScreen })));
const PosScreen = React.lazy(() => import("@/screens/PosScreen").then((module) => ({ default: module.PosScreen })));
const ProductsScreen = React.lazy(() => import("@/screens/ProductsScreen").then((module) => ({ default: module.ProductsScreen })));
const CustomersScreen = React.lazy(() => import("@/screens/CustomersScreen").then((module) => ({ default: module.CustomersScreen })));
const EmployeesScreen = React.lazy(() => import("@/screens/EmployeesScreen").then((module) => ({ default: module.EmployeesScreen })));
const AnalyticsScreen = React.lazy(() => import("@/screens/AnalyticsScreen").then((module) => ({ default: module.AnalyticsScreen })));
const ReportsScreen = React.lazy(() => import("@/screens/ReportsScreen").then((module) => ({ default: module.ReportsScreen })));
const ExpensesScreen = React.lazy(() => import("@/screens/ExpensesScreen").then((module) => ({ default: module.ExpensesScreen })));
const FinanceScreen = React.lazy(() => import("@/screens/FinanceScreen").then((module) => ({ default: module.FinanceScreen })));
const SettingsScreen = React.lazy(() => import("@/screens/SettingsScreen").then((module) => ({ default: module.SettingsScreen })));
const RoleLaunchpadScreen = React.lazy(() => import("@/screens/RoleLaunchpadScreen").then((module) => ({ default: module.RoleLaunchpadScreen })));

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
  More: undefined;
};

const WorkspaceTabs = createBottomTabNavigator<WorkspaceTabParamList>();

const MOBILE_PRIMARY_ROUTES: Array<keyof WorkspaceTabParamList> = ["Dashboard", "POS", "Catalog", "Finance", "Customers", "More"];
const DESKTOP_SIDEBAR_ROUTES: Array<keyof WorkspaceTabParamList> = [
  "Dashboard",
  "POS",
  "Catalog",
  "Customers",
  "Employees",
  "Reports",
  "Finance",
  "Insights",
  "Settings"
];

export function AdaptiveWorkspaceNavigator() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  return (
    <React.Suspense fallback={<WorkspaceFallback />}>
      <WorkspaceTabs.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: tokens.colors.surface,
            borderTopColor: tokens.colors.border
          },
          tabBarActiveTintColor: tokens.colors.primaryStrong,
          tabBarInactiveTintColor: tokens.colors.textMuted
        }}
        tabBar={(props) => <AdaptiveTabBar {...props} isDesktop={isDesktop} />}
        sceneContainerStyle={{
          backgroundColor: tokens.colors.background,
          paddingLeft: isDesktop ? 304 : 0
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
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: "Settings",
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />
          }}
        />
        <WorkspaceTabs.Screen
          name="More"
          component={RoleLaunchpadScreen}
          options={{
            tabBarLabel: "More",
            tabBarIcon: ({ color, size }) => <Ionicons name="apps-outline" color={color} size={size} />
          }}
        />
      </WorkspaceTabs.Navigator>
    </React.Suspense>
  );
}

function AdaptiveTabBar({ state, descriptors, navigation, isDesktop }: BottomTabBarProps & { isDesktop: boolean }) {
  const insets = useSafeAreaInsets();
  const business = useAppStore((store) => store.business);
  const user = useAppStore((store) => store.user);
  const pendingSync = useAppStore((store) => store.pendingSync);
  const syncProgress = useAppStore((store) => store.syncProgress);
  const permissions = React.useMemo(() => getEffectivePermissions(user), [user]);
  const visibleRoutes = isDesktop ? DESKTOP_SIDEBAR_ROUTES : MOBILE_PRIMARY_ROUTES;

  return (
    <View
      style={[
        isDesktop
          ? {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 304,
              backgroundColor: tokens.colors.surface,
              borderRightWidth: 1,
              borderRightColor: tokens.colors.border,
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 14,
              paddingHorizontal: 14
            }
          : {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 10),
              paddingHorizontal: 10,
              borderTopWidth: 1,
              borderTopColor: tokens.colors.border,
              backgroundColor: tokens.colors.surface
            }
      ]}
    >
      {isDesktop ? (
        <View style={{ gap: 14, flex: 1 }}>
          <LinearGradient colors={tokens.gradients.premium} style={{ borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, borderColor: tokens.colors.border }}>
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
                  {business?.name ?? "Biz Pro"}
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
              <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: tokens.colors.border }}>
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
            {visibleRoutes.map((routeName) => renderWorkspaceItem({ routeName, state, descriptors, navigation, isDesktop }))}
          </View>

          <Card style={{ gap: 8, padding: 12 }}>
            <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>Navigation</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Use the sidebar to switch between the main work areas without losing your place.
            </Text>
          </Card>
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
            {visibleRoutes.map((routeName) => renderWorkspaceItem({ routeName, state, descriptors, navigation, isDesktop }))}
          </View>
        </View>
      )}
    </View>
  );
}

function renderWorkspaceItem({
  routeName,
  state,
  descriptors,
  navigation,
  isDesktop
}: {
  routeName: keyof WorkspaceTabParamList;
  state: BottomTabBarProps["state"];
  descriptors: BottomTabBarProps["descriptors"];
  navigation: BottomTabBarProps["navigation"];
  isDesktop: boolean;
}) {
  const focused = state.routes[state.index]?.name === routeName;
  const options = descriptors[routeName]?.options;
  const label = typeof options?.tabBarLabel === "string" ? options.tabBarLabel : routeName;
  const icon = options?.tabBarIcon?.({
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
        const event = navigation.emit({ type: "tabPress", target: routeName, canPreventDefault: true });
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
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderRadius: 18,
              backgroundColor: focused ? "rgba(37, 99, 235, 0.14)" : "transparent",
              borderWidth: 1,
              borderColor: focused ? tokens.colors.primaryStrong : "transparent"
            }
          : {
              flex: 1,
              minHeight: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              backgroundColor: focused ? "rgba(37, 99, 235, 0.12)" : "transparent"
            },
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }
      ]}
    >
      {icon}
      {isDesktop ? (
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: focused ? tokens.colors.text : tokens.colors.textSecondary, fontSize: 14, fontWeight: "800" }}>{label}</Text>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{routeDescription(routeName)}</Text>
        </View>
      ) : (
        <Text style={{ color: focused ? tokens.colors.primaryStrong : tokens.colors.textSecondary, fontSize: 10, fontWeight: "800", marginTop: 4 }}>{label}</Text>
      )}
    </Pressable>
  );
}

function routeDescription(routeName: keyof WorkspaceTabParamList) {
  switch (routeName) {
    case "Dashboard":
      return "Overview";
    case "POS":
      return "Record sales";
    case "Catalog":
      return "Products and stock";
    case "Customers":
      return "Balances and payments";
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
      return "Workspace hub";
  }
}

function WorkspaceFallback() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.background }}>
      <ActivityIndicator color={tokens.colors.primaryStrong} />
    </View>
  );
}
