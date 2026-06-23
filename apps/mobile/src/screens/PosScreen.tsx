import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { copyReceipt, printBluetoothReceipt, shareReceipt } from "@/services/printerService";

const checkoutSchema = z.object({
  amountPaid: z.coerce.number().nonnegative(),
  notes: z.string().optional()
});

type CartLine = { productId: string; name: string; quantity: number; unitPrice: number; costPrice: number; discount: number };

export function PosScreen() {
  const products = useAppStore((state) => state.products);
  const customers = useAppStore((state) => state.customers);
  const business = useAppStore((state) => state.business);
  const createSale = useAppStore((state) => state.createSale);
  const loadCatalog = useAppStore((state) => state.loadCatalog);

  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa" | "bank" | "credit">("cash");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "pending_confirmation" | "credit" | "unpaid">("paid");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptVisible, setReceiptVisible] = useState(false);

  const { control, handleSubmit, reset } = useForm<{ amountPaid: number; notes?: string }>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { amountPaid: 0, notes: "" }
  });

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const filtered = useMemo(() => {
    return products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) || (product.sku ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountTotal = cart.reduce((sum, line) => sum + line.discount, 0);
  const total = subtotal - discountTotal;

  const addToCart = (product: (typeof products)[number]) => {
    setCart((current) => {
      const exists = current.find((line) => line.productId === product.id);
      if (exists) {
        return current.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return current.concat([{ productId: product.id, name: product.name, quantity: 1, unitPrice: product.sellingPrice, costPrice: product.buyingPrice, discount: 0 }]);
    });
  };

  return (
    <Screen>
      <GradientHeader title="POS checkout" subtitle="Fast retail flow with offline local commit" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 12 }}>
          <InputField label="Search products" value={search} onChangeText={setSearch} placeholder="Search by name or SKU" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {customers.slice(0, 4).map((customer) => (
              <Pressable key={customer.id} onPress={() => setSelectedCustomerId(customer.id)}>
                <Badge label={customer.name} tone={selectedCustomerId === customer.id ? "success" : "primary"} />
              </Pressable>
            ))}
          </ScrollView>
        </Card>
        <FlatList
          data={filtered}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => addToCart(item)}>
              <Card style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{item.name}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>{item.sku ?? "No SKU"} • Stock {item.stockOnHand}</Text>
                </View>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>{formatMoney(item.sellingPrice, business?.currency)}</Text>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<Card><Text style={{ color: tokens.colors.textSecondary }}>No matching products.</Text></Card>}
        />
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Cart</Text>
          {cart.length ? cart.map((line) => (
            <View key={line.productId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.colors.textSecondary }}>{line.name} x{line.quantity}</Text>
              <Text style={{ color: tokens.colors.text }}>{formatMoney(line.quantity * line.unitPrice, business?.currency)}</Text>
            </View>
          )) : <Text style={{ color: tokens.colors.textMuted }}>Add products to start the sale.</Text>}
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: 12, gap: 4 }}>
            <Text style={{ color: tokens.colors.textSecondary }}>Subtotal: {formatMoney(subtotal, business?.currency)}</Text>
            <Text style={{ color: tokens.colors.textSecondary }}>Discount: {formatMoney(discountTotal, business?.currency)}</Text>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Total: {formatMoney(total, business?.currency)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["cash", "mpesa", "bank", "credit"] as const).map((method) => (
              <Pressable key={method} onPress={() => setPaymentMethod(method)}>
                <Badge label={method} tone={paymentMethod === method ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {(["paid", "partial", "pending_confirmation", "credit", "unpaid"] as const).map((status) => (
              <Pressable key={status} onPress={() => setPaymentStatus(status)}>
                <Badge label={status.replaceAll("_", " ")} tone={paymentStatus === status ? "success" : status === "unpaid" ? "danger" : "primary"} />
              </Pressable>
            ))}
          </View>
          <Controller
            control={control}
            name="amountPaid"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Amount received"
                value={String(value)}
                onChangeText={(text) => onChange(Number(text || 0))}
                keyboardType="decimal-pad"
                placeholder={String(total)}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange } }) => <InputField label="Payment note" value={value ?? ""} onChangeText={onChange} placeholder="Optional note" />}
          />
        </Card>
        <PrimaryButton
          title="Checkout sale"
          onPress={handleSubmit(async (values) => {
            if (!cart.length) {
              Alert.alert("No items", "Add at least one product.");
              return;
            }
            try {
              const result = await createSale({
                customerId: selectedCustomerId,
                paymentMethod,
                paymentStatus,
                amountPaid: values.amountPaid,
                notes: values.notes ?? null,
                items: cart.map((line) => ({
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  costPrice: line.costPrice,
                  discount: line.discount
                }))
              });
              setReceipt(result.receipt);
              setReceiptVisible(true);
              setCart([]);
              reset({ amountPaid: 0, notes: "" });
              setSelectedCustomerId(null);
            } catch (error) {
              Alert.alert("Sale failed", error instanceof Error ? error.message : "Failed to create sale");
            }
          })}
        />
      </ScrollView>
      <SimpleModal visible={receiptVisible} title="Receipt ready" onClose={() => setReceiptVisible(false)}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.textSecondary, fontFamily: "monospace" }}>{receipt}</Text>
          <View style={{ gap: 10 }}>
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
            <PrimaryButton title="Close" variant="secondary" onPress={() => setReceiptVisible(false)} />
          </View>
        </View>
      </SimpleModal>
    </Screen>
  );
}
