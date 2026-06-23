import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { allSql } from "@/storage/sqlite";
import { formatDate } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";

type RootStackParamList = {
  Main: undefined;
  Expenses: undefined;
  Reports: undefined;
  Settings: undefined;
  ProductDetail: { productId: string };
};

type Route = RouteProp<RootStackParamList, "ProductDetail">;

type StockMovementRow = {
  id: string;
  referenceType: string;
  referenceId: string;
  quantityDelta: number;
  unitCost: number;
  note?: string | null;
  createdAt: string;
};

type SaleHistoryRow = {
  id: string;
  receiptNumber: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
  paymentStatus: string;
};

export function ProductDetailScreen() {
  const route = useRoute<Route>();
  const product = useAppStore((state) => state.products.find((item) => item.id === route.params.productId) ?? null);
  const business = useAppStore((state) => state.business);
  const adjustStock = useAppStore((state) => state.adjustStock);
  const [stockMovements, setStockMovements] = React.useState<StockMovementRow[]>([]);
  const [salesHistory, setSalesHistory] = React.useState<SaleHistoryRow[]>([]);
  const [restockVisible, setRestockVisible] = React.useState(false);
  const [restockQty, setRestockQty] = React.useState("0");
  const [restockCost, setRestockCost] = React.useState("0");
  const [restockNote, setRestockNote] = React.useState("Quick restock");

  React.useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [route.params.productId]);

  async function loadHistory() {
    const [movementRows, saleRows] = await Promise.all([
      allSql<StockMovementRow>(
        "SELECT id, referenceType, referenceId, quantityDelta, unitCost, note, createdAt FROM stock_movements WHERE productId = ? ORDER BY createdAt DESC LIMIT 24",
        [route.params.productId]
      ),
      allSql<SaleHistoryRow>(
        `SELECT sale_items.id, sales.receiptNumber, sale_items.quantity, sale_items.unitPrice, sale_items.lineTotal, sales.createdAt, sales.paymentStatus
         FROM sale_items
         JOIN sales ON sales.id = sale_items.saleId
         WHERE sale_items.productId = ?
         ORDER BY sales.createdAt DESC
         LIMIT 24`,
        [route.params.productId]
      )
    ]);
    setStockMovements(movementRows);
    setSalesHistory(saleRows);
  }

  if (!product) {
    return (
      <Screen>
        <GradientHeader title="Product details" subtitle="Item not found locally" />
        <View style={{ padding: 16 }}>
          <Card>
            <Text style={{ color: tokens.colors.textSecondary }}>The selected product is not available in the local catalog yet.</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  const lowStock = product.stockOnHand <= product.lowStockThreshold;
  const margin = Math.max(0, product.sellingPrice - product.buyingPrice);

  return (
    <Screen>
      <GradientHeader
        title={product.name}
        subtitle={`${product.sku ?? "No SKU"} • ${product.unit} • ${business?.currency ?? "KES"}`}
        right={<Badge label={product.isActive ? "active" : "archived"} tone={product.isActive ? "success" : "warning"} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{product.name}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>{product.barcode ?? "No barcode"}</Text>
            </View>
            <Badge label={lowStock ? "low stock" : "healthy"} tone={lowStock ? "danger" : "success"} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Stock" value={String(product.stockOnHand)} />
            <Metric label="Low stock" value={String(product.lowStockThreshold)} />
            <Metric label="Margin" value={formatMoney(margin, business?.currency)} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Buying" value={formatMoney(product.buyingPrice, business?.currency)} />
            <Metric label="Selling" value={formatMoney(product.sellingPrice, business?.currency)} />
          </View>
          <PrimaryButton title="Quick restock" onPress={() => setRestockVisible(true)} />
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Stock history</Text>
          {stockMovements.length ? (
            stockMovements.map((movement) => (
              <View key={movement.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{movement.referenceType}</Text>
                  <Text style={{ color: movement.quantityDelta < 0 ? tokens.colors.danger : tokens.colors.success, fontWeight: "800" }}>
                    {movement.quantityDelta > 0 ? "+" : ""}
                    {movement.quantityDelta}
                  </Text>
                </View>
                <Text style={{ color: tokens.colors.textSecondary }}>{movement.note ?? movement.referenceId}</Text>
                <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatDate(movement.createdAt, "PPP")}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: tokens.colors.textSecondary }}>No stock movements yet.</Text>
          )}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Sales history</Text>
          {salesHistory.length ? (
            salesHistory.map((sale) => (
              <View key={sale.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{sale.receiptNumber}</Text>
                  <Badge label={sale.paymentStatus.replaceAll("_", " ")} tone={sale.paymentStatus === "paid" ? "success" : sale.paymentStatus === "unpaid" ? "danger" : "warning"} />
                </View>
                <Text style={{ color: tokens.colors.textSecondary }}>
                  Qty {sale.quantity} • {formatMoney(sale.lineTotal, business?.currency)}
                </Text>
                <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatDate(sale.createdAt, "PPP p")}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: tokens.colors.textSecondary }}>No sales history yet.</Text>
          )}
        </Card>
      </ScrollView>

      <SimpleModal visible={restockVisible} title="Quick restock" onClose={() => setRestockVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Quantity" value={restockQty} onChangeText={setRestockQty} keyboardType="decimal-pad" />
          <InputField label="Unit cost" value={restockCost} onChangeText={setRestockCost} keyboardType="decimal-pad" />
          <InputField label="Note" value={restockNote} onChangeText={setRestockNote} />
          <PrimaryButton
            title="Save restock"
            onPress={async () => {
              try {
                const quantity = Number(restockQty || 0);
                const unitCost = Number(restockCost || 0);
                if (quantity <= 0) {
                  Alert.alert("Invalid quantity", "Enter a quantity greater than zero.");
                  return;
                }
                await adjustStock({
                  productId: product.id,
                  quantityDelta: quantity,
                  unitCost,
                  note: restockNote.trim() || "Quick restock"
                });
                setRestockVisible(false);
                await loadHistory();
              } catch (error) {
                Alert.alert("Restock failed", error instanceof Error ? error.message : "Failed to update stock");
              }
            }}
          />
        </View>
      </SimpleModal>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 4 }}>
      <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}
