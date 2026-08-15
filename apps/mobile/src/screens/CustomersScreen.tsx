import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";
import type { Customer, CustomerAnalytics, CustomerAttachment, CustomerGroup, Payment } from "@shared";
import { AppScrollView, AppVirtualizedList, Avatar, Badge, Card, Dropdown, EmptyState, GradientHeader, InputField, Loader, PrimaryButton, Screen, SimpleModal, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { createId } from "@/utils/id";
import { archiveCustomerGroup, createCustomerGroup, getCustomerAnalytics, listCustomerPayments } from "@/services/apiClient";

const customerSchema = z.object({
  name: z.string().min(2, "Enter a customer name."),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  groupId: z.string().optional(),
  creditLimit: z.string().optional(),
  loyaltyPoints: z.string().optional(),
  notes: z.string().optional()
});

type CustomerFormValues = z.infer<typeof customerSchema>;
type CustomerStatusFilter = "all" | "owing" | "clear" | "over_limit";

const EMPTY_FORM: CustomerFormValues = {
  name: "",
  phone: "",
  email: "",
  groupId: "",
  creditLimit: "0",
  loyaltyPoints: "0",
  notes: ""
};

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function createAttachmentDraft(input?: Partial<CustomerAttachment>): CustomerAttachment {
  return {
    id: input?.id ?? createId(),
    label: input?.label ?? "",
    url: input?.url ?? "",
    note: input?.note ?? null,
    addedAt: input?.addedAt ?? new Date().toISOString()
  };
}

function buildCustomerAnalytics(customers: Customer[], groups: CustomerGroup[]): CustomerAnalytics {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const grouped = new Map<string | null, CustomerAnalytics["grouped"][number]>();

  for (const customer of customers) {
    const groupId = customer.groupId ?? null;
    const group = groupId ? groupsById.get(groupId) ?? null : null;
    const current =
      grouped.get(groupId) ??
      ({
        groupId,
        groupName: group?.name ?? (groupId ? "Archived group" : "Ungrouped"),
        customerCount: 0,
        outstanding: 0,
        loyaltyPoints: 0
      } as CustomerAnalytics["grouped"][number]);
    current.customerCount += 1;
    current.outstanding += Math.max(0, Number(customer.balance ?? 0));
    current.loyaltyPoints += Number(customer.loyaltyPoints ?? 0);
    grouped.set(groupId, current);
  }

  return {
    totalCustomers: customers.length,
    totalOutstanding: customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.balance ?? 0)), 0),
    totalCreditLimit: customers.reduce((sum, customer) => sum + Math.max(0, Number(customer.creditLimit ?? 0)), 0),
    totalLoyaltyPoints: customers.reduce((sum, customer) => sum + Number(customer.loyaltyPoints ?? 0), 0),
    owingCustomers: customers.filter((customer) => Math.max(0, Number(customer.balance ?? 0)) > 0).length,
    grouped: [...grouped.values()].sort((left, right) => right.customerCount - left.customerCount),
    topBalances: [...customers]
      .sort((left, right) => Number(right.balance ?? 0) - Number(left.balance ?? 0))
      .slice(0, 8)
      .map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        balance: Math.max(0, Number(customer.balance ?? 0)),
        creditLimit: Number(customer.creditLimit ?? 0),
        loyaltyPoints: Number(customer.loyaltyPoints ?? 0)
      }))
  };
}

