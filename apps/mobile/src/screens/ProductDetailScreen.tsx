import React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { AppScrollView, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatDate } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";
import { deleteProduct, getProductHistory } from "@/services/apiClient";
import type { StockMovement } from "@shared";
import { hasPermission } from "@shared";

type RootStackParamList = {
  Main: undefined;
  Expenses: undefined;
  Reports: undefined;
  Settings: undefined;
  ProductDetail: { productId: string };
};

type Route = RouteProp<RootStackParamList, "ProductDetail">;

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
  const navigation = useNavigation<any>();
  const product = useAppStore((state) => state.products.find((item) => item.id === route.params.productId) ?? null);
  const categories = useAppStore((state) => state.categories);
  const brands = useAppStore((state) => state.brands);
  const suppliers = useAppStore((state) => state.suppliers);
  const products = useAppStore((state) => state.products);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const adjustStock = useAppStore((state) => state.adjustStock);
  const [stockMovements, setStockMovements] = React.useState<StockMovement[]>([]);
  const [salesHistory, setSalesHistory] = React.useState<SaleHistoryRow[]>([]);
  const [restockVisible, setRestockVisible] = React.useState(false);
  const [restockQty, setRestockQty] = React.useState("0");
  const [restockCost, setRestockCost] = React.useState("0");
  const [restockNote, setRestockNote] = React.useState("Quick restock");
  const [savingRestock, setSavingRestock] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [lookupCode, setLookupCode] = React.useState("");
  const canManageInventory = hasPermission(user, "manageInventory");

  React.useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [route.params.productId]);

  if (!canManageInventory) {
    return (
      <Screen>
        <GradientHeader title="Product details" subtitle="Inventory view" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Product details restricted"
            subtitle="This account cannot view inventory detail. Ask an owner or manager for inventory access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
            icon="cube-outline"
          />
        </View>
      </Screen>
    );
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const history = await getProductHistory(route.params.productId, currentProduct?.branchId ?? selectedBranchId);
      setStockMovements(history.stockMovements);
      setSalesHistory(history.salesHistory);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshHistory() {
    if (refreshing || historyLoading) return;
    setRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmDelete() {
    if (deleting) return;
    const currentProduct = useAppStore.getState().products.find((item) => item.id === route.params.productId);
    if (!currentProduct) return;
    const confirmed = await confirmMobile(`Delete ${currentProduct.name}? This will remove it from active catalog lists.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteProduct(currentProduct.id, currentProduct.branchId ?? selectedBranchId);
      await useAppStore.getState().loadCatalog();
      Alert.alert("Product deleted", `${currentProduct.name} was removed from the catalog.`);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Delete failed", error instanceof Error ? error.message : "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  if (!product) {
    return (
      <Screen>
        <GradientHeader title="Product details" subtitle="Item not found locally" />
        <View style={{ padding: 16 }}>
          <Card style={{ gap: 8 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Product not found</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>The selected product is not available in the local catalog yet.</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  const currentProduct = product;
  const lowStock = currentProduct.stockOnHand <= currentProduct.lowStockThreshold;
  const margin = Math.max(0, currentProduct.sellingPrice - currentProduct.buyingPrice);
  const categoryName = categories.find((category) => category.id === currentProduct.categoryId)?.name ?? "Uncategorized";
  const brandName = brands.find((brand) => brand.id === currentProduct.brandId)?.name ?? "No brand";
  const supplierName = suppliers.find((supplier) => supplier.id === currentProduct.supplierId)?.name ?? "No supplier";
  const lookupMatch = findProductByCode(products, lookupCode);

  return (
    <Screen>
      <GradientHeader
        title={currentProduct.name}
        subtitle={`${currentProduct.sku ?? "No SKU"} • ${currentProduct.unit} • ${categoryName}`}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Badge label={currentProduct.isActive ? "Active" : "Archived"} tone={currentProduct.isActive ? "success" : "warning"} />
            <Pressable onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="Delete product" disabled={deleting}>
              <Ionicons name="trash-outline" size={22} color={tokens.colors.danger} />
            </Pressable>
          </View>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={refreshHistory}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Quick lookup</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Jump to another product by SKU or barcode without leaving inventory detail.
          </Text>
          <InputField
            label="Code"
            value={lookupCode}
            onChangeText={setLookupCode}
            placeholder="Scan or type SKU / barcode"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!lookupMatch) {
                Alert.alert("No match", "Try the full SKU or barcode.");
                return;
              }
              navigation.push("ProductDetail", { productId: lookupMatch.id });
              setLookupCode("");
            }}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Open product"
                onPress={() => {
                  if (!lookupMatch) {
                    Alert.alert("No match", "Try the full SKU or barcode.");
                    return;
                  }
                  navigation.push("ProductDetail", { productId: lookupMatch.id });
                  setLookupCode("");
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Clear" variant="secondary" onPress={() => setLookupCode("")} />
            </View>
          </View>
          {lookupMatch ? (
            <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
              Match: {lookupMatch.name} • {lookupMatch.sku ?? "No SKU"} • {lookupMatch.barcode ?? "No barcode"}
            </Text>
          ) : lookupCode.trim() ? (
            <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>No exact match yet. Try a full code or barcode.</Text>
          ) : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{currentProduct.name}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>{currentProduct.barcode ?? "No barcode"}</Text>
            </View>
            <Badge label={lowStock ? "Low stock" : "Healthy"} tone={lowStock ? "danger" : "success"} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Units on hand" value={String(currentProduct.stockOnHand)} />
            <Metric label="Low stock limit" value={String(currentProduct.lowStockThreshold)} />
            <Metric label="Profit per unit" value={formatMoney(margin, business?.currency)} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Buying price" value={formatMoney(currentProduct.buyingPrice, business?.currency)} />
            <Metric label="Selling price" value={formatMoney(currentProduct.sellingPrice, business?.currency)} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Brand" value={brandName} />
            <Metric label="Supplier" value={supplierName} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Batch" value={currentProduct.batchNumber ?? "None"} />
            <Metric label="Expiry" value={currentProduct.expiryDate ?? "None"} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Metric label="Serial" value={currentProduct.serialNumber ?? "None"} />
            <Metric label="Barcode" value={currentProduct.barcode ?? "No barcode"} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Add stock" onPress={() => setRestockVisible(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={deleting ? "Deleting..." : "Delete"} variant="danger" onPress={confirmDelete} loading={deleting} />
            </View>
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Stock history</Text>
          {historyLoading ? (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={tokens.colors.primaryStrong} />
              <Text style={{ color: tokens.colors.textSecondary }}>Loading stock activity...</Text>
            </View>
          ) : stockMovements.length ? (
            stockMovements.map((movement) => (
              <View key={movement.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{formatReferenceLabel(movement.referenceType)}</Text>
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
          {historyLoading ? (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={tokens.colors.primaryStrong} />
              <Text style={{ color: tokens.colors.textSecondary }}>Loading sales activity...</Text>
            </View>
          ) : salesHistory.length ? (
            salesHistory.map((sale) => (
              <View key={sale.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border, gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{sale.receiptNumber}</Text>
                  <Badge label={formatPaymentStatusLabel(sale.paymentStatus)} tone={sale.paymentStatus === "paid" ? "success" : sale.paymentStatus === "unpaid" ? "danger" : "warning"} />
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
      </AppScrollView>

      <SimpleModal visible={restockVisible} title="Quick restock" onClose={() => setRestockVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Quantity" value={restockQty} onChangeText={setRestockQty} keyboardType="decimal-pad" helperText="How many units are being added." />
          <InputField label="Unit cost" value={restockCost} onChangeText={setRestockCost} keyboardType="decimal-pad" helperText="What one unit cost you." />
          <InputField label="Note" value={restockNote} onChangeText={setRestockNote} helperText="Optional note for the stock movement." />
          <PrimaryButton
            title="Save restock"
            onPress={async () => {
              setSavingRestock(true);
              try {
                const quantity = Number(restockQty || 0);
                const unitCost = Number(restockCost || 0);
                if (quantity <= 0) {
                  Alert.alert("Invalid quantity", "Enter a quantity greater than zero.");
                  return;
                }
                await adjustStock({
                  productId: currentProduct.id,
                  quantityDelta: quantity,
                  unitCost,
                  note: restockNote.trim() || "Quick restock"
                });
                setRestockVisible(false);
                await loadHistory();
                Alert.alert("Stock updated", "Inventory updated successfully.");
              } catch (error) {
                Alert.alert("Restock failed", error instanceof Error ? error.message : "Failed to update stock");
              } finally {
                setSavingRestock(false);
              }
            }}
            loading={savingRestock}
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

function formatReferenceLabel(value: string) {
  if (value === "adjustment") return "Manual adjustment";
  if (value === "sale") return "Sale";
  if (value === "restock") return "Restock";
  return value.replaceAll("_", " ");
}

function formatPaymentStatusLabel(value: string) {
  return value === "pending_confirmation"
    ? "Awaiting confirmation"
    : value === "paid"
      ? "Paid"
      : value === "unpaid"
        ? "Unpaid"
        : value.replaceAll("_", " ");
}

function confirmMobile(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm delete", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}

function findProductByCode(products: Array<{ id: string; name: string; sku?: string | null; barcode?: string | null }>, code: string) {
  const query = code.trim().toLowerCase();
  if (!query) return null;
  return products.find((product) => (product.sku ?? "").trim().toLowerCase() === query) ?? products.find((product) => (product.barcode ?? "").trim().toLowerCase() === query) ?? null;
}
