import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseCreateSchema } from "@shared";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useNavigation } from "@react-navigation/native";
import { hasPermission } from "@shared";
import { SearchField } from "@/components/DesignSystem";
import { formatMoney } from "@/utils/money";

type FormValues = z.infer<typeof expenseCreateSchema>;

export function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const expenses = useAppStore((state) => state.expenses);
  const addExpense = useAppStore((state) => state.addExpense);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const user = useAppStore((state) => state.user);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canManageExpenses = hasPermission(user, "manageExpenses");

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
      expenseDate: new Date().toISOString().slice(0, 10),
      recordedById: ""
    }
  });

  const filtered = useMemo(() => expenses.filter((expense) => expense.note.toLowerCase().includes(search.toLowerCase())), [expenses, search]);

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

  if (!canManageExpenses) {
    return (
      <Screen>
        <GradientHeader title="Expenses" subtitle="Leakage control and spending visibility" />
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
        subtitle="Leakage control and spending visibility"
        right={
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
            </Pressable>
            <Pressable onPress={() => setVisible(true)}>
              <Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} />
            </Pressable>
          </View>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={refreshExpenses} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        <View style={{ gap: 9, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>Expense register</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{filtered.length} of {expenses.length} records</Text>
            </View>
          </View>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search expense descriptions" accessibilityLabel="Search expenses" />
        </View>
        {filtered.length ? (
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
            {filtered.map((expense) => (
              <View key={expense.id} style={{ minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.colors.border }}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{expense.note}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }}>{formatExpenseDate(expense.expenseDate)}</Text>
                </View>
                <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "700" }} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(expense.amount, business?.currency ?? "KES")}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title={search ? "No matching expenses" : "No expenses yet"}
            subtitle={search ? "Try a different note or clear the search to see all expenses." : "Record your first expense to keep spending visible."}
            action={<PrimaryButton title="Add expense" onPress={() => setVisible(true)} />}
          />
        )}
      </AppScrollView>
      <SimpleModal visible={visible} title="Add expense" onClose={() => setVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 9 }}>
          <Controller
            control={control}
            name="amount"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Amount"
                value={String(value)}
                onChangeText={(text) => onChange(Number(text || 0))}
                keyboardType="decimal-pad"
                error={errors.amount?.message}
                helperText="Enter the full expense amount."
              />
            )}
          />
          <Controller
            control={control}
            name="note"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Note"
                value={value}
                onChangeText={onChange}
                error={errors.note?.message}
                helperText="Describe what the expense was for."
              />
            )}
          />
          <Controller
            control={control}
            name="expenseDate"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Expense date"
                value={value}
                onChangeText={onChange}
                error={errors.expenseDate?.message}
                helperText="Use the date the money was spent."
              />
            )}
          />
          <PrimaryButton
            title={savingExpense ? "Saving…" : "Save expense"}
            onPress={handleSubmit(async (values) => {
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
                reset({ businessId: business?.id ?? "", categoryId: null, amount: 0, note: "", expenseDate: new Date().toISOString().slice(0, 10), recordedById: "" });
                setVisible(false);
                Alert.alert("Expense saved", "Expense recorded successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save expense");
              } finally {
                setSavingExpense(false);
              }
            })}
            loading={savingExpense}
          />
        </AppScrollView>
      </SimpleModal>
    </Screen>
  );
}

function formatExpenseDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
