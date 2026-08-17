import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { ProductDetailScreen } from "@/screens/ProductDetailScreen";
import { BrandsScreen } from "@/screens/BrandsScreen";
import { ExpensesScreen } from "@/screens/ExpensesScreen";
import { FinanceScreen } from "@/screens/FinanceScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { SuppliersScreen } from "@/screens/SuppliersScreen";
import { PurchaseOrdersScreen } from "@/screens/PurchaseOrdersScreen";
import { StockTransfersScreen } from "@/screens/StockTransfersScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TeamAccessScreen } from "@/screens/TeamAccessScreen";
import { EmployeesScreen } from "@/screens/EmployeesScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { RoleLaunchpadScreen } from "@/screens/RoleLaunchpadScreen";
import { AdaptiveWorkspaceNavigator } from "@/navigation/WorkspaceNavigator";

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
    </NavigationContainer>
  );
}
