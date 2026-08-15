import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useNavigation } from "@react-navigation/native";
import {
  Badge,
  Card,
  DateRangePickerModal,
  EmptyState,
  ErrorState,
  GradientHeader,
  InputField,
  PrimaryButton,
  Screen,
  SimpleModal,
  SkeletonBlock,
  StatCard,
  Tag
} from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { formatMoney } from "@/utils/money";
import { createId } from "@/utils/id";
import { useAppStore } from "@/store/useAppStore";
import {
  archiveBankAccount,
  archiveFinanceCreditNote,
  archivePettyCashEntry,
  createBankAccount,
  createFinanceCreditNote,
  createPettyCashEntry,
  getFinanceOverview,
  listBankAccounts,
  listFinanceCreditNotes,
  listFinanceInvoices,
  listFinancePayments,
  listPettyCashEntries,
  listExpenses
} from "@/services/apiClient";
import type { BankAccount, CreditNote, Expense, FinanceInvoice, FinanceOverview, FinancePayment, PettyCashEntry } from "@shared";
import { hasPermission } from "@shared";
import { bankAccountCreateSchema, creditNoteCreateSchema, pettyCashEntryCreateSchema } from "@shared";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

type Filter = "today" | "week" | "month" | "year" | "custom";
type RangeState = { from: string; to: string };

type BankAccountFormValues = z.infer<typeof bankAccountCreateSchema>;
type PettyCashFormValues = z.infer<typeof pettyCashEntryCreateSchema>;
type CreditNoteFormValues = z.infer<typeof creditNoteCreateSchema>;

