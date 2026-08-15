import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, format, startOfDay } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import { PAYMENT_METHODS, type PurchaseOrder, type Supplier, type SupplierCategory, type SupplierContact, type SupplierDocument, type SupplierPayment, type SupplierPerformanceReport, type SupplierStatement } from "@shared";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { useAppStore } from "@/store/useAppStore";
import {
  archiveSupplier,
  archiveSupplierCategory,
  archiveSupplierContact,
  archiveSupplierDocument,
  archiveSupplierPayment,
  createSupplier,
  createSupplierCategory,
  createSupplierContact,
  createSupplierDocument,
  createSupplierPayment,
  getSupplierPerformance,
  getSupplierStatement,
  listPurchaseOrders,
  listSupplierCategories,
  listSupplierContacts,
  listSupplierDocuments,
  listSupplierPayments,
  updateSupplier,
  updateSupplierCategory,
  updateSupplierContact,
  updateSupplierDocument
} from "@/services/apiClient";

type SupplierEditorState = {
  visible: boolean;
  editing: Supplier | null;
  categoryId: string | null;
  code: string;
  name: string;
  phone: string;
  email: string;
  contactName: string;
  notes: string;
};

type CategoryEditorState = {
  visible: boolean;
  editing: SupplierCategory | null;
  name: string;
  description: string;
  color: string;
  sortOrder: string;
};

type ContactEditorState = {
  visible: boolean;
  editing: SupplierContact | null;
  name: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
  isPrimary: boolean;
};

type DocumentEditorState = {
  visible: boolean;
  editing: SupplierDocument | null;
  title: string;
  url: string;
  fileName: string;
  documentType: string;
  note: string;
};

type PaymentEditorState = {
  visible: boolean;
  editing: SupplierPayment | null;
  amount: string;
  method: SupplierPayment["method"];
  reference: string;
  note: string;
  paymentDate: string;
};

const EMPTY_SUPPLIER_EDITOR: SupplierEditorState = {
  visible: false,
  editing: null,
  categoryId: null,
  code: "",
  name: "",
  phone: "",
  email: "",
  contactName: "",
  notes: ""
};

const EMPTY_CATEGORY_EDITOR: CategoryEditorState = {
  visible: false,
  editing: null,
  name: "",
  description: "",
  color: "#B88A44",
  sortOrder: "0"
};

const EMPTY_CONTACT_EDITOR: ContactEditorState = {
  visible: false,
  editing: null,
  name: "",
  role: "",
  phone: "",
  email: "",
  notes: "",
  isPrimary: false
};

const EMPTY_DOCUMENT_EDITOR: DocumentEditorState = {
  visible: false,
  editing: null,
  title: "",
  url: "",
  fileName: "",
  documentType: "",
  note: ""
};

const EMPTY_PAYMENT_EDITOR: PaymentEditorState = {
  visible: false,
  editing: null,
  amount: "0",
  method: "cash",
  reference: "",
  note: "",
  paymentDate: format(new Date(), "yyyy-MM-dd")
};

