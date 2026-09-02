import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { format, addDays } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useNavigation } from "@react-navigation/native";
import type { Customer, Invoice, Payment, Product } from "@shared";
import {
  AppScrollView,
  Badge,
  Card,
  Dropdown,
  EmptyState,
  ErrorState,
  GradientHeader,
  InputField,
  Loader,
  PrimaryButton,
  Screen,
  SimpleModal,
  StatCard,
  Tag
} from "@/components/Primitives";
import { env } from "@/config/env";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { createId } from "@/utils/id";
import {
  archiveInvoice,
  cancelInvoice,
  createCustomer,
  createInvoice,
  createInvoiceCreditNote,
  createInvoiceDebitNote,
  deleteDraftInvoice,
  duplicateInvoice,
  getInvoice,
  getInvoiceCustomerHistory,
  getInvoiceDashboard,
  getInvoicePdfHtml,
  listInvoices,
  markInvoiceViewed,
  recordInvoicePayment,
  restoreInvoice,
  sendInvoice,
  updateInvoice,
  voidInvoice
} from "@/services/apiClient";

type InvoiceFilter = "all" | "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "cancelled" | "void" | "refunded" | "archived";
type CustomerMode = "existing" | "new";
type InvoiceEditorMode = "create" | "edit";
type NoteModalMode = "credit" | "debit" | null;

type LineEditor = {
  id: string;
  productId: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  taxCategory: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom";
  taxCode: string;
  taxRate: string;
  taxInclusive: boolean;
};

type InvoiceEditorState = {
  visible: boolean;
  mode: InvoiceEditorMode;
  invoiceId: string | null;
  customerMode: CustomerMode;
  customerId: string;
  customerName: string;
  customerBusinessName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerTaxPin: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  currency: string;
  referenceNumber: string;
  purchaseOrderNumber: string;
  notes: string;
  termsAndConditions: string;
  amountPaid: string;
  lineItems: LineEditor[];
  sendOnSave: boolean;
};

type PaymentEditorState = {
  visible: boolean;
  invoiceId: string | null;
  amount: string;
  method: string;
  paymentDate: string;
  reference: string;
  note: string;
};

type NoteEditorState = {
  visible: boolean;
  invoiceId: string | null;
  mode: NoteModalMode;
  reference: string;
  amount: string;
  taxAdjustment: string;
  reason: string;
  note: string;
  date: string;
};

const FILTERS: InvoiceFilter[] = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "void", "refunded", "archived"];

function createLineEditor(product?: Product | null): LineEditor {
  return {
    id: createId(),
    productId: product?.id ?? "",
    description: product?.name ?? "",
    quantity: "1",
    unit: product?.unit ?? "pcs",
    unitPrice: String(product?.sellingPrice ?? 0),
    discountType: "fixed",
    discountValue: "0",
    taxCategory: "vat",
    taxCode: "",
    taxRate: "16",
    taxInclusive: false
  };
}

function createInvoiceEditor(businessCurrency: string, invoice?: Invoice | null): InvoiceEditorState {
  return {
    visible: true,
    mode: invoice ? "edit" : "create",
    invoiceId: invoice?.id ?? null,
    customerMode: invoice?.customerId ? "existing" : "new",
    customerId: invoice?.customerId ?? "",
    customerName: invoice?.customerName ?? "",
    customerBusinessName: invoice?.customerBusinessName ?? "",
    customerEmail: invoice?.customerEmail ?? "",
    customerPhone: invoice?.customerPhone ?? "",
    customerAddress: invoice?.customerAddress ?? "",
    customerTaxPin: invoice?.customerTaxPin ?? "",
    invoiceNumber: invoice?.invoiceNumber ?? "",
    issueDate: invoice?.issueDate ? invoice.issueDate.slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
    dueDate: invoice?.dueDate ? invoice.dueDate.slice(0, 10) : format(addDays(new Date(), 30), "yyyy-MM-dd"),
    paymentTerms: invoice?.paymentTerms ?? "30 days",
    currency: invoice?.currency ?? businessCurrency ?? "KES",
    referenceNumber: invoice?.referenceNumber ?? "",
    purchaseOrderNumber: invoice?.purchaseOrderNumber ?? "",
    notes: invoice?.notes ?? "",
    termsAndConditions: invoice?.termsAndConditions ?? "",
    amountPaid: String(invoice?.amountPaid ?? 0),
    lineItems:
      invoice?.lineItems?.length
        ? invoice.lineItems.map((line) => ({
            id: line.id,
            productId: line.productId ?? "",
            description: line.description,
            quantity: String(line.quantity),
            unit: line.unit,
            unitPrice: String(line.unitPrice),
            discountType: line.discountType,
            discountValue: String(line.discountValue),
            taxCategory: line.tax.taxCategory,
            taxCode: line.tax.taxCode ?? "",
            taxRate: String(line.tax.taxRate),
            taxInclusive: line.tax.taxInclusive
          }))
        : [createLineEditor(null)],
    sendOnSave: false
  };
}

function createPaymentEditor(invoiceId: string | null, amount = "0"): PaymentEditorState {
  return {
    visible: true,
    invoiceId,
    amount,
    method: "cash",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    reference: "",
    note: ""
  };
}

