import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/store/useAppStore";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { formatDate } from "@/utils/date";
import { copyReceipt, printBluetoothReceipt, shareReceiptPdf } from "@/services/printerService";
import type { ReceiptArtifacts } from "@/services/receiptService";

type PaymentMode = "cash" | "mpesa";

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
};

export function PosScreen() {
  const products = useAppStore((state) => state.products);
  const sales = useAppStore((state) => state.sales);
  const business = useAppStore((state) => state.business);
  const createSale = useAppStore((state) => state.createSale);
  const loadCatalog = useAppStore((state) => state.loadCatalog);

  const [search, setSearch] = React.useState("");
  const [modalVisible, setModalVisible] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("cash");
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [stkInitiating, setStkInitiating] = React.useState(false);
  const [receipt, setReceipt] = React.useState<ReceiptArtifacts | null>(null);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const filteredSales = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!query) return true;
      return [sale.receiptNumber, sale.customerId ?? "", sale.paymentMethod, sale.paymentStatus].join(" ").toLowerCase().includes(query);
    });
  }, [sales, search]);

  const filteredProducts = React.useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (!query) return true;
      return [product.name, product.sku ?? "", product.barcode ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [productSearch, products]);

  const subtotal = React.useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const discountTotal = React.useMemo(() => cart.reduce((sum, line) => sum + line.discount, 0), [cart]);
  const total = subtotal - discountTotal;
  const amountPaid = total;
  const paymentStatus = paymentMode === "cash" ? "paid" : "pending_confirmation";

  async function refreshSales() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadCatalog();
    } finally {
      setRefreshing(false);
    }
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return current.concat([
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.sellingPrice,
          costPrice: product.buyingPrice,
          discount: 0
        }
      ]);
    });
  }

  function updateLineQuantity(productId: string, quantityText: string) {
    const nextQuantity = Number(quantityText || 0);
    setCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((line) => line.productId !== productId);
      }
      return current.map((line) => (line.productId === productId ? { ...line, quantity: nextQuantity } : line));
    });
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  function clearSaleForm() {
    setCart([]);
    setProductSearch("");
    setPaymentMode("cash");
  }

  async function saveSale() {
    if (!cart.length) {
      Alert.alert("Add products", "Choose at least one product before recording the sale.");
      return;
    }

    setSaving(true);
    try {
      const result = await createSale({
        paymentMethod: paymentMode,
        paymentStatus,
        amountPaid,
        notes: paymentMode === "mpesa" ? "Mobile payment pending STK confirmation" : null,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costPrice: line.costPrice,
          discount: line.discount
        }))
      });
      setReceipt(result.receipt);
      setModalVisible(false);
      clearSaleForm();
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
            Tap Record Sale to open the cart flow. The history below updates automatically after each save.
          </Text>
          <PrimaryButton title="Record Sale" onPress={() => setModalVisible(true)} />
        </Card>

        <Card>
          <InputField label="Search sales" value={search} onChangeText={setSearch} placeholder="Receipt, method, or status" />
        </Card>

        {filteredSales.length ? (
          filteredSales.map((sale) => {
            const methodLabel = formatPaymentMethodLabel(String(sale.paymentMethod ?? "cash"));
            const paymentState = String(sale.paymentStatus ?? "paid");
            return (
              <Card key={sale.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{sale.receiptNumber}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>
                      {formatDate(sale.createdAt, "PPP p")} • {methodLabel}
                    </Text>
                  </View>
                  <Badge label={formatPaymentStatusLabel(paymentState)} tone={paymentState === "paid" ? "success" : paymentState === "unpaid" ? "danger" : "warning"} />
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
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Choose one or more products, set quantities for each line, then save the sale.
          </Text>

          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Payment type</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Cash sales save immediately. Mobile sales reserve a space here for STK push initiation.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[
                { value: "cash" as const, label: "Cash" },
                { value: "mpesa" as const, label: "Mobile" }
              ].map((option) => (
                <Pressable key={option.value} onPress={() => setPaymentMode(option.value)}>
                  <Badge label={option.label} tone={paymentMode === option.value ? "success" : "primary"} />
                </Pressable>
              ))}
            </View>
          </Card>

          {paymentMode === "mpesa" ? (
            <Card style={{ gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Mobile payment</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                This area is reserved for direct STK push initiation once the payment gateway is connected.
              </Text>
              <PrimaryButton
                title={stkInitiating ? "Initiating..." : "Initiate STK Push"}
                variant="secondary"
                loading={stkInitiating}
                onPress={async () => {
                  setStkInitiating(true);
                  try {
                    Alert.alert("STK Push not connected", "The direct mobile payment flow can be wired into this space next.");
                  } finally {
                    setStkInitiating(false);
                  }
                }}
              />
            </Card>
          ) : null}

          <InputField label="Search products" value={productSearch} onChangeText={setProductSearch} placeholder="Find a product" />

          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Add products</Text>
            {filteredProducts.length ? (
              filteredProducts.map((product) => (
                <Pressable
                  key={product.id}
                  onPress={() => addToCart(product.id)}
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: tokens.colors.border,
                    backgroundColor: tokens.colors.surfaceAlt,
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
                  <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>Tap to add to sale</Text>
                </Pressable>
              ))
            ) : (
              <EmptyState title="No matching products" subtitle="Try a different product name or SKU." icon="cube-outline" />
            )}
          </Card>

          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Sale cart</Text>
            {cart.length ? (
              cart.map((line) => (
                <View key={line.productId} style={{ gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{line.name}</Text>
                      <Text style={{ color: tokens.colors.textSecondary }}>
                        {formatMoney(line.unitPrice, business?.currency ?? "KES")} each
                      </Text>
                    </View>
                    <Pressable onPress={() => removeLine(line.productId)} accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`}>
                      <Ionicons name="trash-outline" size={20} color={tokens.colors.danger} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label="Quantity"
                        value={String(line.quantity)}
                        onChangeText={(text) => updateLineQuantity(line.productId, text)}
                        keyboardType="number-pad"
                        helperText="Set a different quantity for each product."
                      />
                    </View>
                    <View style={{ flex: 1, paddingBottom: 2 }}>
                      <Card style={{ gap: 4, padding: 14 }}>
                        <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>Line total</Text>
                        <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>
                          {formatMoney(line.unitPrice * line.quantity - line.discount, business?.currency ?? "KES")}
                        </Text>
                      </Card>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState title="Cart is empty" subtitle="Tap products above to add multiple items to the sale." icon="cart-outline" />
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: 12, gap: 4 }}>
              <Text style={{ color: tokens.colors.textSecondary }}>Subtotal: {formatMoney(subtotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Discount: {formatMoney(discountTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Total: {formatMoney(total, business?.currency ?? "KES")}</Text>
            </View>
          </Card>

          <View style={{ gap: 10 }}>
            <PrimaryButton title={saving ? "Saving..." : "Save sale"} onPress={saveSale} loading={saving} disabled={!cart.length} />
            <PrimaryButton title="Close" variant="secondary" onPress={() => setModalVisible(false)} />
          </View>
        </AppScrollView>
      </SimpleModal>

      <SimpleModal visible={Boolean(receipt)} title="Receipt saved" onClose={() => setReceipt(null)}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.textSecondary, fontFamily: "monospace", fontSize: 12, lineHeight: 18 }}>{receipt?.text}</Text>
          <PrimaryButton
            title="Copy receipt"
            variant="secondary"
            onPress={async () => {
              if (!receipt) return;
              await copyReceipt(receipt.text);
              Alert.alert("Copied", "Receipt text copied to clipboard.");
            }}
          />
          <PrimaryButton
            title="Share PDF receipt"
            variant="secondary"
            onPress={async () => {
              if (!receipt) return;
              await shareReceiptPdf(receipt.html, receipt.fileName);
            }}
          />
          <PrimaryButton
            title="Bluetooth print"
            onPress={async () => {
              if (!receipt) return;
              try {
                await printBluetoothReceipt(receipt.text);
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

function formatPaymentMethodLabel(method: string) {
  if (method === "cash") return "Cash";
  if (method === "mpesa") return "Mobile";
  if (method === "bank") return "Bank";
  return method.replaceAll("_", " ");
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
