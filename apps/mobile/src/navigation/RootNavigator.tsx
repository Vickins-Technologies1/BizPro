import React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
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
import { LoginScreen } from "@/screens/LoginScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";

type RootStackParamList = {
  Main: undefined;
  Expenses: undefined;
  Reports: undefined;
  Settings: undefined;
  ProductDetail: { productId: string };
};

type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator();

function TabNavigator() {
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
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: "grid-outline",
            POS: "scan-outline",
            Catalog: "cube-outline",
            Customers: "people-outline",
            Insights: "bar-chart-outline"
          };
          return <Ionicons name={map[route.name] ?? "ellipse-outline"} color={color} size={size} />;
        }
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="POS" component={PosScreen} />
      <Tabs.Screen name="Catalog" component={ProductsScreen} />
      <Tabs.Screen name="Customers" component={CustomersScreen} />
      <Tabs.Screen name="Insights" component={ReportsScreen} />
    </Tabs.Navigator>
  );
}

function AuthNavigator() {
  const business = useAppStore((state) => state.business);
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      {business ? <AuthStack.Screen name="Login" component={LoginScreen} /> : <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />}
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);

  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: tokens.colors.background,
          card: tokens.colors.surface,
          border: tokens.colors.border,
          text: tokens.colors.text,
          primary: tokens.colors.primaryStrong,
          notification: tokens.colors.warning
        }
      }}
    >
      {business && user ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Main" component={TabNavigator} />
          <RootStack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <RootStack.Screen name="Expenses" component={ExpensesScreen} />
          <RootStack.Screen name="Reports" component={ReportsScreen} />
          <RootStack.Screen name="Settings" component={SettingsScreen} />
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
