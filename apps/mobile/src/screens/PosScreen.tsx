import React from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/store/useAppStore";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { formatDate } from "@/utils/date";
import { copyReceipt, printBluetoothReceipt, shareReceiptPdf } from "@/services/printerService";
import { buildReceiptArtifacts, type ReceiptArtifacts } from "@/services/receiptService";
import { clearPosDrafts, listPosDrafts, removePosDraft, savePosDraft, type PosDraft, type PosMode, type PosPaymentLine } from "@/services/posDrafts";
import { createId } from "@/utils/id";

type PaymentMode = "cash" | "mpesa" | "bank" | "credit";

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
};

type PaymentStep = PosPaymentLine;

export function PosScreen() {
  const products = useAppStore((state) => state.products);
  const sales = useAppStore((state) => state.sales);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncMessage = useAppStore((state) => state.syncMessage);
  const createSale = useAppStore((state) => state.createSale);
  const loadCatalog = useAppStore((state) => state.loadCatalog);

  const [search, setSearch] = React.useState("");
  const [modalVisible, setModalVisible] = React.useState(false);
  const [lookupCode, setLookupCode] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [drafts, setDrafts] = React.useState<PosDraft[]>([]);
  const [currentDraftId, setCurrentDraftId] = React.useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = React.useState<PosMode>("sale");
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
  const [refreshing, setRefreshing] = React.useState(false);
  const [stkInitiating, setStkInitiating] = React.useState(false);
  const [receipt, setReceipt] = React.useState<ReceiptArtifacts | null>(null);
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

  const filteredSales = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return sales.filter((sale) => {
      if (!query) return true;
      return [sale.receiptNumber, sale.customerId ?? "", sale.paymentMethod, sale.paymentStatus].join(" ").toLowerCase().includes(query);
    });
  }, [deferredSearch, sales]);

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
    setLookupCode("");
    setPaymentMode("cash");
    setCheckoutMode("sale");
    setDiscountMode("flat");
    setDiscountValue("0");
    setTaxMode("flat");
    setTaxValue("0");
    setPayments([{ id: createId(), method: "cash", amount: 0, reference: "", note: "" }]);
    setCheckoutNote("");
    setCurrentDraftId(null);
  }

  function handleLookupSubmit() {
    if (!lookupMatch) {
      Alert.alert("No match", "Try scanning or typing a full SKU or barcode.");
      return;
    }
    addToCart(lookupMatch.id);
    setLookupCode("");
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
      branchId: null,
      customerId: null,
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
    return buildReceiptArtifacts(sale, lines, business?.currency ?? "KES", user?.fullName?.trim() || user?.roleLabel?.trim() || "Staff", business?.name ?? "Biz Pro");
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
      customerId: null,
      relatedSaleId: null,
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
    if (!cart.length) {
      Alert.alert("Add products", "Choose at least one product before recording the sale.");
      return;
    }

    if (checkoutMode === "return") {
      await saveCurrentDraft("return");
      setPreviewReceipt(buildSalePreview());
      setPreviewVisible(true);
      return;
    }

    setSaving(true);
    try {
      const note = buildCheckoutNote();
      const result = await createSale({
        paymentMethod: paymentMode,
        paymentStatus,
        amountPaid,
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
      setModalVisible(false);
      clearSaleForm();
      await refreshDrafts();
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

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Metric label="Drafts" value={String(drafts.length)} />
            <Metric label="Queued" value={String(pendingSync)} />
          </View>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 18 }}>{syncMessage}</Text>
        </Card>

        <Card>
          <InputField label="Search sales" value={search} onChangeText={setSearch} placeholder="Receipt, method, or status" />
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Draft sales</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
                Hold a basket, resume later, or keep a return slip for supervisor review.
              </Text>
            </View>
            <Badge label={`${drafts.length} saved`} tone={drafts.length ? "success" : "primary"} />
          </View>
          {drafts.length ? (
            drafts.map((draft) => (
              <Card key={draft.id} style={{ gap: 8, padding: 12, backgroundColor: tokens.colors.surfaceAlt }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{draft.title}</Text>
                    <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
                      {draft.mode === "return" ? "Return draft" : "Sale draft"} • {formatDate(draft.updatedAt, "PPP p")}
                    </Text>
                  </View>
                  <Badge label={draft.mode === "return" ? "Return" : "Sale"} tone={draft.mode === "return" ? "warning" : "primary"} />
                </View>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
                  {draft.cart.length} item{draft.cart.length === 1 ? "" : "s"} • {formatMoney(draft.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity - line.discount, 0), business?.currency ?? "KES")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Resume" variant="secondary" onPress={() => void loadDraft(draft)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Delete"
                      variant="secondary"
                      onPress={async () => {
                        await removePosDraft(draft.id);
                        await refreshDrafts();
                      }}
                    />
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>No drafts yet. Hold a sale to save one here.</Text>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Refresh drafts" variant="secondary" onPress={() => void refreshDrafts()} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Clear drafts"
                variant="secondary"
                onPress={async () => {
                  await clearPosDrafts();
                  await refreshDrafts();
                }}
              />
            </View>
          </View>
        </Card>

        {filteredSales.length ? (
          filteredSales.map((sale) => {
            const methodLabel = formatPaymentMethodLabel(String(sale.paymentMethod ?? "cash"));
            const paymentState = String(sale.paymentStatus ?? "paid");
            const transactionType = (sale as any).transactionType ?? "sale";
            return (
              <Card key={sale.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{sale.receiptNumber}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>
                      {formatDate(sale.createdAt, "PPP p")} • {methodLabel}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Badge label={transactionType === "refund" ? "Refund" : transactionType === "return" ? "Return" : "Sale"} tone={transactionType === "refund" || transactionType === "return" ? "warning" : "success"} />
                    <Badge label={formatPaymentStatusLabel(paymentState)} tone={paymentState === "paid" ? "success" : paymentState === "unpaid" ? "danger" : "warning"} />
                  </View>
                </View>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>{formatMoney(sale.grandTotal, business?.currency ?? "KES")}</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>
                  {sale.items.length} item{sale.items.length === 1 ? "" : "s"} • {sale.customerId ? "Linked customer" : "Walk-in sale"}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Preview"
                      variant="secondary"
                      onPress={() => {
                        const receiptArtifacts = buildReceiptArtifacts(sale as any, sale.items as any, business?.currency ?? "KES", user?.fullName?.trim() || user?.roleLabel?.trim() || "Staff", business?.name ?? "Biz Pro");
                        setPreviewReceipt(receiptArtifacts);
                        setPreviewVisible(true);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Return"
                      variant="secondary"
                      onPress={() => {
                        setCheckoutMode("return");
                        setCurrentDraftId(null);
                        setCart(
                          sale.items.map((item) => ({
                            productId: item.productId,
                            name: item.productName,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            costPrice: item.costPrice,
                            discount: item.lineDiscount
                          }))
                        );
                        setPayments([{ id: createId(), method: "cash", amount: 0, reference: "", note: `Return for ${sale.receiptNumber}` }]);
                        setCheckoutNote(`Return draft for ${sale.receiptNumber}`);
                        setLookupCode("");
                        setProductSearch("");
                        setModalVisible(true);
                      }}
                    />
                  </View>
                </View>
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

          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Checkout mode</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Sale mode records normally. Return draft mode prepares a reversal slip for review and hold, without changing existing recorded sales.
            </Text>
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
                <Pressable key={option.value} onPress={() => setPrimaryPaymentMethod(option.value)}>
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

          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Discounts and taxes</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Apply an order-level discount or tax. Line-level discounts remain editable directly on each item.
            </Text>
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
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Split the checkout across cash, mobile money, bank, or credit without changing the recorded sales contract.
            </Text>
            {payments.map((payment, index) => (
              <Card key={payment.id} style={{ gap: 10, padding: 12, backgroundColor: tokens.colors.surfaceAlt }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Payment {index + 1}</Text>
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
            <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
              Paid {formatMoney(amountPaid, business?.currency ?? "KES")} • Due {formatMoney(balanceDue, business?.currency ?? "KES")} • Change {formatMoney(changeDue, business?.currency ?? "KES")}
            </Text>
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Receipt preview</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Preview the receipt before posting the sale, or keep the transaction as a draft for later.
            </Text>
            <InputField label="Checkout note" value={checkoutNote} onChangeText={setCheckoutNote} multiline numberOfLines={3} placeholder="Optional notes for the receipt" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Preview receipt" variant="secondary" onPress={() => void openReceiptPreview()} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Hold sale" variant="secondary" onPress={() => void holdDraft()} />
              </View>
            </View>
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Barcode / SKU lookup</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
              Scan a barcode, enter a SKU, or paste a product code to add items faster.
            </Text>
            <InputField
              label="Code"
              value={lookupCode}
              onChangeText={setLookupCode}
              placeholder="Scan or type code"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLookupSubmit}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Add to cart" onPress={handleLookupSubmit} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Clear"
                  variant="secondary"
                  onPress={() => {
                    setLookupCode("");
                  }}
                />
              </View>
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
                  <InputField
                    label="Line discount"
                    value={String(line.discount)}
                    onChangeText={(text) =>
                      setCart((current) => current.map((item) => (item.productId === line.productId ? { ...item, discount: Number(text || 0) } : item)))
                    }
                    keyboardType="decimal-pad"
                    helperText="Discount on this line only."
                  />
                </View>
              ))
            ) : (
              <EmptyState title="Cart is empty" subtitle="Tap products above to add multiple items to the sale." icon="cart-outline" />
            )}

            <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border, paddingTop: 12, gap: 4 }}>
              <Text style={{ color: tokens.colors.textSecondary }}>Subtotal: {formatMoney(subtotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Line discounts: {formatMoney(lineDiscountTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Order discount: {formatMoney(orderDiscountTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Tax: {formatMoney(taxTotal, business?.currency ?? "KES")}</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Total: {formatMoney(total, business?.currency ?? "KES")}</Text>
            </View>
          </Card>

          <View style={{ gap: 10 }}>
            <PrimaryButton title={saving ? "Saving..." : checkoutMode === "return" ? "Save return draft" : "Save sale"} onPress={saveSale} loading={saving} disabled={!cart.length} />
            <PrimaryButton title="Close" variant="secondary" onPress={() => setModalVisible(false)} />
          </View>
        </AppScrollView>
      </SimpleModal>

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
