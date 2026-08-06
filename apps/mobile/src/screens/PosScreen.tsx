import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/store/useAppStore";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { formatDate } from "@/utils/date";
import { copyReceipt, printBluetoothReceipt, shareReceipt } from "@/services/printerService";

export function PosScreen() {
  const products = useAppStore((state) => state.products);
  const sales = useAppStore((state) => state.sales);
  const business = useAppStore((state) => state.business);
  const createSale = useAppStore((state) => state.createSale);
  const loadCatalog = useAppStore((state) => state.loadCatalog);

  const [search, setSearch] = React.useState("");
  const [modalVisible, setModalVisible] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [quantity, setQuantity] = React.useState("1");
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const filteredSales = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!query) return true;
      return [sale.receiptNumber, sale.customerId ?? "", sale.paymentMethod, sale.paymentStatus]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [sales, search]);

  const filteredProducts = React.useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (!query) return true;
      return [product.name, product.sku ?? "", product.barcode ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [productSearch, products]);

  const selectedProduct = React.useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);
  const saleQuantity = Number(quantity || 0);
  const total = selectedProduct ? selectedProduct.sellingPrice * saleQuantity : 0;

  async function refreshSales() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadCatalog();
    } finally {
      setRefreshing(false);
    }
  }

  async function saveSale() {
    if (!selectedProduct) {
      Alert.alert("Choose a product", "Select a product before recording the sale.");
      return;
    }
    if (!saleQuantity || saleQuantity <= 0) {
      Alert.alert("Enter quantity", "Quantity must be greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const result = await createSale({
        paymentMethod: "cash",
        paymentStatus: "paid",
        amountPaid: total,
        notes: null,
        items: [
          {
            productId: selectedProduct.id,
            quantity: saleQuantity,
            unitPrice: selectedProduct.sellingPrice,
            costPrice: selectedProduct.buyingPrice,
            discount: 0
          }
        ]
      });
      setReceipt(result.receipt);
      setModalVisible(false);
      setSelectedProductId(null);
      setQuantity("1");
      setProductSearch("");
      Alert.alert("Sale recorded", "The sale has been saved and the history has been refreshed.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to record sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <GradientHeader
        title="Sales"
        subtitle="Review recent sales and record a new one when needed"
        right={
          <Pressable onPress={() => setModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={refreshSales}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Sales history</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "900" }}>Keep the page focused on recent sales.</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Tap Record Sale to open the simple entry flow. The history below updates automatically after each save.
          </Text>
          <PrimaryButton title="Record Sale" onPress={() => setModalVisible(true)} />
        </Card>

        <Card>
          <InputField label="Search sales" value={search} onChangeText={setSearch} placeholder="Receipt, method, or status" />
        </Card>

        {filteredSales.length ? (
          filteredSales.map((sale) => {
            const paymentStatus = String(sale.paymentStatus ?? "paid");
            const paymentMethod = String(sale.paymentMethod ?? "cash");
            return (
              <Card key={sale.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{sale.receiptNumber}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>
                      {formatDate(sale.createdAt, "PPP p")} • {paymentMethod.toUpperCase()}
                    </Text>
                  </View>
                  <Badge label={formatPaymentStatusLabel(paymentStatus)} tone={paymentStatus === "paid" ? "success" : paymentStatus === "unpaid" ? "danger" : "warning"} />
                </View>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>{formatMoney(sale.grandTotal, business?.currency ?? "KES")}</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>
                  {sale.items.length} item{sale.items.length === 1 ? "" : "s"} • {sale.customerId ? "Linked customer" : "Walk-in sale"}
                </Text>
              </Card>
            );
          })
        ) : (
          <EmptyState
            title={search ? "No matching sales" : "No sales yet"}
            subtitle={search ? "Try a different receipt number, method, or status." : "Use Record Sale to create the first entry."}
            icon="receipt-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={modalVisible} title="Record sale" onClose={() => setModalVisible(false)}>
        <View style={{ gap: 12, maxHeight: "100%" }}>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Choose one product, enter the quantity, and save. The total updates automatically.
          </Text>
          <InputField label="Search products" value={productSearch} onChangeText={setProductSearch} placeholder="Find a product" />
          <View style={{ gap: 10, maxHeight: 240 }}>
            {filteredProducts.length ? (
              filteredProducts.map((product) => {
                const selected = product.id === selectedProductId;
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => setSelectedProductId(product.id)}
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: selected ? tokens.colors.primaryStrong : tokens.colors.border,
                      backgroundColor: selected ? "rgba(37,99,235,0.08)" : tokens.colors.surfaceAlt,
                      gap: 4
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800", flex: 1 }}>{product.name}</Text>
                      <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>{formatMoney(product.sellingPrice, business?.currency ?? "KES")}</Text>
                    </View>
                    <Text style={{ color: tokens.colors.textSecondary }}>
                      {product.sku ?? "No SKU"} • Stock {product.stockOnHand}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <EmptyState title="No matching products" subtitle="Try a different product name or SKU." icon="cube-outline" />
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                helperText="Enter how many units are being sold."
              />
            </View>
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <Card style={{ gap: 6, padding: 14 }}>
                <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>Total</Text>
                <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "900" }}>{formatMoney(total, business?.currency ?? "KES")}</Text>
              </Card>
            </View>
          </View>
          <PrimaryButton title={saving ? "Saving..." : "Save sale"} onPress={saveSale} loading={saving} disabled={!selectedProduct} />
          <PrimaryButton title="Close" variant="secondary" onPress={() => setModalVisible(false)} />
        </View>
      </SimpleModal>

      <SimpleModal visible={Boolean(receipt)} title="Receipt saved" onClose={() => setReceipt(null)}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.textSecondary, fontFamily: "monospace" }}>{receipt}</Text>
          <PrimaryButton
            title="Copy receipt"
            variant="secondary"
            onPress={async () => {
              if (!receipt) return;
              await copyReceipt(receipt);
              Alert.alert("Copied", "Receipt text copied to clipboard.");
            }}
          />
          <PrimaryButton
            title="Share receipt"
            variant="secondary"
            onPress={async () => {
              if (!receipt) return;
              await shareReceipt(receipt);
            }}
          />
          <PrimaryButton
            title="Bluetooth print"
            onPress={async () => {
              if (!receipt) return;
              try {
                await printBluetoothReceipt(receipt);
                Alert.alert("Printed", "Receipt sent to the paired Bluetooth printer.");
              } catch (error) {
                Alert.alert("Printer unavailable", error instanceof Error ? error.message : "Bluetooth printing failed");
              }
            }}
          />
        </View>
      </SimpleModal>
    </Screen>
  );
}

function formatPaymentStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "pending_confirmation":
      return "Awaiting confirmation";
    case "credit":
      return "Credit sale";
    case "unpaid":
      return "Unpaid";
    default:
      return status.replaceAll("_", " ");
  }
}
