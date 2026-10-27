import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { StockTransfer } from "@shared";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { archiveStockTransfer, createStockTransfer, dispatchStockTransfer, listProducts, listStockTransfers, receiveStockTransfer, updateStockTransfer } from "@/services/apiClient";
import { formatDate } from "@/utils/date";
import { formatMoney } from "@/utils/money";
import { createId } from "@/utils/id";
import { Ionicons } from "@expo/vector-icons";

type TransferLine = {
  productId: string;
  productName: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  serialNumbers: string;
};

export function StockTransfersScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const products = useAppStore((state) => state.products);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [transfers, setTransfers] = React.useState<StockTransfer[]>([]);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<StockTransfer | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [branchProducts, setBranchProducts] = React.useState(products);
  const [fromBranchId, setFromBranchId] = React.useState("");
  const [toBranchId, setToBranchId] = React.useState("");
  const [transferNumber, setTransferNumber] = React.useState("");
  const [transferDate, setTransferDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [items, setItems] = React.useState<TransferLine[]>([]);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
    refreshTransfers().catch(() => undefined);
  }, [loadCatalog]);

  React.useEffect(() => {
    let active = true;
    if (!fromBranchId) { setBranchProducts([]); return () => { active = false; }; }
    void listProducts(fromBranchId).then((items) => { if (active) setBranchProducts(items); }).catch(() => { if (active) setBranchProducts([]); });
    return () => { active = false; };
  }, [fromBranchId]);

  const filteredTransfers = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return transfers.filter((transfer) => [transfer.transferNumber, transfer.status, transfer.fromBranchId ?? "", transfer.toBranchId ?? "", transfer.note ?? "", branches.find((branch) => branch.id === transfer.fromBranchId)?.name ?? "", branches.find((branch) => branch.id === transfer.toBranchId)?.name ?? ""].join(" ").toLowerCase().includes(query));
  }, [search, transfers, branches]);

  const filteredProducts = React.useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return branchProducts.filter((product) => product.branchId === fromBranchId && Boolean(product.externalId) && [product.name, product.sku ?? "", product.barcode ?? ""].join(" ").toLowerCase().includes(query));
  }, [productSearch, branchProducts, fromBranchId]);

  const subtotal = React.useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0), [items]);

  async function refreshTransfers() {
    const next = await listStockTransfers();
    setTransfers(next);
  }

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([loadCatalog(), refreshTransfers()]);
    } finally {
      setRefreshing(false);
    }
  }

  function openEditor(transfer?: StockTransfer | null) {
    setEditing(transfer ?? null);
    setFromBranchId(transfer?.fromBranchId ?? user?.branchId ?? "");
    setToBranchId(transfer?.toBranchId ?? "");
    setTransferNumber(transfer?.transferNumber ?? `TR-${Date.now()}`);
    setTransferDate(transfer?.transferDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setNote(transfer?.note ?? "");
    setItems(
      (transfer?.items ?? []).map((item) => ({
        productId: item.productId,
        productName: products.find((candidate) => candidate.id === item.productId)?.name ?? item.productId,
        quantity: String(item.quantity),
        unitCost: String(item.unitCost),
        batchNumber: item.batchNumber ?? "",
        serialNumbers: item.serialNumbers?.join(", ") ?? ""
      }))
    );
    setProductSearch("");
    setVisible(true);
  }

  function addProduct(productId: string) {
    const product = branchProducts.find((candidate) => candidate.id === productId);
    if (!product) return;
    if (!product.externalId?.trim()) {
      Alert.alert("Product cannot be transferred", "This product has no shared catalog ID for branch stock matching.");
      return;
    }
    setItems((current) => {
      if (current.some((item) => item.productId === product.externalId)) {
        return current;
      }
      return current.concat([
        {
          productId: product.externalId!,
          productName: product.name,
          quantity: "1",
          unitCost: String(product.buyingPrice),
          batchNumber: "",
          serialNumbers: ""
        }
      ]);
    });
  }

  async function saveTransfer() {
    if (!business?.id) return;
    if (!transferNumber.trim()) {
      Alert.alert("Missing transfer number", "Enter a stock transfer number.");
      return;
    }
    if (!items.length) {
      Alert.alert("Add items", "Add at least one product to the stock transfer.");
      return;
    }
    if (!fromBranchId.trim() || !toBranchId.trim() || fromBranchId.trim() === toBranchId.trim()) {
      Alert.alert("Choose branches", "Choose two different source and destination branches.");
      return;
    }
    if (items.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0)) {
      Alert.alert("Check transfer quantities", "Each product needs a positive quantity and a non-negative unit cost.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        businessId: business.id,
        ...(editing ? {} : { externalId: createId() }),
        fromBranchId: fromBranchId.trim() || null,
        toBranchId: toBranchId.trim() || null,
        transferNumber: transferNumber.trim(),
        transferDate,
        note: note.trim() || null,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 0),
          unitCost: Number(item.unitCost || 0),
          batchNumber: item.batchNumber.trim() || null,
          serialNumbers: item.serialNumbers
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        }))
      };
      if (editing) {
        await updateStockTransfer(editing.id, payload);
      } else {
        await createStockTransfer(payload);
      }
      setVisible(false);
      setEditing(null);
      await refreshAll();
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save stock transfer");
    } finally {
      setSaving(false);
    }
  }

  async function runTransferAction(transfer: StockTransfer, action: "dispatch" | "receive") {
    if (user?.role !== "owner" && user?.role !== "manager") return;
    try {
      const updated = action === "dispatch" ? await dispatchStockTransfer(transfer.id) : await receiveStockTransfer(transfer.id);
      setTransfers((current) => current.map((item) => item.id === transfer.id ? updated : item));
      await loadCatalog();
      Alert.alert(action === "dispatch" ? "Transfer dispatched" : "Transfer received", action === "dispatch" ? "Source branch stock has been deducted." : "Destination branch stock has been updated.");
    } catch (error) {
      Alert.alert("Transfer failed", error instanceof Error ? error.message : `Could not ${action} this transfer.`);
    }
  }

  return (
    <Screen>
      <GradientHeader
        title="Stock Transfers"
        subtitle="Move stock between branches and locations"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={refreshAll} contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
        <Card style={{ gap: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>{filteredTransfers.length} of {transfers.length} transfers</Text>
            </View>
            {user?.role === "owner" || user?.role === "manager" ? <PrimaryButton title="Create transfer" onPress={() => openEditor(null)} /> : null}
          </View>
          <InputField label="Search transfers" value={search} onChangeText={setSearch} placeholder="Transfer number, branch, or status" />
        </Card>
        {filteredTransfers.length ? (
          <Card style={{ paddingVertical: 0, paddingHorizontal: 12 }}>
          {filteredTransfers.map((transfer, index) => (
            <View key={transfer.id} style={{ gap: 7, paddingVertical: 12, borderBottomWidth: index === filteredTransfers.length - 1 ? 0 : 1, borderBottomColor: tokens.colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }}>{transfer.transferNumber}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
                    {branches.find((branch) => branch.id === transfer.fromBranchId)?.name ?? "Source branch"} → {branches.find((branch) => branch.id === transfer.toBranchId)?.name ?? "Destination branch"}
                  </Text>
                  <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatDate(transfer.transferDate, "PP")} · {transfer.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)} units · {transfer.items.length} line{transfer.items.length === 1 ? "" : "s"}</Text>
                </View>
                <Badge label={transfer.status.replaceAll("_", " ")} tone={transfer.status === "received" ? "success" : transfer.status === "cancelled" ? "danger" : "primary"} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 15, fontWeight: "900" }}>{formatMoney(transfer.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), business?.currency)}</Text>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>{transfer.items.length} line{transfer.items.length === 1 ? "" : "s"}</Text>
              </View>
              {user?.role === "owner" || user?.role === "manager" ? <View style={{ flexDirection: "row", gap: 10 }}>
                {transfer.status === "draft" && (user?.role === "owner" || user?.branchId === transfer.fromBranchId) ? <View style={{ flex: 1 }}><PrimaryButton title="Edit" variant="secondary" onPress={() => openEditor(transfer)} /></View> : null}
                {transfer.status === "draft" && (user?.role === "owner" || user?.branchId === transfer.fromBranchId) ? <View style={{ flex: 1 }}><PrimaryButton title="Dispatch" onPress={() => void runTransferAction(transfer, "dispatch")} /></View> : null}
                {transfer.status === "in_transit" && transfer.dispatchedAt && (user?.role === "owner" || user?.branchId === transfer.toBranchId) ? <View style={{ flex: 1 }}><PrimaryButton title="Receive" onPress={() => void runTransferAction(transfer, "receive")} /></View> : null}
                {(transfer.status === "draft" || transfer.status === "cancelled") && (user?.role === "owner" || user?.branchId === transfer.fromBranchId) ? <View style={{ flex: 1 }}><PrimaryButton title="Archive" variant="danger" onPress={async () => {
                  const confirmed = await confirmMobile(`Archive ${transfer.transferNumber}?`);
                  if (!confirmed) return;
                  try { await archiveStockTransfer(transfer.id); await refreshAll(); }
                  catch (error) { Alert.alert("Archive failed", error instanceof Error ? error.message : "Failed to archive transfer"); }
                }} /></View> : null}
              </View> : null}
            </View>
          ))}
          </Card>
        ) : (
          <EmptyState
            title={search ? "No matching transfers" : "No stock transfers yet"}
            subtitle={search ? "Try a different transfer number or branch." : "Create transfers to document stock movement between branches."}
            action={user?.role === "owner" || user?.role === "manager" ? <PrimaryButton title="Create transfer" onPress={() => openEditor(null)} /> : undefined}
            icon="swap-horizontal-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={visible} title={editing ? "Edit transfer" : "Create transfer"} onClose={() => setVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <InputField label="Transfer number" value={transferNumber} onChangeText={setTransferNumber} />
          <View style={{ gap: 6 }}>
            <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Source branch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {branches.filter((branch) => branch.status !== "inactive" && (user?.role === "owner" || branch.id === user?.branchId)).map((branch) => <Tag key={branch.id} label={branch.name} tone="primary" selected={fromBranchId === branch.id} onPress={() => setFromBranchId(branch.id)} />)}
            </ScrollView>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Destination branch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {branches.filter((branch) => branch.status !== "inactive" && branch.id !== fromBranchId).map((branch) => <Tag key={branch.id} label={branch.name} tone="primary" selected={toBranchId === branch.id} onPress={() => setToBranchId(branch.id)} />)}
            </ScrollView>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Transfer date" value={transferDate} onChangeText={setTransferDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <InputField label="Note" value={note} onChangeText={setNote} multiline numberOfLines={3} />
          <Card style={{ gap: 8 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Total transfer value</Text>
            <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>{formatMoney(subtotal, business?.currency)}</Text>
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
                    <InputField label="Serials" value={item.serialNumbers} onChangeText={(value) => setItems((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, serialNumbers: value } : line)))} helperText="Comma-separate serial numbers." />
                  </View>
                </View>
              </Card>
            ))}
          </View>
          <PrimaryButton title={saving ? "Saving..." : "Save stock transfer"} loading={saving} onPress={() => void saveTransfer()} />
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