export function FinanceScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const liveDataVersion = useAppStore((state) => `${state.sales.length}:${state.expenses.length}:${state.customers.length}`);
  const canManageExpenses = hasPermission(user, "manageExpenses");
  const canViewReports = hasPermission(user, "viewReports");

  const [activeFilter, setActiveFilter] = React.useState<Filter>("month");
  const [customRange, setCustomRange] = React.useState<RangeState | null>(null);
  const [overview, setOverview] = React.useState<FinanceOverview | null>(null);
  const [invoices, setInvoices] = React.useState<FinanceInvoice[]>([]);
  const [payments, setPayments] = React.useState<FinancePayment[]>([]);
  const [creditNotes, setCreditNotes] = React.useState<CreditNote[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [pettyCash, setPettyCash] = React.useState<PettyCashEntry[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [bankVisible, setBankVisible] = React.useState(false);
  const [pettyVisible, setPettyVisible] = React.useState(false);
  const [creditVisible, setCreditVisible] = React.useState(false);
  const [savingBank, setSavingBank] = React.useState(false);
  const [savingPetty, setSavingPetty] = React.useState(false);
  const [savingCredit, setSavingCredit] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const initializedRef = React.useRef(false);

  const currentRange = React.useMemo(() => {
    if (activeFilter === "custom") return customRange;
    return presetRange(activeFilter);
  }, [activeFilter, customRange]);

  React.useEffect(() => {
    if (!currentRange) return;
    const range = toApiRange(currentRange);
    void loadFinance(range.from, range.to);
  }, [currentRange?.from, currentRange?.to, selectedBranchId]);

  React.useEffect(() => {
    if (!initializedRef.current || !currentRange) return;
    const range = toApiRange(currentRange);
    void loadFinance(range.from, range.to, "refresh");
  }, [liveDataVersion, currentRange?.from, currentRange?.to, selectedBranchId]);

  async function loadFinance(from: string, to: string, mode: "replace" | "refresh" = "replace") {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);

    try {
      const [overviewResponse, invoiceResponse, paymentResponse, creditResponse, bankResponse, pettyResponse, expenseResponse] = await Promise.all([
        getFinanceOverview(from, to, selectedBranchId),
        listFinanceInvoices(from, to, selectedBranchId),
        listFinancePayments(from, to, selectedBranchId),
        listFinanceCreditNotes(from, to, selectedBranchId),
        listBankAccounts(selectedBranchId),
        listPettyCashEntries(from, to, selectedBranchId),
        listExpenses(selectedBranchId)
      ]);
      if (requestId !== requestIdRef.current) return;
      setOverview(overviewResponse);
      setInvoices(invoiceResponse);
      setPayments(paymentResponse);
      setCreditNotes(creditResponse);
      setBankAccounts(bankResponse);
      setPettyCash(pettyResponse);
      setExpenses(expenseResponse);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Unable to load finance");
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
      initializedRef.current = true;
    }
  }

  async function handleRefresh() {
    if (!currentRange || loading || refreshing) return;
    const range = toApiRange(currentRange);
    await loadFinance(range.from, range.to, "refresh");
  }

  function applyCustomRange(range: { startDate: string; endDate: string }) {
    setCustomRange({ from: range.startDate, to: range.endDate });
    setActiveFilter("custom");
  }

  async function exportPdf() {
    if (!currentRange || !overview) return;
    try {
      const html = buildExportHtml({
        title: "Finance report",
        subtitle: formatRangeLabel(currentRange.from, currentRange.to),
        overview,
        invoices,
        creditNotes,
        payments,
        bankAccounts,
        pettyCash,
        expenses,
        currency: business?.currency ?? "KES"
      });
      const file = await Print.printToFileAsync({ html });
      const targetPath = `${FileSystem.cacheDirectory ?? ""}biz-pro-finance-${Date.now()}.pdf`;
      await FileSystem.moveAsync({ from: file.uri, to: targetPath });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetPath, { mimeType: "application/pdf", dialogTitle: "Export finance report" });
        return;
      }
      Alert.alert("Export ready", "PDF was generated on the device.");
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Unable to export the finance report");
    }
  }

  async function exportExcel() {
    if (!currentRange || !overview) return;
    try {
      const html = buildExportHtml({
        title: "Finance report",
        subtitle: formatRangeLabel(currentRange.from, currentRange.to),
        overview,
        invoices,
        creditNotes,
        payments,
        bankAccounts,
        pettyCash,
        expenses,
        currency: business?.currency ?? "KES"
      });
      const fileName = `biz-pro-finance-${Date.now()}.xls`;
      const filePath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, html, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/vnd.ms-excel",
          dialogTitle: "Export finance workbook"
        });
        return;
      }
      Alert.alert("Export ready", "Excel workbook was generated on the device.");
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Unable to export the finance workbook");
    }
  }

  const rangeLabel = currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "Loading";

  const hasContent =
    Boolean(overview) &&
    (overview!.incomeTotal > 0 || overview!.expensesTotal > 0 || overview!.invoiceCount > 0 || overview!.creditNoteCount > 0 || payments.length > 0 || bankAccounts.length > 0 || pettyCash.length > 0);

  if (!canManageExpenses && !canViewReports) {
    return (
      <Screen>
        <GradientHeader title="Finance" subtitle="Expenses, income, and cash control" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Finance access restricted"
            subtitle="This account cannot view the finance workspace. Ask an owner or manager to grant reporting access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Finance"
        subtitle={`${rangeLabel} • expenses, income, cash flow, and controls`}
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 12 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Finance snapshot</Text>
            <Text style={{ color: tokens.colors.text, fontSize: 22, fontWeight: "900" }}>Track money in, money out, and the positions that matter.</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Expenses, income, invoices, credit notes, payments, bank accounts, and petty cash all live here. Sales reports stay in the Reports area.
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["year", "This Year"]
            ] as Array<[Exclude<Filter, "custom">, string]>).map(([filter, label]) => (
              <Tag key={filter} label={label} tone="primary" selected={activeFilter === filter} onPress={() => setActiveFilter(filter)} />
            ))}
            <Tag label="Custom Range" tone="warning" selected={activeFilter === "custom"} onPress={() => setPickerVisible(true)} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Export PDF" variant="secondary" onPress={exportPdf} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Export Excel" variant="secondary" onPress={exportExcel} />
            </View>
          </View>
          {error ? <Text style={{ color: tokens.colors.danger, lineHeight: 18 }}>{error}</Text> : null}
        </Card>

        {loading && !overview ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <SkeletonBlock height={120} style={{ flex: 1 }} />
              <SkeletonBlock height={120} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <SkeletonBlock height={120} style={{ flex: 1 }} />
              <SkeletonBlock height={120} style={{ flex: 1 }} />
            </View>
            <SkeletonBlock height={220} />
            <SkeletonBlock height={220} />
          </View>
        ) : error && !overview ? (
          <ErrorState
            title="Finance unavailable"
            subtitle={error}
            action={
              <PrimaryButton
                title="Try again"
                onPress={() => {
                  if (!currentRange) return;
                  const range = toApiRange(currentRange);
                  void loadFinance(range.from, range.to);
                }}
              />
            }
          />
        ) : !hasContent ? (
          <EmptyState
            title="Nothing to show yet"
            subtitle="This period does not have enough activity. Try a wider range or record a few sales and expenses first."
            icon="cash-outline"
          />
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard label="Income" value={formatMoney(overview?.incomeTotal ?? 0, business?.currency)} icon="trending-up-outline" tone="success" />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard label="Expenses" value={formatMoney(overview?.expensesTotal ?? 0, business?.currency)} icon="trending-down-outline" tone="warning" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard label="Profit & Loss" value={formatMoney(overview?.profitLossTotal ?? 0, business?.currency)} icon="analytics-outline" tone="primary" />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard label="Cash Flow" value={formatMoney(overview?.cashFlowTotal ?? 0, business?.currency)} icon="water-outline" tone="success" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <StatCard label="Tax Reports" value={formatMoney(overview?.taxTotal ?? 0, business?.currency)} icon="document-text-outline" tone="danger" />
              </View>
              <View style={{ flex: 1 }}>
                <StatCard label="Payments" value={formatMoney(overview?.paymentTotal ?? 0, business?.currency)} icon="card-outline" tone="primary" />
              </View>
            </View>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Invoices</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>
                {overview?.invoiceCount ?? 0} open invoices totaling {formatMoney(overview?.invoiceTotal ?? 0, business?.currency)}.
              </Text>
              {invoices.length ? (
                invoices.map((invoice) => <FinanceRow key={invoice.id} title={invoice.receiptNumber} subtitle={invoice.customerId ?? "Walk-in invoice"} amount={invoice.balanceDue} currency={business?.currency ?? "KES"} tone="warning" badge={paymentStatusLabel(invoice.paymentStatus)} />)
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No open invoices in this period.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Credit notes</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>
                {overview?.creditNoteCount ?? 0} credit notes totaling {formatMoney(overview?.creditNoteTotal ?? 0, business?.currency)}.
              </Text>
              {creditNotes.length ? (
                creditNotes.map((note) => (
                  <FinanceRow
                    key={note.id}
                    title={note.reference}
                    subtitle={note.reason}
                    amount={note.amount}
                    currency={business?.currency ?? "KES"}
                    tone="danger"
                    badge={note.status}
                    actionLabel="Archive"
                    onAction={async () => {
                      try {
                        await archiveFinanceCreditNote(note.id);
                        if (currentRange) {
                          const range = toApiRange(currentRange);
                          await loadFinance(range.from, range.to, "refresh");
                        }
                      } catch (error) {
                        Alert.alert("Archive failed", error instanceof Error ? error.message : "Unable to archive credit note");
                      }
                    }}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No credit notes have been recorded yet.</Text>
              )}
              <PrimaryButton title="Create credit note" variant="secondary" onPress={() => setCreditVisible(true)} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Payments</Text>
              {payments.length ? (
                payments.map((payment) => (
                  <FinanceRow
                    key={payment.id}
                    title={formatPaymentLabel(payment.method)}
                    subtitle={payment.note ?? payment.reference ?? payment.saleId ?? "Payment record"}
                    amount={payment.amount}
                    currency={business?.currency ?? "KES"}
                    tone={payment.status === "paid" ? "success" : "primary"}
                    badge={payment.status}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No payments were recorded in this period.</Text>
              )}
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Bank accounts</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>{overview?.bankBalanceTotal ?? 0 ? `Total bank position is ${formatMoney(overview?.bankBalanceTotal ?? 0, business?.currency)}` : "Track operating accounts and balances in one place."}</Text>
              {bankAccounts.length ? (
                bankAccounts.map((account) => (
                  <FinanceRow
                    key={account.id}
                    title={account.accountName}
                    subtitle={`${account.bankName}${account.accountNumber ? ` • ${account.accountNumber}` : ""}`}
                    amount={account.currentBalance}
                    currency={account.currency ?? business?.currency ?? "KES"}
                    tone={account.isPrimary ? "success" : "primary"}
                    badge={account.isPrimary ? "primary" : "secondary"}
                    actionLabel="Archive"
                    onAction={async () => {
                      try {
                        await archiveBankAccount(account.id);
                        if (currentRange) {
                          const range = toApiRange(currentRange);
                          await loadFinance(range.from, range.to, "refresh");
                        }
                      } catch (error) {
                        Alert.alert("Archive failed", error instanceof Error ? error.message : "Unable to archive bank account");
                      }
                    }}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No bank accounts yet.</Text>
              )}
              <PrimaryButton title="Add bank account" variant="secondary" onPress={() => setBankVisible(true)} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Petty cash</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>
                Current petty cash balance: {formatMoney(overview?.pettyCashBalance ?? 0, business?.currency)}.
              </Text>
              {pettyCash.length ? (
                pettyCash.map((entry) => (
                  <FinanceRow
                    key={entry.id}
                    title={entry.label}
                    subtitle={`${entry.entryDate} • ${entry.direction === "in" ? "in" : "out"}${entry.category ? ` • ${entry.category}` : ""}`}
                    amount={entry.direction === "in" ? entry.amount : -entry.amount}
                    currency={business?.currency ?? "KES"}
                    tone={entry.direction === "in" ? "success" : "warning"}
                    badge={entry.direction}
                    actionLabel="Archive"
                    onAction={async () => {
                      try {
                        await archivePettyCashEntry(entry.id);
                        if (currentRange) {
                          const range = toApiRange(currentRange);
                          await loadFinance(range.from, range.to, "refresh");
                        }
                      } catch (error) {
                        Alert.alert("Archive failed", error instanceof Error ? error.message : "Unable to archive petty cash entry");
                      }
                    }}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No petty cash entries yet.</Text>
              )}
              <PrimaryButton title="Add petty cash entry" variant="secondary" onPress={() => setPettyVisible(true)} />
            </Card>

            <Card style={{ gap: 12 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Expenses</Text>
              {expenses.length ? (
                expenses.map((expense) => (
                  <FinanceRow
                    key={expense.id}
                    title={expense.note}
                    subtitle={expense.expenseDate}
                    amount={expense.amount}
                    currency={business?.currency ?? "KES"}
                    tone="warning"
                    badge="expense"
                    actionLabel="Open register"
                    onAction={() => navigation.navigate("Expenses")}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.colors.textSecondary }}>No expenses were recorded in this period.</Text>
              )}
            </Card>
          </>
        )}
      </View>

      <DateRangePickerModal
        visible={pickerVisible}
        title="Custom finance range"
        startDate={customRange?.from ?? currentRange?.from ?? null}
        endDate={customRange?.to ?? currentRange?.to ?? null}
        onClose={() => setPickerVisible(false)}
        onApply={(range) => applyCustomRange(range)}
      />

      <SimpleModal visible={bankVisible} title="Add bank account" onClose={() => setBankVisible(false)}>
        <FinanceFormShell>
          <BankAccountForm
            onCancel={() => setBankVisible(false)}
            onSubmit={async (values) => {
              setSavingBank(true);
              try {
                await createBankAccount({
                  ...values,
                  businessId: business?.id ?? "",
                  externalId: createId(),
                  accountNumber: values.accountNumber ?? null,
                  notes: values.notes ?? null
                });
                setBankVisible(false);
                if (currentRange) {
                  const range = toApiRange(currentRange);
                  await loadFinance(range.from, range.to, "refresh");
                }
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Unable to save bank account");
              } finally {
                setSavingBank(false);
              }
            }}
            loading={savingBank}
            currency={business?.currency ?? "KES"}
          />
        </FinanceFormShell>
      </SimpleModal>

      <SimpleModal visible={pettyVisible} title="Add petty cash entry" onClose={() => setPettyVisible(false)}>
        <FinanceFormShell>
          <PettyCashForm
            onCancel={() => setPettyVisible(false)}
            onSubmit={async (values) => {
              setSavingPetty(true);
              try {
                await createPettyCashEntry({
                  ...values,
                  businessId: business?.id ?? "",
                  externalId: createId(),
                  category: values.category ?? null,
                  note: values.note ?? null,
                  recordedById: values.recordedById ?? user?.id ?? null
                });
                setPettyVisible(false);
                if (currentRange) {
                  const range = toApiRange(currentRange);
                  await loadFinance(range.from, range.to, "refresh");
                }
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Unable to save petty cash entry");
              } finally {
                setSavingPetty(false);
              }
            }}
            loading={savingPetty}
            currency={business?.currency ?? "KES"}
          />
        </FinanceFormShell>
      </SimpleModal>

      <SimpleModal visible={creditVisible} title="Create credit note" onClose={() => setCreditVisible(false)}>
        <FinanceFormShell>
          <CreditNoteForm
            onCancel={() => setCreditVisible(false)}
            onSubmit={async (values) => {
              setSavingCredit(true);
              try {
                await createFinanceCreditNote({
                  ...values,
                  businessId: business?.id ?? "",
                  externalId: createId(),
                  relatedSaleId: values.relatedSaleId ?? null,
                  customerId: values.customerId ?? null,
                  note: values.note ?? null
                });
                setCreditVisible(false);
                if (currentRange) {
                  const range = toApiRange(currentRange);
                  await loadFinance(range.from, range.to, "refresh");
                }
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Unable to save credit note");
              } finally {
                setSavingCredit(false);
              }
            }}
            loading={savingCredit}
            currency={business?.currency ?? "KES"}
          />
        </FinanceFormShell>
      </SimpleModal>
    </Screen>
  );
}

function BankAccountForm({
  onSubmit,
  onCancel,
  loading,
  currency
}: {
  onSubmit: (values: BankAccountFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  currency: string;
}) {
  const { control, handleSubmit } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountCreateSchema),
    defaultValues: {
      businessId: "",
      bankName: "",
      accountName: "",
      accountNumber: "",
      currency,
      openingBalance: 0,
      currentBalance: 0,
      isPrimary: false,
      notes: ""
    }
  });
  return (
    <View style={{ gap: 12 }}>
      <Controller control={control} name="bankName" render={({ field: { value, onChange } }) => <InputField label="Bank name" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="accountName" render={({ field: { value, onChange } }) => <InputField label="Account name" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="accountNumber" render={({ field: { value, onChange } }) => <InputField label="Account number" value={value ?? ""} onChangeText={onChange} />} />
      <Controller control={control} name="currency" render={({ field: { value, onChange } }) => <InputField label="Currency" value={value} onChangeText={onChange} helperText="Use a 3-letter currency code." />} />
      <Controller control={control} name="openingBalance" render={({ field: { value, onChange } }) => <InputField label="Opening balance" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
      <Controller control={control} name="currentBalance" render={({ field: { value, onChange } }) => <InputField label="Current balance" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
      <Controller control={control} name="notes" render={({ field: { value, onChange } }) => <InputField label="Notes" value={value ?? ""} onChangeText={onChange} multiline numberOfLines={3} />} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={loading ? "Saving..." : "Save account"} onPress={handleSubmit(async (values) => onSubmit(values))} loading={loading} />
        </View>
      </View>
    </View>
  );
}

function PettyCashForm({
  onSubmit,
  onCancel,
  loading,
  currency
}: {
  onSubmit: (values: PettyCashFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  currency: string;
}) {
  const { control, handleSubmit } = useForm<PettyCashFormValues>({
    resolver: zodResolver(pettyCashEntryCreateSchema),
    defaultValues: {
      businessId: "",
      label: "",
      amount: 0,
      direction: "out",
      category: "",
      note: "",
      recordedById: "",
      entryDate: new Date().toISOString().slice(0, 10)
    }
  });
  return (
    <View style={{ gap: 12 }}>
      <Controller control={control} name="label" render={({ field: { value, onChange } }) => <InputField label="Label" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="amount" render={({ field: { value, onChange } }) => <InputField label="Amount" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" helperText={`In ${currency}`} />} />
      <Controller
        control={control}
        name="direction"
        render={({ field: { value, onChange } }) => (
          <View style={{ gap: 8 }}>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>Direction</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["in", "out"] as const).map((direction) => (
                <Pressable key={direction} onPress={() => onChange(direction)}>
                  <Badge label={direction === "in" ? "Cash in" : "Cash out"} tone={value === direction ? "success" : "primary"} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
      <Controller control={control} name="category" render={({ field: { value, onChange } }) => <InputField label="Category" value={value ?? ""} onChangeText={onChange} />} />
      <Controller control={control} name="entryDate" render={({ field: { value, onChange } }) => <InputField label="Entry date" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="note" render={({ field: { value, onChange } }) => <InputField label="Note" value={value ?? ""} onChangeText={onChange} multiline numberOfLines={3} />} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={loading ? "Saving..." : "Save entry"} onPress={handleSubmit(async (values) => onSubmit(values))} loading={loading} />
        </View>
      </View>
    </View>
  );
}

function CreditNoteForm({
  onSubmit,
  onCancel,
  loading,
  currency
}: {
  onSubmit: (values: CreditNoteFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  currency: string;
}) {
  const { control, handleSubmit } = useForm<CreditNoteFormValues>({
    resolver: zodResolver(creditNoteCreateSchema),
    defaultValues: {
      businessId: "",
      reference: `CN-${Date.now().toString().slice(-6)}`,
      amount: 0,
      reason: "",
      relatedSaleId: "",
      customerId: "",
      note: "",
      creditDate: new Date().toISOString().slice(0, 10),
      status: "draft"
    }
  });
  return (
    <View style={{ gap: 12 }}>
      <Controller control={control} name="reference" render={({ field: { value, onChange } }) => <InputField label="Reference" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="amount" render={({ field: { value, onChange } }) => <InputField label="Amount" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" helperText={`In ${currency}`} />} />
      <Controller control={control} name="reason" render={({ field: { value, onChange } }) => <InputField label="Reason" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="relatedSaleId" render={({ field: { value, onChange } }) => <InputField label="Related sale" value={value ?? ""} onChangeText={onChange} helperText="Optional sale reference." />} />
      <Controller control={control} name="customerId" render={({ field: { value, onChange } }) => <InputField label="Customer" value={value ?? ""} onChangeText={onChange} helperText="Optional customer reference." />} />
      <Controller control={control} name="creditDate" render={({ field: { value, onChange } }) => <InputField label="Credit date" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="note" render={({ field: { value, onChange } }) => <InputField label="Note" value={value ?? ""} onChangeText={onChange} multiline numberOfLines={3} />} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={loading ? "Saving..." : "Save credit note"} onPress={handleSubmit(async (values) => onSubmit(values))} loading={loading} />
        </View>
      </View>
    </View>
  );
}

function FinanceFormShell({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 12 }}>{children}</View>;
}

function FinanceRow({
  title,
  subtitle,
  amount,
  currency,
  tone,
  badge,
  actionLabel,
  onAction
}: {
  title: string;
  subtitle?: string | null;
  amount: number;
  currency: string;
  tone: "primary" | "success" | "warning" | "danger";
  badge?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surfaceAlt,
        gap: 8
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{subtitle}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {badge ? <Badge label={badge} tone={tone} /> : null}
          <Text style={{ color: amount < 0 ? tokens.colors.danger : tokens.colors.primaryStrong, fontWeight: "900" }}>{formatMoney(amount, currency)}</Text>
        </View>
      </View>
      {onAction && actionLabel ? <PrimaryButton title={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </View>
  );
}

function presetRange(filter: Exclude<Filter, "custom">): RangeState {
  const today = new Date();
  if (filter === "today") {
    return { from: format(startOfDay(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  if (filter === "month") {
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  }
  if (filter === "year") {
    return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  }
  const start = addDays(today, -6);
  return { from: format(startOfDay(start), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
}

function toApiRange(range: RangeState) {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T23:59:59.999`);
  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function formatRangeLabel(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (fromDate === toDate) {
    return format(from, "MMM d, yyyy");
  }
  return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`;
}

function formatPaymentLabel(value: string) {
  if (value === "mpesa") return "M-Pesa";
  if (value === "cash") return "Cash";
  if (value === "bank") return "Bank";
  if (value === "credit") return "Credit";
  return value.replaceAll("_", " ");
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  if (status === "pending_confirmation") return "pending";
  if (status === "credit") return "credit";
  return status.replaceAll("_", " ");
}

function buildExportHtml(input: {
  title: string;
  subtitle: string;
  overview: FinanceOverview;
  invoices: FinanceInvoice[];
  creditNotes: CreditNote[];
  payments: FinancePayment[];
  bankAccounts: BankAccount[];
  pettyCash: PettyCashEntry[];
  expenses: Expense[];
  currency: string;
}) {
  const row = (label: string, value: string) => `<tr><td>${escapeHtml(label)}</td><td style="text-align:right">${escapeHtml(value)}</td></tr>`;
  const tableRows = [
    row("Income", formatMoney(input.overview.incomeTotal, input.currency)),
    row("Expenses", formatMoney(input.overview.expensesTotal, input.currency)),
    row("Profit & Loss", formatMoney(input.overview.profitLossTotal, input.currency)),
    row("Cash Flow", formatMoney(input.overview.cashFlowTotal, input.currency)),
    row("Tax Reports", formatMoney(input.overview.taxTotal, input.currency)),
    row("Invoice total", formatMoney(input.overview.invoiceTotal, input.currency)),
    row("Credit notes", formatMoney(input.overview.creditNoteTotal, input.currency)),
    row("Payments", formatMoney(input.overview.paymentTotal, input.currency)),
    row("Bank accounts", formatMoney(input.overview.bankBalanceTotal, input.currency)),
    row("Petty cash", formatMoney(input.overview.pettyCashBalance, input.currency))
  ].join("");

  const invoiceRows = input.invoices
    .map((invoice) => `<tr><td>${escapeHtml(invoice.receiptNumber)}</td><td>${escapeHtml(invoice.customerId ?? "Walk-in")}</td><td>${escapeHtml(formatMoney(invoice.balanceDue, input.currency))}</td></tr>`)
    .join("");
  const paymentRows = input.payments
    .map((payment) => `<tr><td>${escapeHtml(formatPaymentLabel(payment.method))}</td><td>${escapeHtml(payment.status)}</td><td>${escapeHtml(formatMoney(payment.amount, input.currency))}</td></tr>`)
    .join("");
  const bankRows = input.bankAccounts
    .map((account) => `<tr><td>${escapeHtml(account.accountName)}</td><td>${escapeHtml(account.bankName)}</td><td>${escapeHtml(formatMoney(account.currentBalance, account.currency ?? input.currency))}</td></tr>`)
    .join("");
  const pettyRows = input.pettyCash
    .map((entry) => `<tr><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(entry.direction)}</td><td>${escapeHtml(formatMoney(entry.direction === "in" ? entry.amount : -entry.amount, input.currency))}</td></tr>`)
    .join("");
  const creditRows = input.creditNotes
    .map((note) => `<tr><td>${escapeHtml(note.reference)}</td><td>${escapeHtml(note.reason)}</td><td>${escapeHtml(formatMoney(note.amount, input.currency))}</td></tr>`)
    .join("");
  const expenseRows = input.expenses
    .map((expense) => `<tr><td>${escapeHtml(expense.note)}</td><td>${escapeHtml(expense.expenseDate)}</td><td>${escapeHtml(formatMoney(expense.amount, input.currency))}</td></tr>`)
    .join("");

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
      h1 { margin: 0 0 6px; }
      h2 { margin: 24px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      td, th { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; }
      th { text-align: left; background: #f3f4f6; }
      .muted { color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(input.title)}</h1>
    <div class="muted">${escapeHtml(input.subtitle)}</div>
    <h2>Summary</h2>
    <table>${tableRows}</table>
    <h2>Invoices</h2>
    <table><tr><th>Receipt</th><th>Customer</th><th>Balance due</th></tr>${invoiceRows || "<tr><td colspan='3'>No invoices</td></tr>"}</table>
    <h2>Credit notes</h2>
    <table><tr><th>Reference</th><th>Reason</th><th>Amount</th></tr>${creditRows || "<tr><td colspan='3'>No credit notes</td></tr>"}</table>
    <h2>Payments</h2>
    <table><tr><th>Method</th><th>Status</th><th>Amount</th></tr>${paymentRows || "<tr><td colspan='3'>No payments</td></tr>"}</table>
    <h2>Bank accounts</h2>
    <table><tr><th>Account</th><th>Bank</th><th>Balance</th></tr>${bankRows || "<tr><td colspan='3'>No bank accounts</td></tr>"}</table>
    <h2>Petty cash</h2>
    <table><tr><th>Label</th><th>Direction</th><th>Amount</th></tr>${pettyRows || "<tr><td colspan='3'>No petty cash entries</td></tr>"}</table>
    <h2>Expenses</h2>
    <table><tr><th>Note</th><th>Date</th><th>Amount</th></tr>${expenseRows || "<tr><td colspan='3'>No expenses</td></tr>"}</table>
  </body>
  </html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
