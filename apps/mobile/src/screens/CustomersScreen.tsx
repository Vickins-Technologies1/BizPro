import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { allSql } from "@/storage/sqlite";
import type { Payment } from "@vbo/shared";

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional()
});

type FormValues = z.infer<typeof customerSchema>;

export function CustomersScreen() {
  const customers = useAppStore((state) => state.customers);
  const sales = useAppStore((state) => state.sales);
  const business = useAppStore((state) => state.business);
  const addCustomer = useAppStore((state) => state.addCustomer);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const recordDebtPayment = useAppStore((state) => state.recordDebtPayment);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([]);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("0");
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<"cash" | "mpesa" | "bank" | "credit">("cash");
  const [debtPaymentReference, setDebtPaymentReference] = useState("");
  const [debtPaymentNote, setDebtPaymentNote] = useState("");

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "", email: "", notes: "" }
  });

  const filtered = useMemo(() => customers.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase()) || (customer.phone ?? "").includes(search)), [customers, search]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedPayments([]);
      return;
    }
    setDebtPaymentAmount("0");
    setDebtPaymentReference("");
    setDebtPaymentNote("");
    setDebtPaymentMethod("cash");
    allSql<Payment>("SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC LIMIT 20", [selectedCustomerId])
      .then((rows) => setSelectedPayments(rows))
      .catch(() => setSelectedPayments([]));
  }, [selectedCustomerId]);

  return (
    <Screen>
      <GradientHeader title="Customers" subtitle="Debt profiles and customer accountability" right={<Pressable onPress={() => setVisible(true)}><Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} /></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <InputField label="Search customers" value={search} onChangeText={setSearch} placeholder="Search name or phone" />
        </Card>
        {filtered.map((customer) => (
          <Pressable key={customer.id} onPress={() => setSelectedCustomerId(customer.id)}>
            <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{customer.name}</Text>
              <Badge label={customer.balance > 0 ? "owing" : "clear"} tone={customer.balance > 0 ? "danger" : "success"} />
            </View>
            <Text style={{ color: tokens.colors.textSecondary }}>{customer.phone ?? "No phone"}</Text>
            <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>Balance: {customer.balance.toLocaleString("en-KE", { style: "currency", currency: business?.currency ?? "KES" })}</Text>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
      <SimpleModal visible={visible} title="Add customer" onClose={() => setVisible(false)}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller control={control} name="name" render={({ field: { value, onChange } }) => <InputField label="Customer name" value={value} onChangeText={onChange} />} />
          <Controller control={control} name="phone" render={({ field: { value, onChange } }) => <InputField label="Phone" value={value ?? ""} onChangeText={onChange} />} />
          <Controller control={control} name="email" render={({ field: { value, onChange } }) => <InputField label="Email" value={(value as string) ?? ""} onChangeText={onChange} />} />
          <Controller control={control} name="notes" render={({ field: { value, onChange } }) => <InputField label="Notes" value={value ?? ""} onChangeText={onChange} />} />
          <PrimaryButton
            title="Save customer"
            onPress={handleSubmit(async (values) => {
              try {
                await addCustomer({
                  businessId: business?.id ?? "",
                  name: values.name,
                  phone: values.phone ?? null,
                  email: values.email ? values.email : null,
                  notes: values.notes ?? null,
                  balance: 0
                });
                await loadCatalog();
                reset({ name: "", phone: "", email: "", notes: "" });
                setVisible(false);
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save customer");
              }
            })}
          />
        </ScrollView>
      </SimpleModal>
      <SimpleModal visible={Boolean(selectedCustomerId)} title="Customer statement" onClose={() => setSelectedCustomerId(null)}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          {(() => {
            const customer = customers.find((item) => item.id === selectedCustomerId);
            const customerSales = sales.filter((sale) => sale.customerId === selectedCustomerId);
            if (!customer) {
              return <Text style={{ color: tokens.colors.textSecondary }}>Customer not found.</Text>;
            }
            return (
              <>
                <Card style={{ gap: 8 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{customer.name}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>{customer.phone ?? "No phone"}</Text>
                <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>Balance: {customer.balance.toLocaleString("en-KE", { style: "currency", currency: business?.currency ?? "KES" })}</Text>
                </Card>
                <Card style={{ gap: 10 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Record payment</Text>
                  <InputField label="Amount" value={debtPaymentAmount} onChangeText={setDebtPaymentAmount} keyboardType="decimal-pad" />
                  <InputField label="Reference" value={debtPaymentReference} onChangeText={setDebtPaymentReference} placeholder="Mpesa code / slip" />
                  <InputField label="Note" value={debtPaymentNote} onChangeText={setDebtPaymentNote} placeholder="Optional note" />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {(["cash", "mpesa", "bank", "credit"] as const).map((method) => (
                      <Pressable key={method} onPress={() => setDebtPaymentMethod(method)}>
                        <Badge label={method} tone={debtPaymentMethod === method ? "success" : "primary"} />
                      </Pressable>
                    ))}
                  </View>
                  <PrimaryButton
                    title="Save payment"
                    onPress={async () => {
                      try {
                        const amount = Number(debtPaymentAmount || 0);
                        if (amount <= 0) {
                          Alert.alert("Invalid amount", "Enter a payment amount greater than zero.");
                          return;
                        }
                        await recordDebtPayment({
                          customerId: customer.id,
                          amount,
                          method: debtPaymentMethod,
                          reference: debtPaymentReference.trim() || null,
                          note: debtPaymentNote.trim() || null
                        });
                        await loadCatalog();
                        const refreshedPayments = await allSql<Payment>("SELECT * FROM payments WHERE customerId = ? ORDER BY createdAt DESC LIMIT 20", [customer.id]);
                        setSelectedPayments(refreshedPayments);
                        setDebtPaymentAmount("0");
                        setDebtPaymentReference("");
                        setDebtPaymentNote("");
                      } catch (error) {
                        Alert.alert("Payment failed", error instanceof Error ? error.message : "Failed to record payment");
                      }
                    }}
                  />
                </Card>
                <Text style={{ color: tokens.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 }}>Recent sales</Text>
                {customerSales.length ? customerSales.map((sale) => (
                  <Card key={sale.id} style={{ gap: 6 }}>
                    <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{sale.receiptNumber}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>{sale.createdAt}</Text>
                    <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>{sale.grandTotal.toLocaleString("en-KE", { style: "currency", currency: business?.currency ?? "KES" })}</Text>
                  </Card>
                )) : <Text style={{ color: tokens.colors.textSecondary }}>No sales linked to this customer yet.</Text>}
                <Text style={{ color: tokens.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 }}>Recent payments</Text>
                {selectedPayments.length ? selectedPayments.map((payment) => (
                  <Card key={payment.id} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{payment.method}</Text>
                      <Badge label={payment.status} tone={payment.status === "paid" ? "success" : "warning"} />
                    </View>
                    <Text style={{ color: tokens.colors.textSecondary }}>{payment.note ?? payment.reference ?? "Debt repayment"}</Text>
                    <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>{payment.amount.toLocaleString("en-KE", { style: "currency", currency: business?.currency ?? "KES" })}</Text>
                  </Card>
                )) : <Text style={{ color: tokens.colors.textSecondary }}>No recorded repayments yet.</Text>}
              </>
            );
          })()}
        </ScrollView>
      </SimpleModal>
    </Screen>
  );
}
