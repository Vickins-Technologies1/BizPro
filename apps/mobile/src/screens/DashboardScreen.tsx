import React, { useEffect } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, EmptyState, GradientHeader, PrimaryButton, Screen, StatCard } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { useNavigation } from "@react-navigation/native";
import { getEffectivePermissions, hasPermission } from "@shared";

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const dashboard = useAppStore((state) => state.dashboard);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const user = useAppStore((state) => state.user);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const refreshPendingSync = useAppStore((state) => state.refreshPendingSync);
  const syncNow = useAppStore((state) => state.syncNow);
  const permissions = getEffectivePermissions(user);
  const canViewDashboard = hasPermission(user, "viewDashboard");

  useEffect(() => {
    loadDashboard().catch(() => undefined);
    refreshPendingSync().catch(() => undefined);
  }, [loadDashboard, refreshPendingSync]);

  if (!canViewDashboard) {
    return (
      <Screen>
        <GradientHeader title={business?.name ?? "Business"} subtitle={`${business?.businessType?.replaceAll("_", " ")} • limited access`} />
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

      if (!dashboard) {
    return (
      <Screen>
        <GradientHeader title={business?.name ?? "Business"} subtitle={`${business?.businessType?.replaceAll("_", " ")} • loading metrics`} />
        <View style={{ padding: 16 }}>
          <EmptyState title="Loading dashboard" subtitle="Pulling in sales, expense, and stock metrics now." icon="speedometer-outline" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title={business?.name ?? "Business"}
        subtitle={`${business?.businessType?.replaceAll("_", " ")} • ${pendingSync} pending sync`}
        right={
          <Pressable onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="settings-outline" size={24} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Sync health</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "800" }}>{pendingSync ? `${pendingSync} events waiting` : "Fully synced"}</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Critical records stay local if the connection drops, then sync automatically as soon as the internet is back.</Text>
          <PrimaryButton title="Sync now" onPress={() => syncNow()} />
        </Card>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <StatCard label="Sales today" value={formatMoney(dashboard?.salesTotal ?? 0, business?.currency)} icon="cash-outline" tone="primary" />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Expenses" value={formatMoney(dashboard?.expensesTotal ?? 0, business?.currency)} icon="trending-down-outline" tone="warning" />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <StatCard label="Estimated profit" value={formatMoney(dashboard?.estimatedProfit ?? 0, business?.currency)} icon="analytics-outline" tone="success" />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Debts" value={formatMoney(dashboard?.debtTotal ?? 0, business?.currency)} icon="person-remove-outline" tone="danger" />
          </View>
        </View>
        <StatCard label="Low stock items" value={`${dashboard?.lowStockCount ?? 0}`} icon="warning-outline" tone="warning" />
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Quick actions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "New sale", permission: "createSales" as const, handler: () => navigation.navigate("POS") },
              { label: "Products", permission: "addProducts" as const, handler: () => navigation.navigate("Catalog") },
              { label: "Stock", permission: "manageInventory" as const, handler: () => navigation.navigate("Catalog") },
              { label: "Customers", permission: "manageCustomers" as const, handler: () => navigation.navigate("Customers") },
              { label: "Expenses", permission: "manageExpenses" as const, handler: () => navigation.navigate("Expenses") },
              { label: "Insights", permission: "viewReports" as const, handler: () => navigation.navigate("Reports") },
              { label: "Employees", permission: "manageEmployees" as const, handler: () => navigation.navigate("Employees") },
              { label: "Settings", permission: "manageSettings" as const, handler: () => navigation.navigate("Settings") }
            ]
              .filter((action) => hasPermission(user, action.permission))
              .map((action) => (
                <View key={action.label} style={{ width: "48%" }}>
                  <PrimaryButton title={action.label} variant="secondary" onPress={action.handler} />
                </View>
              ))}
          </View>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
            {permissions.length} permissions active on this account.
          </Text>
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Top products</Text>
          {(dashboard?.topProducts ?? []).length ? (
            (dashboard?.topProducts ?? []).slice(0, 5).map((item) => (
              <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: tokens.colors.textSecondary }}>{item.productName}</Text>
                <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{item.quantity}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: tokens.colors.textSecondary }}>No product movement yet. Top products will appear after the first few sales.</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
