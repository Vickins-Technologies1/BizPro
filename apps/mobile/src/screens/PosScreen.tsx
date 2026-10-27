import React from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveBusinessTypeConfig } from "@shared";
import { useAppStore } from "@/store/useAppStore";
import { AppScrollView, Badge, Card, Dropdown, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { SectionHeader } from "@/components/DesignSystem";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { formatDate } from "@/utils/date";
import { copyReceipt, printBluetoothReceipt, shareReceiptPdf } from "@/services/printerService";
import { buildReceiptArtifacts, type ReceiptArtifacts } from "@/services/receiptService";
import { clearPosDrafts, listPosDrafts, removePosDraft, savePosDraft, type PosDraft, type PosMode, type PosPaymentLine } from "@/services/posDrafts";
import { createId } from "@/utils/id";

type PaymentMode = "cash" | "mpesa" | "bank" | "card" | "cheque" | "other" | "credit";

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
};

type PaymentStep = PosPaymentLine;
type SaleFilter = "all" | "open" | "paid";

export function PosScreen() {
  const products = useAppStore((state) => state.products);
  const sales = useAppStore((state) => state.sales);
  const customers = useAppStore((state) => state.customers);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncMessage = useAppStore((state) => state.syncMessage);
  const createSale = useAppStore((state) => state.createSale);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const businessConfig = resolveBusinessTypeConfig({ businessType: business?.businessType, industryKey: business?.industryKey });
  const primaryAction = businessConfig.workspace.primaryAction;
  const catalogLabel = businessConfig.navigation.catalogLabel;
  const catalogItemLabel = businessConfig.terminology.catalogItem;
  const tracksStock = businessConfig.capabilities.inventory;
  const supportsBarcode = businessConfig.capabilities.barcode;

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<SaleFilter>("all");
  const [showDrafts, setShowDrafts] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [lookupCode, setLookupCode] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [drafts, setDrafts] = React.useState<PosDraft[]>([]);
  const [currentDraftId, setCurrentDraftId] = React.useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = React.useState<PosMode>("sale");
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [discountMode, setDiscountMode] = React.useState<"flat" | "percent">("flat");
  const [discountValue, setDiscountValue] = React.useState("0");
  const [taxMode, setTaxMode] = React.useState<"flat" | "percent">("flat");
  const [taxValue, setTaxValue] = React.useState("0");
  const [payments, setPayments] = React.useState<PaymentStep[]>([{ id: createId(), method: "cash", amount: 0, reference: "", note: "" }]);
  const [checkoutNote, setCheckoutNote] = React.useState("");
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [previewReceipt, setPreviewReceipt] = React.useState<ReceiptArtifacts | null>(null);
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("cash");
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [stkInitiating, setStkInitiating] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [receipt, setReceipt] = React.useState<ReceiptArtifacts | null>(null);
  const [scannerVisible, setScannerVisible] = React.useState(false);
  const deferredSearch = React.useDeferredValue(search);
  const deferredProductSearch = React.useDeferredValue(productSearch);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  React.useEffect(() => {
    listPosDrafts()
      .then(setDrafts)
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!modalVisible) {
      setScannerVisible(false);
    }
  }, [modalVisible]);

  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const globalWindow = globalThis as typeof globalThis & { addEventListener?: (type: string, listener: (event: any) => void) => void; removeEventListener?: (type: string, listener: (event: any) => void) => void };
    if (!globalWindow.addEventListener || !globalWindow.removeEventListener) return;
    const handleKeyDown = (event: any) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "enter") {
        event.preventDefault();
        void saveSale();
      }
      if ((event.ctrlKey || event.metaKey) && key === "p") {
        event.preventDefault();
        void openReceiptPreview();
      }
      if ((event.ctrlKey || event.metaKey) && key === "h") {
        event.preventDefault();
        void holdDraft();
      }
      if ((event.ctrlKey || event.metaKey) && key === "d") {
        event.preventDefault();
        void saveCurrentDraft();
      }
    };
    globalWindow.addEventListener("keydown", handleKeyDown);
    return () => globalWindow.removeEventListener?.("keydown", handleKeyDown);
  }, [cart, discountMode, discountValue, paymentMode, payments, productSearch, taxMode, taxValue, checkoutNote]);

  const customerOptions = React.useMemo(() => [{ label: "Walk-in customer", value: "" }, ...customers.map((customer) => ({ label: customer.name, value: customer.id, ...(customer.phone ? { description: customer.phone } : {}) }))], [customers]);
  const filteredSales = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return sales.filter((sale) => {
      const state = String(sale.paymentStatus ?? "paid");
      if (statusFilter === "paid" && state !== "paid") return false;
      if (statusFilter === "open" && !["partial", "unpaid", "credit", "pending_confirmation"].includes(state)) return false;
      if (!query) return true;
      const customerName = customers.find((customer) => customer.id === sale.customerId)?.name ?? "";
      return [sale.receiptNumber, sale.customerId ?? "", customerName, sale.paymentMethod, state, sale.notes ?? ""].join(" ").toLowerCase().includes(query);
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customers, deferredSearch, sales, statusFilter]);

  const filteredProducts = React.useMemo(() => {
    const query = deferredProductSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (!query) return true;
      return [product.name, product.sku ?? "", product.barcode ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [deferredProductSearch, products]);
  const lookupMatch = React.useMemo(() => findProductByCode(products, lookupCode), [lookupCode, products]);

  const subtotal = React.useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const lineDiscountTotal = React.useMemo(() => cart.reduce((sum, line) => sum + line.discount, 0), [cart]);
  const orderDiscountTotal = React.useMemo(() => {
    const parsed = Number(discountValue || 0);
    if (!parsed) return 0;
    return discountMode === "percent" ? (subtotal * parsed) / 100 : parsed;
  }, [discountMode, discountValue, subtotal]);
  const taxableSubtotal = Math.max(0, subtotal - lineDiscountTotal - orderDiscountTotal);
  const taxTotal = React.useMemo(() => {
    const parsed = Number(taxValue || 0);
    if (!parsed) return 0;
    return taxMode === "percent" ? (taxableSubtotal * parsed) / 100 : parsed;
  }, [taxMode, taxValue, taxableSubtotal]);
  const total = checkoutMode === "return" ? -(taxableSubtotal + taxTotal) : taxableSubtotal + taxTotal;
  const amountPaid = React.useMemo(() => payments.reduce((sum, line) => sum + Number(line.amount || 0), 0), [payments]);
  const balanceDue = Math.max(0, total - amountPaid);
  const paymentStatus = amountPaid >= total ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
  const paymentMethod = payments[0]?.method ?? paymentMode;
  const primaryPayment = payments[0] ?? null;
  const changeDue = Math.max(0, amountPaid - total);

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
    const availableStock = tracksStock ? Math.max(0, product.stockOnHand) : Number.POSITIVE_INFINITY;
    if (tracksStock && availableStock <= 0) {
      Alert.alert("Unavailable", `${product.name} is currently unavailable.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) {
          return current;
        }
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
    setLineQuantity(productId, Number(quantityText || 0));
  }

  function setLineQuantity(productId: string, quantity: number) {
    const product = products.find((item) => item.id === productId);
    const cappedQuantity = product && tracksStock ? Math.min(Math.max(0, Math.floor(quantity)), Math.max(0, product.stockOnHand)) : Math.max(0, Math.floor(quantity));
    setCart((current) => {
      if (cappedQuantity <= 0) {
        return current.filter((line) => line.productId !== productId);
      }
      return current.map((line) => (line.productId === productId ? { ...line, quantity: cappedQuantity } : line));
    });
  }

  function changeLineQuantity(productId: string, delta: number) {
    const currentLine = cart.find((line) => line.productId === productId);
    if (!currentLine) return;
    setLineQuantity(productId, currentLine.quantity + delta);
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  function clearSaleForm() {
    setCart([]);
    setProductSearch("");
    setLookupCode("");
    setScannerVisible(false);
    setPaymentMode("cash");
    setCheckoutMode("sale");
    setCustomerId(null);
    setDiscountMode("flat");
    setDiscountValue("0");
    setTaxMode("flat");
    setTaxValue("0");
    setPayments([{ id: createId(), method: "cash", amount: 0, reference: "", note: "" }]);
    setCheckoutNote("");
    setCurrentDraftId(null);
    setShowAdvanced(false);
  }

  function handleLookupSubmit() {
    if (!lookupMatch) {
      Alert.alert("No match", `Try searching for a ${catalogItemLabel.toLowerCase()} by name${supportsBarcode ? " or scanning its code" : ""}.`);
      return;
    }
    addToCart(lookupMatch.id);
    setLookupCode("");
  }

  async function handleScannedBarcode(barcode: string) {
    setLookupCode(barcode);
    const match = findProductByCode(products, barcode);
    if (!match) {
      return { status: "not-found" as const, message: `No ${catalogItemLabel.toLowerCase()} was found for this barcode.` };
    }
    addToCart(match.id);
    setLookupCode("");
    return { status: "accepted" as const, message: `${match.name} added. Ready for the next item.` };
  }

  function buildPaymentSummary() {
    return payments
      .filter((payment) => Number(payment.amount || 0) > 0)
      .map((payment) => `${formatPaymentMethodLabel(payment.method)} ${formatMoney(Number(payment.amount || 0), business?.currency ?? "KES")}${payment.reference?.trim() ? ` • ${payment.reference.trim()}` : ""}`)
      .join(" | ");
  }

  function buildCheckoutNote() {
    const parts = [checkoutNote.trim(), buildPaymentSummary()].filter(Boolean);
    if (!parts.length) {
      return null;
    }
    return parts.join(" || ");
  }

  function setPrimaryPaymentMethod(method: PaymentMode) {
    setPaymentMode(method);
    setPayments((current) => {
      if (!current.length) {
        return [{ id: createId(), method, amount: total, reference: "", note: "" }];
      }
      return current.map((payment, index) => (index === 0 ? { ...payment, method } : payment));
    });
  }

  function updatePaymentLine(id: string, patch: Partial<PaymentStep>) {
    setPayments((current) => current.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)));
  }

  function addPaymentLine() {
    setPayments((current) => current.concat([{ id: createId(), method: paymentMode, amount: 0, reference: "", note: "" }]));
  }

  function removePaymentLine(id: string) {
    setPayments((current) => (current.length === 1 ? current : current.filter((payment) => payment.id !== id)));
  }

  function buildSalePreview() {
    const note = buildCheckoutNote();
    const lines = cart.map((line) => ({
      id: createId(),
      saleId: "preview",
      productId: line.productId,
      productName: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      costPrice: line.costPrice,
      lineDiscount: line.discount,
      lineTotal: line.unitPrice * line.quantity - line.discount
    }));
    const sale = {
      id: currentDraftId ?? "preview",
      businessId: business?.id ?? "preview",
      branchId: selectedBranchId,
      customerId,
      receiptNumber: `PREVIEW-${Date.now().toString().slice(-6)}`,
      subtotal,
      discountTotal: lineDiscountTotal + orderDiscountTotal,
      taxTotal,
      grandTotal: total,
      amountPaid,
      balanceDue,
      paymentStatus,
      paymentMethod,
      cashierId: null,
      notes: note,
      items: lines,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    } as any;
    return buildReceiptArtifacts(sale, lines, business?.currency ?? "KES", user?.fullName?.trim() || user?.roleLabel?.trim() || "Staff", business?.name ?? "Dira OS");
  }

  async function refreshDrafts() {
    const nextDrafts = await listPosDrafts();
    setDrafts(nextDrafts);
  }

  async function saveCurrentDraft(mode: PosMode = checkoutMode) {
    if (!cart.length) {
      Alert.alert("Nothing to save", "Add items before saving a draft.");
      return;
    }
    const draftPayload = {
      title: mode === "return" ? `Return draft ${Date.now().toString().slice(-4)}` : `Sale draft ${Date.now().toString().slice(-4)}`,
      mode,
      cart,
      paymentMethod,
      payments,
      discountMode,
      discountValue: Number(discountValue || 0),
      taxMode,
      taxValue: Number(taxValue || 0),
      relatedSaleId: null,
      customerId,
      ...(currentDraftId ? { id: currentDraftId } : {}),
      ...(checkoutNote.trim() ? { notes: checkoutNote.trim() } : {}),
      ...(lookupCode.trim() ? { lookupCode: lookupCode.trim() } : {}),
      ...(productSearch.trim() ? { productSearch: productSearch.trim() } : {})
    } satisfies Parameters<typeof savePosDraft>[0];
    const draft = await savePosDraft(draftPayload);
    setCurrentDraftId(draft.id);
    await refreshDrafts();
    Alert.alert("Draft saved", mode === "return" ? "Return draft saved locally." : "Sale draft saved locally.");
  }

  async function holdDraft() {
    await saveCurrentDraft(checkoutMode);
  }

  async function openReceiptPreview() {
    if (!cart.length) {
      Alert.alert("Nothing to preview", "Add items before previewing a receipt.");
      return;
    }
    setPreviewReceipt(buildSalePreview());
    setPreviewVisible(true);
  }

  async function loadDraft(draft: PosDraft) {
    setCheckoutMode(draft.mode);
    setCustomerId(draft.customerId ?? null);
    setCart(draft.cart);
    setPaymentMode(draft.paymentMethod);
    setPayments(draft.payments.length ? draft.payments : [{ id: createId(), method: draft.paymentMethod, amount: 0, reference: "", note: "" }]);
    setDiscountMode(draft.discountMode);
    setDiscountValue(String(draft.discountValue ?? 0));
    setTaxMode(draft.taxMode);
    setTaxValue(String(draft.taxValue ?? 0));
    setCheckoutNote(draft.notes ?? "");
    setLookupCode(draft.lookupCode ?? "");
    setProductSearch(draft.productSearch ?? "");
    setCurrentDraftId(draft.id);
    setModalVisible(true);
  }

  async function saveSale() {
    if (savingRef.current) return;
    if (!cart.length) {
      Alert.alert(`Add ${catalogItemLabel.toLowerCase()}s`, `Choose at least one ${catalogItemLabel.toLowerCase()} before recording the transaction.`);
      return;
    }

    if (checkoutMode === "return") {
      savingRef.current = true;
      setSaving(true);
      try {
        await saveCurrentDraft("return");
        setPreviewReceipt(buildSalePreview());
        setPreviewVisible(true);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const note = buildCheckoutNote();
      const result = await createSale({
        customerId,
        paymentMethod: paymentMode,
        paymentStatus,
        amountPaid,
        discountTotal: lineDiscountTotal + orderDiscountTotal,
        taxTotal,
        notes: note ?? (paymentMode === "mpesa" ? "Mobile payment pending STK confirmation" : null),
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          costPrice: line.costPrice,
          discount: line.discount
        }))
      });
      setReceipt(result.receipt);
      setScannerVisible(false);
      setModalVisible(false);
      clearSaleForm();
      await refreshDrafts();
      Alert.alert("Sale recorded", "The sale has been saved and the history has been refreshed.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to record sale");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen>
      <GradientHeader
        title={businessConfig.navigation.posLabel}
        subtitle={`${sales.length} ${businessConfig.workspace.activityLabel.toLowerCase()} · ${pendingSync ? `${pendingSync} pending sync` : "Synced"}`}
        right={
          <Pressable onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel={`Record ${primaryAction}`} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={26} color={tokens.colors.primaryStrong} />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={refreshSales} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 9, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>{businessConfig.workflow.headline}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name={pendingSync ? "cloud-upload-outline" : "cloud-done-outline"} size={13} color={pendingSync ? tokens.colors.warning : tokens.colors.success} />
              <Text style={{ color: pendingSync ? tokens.colors.warning : tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{pendingSync ? `${pendingSync} waiting to sync` : syncMessage || "All transactions synced"}</Text>
            </View>
          </View>
          <PrimaryButton title={primaryAction} iconLeft="add" onPress={() => setModalVisible(true)} style={{ minHeight: 40, paddingHorizontal: 12 }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 2 }}>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{sales.length} transactions</Text>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{drafts.length} drafts</Text>
            {pendingSync > 0 ? <Text style={{ color: tokens.colors.warning, fontSize: 11, fontWeight: "700" }}>{pendingSync} pending</Text> : null}
          </View>
        </View>

        <InputField label="Search transactions" value={search} onChangeText={setSearch} placeholder="Receipt, customer, payment method" leftAccessory={<Ionicons name="search-outline" size={18} color={tokens.colors.textMuted} />} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 7 }} accessibilityLabel="Transaction status filters">
          {([{ key: "all", label: "All" }, { key: "open", label: "Outstanding" }, { key: "paid", label: "Paid" }] as const).map((filter) => (
            <Pressable
              key={filter.key}
              onPress={() => setStatusFilter(filter.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: statusFilter === filter.key }}
              style={{ minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, backgroundColor: statusFilter === filter.key ? tokens.colors.surfaceAlt : tokens.colors.surface, borderWidth: 1, borderColor: statusFilter === filter.key ? tokens.colors.primary : tokens.colors.border }}
            >
              <Text style={{ color: statusFilter === filter.key ? tokens.colors.primaryStrong : tokens.colors.textSecondary, fontSize: 12, fontWeight: "700" }}>{filter.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
          <Pressable onPress={() => setShowDrafts((visible) => !visible)} accessibilityRole="button" accessibilityState={{ expanded: showDrafts }} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="file-tray-full-outline" size={18} color={tokens.colors.icon} />
            <Text style={{ flex: 1, color: tokens.colors.text, fontSize: 13, fontWeight: "700" }}>{businessConfig.workspace.primaryEntity} drafts</Text>
            <Badge label={String(drafts.length)} tone={drafts.length ? "warning" : "primary"} />
            <Ionicons name={showDrafts ? "chevron-up" : "chevron-down"} size={18} color={tokens.colors.textSecondary} />
          </Pressable>
          {showDrafts ? drafts.length ? (
            <View style={{ gap: 6 }}>
              {drafts.map((draft) => (
                <View key={draft.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: tokens.colors.border, gap: 7 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: tokens.colors.text, fontWeight: "700" }} numberOfLines={1}>{draft.title}</Text>
                      <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{draft.mode === "return" ? "Return draft" : "Sale draft"} · {formatDate(draft.updatedAt, "MMM d, p")} · {draft.cart.length} items · {formatMoney(draft.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity - line.discount, 0), business?.currency ?? "KES")}</Text>
                    </View>
                    <Badge label={draft.mode === "return" ? "Return" : "Sale"} tone={draft.mode === "return" ? "warning" : "primary"} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><PrimaryButton title="Resume" variant="secondary" onPress={() => void loadDraft(draft)} /></View>
                    <View style={{ flex: 1 }}><PrimaryButton title="Delete draft" variant="secondary" onPress={() => Alert.alert("Delete this draft?", "This saved basket cannot be recovered.", [{ text: "Keep draft", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await removePosDraft(draft.id); await refreshDrafts(); } }])} /></View>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><PrimaryButton title="Refresh drafts" variant="secondary" onPress={() => void refreshDrafts()} /></View>
                <View style={{ flex: 1 }}><PrimaryButton title="Clear all" variant="secondary" onPress={() => Alert.alert("Clear all drafts?", "All saved sale and return drafts will be deleted.", [{ text: "Cancel", style: "cancel" }, { text: "Clear drafts", style: "destructive", onPress: async () => { await clearPosDrafts(); await refreshDrafts(); } }])} /></View>
              </View>
            </View>
          ) : <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, paddingBottom: 10 }}>No saved drafts.</Text> : null}
        </View>

        <SectionHeader title={businessConfig.workspace.activityLabel} description={`${filteredSales.length} shown · ${sales.length} total`} />
        {filteredSales.length ? (
          filteredSales.map((sale) => {
            const methodLabel = formatPaymentMethodLabel(String(sale.paymentMethod ?? "cash"));
            const paymentState = String(sale.paymentStatus ?? "paid");
            const transactionType = (sale as any).transactionType ?? "sale";
            return (
              <View key={sale.id} style={{ gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>{sale.receiptNumber}</Text>
                    <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{formatDate(sale.createdAt, "MMM d, yyyy · p")} · {methodLabel}{sale.customerId ? ` · ${customers.find((customer) => customer.id === sale.customerId)?.name ?? "Customer"}` : " · Walk-in"}</Text>
                  </View>
                  <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{formatMoney(sale.grandTotal, business?.currency ?? "KES")}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Badge label={transactionType === "refund" ? "Refund" : transactionType === "return" ? "Return" : "Sale"} tone={transactionType === "refund" || transactionType === "return" ? "warning" : "success"} />
                  <Badge label={formatPaymentStatusLabel(paymentState)} tone={paymentState === "paid" ? "success" : paymentState === "unpaid" ? "danger" : "warning"} />
                  {sale.balanceDue > 0 ? <Text style={{ color: tokens.colors.warning, fontSize: 11, fontWeight: "700" }}>Due {formatMoney(sale.balanceDue, business?.currency ?? "KES")}</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => { const receiptArtifacts = buildReceiptArtifacts(sale as any, sale.items as any, business?.currency ?? "KES", user?.fullName?.trim() || user?.roleLabel?.trim() || "Staff", business?.name ?? "Dira OS"); setPreviewReceipt(receiptArtifacts); setPreviewVisible(true); }} accessibilityRole="button" accessibilityLabel={`Preview receipt ${sale.receiptNumber}`} hitSlop={5} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="receipt-outline" size={19} color={tokens.colors.primaryStrong} />
                  </Pressable>
                  <Pressable onPress={() => { setCheckoutMode("return"); setCurrentDraftId(null); setCustomerId(sale.customerId ?? null); setCart(sale.items.map((item) => ({ productId: item.productId, name: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, costPrice: item.costPrice, discount: item.lineDiscount }))); setPayments([{ id: createId(), method: "cash", amount: 0, reference: "", note: `Return for ${sale.receiptNumber}` }]); setCheckoutNote(`Return draft for ${sale.receiptNumber}`); setLookupCode(""); setProductSearch(""); setModalVisible(true); }} accessibilityRole="button" accessibilityLabel={`Start return draft for ${sale.receiptNumber}`} hitSlop={5} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="return-up-back-outline" size={19} color={tokens.colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState
            title={search || statusFilter !== "all" ? "No matching transactions" : "No sales yet"}
            subtitle={search || statusFilter !== "all" ? "Try another search or change the status filter." : `Use ${primaryAction} to create the first entry.`}
            icon="receipt-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal
        visible={modalVisible}
        title={primaryAction}
        subtitle={`${checkoutMode === "return" ? "Return draft" : "Checkout"} · ${cart.length} item${cart.length === 1 ? "" : "s"}`}
        fixedFooter
        onClose={() => setModalVisible(false)}
        footer={(
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }}>TOTAL · PAID · BALANCE</Text>
                <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{formatMoney(total, business?.currency ?? "KES")}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: tokens.colors.success, fontSize: 11 }}>Paid {formatMoney(amountPaid, business?.currency ?? "KES")}</Text>
                <Text style={{ color: balanceDue ? tokens.colors.warning : tokens.colors.textSecondary, fontSize: 11 }}>Due {formatMoney(balanceDue, business?.currency ?? "KES")}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><PrimaryButton title="Close" variant="secondary" onPress={() => setModalVisible(false)} /></View>
              <View style={{ flex: 1 }}><PrimaryButton title={saving ? "Saving…" : checkoutMode === "return" ? "Save return draft" : `Record · ${formatMoney(total, business?.currency ?? "KES")}`} onPress={saveSale} loading={saving} disabled={!cart.length} /></View>
            </View>
          </View>
        )}
      >
        <AppScrollView contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
            {businessConfig.operatingModel === "commerce" ? `Add ${catalogLabel.toLowerCase()}, confirm payment, and record the sale.` : `Add ${catalogLabel.toLowerCase()}, confirm payment, and close the ${businessConfig.workspace.primaryEntity.toLowerCase()}.`}
          </Text>

          <Card style={{ gap: 8, padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }}>Checkout mode</Text>
              <Badge label={checkoutMode === "return" ? "Return" : "Sale"} tone={checkoutMode === "return" ? "warning" : "success"} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[
                { value: "sale" as const, label: "Sale" },
                { value: "return" as const, label: "Return draft" }
              ].map((option) => (
                <Pressable key={option.value} onPress={() => setCheckoutMode(option.value)}>
                  <Badge label={option.label} tone={checkoutMode === option.value ? "success" : "primary"} />
                </Pressable>
              ))}
            </View>
          </Card>

          <Dropdown label="Customer" value={customerId ?? ""} options={customerOptions} onChange={(value) => setCustomerId(value || null)} placeholder="Walk-in customer" helperText="Optional. Choose a customer to link this transaction and any balance." />

          <Card style={{ gap: 9, padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }}>{catalogLabel}</Text>
              <Badge label={`${filteredProducts.length} found`} tone="primary" />
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <InputField label={`Search ${businessConfig.terminology.catalogItem.toLowerCase()}s`} value={productSearch} onChangeText={setProductSearch} placeholder={`Find a ${businessConfig.terminology.catalogItem.toLowerCase()}`} />
              </View>
              {supportsBarcode ? <PrimaryButton title="Scan" variant="secondary" iconLeft="scan-outline" onPress={() => setScannerVisible(true)} /> : null}
            </View>
            {filteredProducts.length ? (
              <View style={{ gap: 8 }}>
                {filteredProducts.slice(0, 12).map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => addToCart(product.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${product.name}, ${formatMoney(product.sellingPrice, business?.currency ?? "KES")}`}
                    style={({ pressed }) => ({ paddingVertical: 9, borderTopWidth: 1, borderColor: tokens.colors.border, gap: 3, opacity: pressed ? 0.72 : 1 })}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "900", flex: 1 }} numberOfLines={1}>{product.name}</Text>
                      <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "900" }}>{formatMoney(product.sellingPrice, business?.currency ?? "KES")}</Text>
                    </View>
                    <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                      {tracksStock ? `${product.sku ?? "No SKU"} • ${product.stockOnHand > 0 ? `Stock ${product.stockOnHand}` : "Unavailable"}` : `${product.serviceDurationMinutes ? `${product.serviceDurationMinutes} min` : "Available"} • ${catalogItemLabel}`}
                    </Text>
                  </Pressable>
                ))}
                {filteredProducts.length > 12 ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>Showing 12 of {filteredProducts.length}. Refine your search to find another item.</Text> : null}
              </View>
            ) : (
              <EmptyState title={`No matching ${businessConfig.terminology.catalogItem.toLowerCase()}s`} subtitle={`Try a different ${businessConfig.terminology.catalogItem.toLowerCase()} name or code.`} icon="cube-outline" />
            )}
          </Card>

          <Card style={{ gap: 9, padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }}>{businessConfig.operatingModel === "commerce" ? "Basket" : `${businessConfig.workspace.primaryEntity} lines`}</Text>
              <Badge label={`${cart.length} line${cart.length === 1 ? "" : "s"}`} tone={cart.length ? "success" : "primary"} />
            </View>
            {cart.length ? (
              cart.map((line) => (
                <View key={line.productId} style={{ gap: 7, paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>{line.name}</Text>
                      <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{formatMoney(line.unitPrice, business?.currency ?? "KES")} each</Text>
                    </View>
                    <Pressable onPress={() => removeLine(line.productId)} accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`}>
                      <Ionicons name="trash-outline" size={17} color={tokens.colors.danger} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => changeLineQuantity(line.productId, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease ${line.name}`}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: tokens.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: tokens.colors.border
                      }}
                    >
                      <Ionicons name="remove" size={15} color={tokens.colors.text} />
                    </Pressable>
                    <View style={{ minWidth: 34, alignItems: "center" }}>
                      <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "900" }}>{line.quantity}</Text>
                    </View>
                    <Pressable
                      onPress={() => changeLineQuantity(line.productId, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase ${line.name}`}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: tokens.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: tokens.colors.border
                      }}
                    >
                      <Ionicons name="add" size={15} color={tokens.colors.text} />
                    </Pressable>
                    <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "900", marginLeft: "auto" }}>{formatMoney(line.unitPrice * line.quantity - line.discount, business?.currency ?? "KES")}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label="Unit price"
                        value={String(line.unitPrice)}
                        onChangeText={(text) => setCart((current) => current.map((item) => item.productId === line.productId ? { ...item, unitPrice: Number(text || 0) } : item))}
                        keyboardType="decimal-pad"
                        helperText="Current item price."
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label="Line discount"
                        value={String(line.discount)}
                        onChangeText={(text) =>
                          setCart((current) => current.map((item) => (item.productId === line.productId ? { ...item, discount: Number(text || 0) } : item)))
                        }
                        keyboardType="decimal-pad"
                        helperText="Optional discount for this item."
                      />
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState title="No lines added" subtitle={`Tap ${catalogItemLabel.toLowerCase()}s above to add them.`} icon="cart-outline" />
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: 12, gap: 4 }}>
              <Text style={{ color: tokens.colors.textSecondary }}>Subtotal: {formatMoney(subtotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Line discounts: {formatMoney(lineDiscountTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Order discount: {formatMoney(orderDiscountTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Tax: {formatMoney(taxTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>Total: {formatMoney(total, business?.currency ?? "KES")}</Text>
            </View>
          </Card>

          <Card style={{ gap: 8, padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }}>Payment</Text>
              <Badge label={paymentStatus} tone={paymentStatus === "paid" ? "success" : paymentStatus === "partial" ? "warning" : "primary"} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[
                { value: "cash" as const, label: "Cash" },
                { value: "mpesa" as const, label: "Mobile" },
                { value: "bank" as const, label: "Bank" },
                { value: "card" as const, label: "Card" },
                { value: "cheque" as const, label: "Cheque" },
                { value: "other" as const, label: "Other" },
                { value: "credit" as const, label: "Credit" }
              ].map((option) => (
                <Pressable key={option.value} onPress={() => setPrimaryPaymentMethod(option.value)}>
                  <Badge label={option.label} tone={paymentMode === option.value ? "success" : "primary"} />
                </Pressable>
              ))}
            </View>
            {primaryPayment ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <InputField
                      label="Amount paid"
                      value={String(primaryPayment.amount)}
                      onChangeText={(value) => updatePaymentLine(primaryPayment.id, { amount: Number(value || 0) })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField
                      label="Reference"
                      value={primaryPayment.reference ?? ""}
                      onChangeText={(value) => updatePaymentLine(primaryPayment.id, { reference: value })}
                      placeholder="Optional"
                    />
                  </View>
                </View>
                <InputField
                  label="Payment note"
                  value={primaryPayment.note ?? ""}
                  onChangeText={(value) => updatePaymentLine(primaryPayment.id, { note: value })}
                  placeholder="Optional note"
                />
                <Text style={{ color: tokens.colors.textMuted, fontSize: 11 }}>
                  Paid {formatMoney(amountPaid, business?.currency ?? "KES")} • Due {formatMoney(balanceDue, business?.currency ?? "KES")} • Change {formatMoney(changeDue, business?.currency ?? "KES")}
                </Text>
              </View>
            ) : null}

            {paymentMode === "mpesa" ? (
              <Card style={{ gap: 10, backgroundColor: tokens.colors.surfaceAlt }}>
                <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>Mobile payment</Text>
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
                  Direct STK push will plug in here when the gateway is connected.
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
          </Card>

          <PrimaryButton
            title={showAdvanced ? "Hide advanced options" : "More options"}
            variant="secondary"
            onPress={() => setShowAdvanced((current) => !current)}
          />

          {showAdvanced ? (
            <>
              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Discounts and taxes</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { value: "flat" as const, label: "Flat" },
                    { value: "percent" as const, label: "Percent" }
                  ].map((option) => (
                    <Pressable key={`discount-${option.value}`} onPress={() => setDiscountMode(option.value)}>
                      <Badge label={`Discount ${option.label}`} tone={discountMode === option.value ? "success" : "primary"} />
                    </Pressable>
                  ))}
                </View>
                <InputField
                  label="Order discount"
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  keyboardType="decimal-pad"
                  helperText={discountMode === "percent" ? "Percent off the subtotal after line discounts." : "Flat discount amount."}
                />
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { value: "flat" as const, label: "Flat" },
                    { value: "percent" as const, label: "Percent" }
                  ].map((option) => (
                    <Pressable key={`tax-${option.value}`} onPress={() => setTaxMode(option.value)}>
                      <Badge label={`Tax ${option.label}`} tone={taxMode === option.value ? "success" : "primary"} />
                    </Pressable>
                  ))}
                </View>
                <InputField
                  label="Tax"
                  value={taxValue}
                  onChangeText={setTaxValue}
                  keyboardType="decimal-pad"
                  helperText={taxMode === "percent" ? "Percentage applied after discount." : "Flat tax amount."}
                />
              </Card>

              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Split payments</Text>
                {payments.slice(1).map((payment, index) => (
                  <Card key={payment.id} style={{ gap: 10, padding: 12, backgroundColor: tokens.colors.surfaceAlt }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Split payment {index + 2}</Text>
                      <Pressable onPress={() => removePaymentLine(payment.id)} accessibilityRole="button" accessibilityLabel="Remove payment line">
                        <Ionicons name="close-circle-outline" size={18} color={tokens.colors.textSecondary} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {(["cash", "mpesa", "bank", "credit"] as const).map((method) => (
                        <Pressable key={`${payment.id}-${method}`} onPress={() => updatePaymentLine(payment.id, { method })}>
                          <Badge label={formatPaymentMethodLabel(method)} tone={payment.method === method ? "success" : "primary"} />
                        </Pressable>
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <InputField
                          label="Amount"
                          value={String(payment.amount)}
                          onChangeText={(value) => updatePaymentLine(payment.id, { amount: Number(value || 0) })}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <InputField
                          label="Reference"
                          value={payment.reference ?? ""}
                          onChangeText={(value) => updatePaymentLine(payment.id, { reference: value })}
                          placeholder="Optional"
                        />
                      </View>
                    </View>
                    <InputField
                      label="Payment note"
                      value={payment.note ?? ""}
                      onChangeText={(value) => updatePaymentLine(payment.id, { note: value })}
                      placeholder="Optional note"
                    />
                  </Card>
                ))}
                <PrimaryButton title="Add split payment" variant="secondary" onPress={addPaymentLine} />
              </Card>

              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Receipt and lookup</Text>
                <InputField label="Checkout note" value={checkoutNote} onChangeText={setCheckoutNote} multiline numberOfLines={3} placeholder="Optional notes for the receipt" />
                <InputField
                  label="Code"
                  value={lookupCode}
                  onChangeText={setLookupCode}
                  placeholder="Scan or type code"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLookupSubmit}
                  rightAccessory={
                    <Pressable onPress={() => setScannerVisible(true)} accessibilityRole="button" accessibilityLabel="Open barcode scanner">
                      <Ionicons name="scan-outline" size={20} color={tokens.colors.primaryStrong} />
                    </Pressable>
                  }
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Add to cart" onPress={handleLookupSubmit} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Scan barcode"
                      variant="secondary"
                      onPress={() => setScannerVisible(true)}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Preview receipt"
                      variant="secondary"
                      onPress={() => void openReceiptPreview()}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Hold sale" variant="secondary" onPress={() => void holdDraft()} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Clear lookup"
                      variant="secondary"
                      onPress={() => {
                        setLookupCode("");
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }} />
                </View>
                {lookupMatch ? (
                  <Card style={{ gap: 4, padding: 12, backgroundColor: tokens.colors.surfaceAlt }}>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{lookupMatch.name}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>
                      {lookupMatch.sku ?? "No SKU"} • {lookupMatch.barcode ?? "No barcode"} • Stock {lookupMatch.stockOnHand}
                    </Text>
                    <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>Press Enter to add immediately</Text>
                  </Card>
                ) : lookupCode.trim() ? (
                  <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>No exact match yet. Try the full code or barcode.</Text>
                ) : null}
              </Card>
            </>
          ) : null}

        </AppScrollView>
      </SimpleModal>

      <BarcodeScannerModal
        visible={scannerVisible}
        closeOnScan={false}
        onClose={() => setScannerVisible(false)}
        onBarcodeScanned={handleScannedBarcode}
      />

      <SimpleModal visible={previewVisible} title="Receipt preview" onClose={() => setPreviewVisible(false)}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Review the receipt layout before you commit the sale or keep the basket as a draft.
          </Text>
          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{previewReceipt?.servedBy ?? "Staff"}</Text>
            <Text style={{ color: tokens.colors.textSecondary, fontFamily: "monospace", fontSize: 12, lineHeight: 18 }}>{previewReceipt?.text ?? "No receipt preview available."}</Text>
          </Card>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Copy preview"
                variant="secondary"
                onPress={async () => {
                  if (!previewReceipt) return;
                  await copyReceipt(previewReceipt.text);
                  Alert.alert("Copied", "Preview receipt copied to clipboard.");
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Share PDF"
                variant="secondary"
                onPress={async () => {
                  if (!previewReceipt) return;
                  await shareReceiptPdf(previewReceipt.html, previewReceipt.fileName);
                }}
              />
            </View>
          </View>
          <PrimaryButton
            title="Close"
            onPress={() => {
              setPreviewVisible(false);
            }}
          />
        </View>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 4 }}>
      <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{value}</Text>
    </View>
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

function findProductByCode(products: Array<{ id: string; name: string; stockOnHand: number; sku?: string | null; barcode?: string | null }>, code: string) {
  const query = code.trim().toLowerCase();
  if (!query) return null;
  return (
    products.find((product) => (product.sku ?? "").trim().toLowerCase() === query) ??
    products.find((product) => (product.barcode ?? "").trim().toLowerCase() === query) ??
    null
  );
}
