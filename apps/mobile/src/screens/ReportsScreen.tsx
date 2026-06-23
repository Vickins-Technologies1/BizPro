import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Card, GradientHeader, Screen, StatCard } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

export function ReportsScreen() {
  const navigation = useNavigation<any>();
  const dashboard = useAppStore((state) => state.dashboard);
  const business = useAppStore((state) => state.business);
  const loadDashboard = useAppStore((state) => state.loadDashboard);

  React.useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [loadDashboard]);

  return (
    <Screen>
      <GradientHeader
        title="Reports"
        subtitle="Daily performance, top movers, and margins"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <StatCard label="Sales" value={formatMoney(dashboard?.salesTotal ?? 0, business?.currency)} icon="cash-outline" tone="primary" />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Profit" value={formatMoney(dashboard?.estimatedProfit ?? 0, business?.currency)} icon="analytics-outline" tone="success" />
          </View>
        </View>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Payment breakdown</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>The API will expose detailed aggregated payment splits. This MVP is already structured for it.</Text>
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Top products</Text>
          {(dashboard?.topProducts ?? []).map((item) => (
            <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.colors.textSecondary }}>{item.productName}</Text>
              <Text style={{ color: tokens.colors.text }}>{item.quantity}</Text>
            </View>
          ))}
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Low stock</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Low stock count: {dashboard?.lowStockCount ?? 0}</Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