function createNoteEditor(invoiceId: string | null, mode: NoteModalMode): NoteEditorState {
  return {
    visible: true,
    invoiceId,
    mode,
    reference: "",
    amount: "0",
    taxAdjustment: "0",
    reason: "",
    note: "",
    date: format(new Date(), "yyyy-MM-dd")
  };
}

function linePreview(line: LineEditor) {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unitPrice || 0);
  const subtotal = quantity * unitPrice;
  const discount = line.discountType === "percentage" ? subtotal * (Number(line.discountValue || 0) / 100) : Number(line.discountValue || 0);
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxRate = Number(line.taxRate || 0);
  const tax = line.taxInclusive ? 0 : taxableAmount * (taxRate / 100);
  return {
    subtotal,
    discount,
    tax,
    total: line.taxInclusive ? taxableAmount : taxableAmount + tax
  };
}

export function InvoicesScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const customers = useAppStore((state) => state.customers);
  const products = useAppStore((state) => state.products);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const loadCatalog = useAppStore((state) => state.loadCatalog);

  const [dashboard, setDashboard] = React.useState<Awaited<ReturnType<typeof getInvoiceDashboard>> | null>(null);
  const [items, setItems] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [statusFilter, setStatusFilter] = React.useState<InvoiceFilter>("all");
  const [customerFilter, setCustomerFilter] = React.useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [editor, setEditor] = React.useState<InvoiceEditorState | null>(null);
  const [paymentEditor, setPaymentEditor] = React.useState<PaymentEditorState | null>(null);
  const [noteEditor, setNoteEditor] = React.useState<NoteEditorState | null>(null);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = React.useState<Awaited<ReturnType<typeof getInvoiceCustomerHistory>> | null>(null);
  const requestIdRef = React.useRef(0);

  const customerOptions = React.useMemo(() => [{ label: "All customers", value: "" }, ...customers.map((customer) => ({ label: customer.name, value: customer.id }))], [customers]);
  const productOptions = React.useMemo(
    () => [
      { label: "Custom item", value: "__custom__" },
      ...products.map((product) => ({ label: `${product.name} • ${product.sku ?? "No SKU"}`, value: product.id, description: `Stock ${product.stockOnHand}` }))
    ],
    [products]
  );
  const selectedCustomer = React.useMemo(() => customers.find((customer) => customer.id === customerFilter) ?? null, [customers, customerFilter]);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  React.useEffect(() => {
    void reloadInvoices(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, statusFilter, customerFilter, selectedBranchId]);

  React.useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedInvoice(null);
      setCustomerHistory(null);
      return;
    }
    let active = true;
    setDetailsLoading(true);
    getInvoice(selectedInvoiceId, selectedBranchId)
      .then((invoice) => {
        if (!active) return;
        setSelectedInvoice(invoice);
        if (invoice.status === "sent") {
          void markInvoiceViewed(invoice.id, selectedBranchId).then(setSelectedInvoice).catch(() => undefined);
        }
        return getInvoiceCustomerHistory(invoice.customerId ?? "", selectedBranchId).then(setCustomerHistory).catch(() => setCustomerHistory(null));
      })
      .catch((err) => {
        if (!active) return;
        Alert.alert("Invoice unavailable", err instanceof Error ? err.message : "Unable to load the invoice");
        setSelectedInvoiceId(null);
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedBranchId, selectedInvoiceId]);

  async function reloadInvoices(nextPage = 1, append = false) {
    const requestId = ++requestIdRef.current;
    if (nextPage === 1) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [dashboardResponse, listResponse] = await Promise.all([
        getInvoiceDashboard(undefined, undefined, selectedBranchId),
        listInvoices({
          branchId: selectedBranchId,
          page: nextPage,
          pageSize,
          search: deferredSearch,
          status: statusFilter === "all" ? undefined : statusFilter,
          customerId: customerFilter || undefined
        })
      ]);
      if (requestId !== requestIdRef.current) return;
      setDashboard(dashboardResponse);
      setTotalPages(listResponse.totalPages);
      setPage(listResponse.page);
      setItems((current) => (append && nextPage > 1 ? [...current, ...listResponse.items] : listResponse.items));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load invoices");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function refresh() {
    await reloadInvoices(1, false);
  }

  function openCreate() {
    setEditor(createInvoiceEditor(business?.currency ?? "KES", null));
  }

  function openEdit(invoice: Invoice) {
    setEditor(createInvoiceEditor(business?.currency ?? "KES", invoice));
  }

  async function openInvoice(invoiceId: string) {
    setSelectedInvoiceId(invoiceId);
  }

  async function saveInvoice(sendImmediately = false) {
    if (!editor || !business?.id) return;
    const customer =
      editor.customerMode === "existing" && editor.customerId
        ? customers.find((candidate) => candidate.id === editor.customerId) ?? null
        : null;
    try {
      setBusyAction("save");
      let customerId = customer?.id ?? (editor.customerMode === "new" ? null : editor.customerId || null);
      if (editor.customerMode === "new") {
        if (!editor.customerName.trim()) {
          Alert.alert("Missing customer", "Enter a customer name or select an existing customer.");
          return;
        }
        const createdCustomer = await createCustomer({
          businessId: business.id,
          branchId: selectedBranchId ?? null,
          externalId: createId(),
          name: editor.customerName.trim(),
          businessName: editor.customerBusinessName.trim() || null,
          phone: editor.customerPhone.trim() || null,
          email: editor.customerEmail.trim() || null,
          address: editor.customerAddress.trim() || null,
          taxPin: editor.customerTaxPin.trim() || null,
          notes: null,
          balance: 0,
          creditLimit: 0,
          loyaltyPoints: 0,
          attachments: []
        });
        customerId = createdCustomer.id;
      }

      const lineItems = editor.lineItems.map((line) => ({
        productId: line.productId.trim() || null,
        productName: line.description.trim(),
        description: line.description.trim(),
        quantity: Number(line.quantity || 0),
        unit: line.unit.trim() || "pcs",
        unitPrice: Number(line.unitPrice || 0),
        discountType: line.discountType,
        discountValue: Number(line.discountValue || 0),
        taxCategory: line.taxCategory,
        taxCode: line.taxCode.trim() || null,
        taxRate: Number(line.taxRate || 0),
        taxInclusive: line.taxInclusive
      }));

      const payload = {
        businessId: business.id,
        branchId: selectedBranchId ?? null,
        customerId,
        customerName: editor.customerMode === "new" ? editor.customerName.trim() : customer?.name ?? editor.customerName.trim() || null,
        customerBusinessName: editor.customerMode === "new" ? editor.customerBusinessName.trim() || null : customer?.businessName ?? null,
        customerEmail: editor.customerMode === "new" ? editor.customerEmail.trim() || null : customer?.email ?? null,
        customerPhone: editor.customerMode === "new" ? editor.customerPhone.trim() || null : customer?.phone ?? null,
        customerAddress: editor.customerMode === "new" ? editor.customerAddress.trim() || null : customer?.address ?? null,
        customerTaxPin: editor.customerMode === "new" ? editor.customerTaxPin.trim() || null : customer?.taxPin ?? null,
        invoiceNumber: editor.invoiceNumber.trim() || null,
        issueDate: editor.issueDate,
        dueDate: editor.dueDate,
        paymentTerms: editor.paymentTerms.trim(),
        currency: editor.currency.trim() || business.currency,
        referenceNumber: editor.referenceNumber.trim() || null,
        purchaseOrderNumber: editor.purchaseOrderNumber.trim() || null,
        notes: editor.notes.trim() || null,
        termsAndConditions: editor.termsAndConditions.trim() || null,
        amountPaid: Number(editor.amountPaid || 0),
        lineItems
      };

      let invoice: Invoice;
      if (editor.mode === "create") {
        invoice = await createInvoice(payload as any);
      } else {
        invoice = await updateInvoice(editor.invoiceId!, payload as any);
      }
      if (sendImmediately || editor.sendOnSave) {
        invoice = await sendInvoice(invoice.id, selectedBranchId);
      }
      setEditor(null);
      setSelectedInvoiceId(invoice.id);
      await reloadInvoices(1, false);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Unable to save the invoice");
    } finally {
      setBusyAction(null);
    }
  }

  async function actionOnInvoice(action: string, handler: () => Promise<Invoice | { invoice: Invoice }>) {
    if (!selectedInvoice) return;
    try {
      setBusyAction(action);
      const result = await handler();
      const nextInvoice = "invoice" in result ? result.invoice : result;
      setSelectedInvoice(nextInvoice);
      setSelectedInvoiceId(nextInvoice.id);
      await reloadInvoices(1, false);
    } catch (err) {
      Alert.alert(`${action} failed`, err instanceof Error ? err.message : `Unable to ${action} the invoice`);
    } finally {
      setBusyAction(null);
    }
  }

  async function exportPdf() {
    if (!selectedInvoice) return;
    try {
      const html = await getInvoicePdfHtml(selectedInvoice.id, selectedBranchId);
      const file = await Print.printToFileAsync({ html: html.html });
      const targetPath = `${FileSystem.cacheDirectory ?? ""}biz-pro-invoice-${selectedInvoice.invoiceNumber}-${Date.now()}.pdf`;
      await FileSystem.moveAsync({ from: file.uri, to: targetPath });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetPath, { mimeType: "application/pdf", dialogTitle: "Share invoice" });
      }
    } catch (err) {
      Alert.alert("PDF unavailable", err instanceof Error ? err.message : "Unable to build the PDF");
    }
  }

  async function copyPublicUrl() {
    if (!selectedInvoice?.shareToken) {
      Alert.alert("No public link", "This invoice does not have a share token yet.");
      return;
    }
    const publicUrl = new URL(`/invoices/public/${selectedInvoice.shareToken}`, env.apiUrl).toString();
    await Clipboard.setStringAsync(publicUrl);
    Alert.alert("Copied", "Public invoice URL copied to clipboard.");
  }

  const totals = React.useMemo(() => {
    const active = items.filter((invoice) => statusFilter === "all" || invoice.status === statusFilter);
    return {
      totalInvoiced: active.reduce((sum, invoice) => sum + invoice.grandTotal, 0),
      outstanding: active.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
      paid: active.reduce((sum, invoice) => sum + invoice.amountPaid, 0)
    };
  }, [items, statusFilter]);

  if (error && !dashboard && !items.length) {
    return (
      <Screen>
        <GradientHeader title="Invoices" subtitle="Invoice creation, lifecycle, payments, and PDF sharing" />
        <View style={{ padding: 16 }}>
          <ErrorState title="Invoices unavailable" subtitle={error} action={<PrimaryButton title="Try again" onPress={() => void refresh()} />} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Invoices"
        subtitle="Invoice creation, lifecycle, payments, and PDF sharing"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={24} color="#fff" />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={() => void refresh()} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>Invoice desk</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>Keep billing, balances, and payment follow-up in one place.</Text>
            <Text style={{ color: "#cbd5e1", lineHeight: 19, fontSize: 12 }}>
              Draft invoices, sendable invoices, payment tracking, and future fiscalization hooks are all wired in.
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="New invoice" onPress={openCreate} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Refresh" variant="secondary" onPress={() => void refresh()} />
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <StatCard label="Total invoiced" value={formatMoney(dashboard?.totalInvoiced ?? totals.totalInvoiced, business?.currency)} icon="document-text-outline" tone="primary" />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Outstanding" value={formatMoney(dashboard?.outstanding ?? totals.outstanding, business?.currency)} icon="time-outline" tone="warning" />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <StatCard label="Paid" value={formatMoney(dashboard?.paid ?? totals.paid, business?.currency)} icon="checkmark-done-outline" tone="success" />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Overdue" value={formatMoney(dashboard?.overdue ?? 0, business?.currency)} icon="alert-circle-outline" tone="danger" />
          </View>
        </View>

        <Card style={{ gap: 10 }}>
          <InputField label="Search invoices" value={search} onChangeText={setSearch} placeholder="Invoice number, customer, reference..." />
          <Dropdown label="Customer filter" value={customerFilter} options={customerOptions} onChange={setCustomerFilter} placeholder="All customers" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FILTERS.map((filter) => (
              <Tag key={filter} label={filter.replaceAll("_", " ").toUpperCase()} tone={filter === statusFilter ? "success" : "primary"} selected={filter === statusFilter} onPress={() => setStatusFilter(filter)} />
            ))}
          </View>
        </Card>

        {loading && !items.length ? (
          <View style={{ gap: 12 }}>
            <Loader />
            <Loader />
          </View>
        ) : items.length ? (
          <View style={{ gap: 10 }}>
            {items.map((invoice, index) => (
              <Pressable key={invoice.id} onPress={() => void openInvoice(invoice.id)} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
                <Card style={{ gap: 10, padding: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{invoice.invoiceNumber}</Text>
                      <Text style={{ color: "#cbd5e1", fontSize: 12 }}>
                        {invoice.customerName ?? "No customer"} {invoice.customerBusinessName ? `• ${invoice.customerBusinessName}` : "" }
                      </Text>
                      <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                        {invoice.issueDate.slice(0, 10)} • due {invoice.dueDate.slice(0, 10)}
                      </Text>
                    </View>
                    <Badge label={invoice.status.replaceAll("_", " ").toUpperCase()} tone={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : invoice.status === "partially_paid" ? "warning" : "primary"} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ color: "#cbd5e1" }}>{formatMoney(invoice.grandTotal, invoice.currency)}</Text>
                    <Text style={{ color: "#94a3b8" }}>
                      Paid {formatMoney(invoice.amountPaid, invoice.currency)} • Balance {formatMoney(invoice.balanceDue, invoice.currency)}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
            {page < totalPages ? <PrimaryButton title="Load more" variant="secondary" onPress={() => void reloadInvoices(page + 1, true)} loading={refreshing} /> : null}
          </View>
        ) : (
          <EmptyState
            title="No invoices yet"
            subtitle="Create the first invoice to start tracking balances, payments, and sharing."
            action={<PrimaryButton title="Create invoice" onPress={openCreate} />}
            icon="document-text-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={Boolean(selectedInvoice)} title={selectedInvoice?.invoiceNumber ?? "Invoice"} onClose={() => setSelectedInvoiceId(null)}>
        {detailsLoading || !selectedInvoice ? (
          <View style={{ paddingVertical: 24 }}>
            <Loader />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{selectedInvoice.invoiceNumber}</Text>
                  <Text style={{ color: "#cbd5e1", marginTop: 4 }}>{selectedInvoice.customerName ?? "Customer"}</Text>
                  <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                    Issued {selectedInvoice.issueDate.slice(0, 10)} • Due {selectedInvoice.dueDate.slice(0, 10)}
                  </Text>
                </View>
                <Badge label={selectedInvoice.status.replaceAll("_", " ").toUpperCase()} tone={selectedInvoice.status === "paid" ? "success" : selectedInvoice.status === "overdue" ? "danger" : selectedInvoice.status === "partially_paid" ? "warning" : "primary"} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={formatMoney(selectedInvoice.grandTotal, selectedInvoice.currency)} tone="primary" />
                <Badge label={`Paid ${formatMoney(selectedInvoice.amountPaid, selectedInvoice.currency)}`} tone="success" />
                <Badge label={`Balance ${formatMoney(selectedInvoice.balanceDue, selectedInvoice.currency)}`} tone="warning" />
              </View>
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "900" }}>Line items</Text>
              {selectedInvoice.lineItems.map((line) => (
                <View key={line.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#223044", gap: 4 }}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>{line.description}</Text>
                  <Text style={{ color: "#cbd5e1", fontSize: 12 }}>
                    {line.quantity} {line.unit} • {formatMoney(line.unitPrice, selectedInvoice.currency)} • tax {formatMoney(line.lineTax, selectedInvoice.currency)}
                  </Text>
                  <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                    Discount {formatMoney(line.lineDiscount, selectedInvoice.currency)} • Total {formatMoney(line.lineTotal, selectedInvoice.currency)}
                  </Text>
                </View>
              ))}
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "900" }}>Totals</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#cbd5e1" }}>Subtotal</Text><Text style={{ color: "#fff" }}>{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#cbd5e1" }}>Discount</Text><Text style={{ color: "#fff" }}>{formatMoney(selectedInvoice.discountTotal, selectedInvoice.currency)}</Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#cbd5e1" }}>Tax</Text><Text style={{ color: "#fff" }}>{formatMoney(selectedInvoice.taxTotal, selectedInvoice.currency)}</Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#cbd5e1" }}>Grand total</Text><Text style={{ color: "#fff" }}>{formatMoney(selectedInvoice.grandTotal, selectedInvoice.currency)}</Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#cbd5e1" }}>Paid</Text><Text style={{ color: "#fff" }}>{formatMoney(selectedInvoice.amountPaid, selectedInvoice.currency)}</Text></View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: "#cbd5e1" }}>Balance due</Text><Text style={{ color: "#fff", fontWeight: "900" }}>{formatMoney(selectedInvoice.balanceDue, selectedInvoice.currency)}</Text></View>
            </Card>

            {selectedInvoice.history?.length ? (
              <Card style={{ gap: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>Activity</Text>
                {selectedInvoice.history.map((entry) => (
                  <View key={entry.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#223044" }}>
                    <Text style={{ color: "#fff", fontWeight: "800" }}>{entry.action}</Text>
                    <Text style={{ color: "#94a3b8", fontSize: 12 }}>{entry.note ?? "Invoice event"}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            {selectedInvoice.creditNotes?.length ? (
              <Card style={{ gap: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>Credit notes</Text>
                {selectedInvoice.creditNotes.map((note) => (
                  <Text key={note.id} style={{ color: "#cbd5e1", fontSize: 12 }}>
                    {note.reference} • {note.status} • {formatMoney(note.amount, selectedInvoice.currency)}
                  </Text>
                ))}
              </Card>
            ) : null}

            {selectedInvoice.debitNotes?.length ? (
              <Card style={{ gap: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>Debit notes</Text>
                {selectedInvoice.debitNotes.map((note) => (
                  <Text key={note.id} style={{ color: "#cbd5e1", fontSize: 12 }}>
                    {note.reference} • {note.status} • {formatMoney(note.amount, selectedInvoice.currency)}
                  </Text>
                ))}
              </Card>
            ) : null}

            {customerHistory ? (
              <Card style={{ gap: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>Customer history</Text>
                <Text style={{ color: "#cbd5e1", fontSize: 12 }}>
                  Invoiced {formatMoney(customerHistory.totalInvoiced, selectedInvoice.currency)} • Paid {formatMoney(customerHistory.totalPaid, selectedInvoice.currency)} • Outstanding {formatMoney(customerHistory.outstandingBalance, selectedInvoice.currency)}
                </Text>
              </Card>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selectedInvoice.status !== "paid" && selectedInvoice.status !== "cancelled" && selectedInvoice.status !== "void" && selectedInvoice.status !== "refunded" ? (
                <PrimaryButton title="Record payment" onPress={() => setPaymentEditor(createPaymentEditor(selectedInvoice.id, String(selectedInvoice.balanceDue)))} />
              ) : null}
              {selectedInvoice.status === "draft" || selectedInvoice.status === "sent" || selectedInvoice.status === "viewed" || selectedInvoice.status === "partially_paid" || selectedInvoice.status === "overdue" ? (
                <PrimaryButton title="Edit" variant="secondary" onPress={() => openEdit(selectedInvoice)} />
              ) : null}
              <PrimaryButton title="Duplicate" variant="secondary" onPress={() => void actionOnInvoice("duplicate", () => duplicateInvoice(selectedInvoice.id, selectedBranchId))} />
              <PrimaryButton title="PDF" variant="secondary" onPress={() => void exportPdf()} />
              <PrimaryButton title="Share URL" variant="secondary" onPress={() => void copyPublicUrl()} />
              {selectedInvoice.status === "draft" ? <PrimaryButton title="Send" onPress={() => void actionOnInvoice("send", () => sendInvoice(selectedInvoice.id, selectedBranchId))} /> : null}
              {selectedInvoice.status === "draft" ? <PrimaryButton title="Delete draft" variant="secondary" onPress={() => void actionOnInvoice("delete", () => deleteDraftInvoice(selectedInvoice.id, selectedBranchId))} /> : null}
              {selectedInvoice.status === "archived" ? <PrimaryButton title="Restore" onPress={() => void actionOnInvoice("restore", () => restoreInvoice(selectedInvoice.id, selectedBranchId))} /> : null}
              {(selectedInvoice.status === "sent" || selectedInvoice.status === "viewed" || selectedInvoice.status === "partially_paid" || selectedInvoice.status === "overdue") ? (
                <PrimaryButton title="Cancel" variant="secondary" onPress={() => void actionOnInvoice("cancel", () => cancelInvoice(selectedInvoice.id, selectedBranchId))} />
              ) : null}
              {(selectedInvoice.status === "sent" || selectedInvoice.status === "viewed" || selectedInvoice.status === "partially_paid" || selectedInvoice.status === "overdue") ? (
                <PrimaryButton title="Void" variant="secondary" onPress={() => void actionOnInvoice("void", () => voidInvoice(selectedInvoice.id, selectedBranchId))} />
              ) : null}
              {(selectedInvoice.status === "draft" || selectedInvoice.status === "sent" || selectedInvoice.status === "viewed" || selectedInvoice.status === "partially_paid" || selectedInvoice.status === "paid" || selectedInvoice.status === "overdue") ? (
                <PrimaryButton title="Archive" variant="secondary" onPress={() => void actionOnInvoice("archive", () => archiveInvoice(selectedInvoice.id, selectedBranchId))} />
              ) : null}
              {selectedInvoice.status === "paid" || selectedInvoice.status === "partially_paid" ? (
                <PrimaryButton title="Credit note" variant="secondary" onPress={() => setNoteEditor(createNoteEditor(selectedInvoice.id, "credit"))} />
              ) : null}
              {selectedInvoice.status !== "draft" ? (
                <PrimaryButton title="Debit note" variant="secondary" onPress={() => setNoteEditor(createNoteEditor(selectedInvoice.id, "debit"))} />
              ) : null}
            </View>
          </View>
        )}
      </SimpleModal>

      <SimpleModal visible={Boolean(editor)} title={editor?.mode === "edit" ? "Edit invoice" : "Create invoice"} onClose={() => setEditor(null)}>
        {editor ? (
          <AppScrollView contentContainerStyle={{ gap: 12, paddingBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={editor.sendOnSave ? "Save + send" : "Save draft"} onPress={() => void saveInvoice(editor.sendOnSave)} loading={busyAction === "save"} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={editor.sendOnSave ? "Send draft" : "Mark send on save"} variant="secondary" onPress={() => setEditor((state) => (state ? { ...state, sendOnSave: !state.sendOnSave } : state))} />
              </View>
            </View>
            <Dropdown
              label="Customer mode"
              value={editor.customerMode}
              options={[
                { label: "Existing customer", value: "existing" },
                { label: "New customer", value: "new" }
              ]}
              onChange={(value) => setEditor((state) => (state ? { ...state, customerMode: value as CustomerMode } : state))}
            />
            {editor.customerMode === "existing" ? (
              <Dropdown
                label="Customer"
                value={editor.customerId}
                options={[{ label: "No customer", value: "" }, ...customers.map((customer) => ({ label: customer.name, value: customer.id, description: customer.businessName ?? customer.email ?? undefined }))]}
                onChange={(value) => setEditor((state) => (state ? { ...state, customerId: value } : state))}
              />
            ) : (
              <>
                <InputField label="Customer name" value={editor.customerName} onChangeText={(value) => setEditor((state) => (state ? { ...state, customerName: value } : state))} />
                <InputField label="Business name" value={editor.customerBusinessName} onChangeText={(value) => setEditor((state) => (state ? { ...state, customerBusinessName: value } : state))} />
                <InputField label="Email" value={editor.customerEmail} onChangeText={(value) => setEditor((state) => (state ? { ...state, customerEmail: value } : state))} />
                <InputField label="Phone" value={editor.customerPhone} onChangeText={(value) => setEditor((state) => (state ? { ...state, customerPhone: value } : state))} />
                <InputField label="Address" value={editor.customerAddress} onChangeText={(value) => setEditor((state) => (state ? { ...state, customerAddress: value } : state))} multiline numberOfLines={2} />
                <InputField label="Tax PIN" value={editor.customerTaxPin} onChangeText={(value) => setEditor((state) => (state ? { ...state, customerTaxPin: value } : state))} />
              </>
            )}
            <InputField label="Invoice number" value={editor.invoiceNumber} onChangeText={(value) => setEditor((state) => (state ? { ...state, invoiceNumber: value } : state))} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <InputField label="Issue date" value={editor.issueDate} onChangeText={(value) => setEditor((state) => (state ? { ...state, issueDate: value } : state))} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <InputField label="Due date" value={editor.dueDate} onChangeText={(value) => setEditor((state) => (state ? { ...state, dueDate: value } : state))} placeholder="YYYY-MM-DD" />
              </View>
            </View>
            <InputField label="Payment terms" value={editor.paymentTerms} onChangeText={(value) => setEditor((state) => (state ? { ...state, paymentTerms: value } : state))} />
            <InputField label="Currency" value={editor.currency} onChangeText={(value) => setEditor((state) => (state ? { ...state, currency: value } : state))} />
            <InputField label="Reference number" value={editor.referenceNumber} onChangeText={(value) => setEditor((state) => (state ? { ...state, referenceNumber: value } : state))} />
            <InputField label="Purchase order number" value={editor.purchaseOrderNumber} onChangeText={(value) => setEditor((state) => (state ? { ...state, purchaseOrderNumber: value } : state))} />
            <InputField label="Notes" value={editor.notes} onChangeText={(value) => setEditor((state) => (state ? { ...state, notes: value } : state))} multiline numberOfLines={3} />
            <InputField label="Terms & conditions" value={editor.termsAndConditions} onChangeText={(value) => setEditor((state) => (state ? { ...state, termsAndConditions: value } : state))} multiline numberOfLines={3} />
            <InputField label="Amount paid" value={editor.amountPaid} onChangeText={(value) => setEditor((state) => (state ? { ...state, amountPaid: value } : state))} keyboardType="decimal-pad" />

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>Line items</Text>
                <PrimaryButton title="Add item" variant="secondary" onPress={() => setEditor((state) => (state ? { ...state, lineItems: [...state.lineItems, createLineEditor(null)] } : state))} />
              </View>
              {editor.lineItems.map((line, index) => {
                const preview = linePreview(line);
                return (
                  <Card key={line.id} style={{ gap: 10, padding: 12, backgroundColor: "#0f172a" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <Text style={{ color: "#fff", fontWeight: "800" }}>Item {index + 1}</Text>
                      <Pressable onPress={() => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.filter((candidate) => candidate.id !== line.id) } : state))}>
                        <Ionicons name="close-circle-outline" size={20} color="#94a3b8" />
                      </Pressable>
                    </View>
                    <Dropdown
                      label="Product or custom item"
                      value={line.productId || "__custom__"}
                      options={productOptions}
                      onChange={(value) =>
                        setEditor((state) =>
                          state
                            ? {
                                ...state,
                                lineItems: state.lineItems.map((candidate) => {
                                  if (candidate.id !== line.id) return candidate;
                                  if (value === "__custom__") {
                                    return { ...candidate, productId: "", description: candidate.description || "", unit: candidate.unit || "pcs", unitPrice: candidate.unitPrice || "0" };
                                  }
                                  const product = products.find((candidateProduct) => candidateProduct.id === value);
                                  return product
                                    ? {
                                        ...candidate,
                                        productId: product.id,
                                        description: product.name,
                                        unit: product.unit,
                                        unitPrice: String(product.sellingPrice)
                                      }
                                    : candidate;
                                })
                              }
                            : state
                        )
                      }
                    />
                    <InputField label="Description" value={line.description} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, description: value } : candidate)) } : state))} />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <InputField label="Qty" value={line.quantity} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, quantity: value } : candidate)) } : state))} keyboardType="decimal-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <InputField label="Unit" value={line.unit} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, unit: value } : candidate)) } : state))} />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <InputField label="Unit price" value={line.unitPrice} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, unitPrice: value } : candidate)) } : state))} keyboardType="decimal-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <InputField label="Discount" value={line.discountValue} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, discountValue: value } : candidate)) } : state))} keyboardType="decimal-pad" />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <Pressable onPress={() => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, discountType: "fixed" } : candidate)) } : state))}>
                        <Badge label="Fixed discount" tone={line.discountType === "fixed" ? "success" : "primary"} />
                      </Pressable>
                      <Pressable onPress={() => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, discountType: "percentage" } : candidate)) } : state))}>
                        <Badge label="Percent discount" tone={line.discountType === "percentage" ? "success" : "primary"} />
                      </Pressable>
                      <Pressable onPress={() => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, taxInclusive: !candidate.taxInclusive } : candidate)) } : state))}>
                        <Badge label={line.taxInclusive ? "Tax inclusive" : "Tax exclusive"} tone={line.taxInclusive ? "warning" : "primary"} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <InputField label="Tax rate" value={line.taxRate} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, taxRate: value } : candidate)) } : state))} keyboardType="decimal-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <InputField label="Tax code" value={line.taxCode} onChangeText={(value) => setEditor((state) => (state ? { ...state, lineItems: state.lineItems.map((candidate) => (candidate.id === line.id ? { ...candidate, taxCode: value } : candidate)) } : state))} />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#cbd5e1", fontSize: 12 }}>Subtotal {formatMoney(preview.subtotal, editor.currency)}</Text>
                      <Text style={{ color: "#cbd5e1", fontSize: 12 }}>Total {formatMoney(preview.total, editor.currency)}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Save draft" variant="secondary" onPress={() => void saveInvoice(false)} loading={busyAction === "save"} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton title="Save & send" onPress={() => void saveInvoice(true)} loading={busyAction === "save"} />
              </View>
            </View>
          </AppScrollView>
        ) : null}
      </SimpleModal>

      <SimpleModal visible={Boolean(paymentEditor)} title="Record payment" onClose={() => setPaymentEditor(null)}>
        {paymentEditor ? (
          <View style={{ gap: 12 }}>
            <InputField label="Amount" value={paymentEditor.amount} onChangeText={(value) => setPaymentEditor((state) => (state ? { ...state, amount: value } : state))} keyboardType="decimal-pad" />
            <Dropdown
              label="Method"
              value={paymentEditor.method}
              options={[
                { label: "Cash", value: "cash" },
                { label: "M-Pesa", value: "mpesa" },
                { label: "Bank", value: "bank" },
                { label: "Card", value: "card" },
                { label: "Cheque", value: "cheque" },
                { label: "Other", value: "other" },
                { label: "Credit", value: "credit" }
              ]}
              onChange={(value) => setPaymentEditor((state) => (state ? { ...state, method: value } : state))}
            />
            <InputField label="Payment date" value={paymentEditor.paymentDate} onChangeText={(value) => setPaymentEditor((state) => (state ? { ...state, paymentDate: value } : state))} placeholder="YYYY-MM-DD" />
            <InputField label="Reference" value={paymentEditor.reference} onChangeText={(value) => setPaymentEditor((state) => (state ? { ...state, reference: value } : state))} />
            <InputField label="Note" value={paymentEditor.note} onChangeText={(value) => setPaymentEditor((state) => (state ? { ...state, note: value } : state))} multiline numberOfLines={2} />
            <PrimaryButton
              title="Save payment"
              onPress={async () => {
                if (!paymentEditor.invoiceId) return;
                await actionOnInvoice("payment", async () => {
                  const result = await recordInvoicePayment(paymentEditor.invoiceId!, {
                    amount: Number(paymentEditor.amount || 0),
                    method: paymentEditor.method,
                    paymentDate: paymentEditor.paymentDate,
                    reference: paymentEditor.reference.trim() || null,
                    note: paymentEditor.note.trim() || null
                  }, selectedBranchId);
                  setPaymentEditor(null);
                  return result.invoice;
                });
              }}
            />
          </View>
        ) : null}
      </SimpleModal>

      <SimpleModal visible={Boolean(noteEditor)} title={noteEditor?.mode === "credit" ? "Create credit note" : "Create debit note"} onClose={() => setNoteEditor(null)}>
        {noteEditor ? (
          <View style={{ gap: 12 }}>
            <InputField label="Reference" value={noteEditor.reference} onChangeText={(value) => setNoteEditor((state) => (state ? { ...state, reference: value } : state))} />
            <InputField label="Amount" value={noteEditor.amount} onChangeText={(value) => setNoteEditor((state) => (state ? { ...state, amount: value } : state))} keyboardType="decimal-pad" />
            <InputField label="Tax adjustment" value={noteEditor.taxAdjustment} onChangeText={(value) => setNoteEditor((state) => (state ? { ...state, taxAdjustment: value } : state))} keyboardType="decimal-pad" />
            <InputField label="Reason" value={noteEditor.reason} onChangeText={(value) => setNoteEditor((state) => (state ? { ...state, reason: value } : state))} />
            <InputField label="Note" value={noteEditor.note} onChangeText={(value) => setNoteEditor((state) => (state ? { ...state, note: value } : state))} multiline numberOfLines={2} />
            <InputField label="Date" value={noteEditor.date} onChangeText={(value) => setNoteEditor((state) => (state ? { ...state, date: value } : state))} placeholder="YYYY-MM-DD" />
            <PrimaryButton
              title={noteEditor.mode === "credit" ? "Save credit note" : "Save debit note"}
              onPress={async () => {
                if (!selectedInvoice || !noteEditor.mode) return;
                if (noteEditor.mode === "credit") {
                  await actionOnInvoice("credit note", async () => {
                    const result = await createInvoiceCreditNote(
                      selectedInvoice.id,
                      {
                        businessId: business?.id ?? "",
                        branchId: selectedBranchId ?? null,
                        externalId: createId(),
                        reference: noteEditor.reference.trim(),
                        customerId: selectedInvoice.customerId ?? null,
                        amount: Number(noteEditor.amount || 0),
                        reason: noteEditor.reason.trim(),
                        note: noteEditor.note.trim() || null,
                        creditDate: noteEditor.date,
                        status: "issued"
                      },
                      selectedBranchId
                    );
                    setNoteEditor(null);
                    return selectedInvoice;
                  });
                } else {
                  await actionOnInvoice("debit note", async () => {
                    const result = await createInvoiceDebitNote(
                      selectedInvoice.id,
                      {
                        businessId: business?.id ?? "",
                        branchId: selectedBranchId ?? null,
                        externalId: createId(),
                        reference: noteEditor.reference.trim(),
                        reason: noteEditor.reason.trim(),
                        amount: Number(noteEditor.amount || 0),
                        taxAdjustment: Number(noteEditor.taxAdjustment || 0),
                        note: noteEditor.note.trim() || null,
                        issuedAt: noteEditor.date,
                        status: "issued"
                      },
                      selectedBranchId
                    );
                    setNoteEditor(null);
                    return selectedInvoice;
                  });
                }
              }}
            />
          </View>
        ) : null}
      </SimpleModal>
    </Screen>
  );
}
