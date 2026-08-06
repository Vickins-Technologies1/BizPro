import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { PosScreen } from "@/screens/PosScreen";
import { ProductsScreen } from "@/screens/ProductsScreen";
import { ProductDetailScreen } from "@/screens/ProductDetailScreen";
import { CustomersScreen } from "@/screens/CustomersScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { ExpensesScreen } from "@/screens/ExpensesScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TeamAccessScreen } from "@/screens/TeamAccessScreen";
import { EmployeesScreen } from "@/screens/EmployeesScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { RoleLaunchpadScreen } from "@/screens/RoleLaunchpadScreen";
import { hasPermission, type AccessPermission } from "@shared";

type RootStackParamList = {
  Launchpad: undefined;
  Main: undefined;
  Expenses: undefined;
  Reports: undefined;
  Settings: undefined;
  TeamAccess: undefined;
  Employees: undefined;
  ProductDetail: { productId: string };
};

type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator();

type TabItem = {
  name: string;
  component: React.ComponentType<any>;
  icon: keyof typeof Ionicons.glyphMap;
  permission: AccessPermission;
};

function TabNavigator() {
  const user = useAppStore((state) => state.user);
  const tabs = React.useMemo(
    () =>
      [
        { name: "Dashboard", component: DashboardScreen, icon: "grid-outline", permission: "viewDashboard" as AccessPermission },
        { name: "POS", component: PosScreen, icon: "scan-outline", permission: "createSales" as AccessPermission },
        { name: "Catalog", component: ProductsScreen, icon: "cube-outline", permission: "manageInventory" as AccessPermission },
        { name: "Customers", component: CustomersScreen, icon: "people-outline", permission: "manageCustomers" as AccessPermission },
        { name: "Insights", component: ReportsScreen, icon: "bar-chart-outline", permission: "viewReports" as AccessPermission }
      ] as TabItem[],
    []
  ).filter((tab) => hasPermission(user, tab.permission));
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: tokens.colors.surface,
          borderTopColor: tokens.colors.border
        },
        tabBarActiveTintColor: tokens.colors.primaryStrong,
        tabBarInactiveTintColor: tokens.colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const current = tabs.find((tab) => tab.name === route.name);
          return <Ionicons name={current?.icon ?? "ellipse-outline"} color={color} size={size} />;
        }
      })}
    >
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name as any} component={tab.component as any} />
      ))}
    </Tabs.Navigator>
  );
}

function AuthNavigator() {
  const business = useAppStore((state) => state.business);
  const initialRouteName = business ? "Login" : "Onboarding";
  return (
    <AuthStack.Navigator key={initialRouteName} initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const themeMode = useAppStore((state) => state.themeMode);
  const navigationTheme = React.useMemo(
    () => ({
      ...(themeMode === "dark" ? DarkTheme : DefaultTheme),
      colors: {
        ...(themeMode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
        background: tokens.colors.background,
        card: tokens.colors.surface,
        border: tokens.colors.border,
        text: tokens.colors.text,
        primary: tokens.colors.primaryStrong,
        notification: tokens.colors.warning
      }
    }),
    [themeMode]
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      {business && user ? (
        <RootStack.Navigator initialRouteName="Launchpad" screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Launchpad" component={RoleLaunchpadScreen} />
          <RootStack.Screen name="Main" component={TabNavigator} />
          <RootStack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <RootStack.Screen name="Expenses" component={ExpensesScreen} />
          <RootStack.Screen name="Reports" component={ReportsScreen} />
          <RootStack.Screen name="Settings" component={SettingsScreen} />
          <RootStack.Screen name="TeamAccess" component={TeamAccessScreen} />
          <RootStack.Screen name="Employees" component={EmployeesScreen} />
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
