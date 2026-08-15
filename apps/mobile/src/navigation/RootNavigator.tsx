import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";

const ProductDetailScreen = React.lazy(() => import("@/screens/ProductDetailScreen").then((module) => ({ default: module.ProductDetailScreen })));
const BrandsScreen = React.lazy(() => import("@/screens/BrandsScreen").then((module) => ({ default: module.BrandsScreen })));
const ExpensesScreen = React.lazy(() => import("@/screens/ExpensesScreen").then((module) => ({ default: module.ExpensesScreen })));
const FinanceScreen = React.lazy(() => import("@/screens/FinanceScreen").then((module) => ({ default: module.FinanceScreen })));
const ReportsScreen = React.lazy(() => import("@/screens/ReportsScreen").then((module) => ({ default: module.ReportsScreen })));
const SuppliersScreen = React.lazy(() => import("@/screens/SuppliersScreen").then((module) => ({ default: module.SuppliersScreen })));
const PurchaseOrdersScreen = React.lazy(() => import("@/screens/PurchaseOrdersScreen").then((module) => ({ default: module.PurchaseOrdersScreen })));
const StockTransfersScreen = React.lazy(() => import("@/screens/StockTransfersScreen").then((module) => ({ default: module.StockTransfersScreen })));
const SettingsScreen = React.lazy(() => import("@/screens/SettingsScreen").then((module) => ({ default: module.SettingsScreen })));
const TeamAccessScreen = React.lazy(() => import("@/screens/TeamAccessScreen").then((module) => ({ default: module.TeamAccessScreen })));
const EmployeesScreen = React.lazy(() => import("@/screens/EmployeesScreen").then((module) => ({ default: module.EmployeesScreen })));
const LoginScreen = React.lazy(() => import("@/screens/LoginScreen").then((module) => ({ default: module.LoginScreen })));
const OnboardingScreen = React.lazy(() => import("@/screens/OnboardingScreen").then((module) => ({ default: module.OnboardingScreen })));
const RoleLaunchpadScreen = React.lazy(() => import("@/screens/RoleLaunchpadScreen").then((module) => ({ default: module.RoleLaunchpadScreen })));
const AdaptiveWorkspaceNavigator = React.lazy(() => import("@/navigation/WorkspaceNavigator").then((module) => ({ default: module.AdaptiveWorkspaceNavigator })));

type RootStackParamList = {
  Launchpad: undefined;
  Main: undefined;
  Expenses: undefined;
  Finance: undefined;
  Reports: undefined;
  Settings: undefined;
  Brands: undefined;
  Suppliers: undefined;
  PurchaseOrders: undefined;
  StockTransfers: undefined;
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
function AuthNavigator() {
  const business = useAppStore((state) => state.business);
  const initialRouteName = business ? "Login" : "Onboarding";
  return (
    <React.Suspense fallback={<NavigatorFallback />}>
      <AuthStack.Navigator key={initialRouteName} initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
        <AuthStack.Screen name="Login" component={LoginScreen} />
      </AuthStack.Navigator>
    </React.Suspense>
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
      <React.Suspense fallback={<NavigatorFallback />}>
        {business && user ? (
          <RootStack.Navigator
            initialRouteName="Launchpad"
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right"
            }}
          >
            <RootStack.Screen name="Launchpad" component={RoleLaunchpadScreen} />
            <RootStack.Screen name="Main" component={AdaptiveWorkspaceNavigator} />
            <RootStack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <RootStack.Screen name="Brands" component={BrandsScreen} />
            <RootStack.Screen name="Suppliers" component={SuppliersScreen} />
            <RootStack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} />
            <RootStack.Screen name="StockTransfers" component={StockTransfersScreen} />
            <RootStack.Screen name="Expenses" component={ExpensesScreen} />
            <RootStack.Screen name="Finance" component={FinanceScreen} />
            <RootStack.Screen name="Reports" component={ReportsScreen} />
            <RootStack.Screen name="Settings" component={SettingsScreen} />
            <RootStack.Screen name="TeamAccess" component={TeamAccessScreen} />
            <RootStack.Screen name="Employees" component={EmployeesScreen} />
          </RootStack.Navigator>
        ) : (
          <AuthNavigator />
        )}
      </React.Suspense>
    </NavigationContainer>
  );
}

function NavigatorFallback() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.background }}>
      <ActivityIndicator color={tokens.colors.primaryStrong} />
    </View>
  );
}
