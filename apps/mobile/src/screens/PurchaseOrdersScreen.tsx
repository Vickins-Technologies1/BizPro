import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { PurchaseOrder } from "@shared";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { archivePurchaseOrder, createPurchaseOrder, listPurchaseOrders, updatePurchaseOrder } from "@/services/apiClient";
import { formatDate } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";

type OrderLine = {
  productId: string;
  productName: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
};

export function PurchaseOrdersScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const products = useAppStore((state) => state.products);
  const suppliers = useAppStore((state) => state.suppliers);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<PurchaseOrder | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState<string | null>(null);
  const [orderNumber, setOrderNumber] = React.useState("");
  const [status, setStatus] = React.useState<PurchaseOrder["status"]>("draft");
  const [orderDate, setOrderDate] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [taxTotal, setTaxTotal] = React.useState("0");
  const [productSearch, setProductSearch] = React.useState("");
  const [items, setItems] = React.useState<OrderLine[]>([]);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
    refreshOrders().catch(() => undefined);
  }, [loadCatalog, selectedBranchId]);

  const writeBranchId = React.useMemo(
    () => selectedBranchId ?? user?.branchId ?? branches.find((branch) => branch.isDefault)?.id ?? branches[0]?.id ?? null,
    [branches, selectedBranchId, user?.branchId]
  );

  const filteredOrders = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => [order.orderNumber, order.status, order.notes ?? "", order.supplierId ?? ""].join(" ").toLowerCase().includes(query));
  }, [orders, search]);

  const filteredProducts = React.useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => [product.name, product.sku ?? "", product.barcode ?? ""].join(" ").toLowerCase().includes(query));
  }, [productSearch, products]);

  const subtotal = React.useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0), [items]);
  const total = subtotal + Number(taxTotal || 0);

  async function refreshOrders() {
    const next = await listPurchaseOrders(selectedBranchId);
    setOrders(next);
  }

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([loadCatalog(), refreshOrders()]);
    } finally {
      setRefreshing(false);
    }
  }

  function openEditor(order?: PurchaseOrder | null) {
    setEditing(order ?? null);
    setSupplierId(order?.supplierId ?? null);
    setOrderNumber(order?.orderNumber ?? `PO-${Date.now()}`);
    setStatus(order?.status ?? "draft");
    setOrderDate(order?.orderDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setExpectedDate(order?.expectedDate?.slice(0, 10) ?? "");
    setNotes(order?.notes ?? "");
    setTaxTotal(String(order?.taxTotal ?? 0));
    setItems(
      (order?.items ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: String(item.quantity),
        unitCost: String(item.unitCost),
        batchNumber: item.batchNumber ?? "",
        expiryDate: item.expiryDate ?? ""
      }))
    );
    setProductSearch("");
    setVisible(true);
  }

  function addProduct(productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    setItems((current) => {
      if (current.some((item) => item.productId === product.id)) {
        return current;
      }
      return current.concat([
        {
          productId: product.id,
          productName: product.name,
          quantity: "1",
          unitCost: String(product.buyingPrice),
          batchNumber: "",
          expiryDate: ""
        }
      ]);
    });
  }

  async function saveOrder() {
    if (!business?.id) return;
    if (!orderNumber.trim()) {
      Alert.alert("Missing order number", "Enter a purchase order number.");
      return;
    }
    if (!items.length) {
      Alert.alert("Add items", "Add at least one product to the purchase order.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        businessId: business.id,
        branchId: writeBranchId,
        supplierId: supplierId ?? null,
        orderNumber: orderNumber.trim(),
        status,
        orderDate,
        expectedDate: expectedDate.trim() || null,
        receivedAt: editing?.receivedAt ?? null,
        subtotal,
        taxTotal: Number(taxTotal || 0),
        total,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: Number(item.quantity || 0),
          unitCost: Number(item.unitCost || 0),
          batchNumber: item.batchNumber.trim() || null,
          expiryDate: item.expiryDate.trim() || null
        }))
      };
      if (editing) {
        await updatePurchaseOrder(editing.id, payload);
      } else {
        await createPurchaseOrder(payload);
      }
      setVisible(false);
      setEditing(null);
      await refreshAll();
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save purchase order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <GradientHeader
        title="Purchase Orders"
        subtitle="Record supplier orders and expected stock"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={refreshAll}>
        <Card>
          <InputField label="Search orders" value={search} onChangeText={setSearch} placeholder="Order number, supplier, or status" />
        </Card>
        <Card>
          <PrimaryButton title="Create order" onPress={() => openEditor(null)} />
        </Card>
        {filteredOrders.length ? (
          filteredOrders.map((order) => {
            const supplierName = suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? "No supplier";
            return (
              <Card key={order.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{order.orderNumber}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>{supplierName}</Text>
                    <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatDate(order.orderDate, "PPP")}</Text>
                  </View>
                  <Badge label={order.status.replaceAll("_", " ")} tone={order.status === "received" ? "success" : order.status === "cancelled" ? "danger" : "primary"} />
                </View>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>{formatMoney(order.total, business?.currency)}</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>{order.items.length} line{order.items.length === 1 ? "" : "s"}</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Edit" variant="secondary" onPress={() => openEditor(order)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Archive"
                      variant="danger"
                      onPress={async () => {
                        const confirmed = await confirmMobile(`Archive ${order.orderNumber}?`);
                        if (!confirmed) return;
                        await archivePurchaseOrder(order.id, selectedBranchId);
                        await refreshAll();
                      }}
                    />
                  </View>
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            title={search ? "No matching purchase orders" : "No purchase orders yet"}
            subtitle={search ? "Try a different order number or supplier." : "Create purchase orders to plan incoming inventory."}
            action={<PrimaryButton title="Create order" onPress={() => openEditor(null)} />}
            icon="cart-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={visible} title={editing ? "Edit purchase order" : "Create purchase order"} onClose={() => setVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <InputField label="Order number" value={orderNumber} onChangeText={setOrderNumber} />
          <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "700" }}>Supplier</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tag label="No supplier" tone="primary" selected={!supplierId} onPress={() => setSupplierId(null)} />
            {suppliers.map((supplier) => (
              <Tag key={supplier.id} label={supplier.name} tone="primary" selected={supplierId === supplier.id} onPress={() => setSupplierId(supplier.id)} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {(["draft", "ordered", "partially_received", "received", "cancelled"] as const).map((option) => (
              <View key={option} style={{ flex: 1 }}>
                <Tag label={option.replaceAll("_", " ")} tone="primary" selected={status === option} fullWidth onPress={() => setStatus(option)} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Order date" value={orderDate} onChangeText={setOrderDate} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Expected date" value={expectedDate} onChangeText={setExpectedDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <InputField label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
          <InputField label="Tax total" value={taxTotal} onChangeText={setTaxTotal} keyboardType="decimal-pad" />
          <Card style={{ gap: 8 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Totals</Text>
            <Text style={{ color: tokens.colors.textSecondary }}>Subtotal {formatMoney(subtotal, business?.currency)}</Text>
            <Text style={{ color: tokens.colors.textSecondary }}>Tax {formatMoney(Number(taxTotal || 0), business?.currency)}</Text>
            <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>Total {formatMoney(total, business?.currency)}</Text>
          </Card>
          <InputField label="Find product" value={productSearch} onChangeText={setProductSearch} placeholder="Search products to add" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filteredProducts.map((product) => (
              <Tag key={product.id} label={`${product.name} • ${product.sku ?? "No SKU"}`} tone="primary" onPress={() => addProduct(product.id)} />
            ))}
          </ScrollView>
          <View style={{ gap: 10 }}>
            {items.map((item, index) => (
              <Card key={`${item.productId}-${index}`} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "800", flex: 1 }}>{item.productName}</Text>
                  <Pressable onPress={() => setItems((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                    <Ionicons name="trash-outline" size={20} color={tokens.colors.danger} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <InputField label="Qty" value={item.quantity} onChangeText={(value) => setItems((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, quantity: value } : line)))} keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField label="Unit cost" value={item.unitCost} onChangeText={(value) => setItems((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, unitCost: value } : line)))} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <InputField label="Batch" value={item.batchNumber} onChangeText={(value) => setItems((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, batchNumber: value } : line)))} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField label="Expiry" value={item.expiryDate} onChangeText={(value) => setItems((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, expiryDate: value } : line)))} placeholder="YYYY-MM-DD" />
                  </View>
                </View>
              </Card>
            ))}
          </View>
          <PrimaryButton title={saving ? "Saving..." : "Save purchase order"} loading={saving} onPress={() => void saveOrder()} />
        </AppScrollView>
      </SimpleModal>
    </Screen>
  );
}

function confirmMobile(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm archive", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Archive", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}