export function SuppliersScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const suppliers = useAppStore((state) => state.suppliers);
  const addSupplier = useAppStore((state) => state.addSupplier);
  const loadCatalog = useAppStore((state) => state.loadCatalog);

  const [search, setSearch] = React.useState("");
  const [categoryFilterId, setCategoryFilterId] = React.useState<string>("all");
  const [categories, setCategories] = React.useState<SupplierCategory[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [contacts, setContacts] = React.useState<SupplierContact[]>([]);
  const [documents, setDocuments] = React.useState<SupplierDocument[]>([]);
  const [payments, setPayments] = React.useState<SupplierPayment[]>([]);
  const [statement, setStatement] = React.useState<SupplierStatement | null>(null);
  const [performance, setPerformance] = React.useState<SupplierPerformanceReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [detailsLoading, setDetailsLoading] = React.useState(false);

  const [supplierEditor, setSupplierEditor] = React.useState<SupplierEditorState>(EMPTY_SUPPLIER_EDITOR);
  const [categoryEditor, setCategoryEditor] = React.useState<CategoryEditorState>(EMPTY_CATEGORY_EDITOR);
  const [contactEditor, setContactEditor] = React.useState<ContactEditorState>(EMPTY_CONTACT_EDITOR);
  const [documentEditor, setDocumentEditor] = React.useState<DocumentEditorState>(EMPTY_DOCUMENT_EDITOR);
  const [paymentEditor, setPaymentEditor] = React.useState<PaymentEditorState>(EMPTY_PAYMENT_EDITOR);

  const requestIdRef = React.useRef(0);
  const deferredSearch = React.useDeferredValue(search);
  const reportRange = React.useMemo(() => {
    const to = new Date();
    const from = startOfDay(addDays(to, -89));
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      try {
        await Promise.all([loadCatalog(), loadCategories()]);
        if (!cancelled) {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog, selectedBranchId]);

  React.useEffect(() => {
    if (!selectedSupplierId) {
      setPurchaseOrders([]);
      setContacts([]);
      setDocuments([]);
      setPayments([]);
      setStatement(null);
      setPerformance(null);
      return;
    }
    void loadSupplierDetails(selectedSupplierId);
  }, [selectedSupplierId, reportRange.from, reportRange.to, selectedBranchId]);

  const selectedSupplier = React.useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, suppliers]
  );

  const filteredSuppliers = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const matchesQuery = [supplier.name, supplier.code ?? "", supplier.contactName ?? "", supplier.phone ?? "", supplier.email ?? "", supplier.notes ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
      const matchesCategory = categoryFilterId === "all" ? true : supplier.categoryId === categoryFilterId;
      return matchesQuery && matchesCategory;
    });
  }, [categoryFilterId, deferredSearch, suppliers]);

  const categoryMap = React.useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const purchaseOrdersBySupplier = React.useMemo(() => {
    const map = new Map<string, PurchaseOrder[]>();
    for (const order of purchaseOrders) {
      const supplierId = order.supplierId ?? "";
      const bucket = map.get(supplierId) ?? [];
      bucket.push(order);
      map.set(supplierId, bucket);
    }
    return map;
  }, [purchaseOrders]);
  const selectedCategoryLabel = selectedSupplier?.categoryId ? categoryMap.get(selectedSupplier.categoryId)?.name ?? "Uncategorized" : "Uncategorized";
  const totalSupplierBalance = React.useMemo(() => payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0), [payments]);
  const supplierOutstanding = statement?.outstandingBalance ?? performance?.outstandingBalance ?? 0;
  const supplierOrdersCount = selectedSupplierOrders(purchaseOrders, selectedSupplierId).length;
  const supplierPaymentsCount = payments.length;

  async function loadCategories() {
    const remote = await listSupplierCategories();
    setCategories(remote);
  }

  async function loadSupplierDetails(supplierId: string) {
    const requestId = ++requestIdRef.current;
    setDetailsLoading(true);
    try {
      const [allOrders, remoteContacts, remoteDocuments, remotePayments, remoteStatement, remotePerformance] = await Promise.all([
        listPurchaseOrders(selectedBranchId),
        listSupplierContacts(supplierId),
        listSupplierDocuments(supplierId),
        listSupplierPayments(supplierId, reportRange.from, reportRange.to),
        getSupplierStatement(supplierId, reportRange.from, reportRange.to),
        getSupplierPerformance(supplierId, reportRange.from, reportRange.to)
      ]);
      if (requestId !== requestIdRef.current) return;
      setPurchaseOrders(allOrders.filter((order) => order.supplierId === supplierId));
      setContacts(remoteContacts);
      setDocuments(remoteDocuments);
      setPayments(remotePayments);
      setStatement(remoteStatement);
      setPerformance(remotePerformance);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setPurchaseOrders([]);
      setContacts([]);
      setDocuments([]);
      setPayments([]);
      setStatement(null);
      setPerformance(null);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setDetailsLoading(false);
    }
  }

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([loadCatalog(), loadCategories()]);
      if (selectedSupplierId) {
        await loadSupplierDetails(selectedSupplierId);
      }
    } finally {
      setRefreshing(false);
    }
  }

  function openSupplierEditor(supplier?: Supplier | null) {
    setSupplierEditor({
      visible: true,
      editing: supplier ?? null,
      categoryId: supplier?.categoryId ?? null,
      code: supplier?.code ?? "",
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      contactName: supplier?.contactName ?? "",
      notes: supplier?.notes ?? ""
    });
  }

  function openCategoryEditor(category?: SupplierCategory | null) {
    setCategoryEditor({
      visible: true,
      editing: category ?? null,
      name: category?.name ?? "",
      description: category?.description ?? "",
      color: category?.color ?? "#B88A44",
      sortOrder: String(category?.sortOrder ?? 0)
    });
  }

  function openContactEditor(contact?: SupplierContact | null) {
    setContactEditor({
      visible: true,
      editing: contact ?? null,
      name: contact?.name ?? "",
      role: contact?.role ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      notes: contact?.notes ?? "",
      isPrimary: contact?.isPrimary ?? false
    });
  }

  function openDocumentEditor(document?: SupplierDocument | null) {
    setDocumentEditor({
      visible: true,
      editing: document ?? null,
      title: document?.title ?? "",
      url: document?.url ?? "",
      fileName: document?.fileName ?? "",
      documentType: document?.documentType ?? "",
      note: document?.note ?? ""
    });
  }

  function openPaymentEditor(payment?: SupplierPayment | null) {
    setPaymentEditor({
      visible: true,
      editing: payment ?? null,
      amount: String(payment?.amount ?? 0),
      method: payment?.method ?? "cash",
      reference: payment?.reference ?? "",
      note: payment?.note ?? "",
      paymentDate: payment?.paymentDate ? payment.paymentDate.slice(0, 10) : format(new Date(), "yyyy-MM-dd")
    });
  }

  async function saveSupplier() {
    if (!business?.id) return;
    if (!supplierEditor.name.trim()) {
      Alert.alert("Missing name", "Enter a supplier name.");
      return;
    }
    try {
      if (supplierEditor.editing) {
        await updateSupplier(supplierEditor.editing.id, {
          categoryId: supplierEditor.categoryId ?? null,
          code: supplierEditor.code.trim() || null,
          name: supplierEditor.name.trim(),
          phone: supplierEditor.phone.trim() || null,
          email: supplierEditor.email.trim() || null,
          contactName: supplierEditor.contactName.trim() || null,
          notes: supplierEditor.notes.trim() || null
        });
      } else {
        await addSupplier({
          businessId: business.id,
          categoryId: supplierEditor.categoryId ?? null,
          code: supplierEditor.code.trim() || null,
          name: supplierEditor.name.trim(),
          phone: supplierEditor.phone.trim() || null,
          email: supplierEditor.email.trim() || null,
          contactName: supplierEditor.contactName.trim() || null,
          notes: supplierEditor.notes.trim() || null
        });
      }
      setSupplierEditor(EMPTY_SUPPLIER_EDITOR);
      await refreshAll();
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save supplier");
    }
  }

  async function saveCategory() {
    if (!business?.id) return;
    if (!categoryEditor.name.trim()) {
      Alert.alert("Missing name", "Enter a supplier category name.");
      return;
    }
    try {
      if (categoryEditor.editing) {
        await updateSupplierCategory(categoryEditor.editing.id, {
          name: categoryEditor.name.trim(),
          description: categoryEditor.description.trim() || null,
          color: categoryEditor.color.trim() || null,
          sortOrder: Number(categoryEditor.sortOrder || 0)
        });
      } else {
        await createSupplierCategory({
          businessId: business.id,
          name: categoryEditor.name.trim(),
          description: categoryEditor.description.trim() || null,
          color: categoryEditor.color.trim() || null,
          sortOrder: Number(categoryEditor.sortOrder || 0),
          isActive: true
        });
      }
      setCategoryEditor(EMPTY_CATEGORY_EDITOR);
      await loadCategories();
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save category");
    }
  }

  async function saveContact() {
    if (!selectedSupplier) return;
    if (!contactEditor.name.trim()) {
      Alert.alert("Missing name", "Enter a contact name.");
      return;
    }
    try {
      if (contactEditor.editing) {
        await updateSupplierContact(selectedSupplier.id, contactEditor.editing.id, {
          name: contactEditor.name.trim(),
          role: contactEditor.role.trim() || null,
          phone: contactEditor.phone.trim() || null,
          email: contactEditor.email.trim() || null,
          notes: contactEditor.notes.trim() || null,
          isPrimary: contactEditor.isPrimary
        });
      } else {
        await createSupplierContact(selectedSupplier.id, {
          name: contactEditor.name.trim(),
          role: contactEditor.role.trim() || null,
          phone: contactEditor.phone.trim() || null,
          email: contactEditor.email.trim() || null,
          notes: contactEditor.notes.trim() || null,
          isPrimary: contactEditor.isPrimary
        });
      }
      setContactEditor(EMPTY_CONTACT_EDITOR);
      await loadSupplierDetails(selectedSupplier.id);
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save contact");
    }
  }

  async function saveDocument() {
    if (!selectedSupplier) return;
    if (!documentEditor.title.trim() || !documentEditor.url.trim()) {
      Alert.alert("Missing document info", "Enter a title and URL.");
      return;
    }
    try {
      if (documentEditor.editing) {
        await updateSupplierDocument(selectedSupplier.id, documentEditor.editing.id, {
          title: documentEditor.title.trim(),
          url: documentEditor.url.trim(),
          fileName: documentEditor.fileName.trim() || null,
          documentType: documentEditor.documentType.trim() || null,
          note: documentEditor.note.trim() || null
        });
      } else {
        await createSupplierDocument(selectedSupplier.id, {
          title: documentEditor.title.trim(),
          url: documentEditor.url.trim(),
          fileName: documentEditor.fileName.trim() || null,
          documentType: documentEditor.documentType.trim() || null,
          note: documentEditor.note.trim() || null
        });
      }
      setDocumentEditor(EMPTY_DOCUMENT_EDITOR);
      await loadSupplierDetails(selectedSupplier.id);
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save document");
    }
  }

  async function savePayment() {
    if (!selectedSupplier) return;
    if (Number(paymentEditor.amount || 0) <= 0) {
      Alert.alert("Missing amount", "Enter a payment amount greater than zero.");
      return;
    }
    try {
      if (paymentEditor.editing) {
        Alert.alert("Unsupported", "Edit is not wired for supplier payments yet.");
        return;
      }
      await createSupplierPayment(selectedSupplier.id, {
        amount: Number(paymentEditor.amount || 0),
        method: paymentEditor.method,
        reference: paymentEditor.reference.trim() || null,
        note: paymentEditor.note.trim() || null,
        paymentDate: paymentEditor.paymentDate
      });
      setPaymentEditor(EMPTY_PAYMENT_EDITOR);
      await loadSupplierDetails(selectedSupplier.id);
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save payment");
    }
  }

  if (loading) {
    return (
      <Screen>
        <GradientHeader title="Suppliers" subtitle="Purchase orders, payments, statements, and contacts" />
        <View style={{ padding: 16, gap: 12 }}>
          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.textSecondary }}>Loading supplier workspace...</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Suppliers"
        subtitle="Purchase orders, payments, statements, and contacts"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />

      <AppScrollView refreshing={refreshing} onRefresh={refreshAll}>
        <Card style={{ gap: 10 }}>
          <InputField label="Search suppliers" value={search} onChangeText={setSearch} placeholder="Supplier name, code, or contact" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tag label="All categories" tone="primary" selected={categoryFilterId === "all"} onPress={() => setCategoryFilterId("all")} />
            {categories.map((category) => (
              <Tag
                key={category.id}
                label={category.name}
                tone="primary"
                selected={categoryFilterId === category.id}
                onPress={() => setCategoryFilterId(category.id)}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Add supplier" onPress={() => openSupplierEditor(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Add category" variant="secondary" onPress={() => openCategoryEditor(null)} />
            </View>
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Supplier Categories</Text>
          {categories.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {categories.map((category) => (
                <Tag key={category.id} label={category.name} tone="success" selected={categoryFilterId === category.id} onPress={() => setCategoryFilterId(category.id)} />
              ))}
            </View>
          ) : (
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>Create categories to organize suppliers by type or vendor group.</Text>
          )}
        </Card>

        {filteredSuppliers.length ? (
          filteredSuppliers.map((supplier) => {
            const category = supplier.categoryId ? categoryMap.get(supplier.categoryId) ?? null : null;
            const isSelected = supplier.id === selectedSupplierId;
            const supplierOrders = purchaseOrdersBySupplier.get(supplier.id) ?? [];
            const supplierPaymentTotal = selectedSupplierId === supplier.id ? totalSupplierBalance : 0;
            const supplierBalance = selectedSupplierId === supplier.id ? supplierOutstanding : Math.max(0, supplierOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0) - 0);
            return (
              <Card key={supplier.id} style={{ gap: 10, borderColor: isSelected ? tokens.colors.primaryStrong : tokens.colors.border, borderWidth: 1 }}>
                <Pressable onPress={() => setSelectedSupplierId(supplier.id)} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{supplier.name}</Text>
                      <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
                        {supplier.code ?? "No code"} • {supplier.contactName ?? "No contact"} • {supplier.phone ?? "No phone"}
                      </Text>
                      <Text style={{ color: tokens.colors.textMuted, lineHeight: 18 }}>{supplier.email ?? "No email"}</Text>
                    </View>
                    <Badge label={supplier.isActive ? "Active" : "Archived"} tone={supplier.isActive ? "success" : "warning"} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={category?.name ?? "Uncategorized"} tone="primary" />
                    <Badge label={`${supplierOrders.length} POs`} tone="success" />
                    <Badge label={formatMoney(selectedSupplierId === supplier.id ? supplierOutstanding : supplierBalance, business?.currency ?? "KES")} tone="warning" />
                    <Badge label={selectedSupplierId === supplier.id ? `${supplierPaymentsCount} payments` : "Open to view details"} tone="primary" />
                  </View>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Select" variant="secondary" onPress={() => setSelectedSupplierId(supplier.id)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton title="Edit" variant="secondary" onPress={() => openSupplierEditor(supplier)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Archive"
                      variant="danger"
                      onPress={async () => {
                        const confirmed = await confirmMobile(`Archive ${supplier.name}?`);
                        if (!confirmed) return;
                        await archiveSupplier(supplier.id);
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
            title={search ? "No matching suppliers" : "No suppliers yet"}
            subtitle={search ? "Try a different supplier name or clear the filters." : "Create suppliers so purchasing and replenishment stay organized."}
            action={<PrimaryButton title="Add supplier" onPress={() => openSupplierEditor(null)} />}
            icon="business-outline"
          />
        )}

        {selectedSupplier ? (
          <>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Selected supplier</Text>
                  <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "900" }}>{selectedSupplier.name}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{selectedSupplier.contactName ?? "No primary contact"}</Text>
                </View>
                <Badge label={selectedCategoryLabel} tone="success" />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={`Outstanding ${formatMoney(supplierOutstanding, business?.currency ?? "KES")}`} tone="warning" />
                <Badge label={`${supplierOrdersCount} purchase orders`} tone="primary" />
                <Badge label={`${supplierPaymentsCount} payments`} tone="success" />
                <Badge label={`${performance?.paymentCoveragePercent?.toFixed(1) ?? "0.0"}% covered`} tone="primary" />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Edit supplier" variant="secondary" onPress={() => openSupplierEditor(selectedSupplier)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Add payment" onPress={() => openPaymentEditor(null)} />
                </View>
              </View>
            </Card>

            <SummaryRow
              title="Performance Reports"
              subtitle={detailsLoading ? "Refreshing..." : "Supplier spend and payment health over the selected window."}
            >
              <StatPill label="Orders" value={`${performance?.ordersCount ?? 0}`} />
              <StatPill label="Billed" value={formatMoney(performance?.billedTotal ?? 0, business?.currency ?? "KES")} />
              <StatPill label="Paid" value={formatMoney(performance?.paidTotal ?? 0, business?.currency ?? "KES")} />
              <StatPill label="Average order" value={formatMoney(performance?.averageOrderValue ?? 0, business?.currency ?? "KES")} />
            </SummaryRow>

            <SummaryRow title="Statements" subtitle={statement?.range.label ?? "Supplier statement ledger"}>
              <StatPill label="Opening" value={formatMoney(statement?.openingBalance ?? 0, business?.currency ?? "KES")} />
              <StatPill label="Billed" value={formatMoney(statement?.billedTotal ?? 0, business?.currency ?? "KES")} />
              <StatPill label="Paid" value={formatMoney(statement?.paidTotal ?? 0, business?.currency ?? "KES")} />
              <StatPill label="Outstanding" value={formatMoney(statement?.outstandingBalance ?? 0, business?.currency ?? "KES")} />
            </SummaryRow>

            <Card style={{ gap: 12 }}>
              <SectionHeading title="Purchase Orders" subtitle="Orders linked to this supplier" action={<PrimaryButton title="Create order" variant="secondary" onPress={() => navigation.navigate("PurchaseOrders")} />} />
              {selectedSupplierOrders(purchaseOrders, selectedSupplier.id).length ? (
                selectedSupplierOrders(purchaseOrders, selectedSupplier.id).map((order) => (
                  <RowCard
                    key={order.id}
                    title={order.orderNumber}
                    subtitle={`${formatDate(order.orderDate)} • ${order.status.replaceAll("_", " ")}`}
                    amount={formatMoney(order.total, business?.currency ?? "KES")}
                    tone={order.status === "received" ? "success" : order.status === "cancelled" ? "danger" : "primary"}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No purchase orders are linked to this supplier yet.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeading title="Payments" subtitle="Recorded supplier payments for the range" action={<PrimaryButton title="Add payment" variant="secondary" onPress={() => openPaymentEditor(null)} />} />
              {payments.length ? (
                payments.map((payment) => (
                  <RowCard
                    key={payment.id}
                    title={payment.reference ?? payment.method.toUpperCase()}
                    subtitle={`${formatDate(payment.paymentDate)} • ${payment.method}`}
                    amount={formatMoney(payment.amount, business?.currency ?? "KES")}
                    tone="success"
                    action={
                      <Pressable
                        onPress={async () => {
                          const confirmed = await confirmMobile("Archive this supplier payment?");
                          if (!confirmed) return;
                          await archiveSupplierPayment(selectedSupplier.id, payment.id);
                          await loadSupplierDetails(selectedSupplier.id);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
                      </Pressable>
                    }
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No payments have been logged for this supplier yet.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeading title="Contacts" subtitle="People we can call or email at this supplier" action={<PrimaryButton title="Add contact" variant="secondary" onPress={() => openContactEditor(null)} />} />
              {contacts.length ? (
                contacts.map((contact) => (
                  <RowCard
                    key={contact.id}
                    title={contact.name}
                    subtitle={[contact.role, contact.phone, contact.email].filter(Boolean).join(" • ") || "No contact details"}
                    amount={contact.isPrimary ? "Primary" : "Contact"}
                    tone={contact.isPrimary ? "success" : "primary"}
                    action={
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => openContactEditor(contact)}>
                          <Ionicons name="create-outline" size={18} color={tokens.colors.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={async () => {
                            const confirmed = await confirmMobile(`Archive ${contact.name}?`);
                            if (!confirmed) return;
                            await archiveSupplierContact(selectedSupplier.id, contact.id);
                            await loadSupplierDetails(selectedSupplier.id);
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
                        </Pressable>
                      </View>
                    }
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No supplier contacts yet.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeading title="Documents" subtitle="Invoices, contracts, and supporting files" action={<PrimaryButton title="Add document" variant="secondary" onPress={() => openDocumentEditor(null)} />} />
              {documents.length ? (
                documents.map((document) => (
                  <RowCard
                    key={document.id}
                    title={document.title}
                    subtitle={[document.documentType, document.fileName, document.url].filter(Boolean).join(" • ")}
                    amount={document.note ?? "Document"}
                    tone="primary"
                    action={
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable onPress={() => openDocumentEditor(document)}>
                          <Ionicons name="create-outline" size={18} color={tokens.colors.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={async () => {
                            const confirmed = await confirmMobile(`Archive ${document.title}?`);
                            if (!confirmed) return;
                            await archiveSupplierDocument(selectedSupplier.id, document.id);
                            await loadSupplierDetails(selectedSupplier.id);
                          }}
                        >
                          <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
                        </Pressable>
                      </View>
                    }
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No supplier documents uploaded yet.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <SectionHeading title="Statement Preview" subtitle="Recent debits and credits" />
              {statement?.entries.length ? (
                statement.entries.slice(-6).map((entry) => (
                  <View
                    key={`${entry.reference}-${entry.date}`}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: tokens.colors.border,
                      backgroundColor: tokens.colors.surfaceAlt,
                      gap: 6
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{entry.reference}</Text>
                      <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatDate(entry.date)}</Text>
                    </View>
                    <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{entry.description}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Badge label={`Debit ${formatMoney(entry.debit, business?.currency ?? "KES")}`} tone="danger" />
                      <Badge label={`Credit ${formatMoney(entry.credit, business?.currency ?? "KES")}`} tone="success" />
                      <Badge label={`Balance ${formatMoney(entry.balance, business?.currency ?? "KES")}`} tone="primary" />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>No statement activity for the selected window.</Text>
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title="Select a supplier"
            subtitle="Choose a supplier from the list to view purchase orders, payments, statements, documents, and contacts."
            icon="business-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={supplierEditor.visible} title={supplierEditor.editing ? "Edit supplier" : "Add supplier"} onClose={() => setSupplierEditor(EMPTY_SUPPLIER_EDITOR)}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "700" }}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Tag label="No category" tone="primary" selected={!supplierEditor.categoryId} onPress={() => setSupplierEditor((state) => ({ ...state, categoryId: null }))} />
              {categories.map((category) => (
                <Tag
                  key={category.id}
                  label={category.name}
                  tone="primary"
                  selected={supplierEditor.categoryId === category.id}
                  onPress={() => setSupplierEditor((state) => ({ ...state, categoryId: category.id }))}
                />
              ))}
            </View>
          </View>
          <InputField label="Supplier name" value={supplierEditor.name} onChangeText={(value) => setSupplierEditor((state) => ({ ...state, name: value }))} placeholder="Global Supplies Ltd" />
          <InputField label="Supplier code" value={supplierEditor.code} onChangeText={(value) => setSupplierEditor((state) => ({ ...state, code: value }))} placeholder="SUP-001" />
          <InputField label="Contact name" value={supplierEditor.contactName} onChangeText={(value) => setSupplierEditor((state) => ({ ...state, contactName: value }))} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Phone" value={supplierEditor.phone} onChangeText={(value) => setSupplierEditor((state) => ({ ...state, phone: value }))} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Email" value={supplierEditor.email} onChangeText={(value) => setSupplierEditor((state) => ({ ...state, email: value }))} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <InputField label="Notes" value={supplierEditor.notes} onChangeText={(value) => setSupplierEditor((state) => ({ ...state, notes: value }))} multiline numberOfLines={3} />
          <PrimaryButton title="Save supplier" onPress={saveSupplier} />
        </View>
      </SimpleModal>

      <SimpleModal visible={categoryEditor.visible} title={categoryEditor.editing ? "Edit category" : "Add category"} onClose={() => setCategoryEditor(EMPTY_CATEGORY_EDITOR)}>
        <View style={{ gap: 12 }}>
          <InputField label="Category name" value={categoryEditor.name} onChangeText={(value) => setCategoryEditor((state) => ({ ...state, name: value }))} placeholder="Wholesaler" />
          <InputField label="Description" value={categoryEditor.description} onChangeText={(value) => setCategoryEditor((state) => ({ ...state, description: value }))} multiline numberOfLines={2} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Color" value={categoryEditor.color} onChangeText={(value) => setCategoryEditor((state) => ({ ...state, color: value }))} placeholder="#B88A44" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Sort order" value={categoryEditor.sortOrder} onChangeText={(value) => setCategoryEditor((state) => ({ ...state, sortOrder: value }))} keyboardType="numeric" />
            </View>
          </View>
          <PrimaryButton title="Save category" onPress={saveCategory} />
        </View>
      </SimpleModal>

      <SimpleModal visible={contactEditor.visible} title={contactEditor.editing ? "Edit contact" : "Add contact"} onClose={() => setContactEditor(EMPTY_CONTACT_EDITOR)}>
        <View style={{ gap: 12 }}>
          <InputField label="Contact name" value={contactEditor.name} onChangeText={(value) => setContactEditor((state) => ({ ...state, name: value }))} />
          <InputField label="Role" value={contactEditor.role} onChangeText={(value) => setContactEditor((state) => ({ ...state, role: value }))} placeholder="Manager / Accounts / Owner" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Phone" value={contactEditor.phone} onChangeText={(value) => setContactEditor((state) => ({ ...state, phone: value }))} />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Email" value={contactEditor.email} onChangeText={(value) => setContactEditor((state) => ({ ...state, email: value }))} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <InputField label="Notes" value={contactEditor.notes} onChangeText={(value) => setContactEditor((state) => ({ ...state, notes: value }))} multiline numberOfLines={2} />
          <Tag
            label={contactEditor.isPrimary ? "Primary contact" : "Mark as primary"}
            tone="success"
            selected={contactEditor.isPrimary}
            onPress={() => setContactEditor((state) => ({ ...state, isPrimary: !state.isPrimary }))}
          />
          <PrimaryButton title="Save contact" onPress={saveContact} />
        </View>
      </SimpleModal>

      <SimpleModal visible={documentEditor.visible} title={documentEditor.editing ? "Edit document" : "Add document"} onClose={() => setDocumentEditor(EMPTY_DOCUMENT_EDITOR)}>
        <View style={{ gap: 12 }}>
          <InputField label="Title" value={documentEditor.title} onChangeText={(value) => setDocumentEditor((state) => ({ ...state, title: value }))} />
          <InputField label="URL" value={documentEditor.url} onChangeText={(value) => setDocumentEditor((state) => ({ ...state, url: value }))} placeholder="https://..." autoCapitalize="none" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="File name" value={documentEditor.fileName} onChangeText={(value) => setDocumentEditor((state) => ({ ...state, fileName: value }))} />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Type" value={documentEditor.documentType} onChangeText={(value) => setDocumentEditor((state) => ({ ...state, documentType: value }))} placeholder="Invoice / Contract" />
            </View>
          </View>
          <InputField label="Note" value={documentEditor.note} onChangeText={(value) => setDocumentEditor((state) => ({ ...state, note: value }))} multiline numberOfLines={2} />
          <PrimaryButton title="Save document" onPress={saveDocument} />
        </View>
      </SimpleModal>

      <SimpleModal visible={paymentEditor.visible} title="Record supplier payment" onClose={() => setPaymentEditor(EMPTY_PAYMENT_EDITOR)}>
        <View style={{ gap: 12 }}>
          <InputField label="Amount" value={paymentEditor.amount} onChangeText={(value) => setPaymentEditor((state) => ({ ...state, amount: value }))} keyboardType="decimal-pad" />
          <InputField label="Payment date" value={paymentEditor.paymentDate} onChangeText={(value) => setPaymentEditor((state) => ({ ...state, paymentDate: value }))} placeholder="YYYY-MM-DD" />
          <InputField label="Reference" value={paymentEditor.reference} onChangeText={(value) => setPaymentEditor((state) => ({ ...state, reference: value }))} />
          <InputField label="Note" value={paymentEditor.note} onChangeText={(value) => setPaymentEditor((state) => ({ ...state, note: value }))} multiline numberOfLines={2} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_METHODS.map((method) => (
              <Tag key={method} label={method.toUpperCase()} tone="primary" selected={paymentEditor.method === method} onPress={() => setPaymentEditor((state) => ({ ...state, method }))} />
            ))}
          </View>
          <PrimaryButton title="Save payment" onPress={savePayment} />
        </View>
      </SimpleModal>
    </Screen>
  );
}

function SummaryRow({ title, subtitle, children }: { title: string; subtitle?: string | undefined; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 12 }}>
      <SectionHeading title={title} subtitle={subtitle} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>
    </Card>
  );
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string | undefined; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
        {subtitle ? <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: "47%", padding: 12, borderRadius: 16, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 4 }}>
      <Text style={{ color: tokens.colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function RowCard({
  title,
  subtitle,
  amount,
  tone,
  action
}: {
  title: string;
  subtitle: string;
  amount: string;
  tone: "primary" | "success" | "warning" | "danger";
  action?: React.ReactNode;
}) {
  return (
    <View style={{ padding: 12, borderRadius: 14, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{subtitle}</Text>
        </View>
        <Badge label={amount} tone={tone} />
      </View>
      {action ? <View style={{ alignSelf: "flex-end" }}>{action}</View> : null}
    </View>
  );
}

function selectedSupplierOrders(orders: PurchaseOrder[], supplierId: string | null) {
  if (!supplierId) return [];
  return orders
    .filter((order) => order.supplierId === supplierId)
    .sort((left, right) => new Date(right.orderDate).getTime() - new Date(left.orderDate).getTime());
}

function formatDate(date: string) {
  try {
    return format(new Date(date), "PPP");
  } catch {
    return date.slice(0, 10);
  }
}

function confirmMobile(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm action", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}
