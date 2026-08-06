import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";
import { listCustomerPayments } from "@/services/apiClient";
import type { Payment } from "@shared";

const customerSchema = z.object({
  name: z.string().min(2, "Enter a customer name."),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  notes: z.string().optional()
});

type FormValues = z.infer<typeof customerSchema>;

export function CustomersScreen() {
  const customers = useAppStore((state) => state.customers);
  const sales = useAppStore((state) => state.sales);
  const business = useAppStore((state) => state.business);
  const addCustomer = useAppStore((state) => state.addCustomer);
  const recordDebtPayment = useAppStore((state) => state.recordDebtPayment);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState("0");
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<"cash" | "mpesa" | "bank" | "credit">("cash");
  const [debtPaymentReference, setDebtPaymentReference] = useState("");
  const [debtPaymentNote, setDebtPaymentNote] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const owingCount = useMemo(() => customers.filter((customer) => customer.balance > 0).length, [customers]);
  const totalDebt = useMemo(() => customers.reduce((sum, customer) => sum + Math.max(0, customer.balance), 0), [customers]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "", email: "", notes: "" }
  });

  const filtered = useMemo(() => customers.filter((customer) => customer.name.toLowerCase().includes(search.toLowerCase()) || (customer.phone ?? "").includes(search)), [customers, search]);

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedPayments([]);
      setPaymentsLoading(false);
      return;
    }
    setPaymentsLoading(true);
    setDebtPaymentAmount("0");
    setDebtPaymentReference("");
    setDebtPaymentNote("");
    setDebtPaymentMethod("cash");
    listCustomerPayments(selectedCustomerId)
      .then((rows) => setSelectedPayments(rows))
      .catch(() => setSelectedPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, [selectedCustomerId]);

  return (
    <Screen>
      <GradientHeader
        title="Customers"
        subtitle="Balances, payments, and customer history"
        right={
          <Pressable onPress={() => setVisible(true)}>
            <Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Customer overview</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Keep balances simple</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Customers with unpaid balances appear here first. Open a customer to review sales and record a payment.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label={`${customers.length} customers`} tone="primary" />
            <Badge label={`${owingCount} owing`} tone="warning" />
            <Badge label={formatMoney(totalDebt, business?.currency ?? "KES")} tone="success" />
          </View>
          <PrimaryButton title="Add customer" onPress={() => setVisible(true)} />
        </Card>
        <Card style={{ gap: 8 }}>
          <InputField
            label="Search customers"
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or phone"
            helperText="Find the customer by name or phone number."
          />
        </Card>
        {filtered.length ? (
          filtered.map((customer) => (
            <Pressable key={customer.id} onPress={() => setSelectedCustomerId(customer.id)}>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{customer.name}</Text>
                  <Badge label={customer.balance > 0 ? "Owing" : "Clear"} tone={customer.balance > 0 ? "danger" : "success"} />
                </View>
                <Text style={{ color: tokens.colors.textSecondary }}>{customer.phone ?? "No phone"}</Text>
                <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>
                  Balance: {formatMoney(customer.balance, business?.currency ?? "KES")}
                </Text>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState
            title={search ? "No matching customers" : "No customers yet"}
            subtitle={search ? "Try a different name or phone number, or clear the search." : "Add a customer to keep balances and sales history organized."}
            action={<PrimaryButton title="Add customer" onPress={() => setVisible(true)} />}
            icon="people-outline"
          />
        )}
      </ScrollView>
      <SimpleModal visible={visible} title="Add customer" onClose={() => setVisible(false)}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <InputField label="Customer name" value={value} onChangeText={onChange} error={errors.name?.message} helperText="Use the name you want to show on statements." />
            )}
          />
          <Controller control={control} name="phone" render={({ field: { value, onChange } }) => <InputField label="Phone" value={value ?? ""} onChangeText={onChange} helperText="Optional, but helpful for follow-up." />} />
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange } }) => (
              <InputField label="Email" value={(value as string) ?? ""} onChangeText={onChange} error={errors.email?.message} helperText="Optional email for invoices or updates." />
            )}
          />
          <Controller control={control} name="notes" render={({ field: { value, onChange } }) => <InputField label="Notes" value={value ?? ""} onChangeText={onChange} helperText="Anything useful for your team to remember." />} />
          <PrimaryButton
            title="Save customer"
            onPress={handleSubmit(async (values) => {
              setSavingCustomer(true);
              try {
                await addCustomer({
                  businessId: business?.id ?? "",
                  name: values.name,
                  phone: values.phone ?? null,
                  email: values.email ? values.email : null,
                  notes: values.notes ?? null,
                  balance: 0
                });
                reset({ name: "", phone: "", email: "", notes: "" });
                setVisible(false);
                Alert.alert("Customer created", "Customer created successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save customer");
              } finally {
                setSavingCustomer(false);
              }
            })}
            loading={savingCustomer}
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
                <Card style={{ gap: 10 }}>
                  <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Statement</Text>
                  <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{customer.name}</Text>
                  <Text style={{ color: tokens.colors.textSecondary }}>{customer.phone ?? "No phone"}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={customer.balance > 0 ? "Balance due" : "Fully paid"} tone={customer.balance > 0 ? "warning" : "success"} />
                    <Badge label={formatMoney(customer.balance, business?.currency ?? "KES")} tone="primary" />
                  </View>
                  <Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>Balance: {formatMoney(customer.balance, business?.currency ?? "KES")}</Text>
                </Card>
                <Card style={{ gap: 10 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Record payment</Text>
                  <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                    Capture the amount received and a short reference so the balance stays easy to track.
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
                  <InputField
                    label="Note"
                    value={debtPaymentNote}
                    onChangeText={setDebtPaymentNote}
                    placeholder="Optional note"
                    helperText="Use this for any extra context."
                  />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {(["cash", "mpesa", "bank", "credit"] as const).map((method) => (
                      <Pressable key={method} onPress={() => setDebtPaymentMethod(method)}>
                        <Badge label={formatPaymentMethodLabel(method)} tone={debtPaymentMethod === method ? "success" : "primary"} />
                      </Pressable>
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
                          customerId: customer.id,
                          amount,
                          method: debtPaymentMethod,
                          reference: debtPaymentReference.trim() || null,
                          note: debtPaymentNote.trim() || null
                        });
                        const refreshedPayments = await listCustomerPayments(customer.id);
                        setSelectedPayments(refreshedPayments);
                        setDebtPaymentAmount("0");
                        setDebtPaymentReference("");
                        setDebtPaymentNote("");
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
                  <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Recent sales</Text>
                  {customerSales.length ? (
                    customerSales.map((sale) => (
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
            );
          })()}
        </ScrollView>
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
