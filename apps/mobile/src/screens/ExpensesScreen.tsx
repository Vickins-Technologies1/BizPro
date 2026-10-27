import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseCreateSchema, hasPermission } from "@shared";
import type { Category } from "@shared";
import { addDays, endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import { z } from "zod";
import { Ionicons } from "@expo/vector-icons";
import { AppScrollView, DateRangePickerModal, Dropdown, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Tag } from "@/components/Primitives";
import { SearchField } from "@/components/DesignSystem";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";

type FormValues = z.infer<typeof expenseCreateSchema>;
type Filter = "all" | "today" | "week" | "month" | "year" | "custom";
type RangeState = { from: string; to: string };

export function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const expenses = useAppStore((state) => state.expenses);
  const categories = useAppStore((state) => state.categories);
  const addExpense = useAppStore((state) => state.addExpense);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const user = useAppStore((state) => state.user);
  const [visible, setVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [customRange, setCustomRange] = useState<RangeState | null>(null);
  const [search, setSearch] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canManageExpenses = hasPermission(user, "manageExpenses");

  const currentRange = useMemo(() => filter === "custom" ? customRange : filter === "all" ? null : presetRange(filter), [filter, customRange]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const categoryOptions = useMemo(() => [
    { label: "Uncategorized", value: "" },
    ...categories.map((category: Category) => ({ label: category.name, value: category.id }))
  ], [categories]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(expenseCreateSchema),
    defaultValues: {
      businessId: business?.id ?? "",
      categoryId: null,
      amount: 0,
      note: "",
      expenseDate: format(new Date(), "yyyy-MM-dd"),
      recordedById: ""
    }
  });

  const filtered = useMemo(() => expenses.filter((expense) => {
    const expenseDay = expense.expenseDate.slice(0, 10);
    if (currentRange && (expenseDay < currentRange.from || expenseDay > currentRange.to)) return false;
    const categoryName = expense.categoryId ? categoryById.get(expense.categoryId)?.name ?? "" : "";
    const query = search.trim().toLowerCase();
    return !query || `${expense.note} ${categoryName} ${expenseDay} ${formatExpenseDate(expense.expenseDate)}`.toLowerCase().includes(query);
  }), [categoryById, currentRange, expenses, search]);
  const filteredTotal = useMemo(() => filtered.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0), [filtered]);
  const rangeLabel = currentRange ? formatRangeLabel(currentRange.from, currentRange.to) : "All dates";

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  async function refreshExpenses() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadCatalog();
    } finally {
      setRefreshing(false);
    }
  }

  function openExpenseForm() {
    reset({ businessId: business?.id ?? "", categoryId: null, amount: 0, note: "", expenseDate: format(new Date(), "yyyy-MM-dd"), recordedById: "" });
    setVisible(true);
  }

  function applyCustomRange(range: { startDate: string; endDate: string }) {
    setCustomRange({ from: range.startDate, to: range.endDate });
    setFilter("custom");
  }

  async function saveExpense(values: FormValues) {
    if (savingExpense) return;
    setSavingExpense(true);
    try {
      await addExpense({
        businessId: business?.id ?? "",
        categoryId: values.categoryId ?? null,
        amount: values.amount,
        note: values.note,
        expenseDate: values.expenseDate,
        recordedById: values.recordedById ?? null
      });
      reset({ businessId: business?.id ?? "", categoryId: null, amount: 0, note: "", expenseDate: format(new Date(), "yyyy-MM-dd"), recordedById: "" });
      setVisible(false);
      Alert.alert("Expense saved", "Expense recorded successfully.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save expense");
    } finally {
      setSavingExpense(false);
    }
  }

  if (!canManageExpenses) {
    return (
      <Screen>
        <GradientHeader title="Expenses" subtitle="Spending visibility" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Expenses access restricted"
            subtitle="This account cannot record expenses. Ask an owner or manager to grant expense access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Expenses"
        subtitle="Spending visibility"
        right={
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
            </Pressable>
            <Pressable onPress={openExpenseForm} accessibilityRole="button" accessibilityLabel="Add expense">
              <Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} />
            </Pressable>
          </View>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={refreshExpenses} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 }}>
        <View style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: tokens.colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" }}>Expense register</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{rangeLabel} · {filtered.length} records</Text>
            </View>
            <Pressable onPress={() => setPickerVisible(true)} accessibilityRole="button" accessibilityLabel="Choose custom expense dates" style={{ minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}>
              <Ionicons name="calendar-outline" size={15} color={tokens.colors.icon} />
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "700" }}>Custom</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }} accessibilityLabel="Filter expenses by date">
            {([ ["all", "All dates"], ["today", "Today"], ["week", "7 days"], ["month", "This month"], ["year", "Year to date"] ] as Array<[Filter, string]>).map(([value, label]) => (
              <Tag key={value} label={label} selected={filter === value} onPress={() => setFilter(value)} />
            ))}
            {filter === "custom" ? <Tag label="Custom range" selected onPress={() => setPickerVisible(true)} /> : null}
          </ScrollView>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search description, category, or date" accessibilityLabel="Search expenses" />
        </View>

        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingVertical: 2 }}>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{filtered.length} expenses in view</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{formatMoney(filteredTotal, business?.currency ?? "KES")}</Text>
        </View>

        {filtered.length ? (
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
            {filtered.map((expense) => {
              const category = expense.categoryId ? categoryById.get(expense.categoryId) : undefined;
              return (
                <View key={expense.id} style={{ minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.colors.border }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{expense.note}</Text>
                    <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }} numberOfLines={1}>{[formatExpenseDate(expense.expenseDate), category?.name].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{formatMoney(expense.amount, business?.currency ?? "KES")}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title={search || filter !== "all" ? "No matching expenses" : "No expenses yet"}
            subtitle={search || filter !== "all" ? "Try another description or date range, or clear the search." : "Record an expense to keep spending visible."}
            action={search || filter !== "all" ? <PrimaryButton title="Clear filters" variant="secondary" onPress={() => { setSearch(""); setFilter("all"); }} /> : <PrimaryButton title="Add expense" onPress={openExpenseForm} />}
            icon="cash-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={visible} title="Add expense" onClose={() => setVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller control={control} name="amount" render={({ field: { value, onChange } }) => (
            <InputField label="Amount" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" error={errors.amount?.message} helperText={`Enter the amount in ${business?.currency ?? "KES"}.`} />
          )} />
          <Controller control={control} name="note" render={({ field: { value, onChange } }) => (
            <InputField label="Description" value={value} onChangeText={onChange} error={errors.note?.message} helperText="Describe what the expense was for." />
          )} />
          <Controller control={control} name="categoryId" render={({ field: { value, onChange } }) => (
            <Dropdown label="Category" value={value ?? ""} options={categoryOptions} placeholder="Select a category" onChange={(next) => onChange(next || null)} helperText="Optional. Uses the business categories already configured." />
          )} />
          <Controller control={control} name="expenseDate" render={({ field: { value, onChange } }) => (
            <InputField label="Expense date" value={value} onChangeText={onChange} error={errors.expenseDate?.message} helperText="Use the date the money was spent." />
          )} />
          <PrimaryButton title={savingExpense ? "Saving…" : "Save expense"} onPress={handleSubmit(saveExpense)} loading={savingExpense} />
        </AppScrollView>
      </SimpleModal>

      <DateRangePickerModal
        visible={pickerVisible}
        title="Custom expense range"
        startDate={customRange?.from ?? currentRange?.from ?? null}
        endDate={customRange?.to ?? currentRange?.to ?? null}
        onClose={() => setPickerVisible(false)}
        onApply={applyCustomRange}
      />
    </Screen>
  );
}

function presetRange(filter: Exclude<Filter, "all" | "custom">): RangeState {
  const today = new Date();
  if (filter === "today") return { from: format(startOfDay(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  if (filter === "month") return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  if (filter === "year") return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
  return { from: format(startOfDay(addDays(today, -6)), "yyyy-MM-dd"), to: format(endOfDay(today), "yyyy-MM-dd") };
}

function formatRangeLabel(from: string, to: string) {
  if (from === to) return format(new Date(`${from}T00:00:00`), "MMM d, yyyy");
  return `${format(new Date(`${from}T00:00:00`), "MMM d")} – ${format(new Date(`${to}T00:00:00`), "MMM d, yyyy")}`;
}

function formatExpenseDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