export function CustomersScreen() {
  const customers = useAppStore((state) => state.customers);
  const customerGroups = useAppStore((state) => state.customerGroups);
  const sales = useAppStore((state) => state.sales);
  const business = useAppStore((state) => state.business);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const addCustomer = useAppStore((state) => state.addCustomer);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const recordDebtPayment = useAppStore((state) => state.recordDebtPayment);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [customerEditorVisible, setCustomerEditorVisible] = useState(false);
  const [customerEditorMode, setCustomerEditorMode] = useState<"create" | "edit">("create");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [groupManagerVisible, setGroupManagerVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupColor, setGroupColor] = useState("#B88A44");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("0");
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<"cash" | "mpesa" | "bank" | "credit">("cash");
  const [debtPaymentReference, setDebtPaymentReference] = useState("");
  const [debtPaymentNote, setDebtPaymentNote] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("all");
  const [attachmentDrafts, setAttachmentDrafts] = useState<CustomerAttachment[]>([]);
  const deferredSearch = React.useDeferredValue(search);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CustomerFormValues>({
    mode: "onTouched",
    resolver: zodResolver(customerSchema),
    defaultValues: EMPTY_FORM
  });

  const analyticsFallback = useMemo(() => buildCustomerAnalytics(customers, customerGroups), [customers, customerGroups]);
  const activeAnalytics = analytics ?? analyticsFallback;
  const customerGroupsById = useMemo(() => new Map(customerGroups.map((group) => [group.id, group])), [customerGroups]);
  const groupOptions = useMemo(
    () => [{ label: "No group", value: "" }, ...customerGroups.map((group) => ({ label: group.name, value: group.id }))],
    [customerGroups]
  );
  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === selectedCustomerId) ?? null, [customers, selectedCustomerId]);
  const selectedCustomerGroup = useMemo(
    () => (selectedCustomer?.groupId ? customerGroupsById.get(selectedCustomer.groupId) ?? null : null),
    [customerGroupsById, selectedCustomer]
  );
  const selectedCustomerSales = useMemo(
    () => (selectedCustomer ? sales.filter((sale) => sale.customerId === selectedCustomer.id) : []),
    [sales, selectedCustomer]
  );
  const selectedCustomerSalesTotal = useMemo(
    () => selectedCustomerSales.reduce((sum, sale) => sum + Number(sale.grandTotal ?? 0), 0),
    [selectedCustomerSales]
  );
  const selectedCustomerOutstanding = selectedCustomer ? Math.max(0, Number(selectedCustomer.balance ?? 0)) : 0;
  const selectedCustomerAvailableCredit = selectedCustomer ? Math.max(0, Number(selectedCustomer.creditLimit ?? 0) - selectedCustomerOutstanding) : 0;
  const selectedCustomerIsOverLimit = selectedCustomer ? selectedCustomer.creditLimit > 0 && selectedCustomerOutstanding > selectedCustomer.creditLimit : false;

  const reloadAnalytics = React.useCallback(async () => {
    if (!business?.id) return;
    setAnalyticsLoading(true);
    try {
      const remote = await getCustomerAnalytics(selectedBranchId);
      setAnalytics(remote);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [business?.id, selectedBranchId]);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
    reloadAnalytics().catch(() => undefined);
  }, [loadCatalog, reloadAnalytics]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedPayments([]);
      setPaymentsLoading(false);
      setDebtPaymentAmount("0");
      setDebtPaymentReference("");
      setDebtPaymentNote("");
      setDebtPaymentMethod("cash");
      return;
    }

    setPaymentsLoading(true);
    setDebtPaymentAmount("0");
    setDebtPaymentReference("");
    setDebtPaymentNote("");
    setDebtPaymentMethod("cash");

    listCustomerPayments(selectedCustomerId, selectedBranchId)
      .then((rows) => setSelectedPayments(rows))
      .catch(() => setSelectedPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, [customerGroups, customers, selectedCustomerId, selectedBranchId]);

  const customerGroupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeAnalytics.grouped) {
      if (item.groupId) {
        counts.set(item.groupId, item.customerCount);
      }
    }
    return counts;
  }, [activeAnalytics.grouped]);

  const filteredCustomers = useMemo(() => {
    const searchTerm = deferredSearch.trim().toLowerCase();

    return customers.filter((customer) => {
      const groupLabel = customer.groupId ? customerGroupsById.get(customer.groupId)?.name ?? "" : "Ungrouped";
      const haystack = [
        customer.name,
        customer.phone ?? "",
        customer.email ?? "",
        customer.notes ?? "",
        groupLabel,
        ...customer.attachments.map((attachment) => `${attachment.label} ${attachment.url} ${attachment.note ?? ""}`)
      ]
        .join(" ")
        .toLowerCase();

      if (searchTerm && !haystack.includes(searchTerm)) {
        return false;
      }

      if (selectedGroupId === "ungrouped") {
        if (customer.groupId) return false;
      } else if (selectedGroupId !== "all" && customer.groupId !== selectedGroupId) {
        return false;
      }

      if (statusFilter === "owing" && !(customer.balance > 0)) return false;
      if (statusFilter === "clear" && !(customer.balance <= 0)) return false;
      if (statusFilter === "over_limit" && !(customer.creditLimit > 0 && customer.balance > customer.creditLimit)) return false;

      return true;
    });
  }, [customerGroupsById, customers, deferredSearch, selectedGroupId, statusFilter]);

  async function refreshCustomers() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([loadCatalog(), reloadAnalytics()]);
    } finally {
      setRefreshing(false);
    }
  }

  function openCreateCustomer() {
    setCustomerEditorMode("create");
    setEditingCustomerId(null);
    reset(EMPTY_FORM);
    setAttachmentDrafts([]);
    setCustomerEditorVisible(true);
  }

  function openEditCustomer(customer: Customer) {
    setCustomerEditorMode("edit");
    setEditingCustomerId(customer.id);
    reset({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      groupId: customer.groupId ?? "",
      creditLimit: String(customer.creditLimit ?? 0),
      loyaltyPoints: String(customer.loyaltyPoints ?? 0),
      notes: customer.notes ?? ""
    });
    setAttachmentDrafts(customer.attachments.length ? customer.attachments.map((attachment) => ({ ...attachment })) : []);
    setCustomerEditorVisible(true);
  }

  async function saveGroup() {
    const name = groupName.trim();
    if (!name) {
      Alert.alert("Group name required", "Enter a name for the customer group.");
      return;
    }
    if (!business?.id) {
      Alert.alert("Business missing", "Please sign in again before saving customer groups.");
      return;
    }
    setGroupSaving(true);
    try {
      await createCustomerGroup({
        businessId: business.id,
        externalId: createId(),
        name,
        description: normalizeOptionalText(groupDescription),
        color: normalizeOptionalText(groupColor),
        isActive: true
      });
      setGroupName("");
      setGroupDescription("");
      setGroupColor("#B88A44");
      setGroupManagerVisible(false);
      await Promise.allSettled([loadCatalog(), reloadAnalytics()]);
      Alert.alert("Group created", "Customer group created successfully.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to create customer group");
    } finally {
      setGroupSaving(false);
    }
  }

  async function archiveGroup(group: CustomerGroup) {
    Alert.alert("Archive group?", `Archive ${group.name}? Customers stay intact and will simply appear as ungrouped until reassigned.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          try {
            setGroupBusyId(group.id);
            await archiveCustomerGroup(group.id);
            if (selectedGroupId === group.id) {
              setSelectedGroupId("all");
            }
            await Promise.allSettled([loadCatalog(), reloadAnalytics()]);
          } catch (error) {
            Alert.alert("Archive failed", error instanceof Error ? error.message : "Failed to archive the group");
          } finally {
            setGroupBusyId(null);
          }
        }
      }
    ]);
  }

  const submitCustomer = handleSubmit(async (values) => {
    if (!business?.id) {
      Alert.alert("Business missing", "Please sign in again before saving customers.");
      return;
    }

    const attachments = attachmentDrafts
      .map((attachment) => ({
        id: attachment.id || createId(),
        label: attachment.label.trim(),
        url: attachment.url.trim(),
        note: normalizeOptionalText(attachment.note),
        addedAt: attachment.addedAt ?? new Date().toISOString()
      }))
      .filter((attachment) => attachment.label || attachment.url || attachment.note);

    const payload = {
      groupId: values.groupId?.trim() ? values.groupId.trim() : null,
      name: values.name.trim(),
      phone: normalizeOptionalText(values.phone),
      email: normalizeOptionalText(values.email),
      creditLimit: Number(values.creditLimit || 0),
      loyaltyPoints: Number(values.loyaltyPoints || 0),
      notes: normalizeOptionalText(values.notes),
      attachments
    };

    setSavingCustomer(true);
    try {
      const customer =
        customerEditorMode === "create"
          ? await addCustomer({ businessId: business.id, ...payload, balance: 0 })
          : editingCustomerId
            ? await updateCustomer({ customerId: editingCustomerId, patch: payload })
            : null;

      reset(EMPTY_FORM);
      setAttachmentDrafts([]);
      setCustomerEditorVisible(false);
      if (customer) {
        setSelectedCustomerId(customer.id);
      }
      await reloadAnalytics();
      Alert.alert(customerEditorMode === "create" ? "Customer created" : "Customer updated", "Customer saved successfully.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save customer");
    } finally {
      setSavingCustomer(false);
    }
  });

  return (
    <Screen>
      <GradientHeader
        title="Customers"
        subtitle="Balances, loyalty, credit, and purchase history"
        right={
          <Pressable onPress={openCreateCustomer}>
            <Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppVirtualizedList
        refreshing={refreshing}
        onRefresh={refreshCustomers}
        data={filteredCustomers}
        keyExtractor={(customer) => customer.id}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Customer analytics</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Track value, not just debt</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                Search by name, phone, email, notes, or group. Customer groups and loyalty data stay optional so existing customers remain unaffected.
              </Text>
              {analyticsLoading ? <Loader label="Refreshing analytics..." /> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Card style={{ flexBasis: "48%", flexGrow: 1, gap: 8 }}>
                  <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>Customers</Text>
                  <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "800" }}>{activeAnalytics.totalCustomers}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>Total customer records</Text>
                </Card>
                <Card style={{ flexBasis: "48%", flexGrow: 1, gap: 8 }}>
                  <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>Outstanding</Text>
                  <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "800" }}>{formatMoney(activeAnalytics.totalOutstanding, business?.currency ?? "KES")}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>{activeAnalytics.owingCustomers} customers owe money</Text>
                </Card>
                <Card style={{ flexBasis: "48%", flexGrow: 1, gap: 8 }}>
                  <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>Credit limit</Text>
                  <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "800" }}>{formatMoney(activeAnalytics.totalCreditLimit, business?.currency ?? "KES")}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>Assigned across customers</Text>
                </Card>
                <Card style={{ flexBasis: "48%", flexGrow: 1, gap: 8 }}>
                  <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 11 }}>Loyalty</Text>
                  <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "800" }}>{activeAnalytics.totalLoyaltyPoints}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>Total reward points</Text>
                </Card>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={`${customerGroups.length} groups`} tone="primary" />
                <Badge label={`${activeAnalytics.grouped.length} grouped segments`} tone="success" />
                <Badge label={`${filteredCustomers.length} visible`} tone="warning" />
              </View>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <PrimaryButton title="Add customer" onPress={openCreateCustomer} />
                <PrimaryButton title="Manage groups" variant="secondary" onPress={() => setGroupManagerVisible(true)} />
              </View>
            </Card>

            <Card style={{ gap: 10 }}>
              <InputField
                label="Search customers"
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, phone, email, notes"
                helperText="Search across contact details, notes, and group names."
              />
              <View style={{ gap: 8 }}>
                <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.7, fontSize: 11 }}>Status</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Tag label="All" selected={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
                  <Tag label="Owing" selected={statusFilter === "owing"} onPress={() => setStatusFilter("owing")} />
                  <Tag label="Clear" selected={statusFilter === "clear"} onPress={() => setStatusFilter("clear")} />
                  <Tag label="Over credit" selected={statusFilter === "over_limit"} onPress={() => setStatusFilter("over_limit")} />
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.7, fontSize: 11 }}>Groups</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Tag label="All groups" selected={selectedGroupId === "all"} onPress={() => setSelectedGroupId("all")} />
                  <Tag label="Ungrouped" selected={selectedGroupId === "ungrouped"} onPress={() => setSelectedGroupId("ungrouped")} />
                  {customerGroups.map((group) => (
                    <Tag
                      key={group.id}
                      label={`${group.name}${customerGroupCounts.has(group.id) ? ` (${customerGroupCounts.get(group.id)})` : ""}`}
                      selected={selectedGroupId === group.id}
                      onPress={() => setSelectedGroupId(group.id)}
                    />
                  ))}
                </View>
              </View>
            </Card>
          </View>
        }
        renderItem={({ item: customer }) => {
          const group = customer.groupId ? customerGroupsById.get(customer.groupId) ?? null : null;
          const isOverCredit = customer.creditLimit > 0 && customer.balance > customer.creditLimit;
          const contactLine = customer.phone ?? customer.email ?? "No contact details";
          return (
            <Pressable key={customer.id} onPress={() => setSelectedCustomerId(customer.id)}>
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <Avatar name={customer.name} size={46} tone={isOverCredit ? "warning" : customer.balance > 0 ? "danger" : "primary"} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{customer.name}</Text>
                        <Text style={{ color: tokens.colors.textSecondary }}>{contactLine}</Text>
                      </View>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setSelectedCustomerId(null);
                          openEditCustomer(customer);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${customer.name}`}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="create-outline" size={20} color={tokens.colors.primaryStrong} />
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <Badge label={group?.name ?? "Ungrouped"} tone={group ? "primary" : "warning"} />
                      <Badge label={customer.balance > 0 ? "Owing" : "Clear"} tone={customer.balance > 0 ? "danger" : "success"} />
                      {customer.creditLimit > 0 ? <Badge label={`Limit ${formatMoney(customer.creditLimit, business?.currency ?? "KES")}`} tone={isOverCredit ? "warning" : "primary"} /> : null}
                      {customer.loyaltyPoints > 0 ? <Badge label={`${customer.loyaltyPoints} points`} tone="success" /> : null}
                    </View>
                  </View>
                </View>
                <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>
                  Balance: {formatMoney(customer.balance, business?.currency ?? "KES")}
                </Text>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={search ? "No matching customers" : "No customers yet"}
            subtitle={search ? "Try a different name, contact detail, or clear the filters." : "Add a customer to track balances, loyalty, and purchase history."}
            action={<PrimaryButton title="Add customer" onPress={openCreateCustomer} />}
            icon="people-outline"
          />
        }
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      />

      <SimpleModal
        visible={customerEditorVisible}
        title={customerEditorMode === "create" ? "Add customer" : "Edit customer"}
        onClose={() => {
          setCustomerEditorVisible(false);
          setEditingCustomerId(null);
        }}
      >
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Customer name"
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
                helperText="Use the name you want to show on statements."
                autoCapitalize="words"
                autoFocus
              />
            )}
          />
          <Controller control={control} name="phone" render={({ field: { value, onChange } }) => <InputField label="Phone" value={value ?? ""} onChangeText={onChange} helperText="Optional contact number." />} />
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange } }) => (
              <InputField label="Email" value={(value as string) ?? ""} onChangeText={onChange} error={errors.email?.message} helperText="Optional email for invoices or updates." />
            )}
          />
          <Controller
            control={control}
            name="groupId"
            render={({ field: { value, onChange } }) => (
              <Dropdown
                label="Customer group"
                value={value ?? ""}
                options={groupOptions}
                placeholder="Select a group"
                onChange={onChange}
                helperText="Groups keep customers organized without changing their balances."
              />
            )}
          />
          <Controller
            control={control}
            name="creditLimit"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Credit limit"
                value={value ?? "0"}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                helperText="Optional limit for customers who can buy on credit."
              />
            )}
          />
          <Controller
            control={control}
            name="loyaltyPoints"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Loyalty points"
                value={value ?? "0"}
                onChangeText={onChange}
                keyboardType="number-pad"
                helperText="Add or adjust reward points."
              />
            )}
          />
          <Controller control={control} name="notes" render={({ field: { value, onChange } }) => <InputField label="Notes" value={value ?? ""} onChangeText={onChange} multiline numberOfLines={3} helperText="Anything useful for your team to remember." />} />

          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Attachments</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>Store receipts, signed slips, or profile links as URL metadata.</Text>
              </View>
              <PrimaryButton title="Add" variant="secondary" onPress={() => setAttachmentDrafts((current) => [...current, createAttachmentDraft()])} />
            </View>
            {attachmentDrafts.length ? (
              attachmentDrafts.map((attachment, index) => (
                <Card key={attachment.id} style={{ gap: 10, backgroundColor: tokens.colors.surfaceAlt }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Attachment {index + 1}</Text>
                    <Pressable onPress={() => setAttachmentDrafts((current) => current.filter((item) => item.id !== attachment.id))}>
                      <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
                    </Pressable>
                  </View>
                  <InputField
                    label="Label"
                    value={attachment.label}
                    onChangeText={(text) =>
                      setAttachmentDrafts((current) => current.map((item) => (item.id === attachment.id ? { ...item, label: text } : item)))
                    }
                  />
                  <InputField
                    label="URL"
                    value={attachment.url}
                    onChangeText={(text) =>
                      setAttachmentDrafts((current) => current.map((item) => (item.id === attachment.id ? { ...item, url: text } : item)))
                    }
                    placeholder="https://..."
                  />
                  <InputField
                    label="Note"
                    value={attachment.note ?? ""}
                    onChangeText={(text) =>
                      setAttachmentDrafts((current) => current.map((item) => (item.id === attachment.id ? { ...item, note: text } : item)))
                    }
                    multiline
                    numberOfLines={2}
                  />
                </Card>
              ))
            ) : (
              <EmptyState title="No attachments yet" subtitle="Add a row when you need to keep a link or document reference with the customer." icon="attach-outline" />
            )}
          </Card>

          <PrimaryButton title={customerEditorMode === "create" ? "Save customer" : "Update customer"} onPress={submitCustomer} loading={savingCustomer} />
        </AppScrollView>
      </SimpleModal>

      <SimpleModal visible={groupManagerVisible} title="Customer groups" onClose={() => setGroupManagerVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>New group</Text>
            <InputField label="Group name" value={groupName} onChangeText={setGroupName} helperText="Keep it short and recognizable." autoCapitalize="words" />
            <InputField label="Description" value={groupDescription} onChangeText={setGroupDescription} multiline numberOfLines={3} helperText="Optional context for your team." />
            <InputField label="Color" value={groupColor} onChangeText={setGroupColor} helperText="Optional brand color or hex code." autoCapitalize="characters" />
            <PrimaryButton title="Save group" onPress={saveGroup} loading={groupSaving} />
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Existing groups</Text>
            {customerGroups.length ? (
              customerGroups.map((group) => {
                const count = customerGroupCounts.get(group.id) ?? 0;
                return (
                  <Card key={group.id} style={{ gap: 8, backgroundColor: tokens.colors.surfaceAlt }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{group.name}</Text>
                        <Text style={{ color: tokens.colors.textSecondary }}>{group.description ?? "No description"}</Text>
                      </View>
                      <Badge label={`${count} customers`} tone="primary" />
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <Badge label={group.isActive ? "Active" : "Archived"} tone={group.isActive ? "success" : "warning"} />
                      <Pressable disabled={groupBusyId === group.id} onPress={() => archiveGroup(group)}>
                        <Text style={{ color: tokens.colors.danger, fontWeight: "800" }}>{groupBusyId === group.id ? "Working..." : "Archive"}</Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            ) : (
              <EmptyState title="No groups yet" subtitle="Create your first customer group to organize the customer list." icon="albums-outline" />
            )}
          </Card>
        </AppScrollView>
      </SimpleModal>

      <SimpleModal visible={Boolean(selectedCustomer)} title="Customer statement" onClose={() => setSelectedCustomerId(null)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          {selectedCustomer ? (
            <>
              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Statement</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={selectedCustomer.name} size={48} tone={selectedCustomerIsOverLimit ? "warning" : selectedCustomerOutstanding > 0 ? "danger" : "primary"} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{selectedCustomer.name}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>{selectedCustomer.phone ?? selectedCustomer.email ?? "No contact details"}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Badge label={selectedCustomerGroup?.name ?? "Ungrouped"} tone={selectedCustomerGroup ? "primary" : "warning"} />
                  <Badge label={selectedCustomerOutstanding > 0 ? "Balance due" : "Fully paid"} tone={selectedCustomerOutstanding > 0 ? "warning" : "success"} />
                  {selectedCustomer.creditLimit > 0 ? <Badge label={`Limit ${formatMoney(selectedCustomer.creditLimit, business?.currency ?? "KES")}`} tone={selectedCustomerIsOverLimit ? "danger" : "primary"} /> : null}
                  <Badge label={`${selectedCustomer.loyaltyPoints} points`} tone="success" />
                </View>
                <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>
                  Outstanding: {formatMoney(selectedCustomerOutstanding, business?.currency ?? "KES")}
                </Text>
                {selectedCustomer.creditLimit > 0 ? (
                  <Text style={{ color: tokens.colors.textSecondary }}>Available credit: {formatMoney(selectedCustomerAvailableCredit, business?.currency ?? "KES")}</Text>
                ) : null}
                {selectedCustomer.notes ? <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{selectedCustomer.notes}</Text> : null}
                {selectedCustomer.attachments.length ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Attachments</Text>
                    {selectedCustomer.attachments.map((attachment) => (
                      <Card key={attachment.id} style={{ gap: 4, backgroundColor: tokens.colors.surfaceAlt }}>
                        <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{attachment.label}</Text>
                        <Text style={{ color: tokens.colors.textSecondary }}>{attachment.url}</Text>
                        {attachment.note ? <Text style={{ color: tokens.colors.textSecondary }}>{attachment.note}</Text> : null}
                      </Card>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <PrimaryButton title="Edit customer" variant="secondary" onPress={() => openEditCustomer(selectedCustomer)} />
                  <PrimaryButton
                    title="Close"
                    onPress={() => {
                      setSelectedCustomerId(null);
                    }}
                  />
                </View>
              </Card>

              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Record payment</Text>
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                  Capture the amount received and a reference so the balance stays easy to track.
                </Text>
                <InputField
                  label="Amount"
                  value={debtPaymentAmount}
                  onChangeText={setDebtPaymentAmount}
                  keyboardType="decimal-pad"
                  helperText="Enter the payment amount."
                />
                <InputField
                  label="Reference"
                  value={debtPaymentReference}
                  onChangeText={setDebtPaymentReference}
                  placeholder="M-Pesa code or slip"
                  helperText="Optional reference or transaction code."
                />
                <InputField label="Note" value={debtPaymentNote} onChangeText={setDebtPaymentNote} placeholder="Optional note" helperText="Use this for any extra context." />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(["cash", "mpesa", "bank", "credit"] as const).map((method) => (
                    <Tag key={method} label={formatPaymentMethodLabel(method)} tone="primary" selected={debtPaymentMethod === method} onPress={() => setDebtPaymentMethod(method)} />
                  ))}
                </View>
                <PrimaryButton
                  title="Save payment"
                  onPress={async () => {
                    setSavingPayment(true);
                    try {
                      const amount = Number(debtPaymentAmount || 0);
                      if (amount <= 0) {
                        Alert.alert("Invalid amount", "Enter a payment amount greater than zero.");
                        return;
                      }
                      await recordDebtPayment({
                        customerId: selectedCustomer.id,
                        amount,
                        method: debtPaymentMethod,
                        reference: debtPaymentReference.trim() || null,
                        note: debtPaymentNote.trim() || null
                      });
                      const refreshedPayments = await listCustomerPayments(selectedCustomer.id, selectedBranchId);
                      setSelectedPayments(refreshedPayments);
                      await reloadAnalytics();
                      Alert.alert("Payment recorded", "Customer payment recorded successfully.");
                    } catch (error) {
                      Alert.alert("Payment failed", error instanceof Error ? error.message : "Failed to record payment");
                    } finally {
                      setSavingPayment(false);
                    }
                  }}
                  loading={savingPayment}
                />
              </Card>

              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Purchase history</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>
                  {selectedCustomerSales.length} purchases totaling {formatMoney(selectedCustomerSalesTotal, business?.currency ?? "KES")}
                </Text>
                {selectedCustomerSales.length ? (
                  selectedCustomerSales.map((sale) => (
                    <View key={sale.id} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{sale.receiptNumber}</Text>
                        <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>{formatMoney(sale.grandTotal, business?.currency ?? "KES")}</Text>
                      </View>
                      <Text style={{ color: tokens.colors.textSecondary }}>{sale.createdAt}</Text>
                    </View>
                  ))
                ) : (
                  <EmptyState title="No sales yet" subtitle="This customer has not been linked to any sales." icon="cart-outline" />
                )}
              </Card>

              <Card style={{ gap: 10 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Recent payments</Text>
                {paymentsLoading ? (
                  <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
                    <ActivityIndicator size="small" color={tokens.colors.primaryStrong} />
                    <Text style={{ color: tokens.colors.textSecondary }}>Loading payment history...</Text>
                  </View>
                ) : selectedPayments.length ? (
                  selectedPayments.map((payment) => (
                    <View key={payment.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{formatPaymentMethodLabel(payment.method)}</Text>
                        <Badge label={formatPaymentStatusLabel(payment.status)} tone={payment.status === "paid" ? "success" : "warning"} />
                      </View>
                      <Text style={{ color: tokens.colors.textSecondary }}>{payment.note ?? payment.reference ?? "Debt repayment"}</Text>
                      <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>{formatMoney(payment.amount, business?.currency ?? "KES")}</Text>
                    </View>
                  ))
                ) : (
                  <EmptyState title="No recorded repayments" subtitle="Use the payment form above to record the first payment." icon="cash-outline" />
                )}
              </Card>
            </>
          ) : null}
        </AppScrollView>
      </SimpleModal>
    </Screen>
  );
}

function formatPaymentMethodLabel(method: "cash" | "mpesa" | "bank" | "credit") {
  return method === "mpesa" ? "M-Pesa" : method === "cash" ? "Cash" : method === "bank" ? "Bank" : "Credit";
}

function formatPaymentStatusLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "unpaid") return "Unpaid";
  if (status === "partial") return "Partial";
  return status.replaceAll("_", " ");
}
