import React, { useEffect } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, GradientHeader, PrimaryButton, Screen, StatCard } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { useNavigation } from "@react-navigation/native";

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const dashboard = useAppStore((state) => state.dashboard);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const refreshPendingSync = useAppStore((state) => state.refreshPendingSync);
  const syncNow = useAppStore((state) => state.syncNow);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
    refreshPendingSync().catch(() => undefined);
  }, [loadDashboard, refreshPendingSync]);

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
          <Text style={{ color: tokens.colors.textSecondary }}>Offline-first queue is ready. Mutations are stored locally and pushed in the background.</Text>
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
              ["New Sale", () => navigation.navigate("POS")],
              ["Add Product", () => navigation.navigate("Catalog")],
              ["Add Stock", () => navigation.navigate("Catalog")],
              ["Add Customer", () => navigation.navigate("Customers")],
              ["Add Expense", () => navigation.navigate("Expenses")],
              ["View Reports", () => navigation.navigate("Reports")],
              ["Settings", () => navigation.navigate("Settings")]
            ].map(([label, handler]) => (
              <View key={label as string} style={{ width: "48%" }}>
                <PrimaryButton title={label as string} variant="secondary" onPress={handler as () => void} />
              </View>
            ))}
          </View>
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Top products</Text>
          {(dashboard?.topProducts ?? []).slice(0, 5).map((item) => (
            <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.colors.textSecondary }}>{item.productName}</Text>
              <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{item.quantity}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
