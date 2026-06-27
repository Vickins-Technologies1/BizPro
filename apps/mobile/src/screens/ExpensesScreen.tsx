import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseCreateSchema } from "@shared";
import { Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useNavigation } from "@react-navigation/native";

type FormValues = z.infer<typeof expenseCreateSchema>;

export function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const expenses = useAppStore((state) => state.expenses);
  const addExpense = useAppStore((state) => state.addExpense);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const { control, handleSubmit, reset } = useForm<FormValues>({
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <InputField label="Search expenses" value={search} onChangeText={setSearch} placeholder="Filter notes" />
        </Card>
        {filtered.map((expense) => (
          <Card key={expense.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{expense.note}</Text>
              <Badge label="expense" tone="warning" />
            </View>
            <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>{expense.amount.toLocaleString("en-KE", { style: "currency", currency: business?.currency ?? "KES" })}</Text>
            <Text style={{ color: tokens.colors.textSecondary }}>{expense.expenseDate}</Text>
          </Card>
        ))}
      </ScrollView>
      <SimpleModal visible={visible} title="Add expense" onClose={() => setVisible(false)}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller control={control} name="amount" render={({ field: { value, onChange } }) => <InputField label="Amount" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
          <Controller control={control} name="note" render={({ field: { value, onChange } }) => <InputField label="Note" value={value} onChangeText={onChange} />} />
          <Controller control={control} name="expenseDate" render={({ field: { value, onChange } }) => <InputField label="Expense date" value={value} onChangeText={onChange} />} />
          <PrimaryButton
            title="Save expense"
            onPress={handleSubmit(async (values) => {
              try {
                await addExpense({
                  businessId: business?.id ?? "",
                  categoryId: values.categoryId ?? null,
                  amount: values.amount,
                  note: values.note,
                  expenseDate: values.expenseDate,
                  recordedById: values.recordedById ?? null
                });
                await loadCatalog();
                reset({ businessId: business?.id ?? "", categoryId: null, amount: 0, note: "", expenseDate: new Date().toISOString().slice(0, 10), recordedById: "" });
                setVisible(false);
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save expense");
              }
            })}
          />
        </ScrollView>
      </SimpleModal>
    </Screen>
  );
}
