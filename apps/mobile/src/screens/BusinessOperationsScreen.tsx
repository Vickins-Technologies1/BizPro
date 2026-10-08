import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getNextBusinessOperationStatus, resolveBusinessTypeConfig, type BusinessOperation, type BusinessOperationKind, type Customer } from "@shared";
import { AppScrollView, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { useAppStore } from "@/store/useAppStore";
import { createBusinessOperationSafe, listBusinessOperations, listCustomers, listEmployees, updateBusinessOperationSafe, type EmployeeRecord } from "@/services/apiClient";
import { cacheBusinessOperations, listCachedBusinessOperations, listQueuedBusinessOperations } from "@/services/offlineQueue";
import { createId } from "@/utils/id";
import { tokens } from "@/theme/tokens";

type DraftItem = { name: string; quantity: number; unitPrice: number };

export function BusinessOperationsScreen() {
  const business = useAppStore((state) => state.business);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const config = resolveBusinessTypeConfig({ businessType: business?.businessType, industryKey: business?.industryKey });
  const operationKind = operationKindForConfig(config);
  const [operations, setOperations] = React.useState<BusinessOperation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [secondaryValue, setSecondaryValue] = React.useState("");
  const [vehicleMake, setVehicleMake] = React.useState("");
  const [vehicleModel, setVehicleModel] = React.useState("");
  const [vehicleYear, setVehicleYear] = React.useState("");
  const [vehicleMileage, setVehicleMileage] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [staffId, setStaffId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<DraftItem[]>([]);
  const [itemName, setItemName] = React.useState("");
  const [itemPrice, setItemPrice] = React.useState("0");
  const [itemQuantity, setItemQuantity] = React.useState("1");
  const [kitchenOnly, setKitchenOnly] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function loadOperations(mode: "initial" | "refresh" = "initial") {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    const cachedOperations = business ? await listCachedBusinessOperations(business.id, selectedBranchId) : [];
    const queuedOperations = business ? await listQueuedBusinessOperations(business.id, selectedBranchId) : [];
    try {
      const remoteOperations = await listBusinessOperations({ kind: operationKind, branchId: selectedBranchId });
      const merged = new Map([...cachedOperations, ...remoteOperations].map((operation) => [operation.id, operation]));
      queuedOperations.filter((operation) => operation.kind === operationKind).forEach((operation) => merged.set(operation.id, operation));
      const nextOperations = [...merged.values()].sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
      setOperations(nextOperations.filter((operation) => operation.kind === operationKind));
      if (business) await cacheBusinessOperations(business.id, nextOperations);
    }
    catch (error) {
      const offlineOperations = [...cachedOperations, ...queuedOperations].filter((operation) => operation.kind === operationKind);
      setOperations([...new Map(offlineOperations.map((operation) => [operation.id, operation])).values()]);
      if (!offlineOperations.length) Alert.alert("Unable to load operations", error instanceof Error ? error.message : "Try again when connected.");
    }
    finally { setLoading(false); setRefreshing(false); }
  }

  React.useEffect(() => {
    void loadOperations();
    void Promise.all([listCustomers().then(setCustomers).catch(() => undefined), listEmployees().then(setEmployees).catch(() => undefined)]);
  }, [operationKind, selectedBranchId]);

  async function saveOperation() {
    if (!title.trim()) { Alert.alert("Add a title", "Enter a " + config.terminology.transaction.toLowerCase() + " title first."); return; }
    setSaving(true);
    try {
      const created = await createBusinessOperationSafe({
        externalId: createId(), businessId: business?.id ?? "", branchId: selectedBranchId, kind: operationKind,
        status: operationKind === "appointment" ? "confirmed" : "open", title: title.trim(), customerId, staffId,
        scheduledAt: scheduledAt.trim() ? new Date(scheduledAt.trim()).toISOString() : null,
        durationMinutes: operationKind === "appointment" ? 60 : null,
        tableName: operationKind === "order" || config.operatingModel === "hospitality" ? secondaryValue.trim() || null : null,
        vehiclePlate: operationKind === "work_order" ? secondaryValue.trim() || null : null,
        vehicleMake: operationKind === "work_order" ? vehicleMake.trim() || null : null,
        vehicleModel: operationKind === "work_order" ? vehicleModel.trim() || null : null,
        vehicleYear: operationKind === "work_order" && vehicleYear ? Number(vehicleYear) : null,
        vehicleMileage: operationKind === "work_order" && vehicleMileage ? Number(vehicleMileage) : null,
        notes: notes.trim() || null, items, total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      });
      setOperations((current) => [created, ...current]); setModalVisible(false); setTitle(""); setSecondaryValue(""); setVehicleMake(""); setVehicleModel(""); setVehicleYear(""); setVehicleMileage(""); setScheduledAt(""); setNotes(""); setCustomerId(null); setStaffId(null); setItems([]);
    } catch (error) { Alert.alert("Could not save", error instanceof Error ? error.message : "The operation was not saved."); }
    finally { setSaving(false); }
  }

  async function advance(operation: BusinessOperation) {
    if (operation.status === "completed") return;
    try {
      const patch = { status: getNextBusinessOperationStatus(operation.status) } as const;
      const updated = await updateBusinessOperationSafe(business?.id ?? "", operation.id, patch);
      setOperations((current) => {
        const next = current.map((item) => item.id === updated.id ? { ...item, ...updated } : item);
        if (business) void cacheBusinessOperations(business.id, next);
        return next;
      });
    } catch (error) { Alert.alert("Status update failed", error instanceof Error ? error.message : "Try again when connected."); }
  }

  const visibleOperations = operations.filter((operation) => operation.status !== "cancelled" && (!kitchenOnly || operation.status !== "completed"));
  return (
    <Screen>
      <GradientHeader title={config.workspace.activityLabel} subtitle={config.workflow.headline} right={<Pressable onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel={config.workspace.primaryAction}><Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} /></Pressable>} />
      <AppScrollView refreshing={refreshing} onRefresh={() => loadOperations("refresh")} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        <Card style={{ gap: 8, padding: 14 }}>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>{config.label} workflow</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "900", flex: 1 }}>{config.workflow.headline}</Text>
            <Badge label={`${visibleOperations.length} active`} tone="primary" />
          </View>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{config.workflow.steps.join("  >  ")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {config.capabilities.kitchen ? <Badge label="Kitchen queue" tone="warning" /> : null}
            {config.capabilities.tables ? <Badge label="Table service" tone="primary" /> : null}
            {config.capabilities.appointments ? <Badge label="Calendar flow" tone="success" /> : null}
            {config.capabilities.workOrders ? <Badge label="Job cards" tone="warning" /> : null}
            {config.capabilities.projects ? <Badge label="Projects" tone="primary" /> : null}
            {config.capabilities.timeTracking ? <Badge label="Time tracking" tone="success" /> : null}
          </View>
          {config.capabilities.kitchen ? <View style={{ flexDirection: "row", gap: 8 }}>
            <PrimaryButton title={kitchenOnly ? "Show all orders" : "Kitchen queue"} variant={kitchenOnly ? "primary" : "secondary"} onPress={() => setKitchenOnly((current) => !current)} />
          </View> : null}
        </Card>
        {loading ? <Card><Text style={{ color: tokens.colors.textSecondary }}>Loading {config.terminology.transaction.toLowerCase()}s...</Text></Card> : visibleOperations.length ? visibleOperations.map((operation) => (
          <Card key={operation.id} style={{ gap: 8, padding: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>{operation.title}</Text>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{operation.tableName ? (config.operatingModel === "hospitality" ? "Room " : "Table ") + operation.tableName : operation.vehiclePlate ? "Vehicle " + operation.vehiclePlate : operation.scheduledAt ? new Date(operation.scheduledAt).toLocaleString() : config.terminology.transaction}</Text>
              </View>
              <Badge label={operationStatusLabel(operation.status, config.capabilities.orders, config.operatingModel === "hospitality")} tone={operation.status === "completed" ? "success" : "warning"} />
            </View>
            {operation.notes ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{operation.notes}</Text> : null}
            {operation.status !== "completed" ? <PrimaryButton title={config.operatingModel === "hospitality" && operation.status === "confirmed" ? "Check in" : config.operatingModel === "hospitality" && operation.status === "in_progress" ? "Check out" : "Move to " + operationStatusLabel(getNextBusinessOperationStatus(operation.status), config.capabilities.orders, config.operatingModel === "hospitality").toLowerCase()} onPress={() => void advance(operation)} /> : null}
          </Card>
        )) : <EmptyState title={"No " + config.workspace.primaryEntity.toLowerCase() + "s yet"} subtitle={"Create the first " + config.workspace.primaryEntity.toLowerCase() + " to start the " + config.label.toLowerCase() + " workflow."} icon="briefcase-outline" action={<PrimaryButton title={config.workspace.primaryAction} onPress={() => setModalVisible(true)} />} />}
      </AppScrollView>
      <SimpleModal visible={modalVisible} title={config.workspace.primaryAction} onClose={() => setModalVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label={config.workspace.primaryEntity + " title"} value={title} onChangeText={setTitle} placeholder={operationKind === "order" ? config.operatingModel === "service" ? "Client service" : "New order" : operationKind === "appointment" ? "Client appointment" : config.operatingModel === "project" ? "Client engagement" : "Vehicle service job"} />
          {operationKind === "order" ? <InputField label="Table or service area" value={secondaryValue} onChangeText={setSecondaryValue} placeholder="Table 4" /> : null}
          {config.operatingModel === "hospitality" ? <InputField label="Room number" value={secondaryValue} onChangeText={setSecondaryValue} placeholder="Room 204" /> : null}
          {operationKind === "work_order" ? <InputField label="Vehicle plate" value={secondaryValue} onChangeText={setSecondaryValue} placeholder="KDA 123A" /> : null}
          {operationKind === "work_order" ? <View style={{ gap: 8 }}>
            <InputField label="Make" value={vehicleMake} onChangeText={setVehicleMake} placeholder="Toyota" />
            <InputField label="Model" value={vehicleModel} onChangeText={setVehicleModel} placeholder="Hilux" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><InputField label="Year" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" placeholder="2020" /></View>
              <View style={{ flex: 1 }}><InputField label="Mileage" value={vehicleMileage} onChangeText={setVehicleMileage} keyboardType="numeric" placeholder="85000" /></View>
            </View>
          </View> : null}
          {operationKind === "appointment" ? <InputField label="Start date and time" value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-08-24T10:00:00+03:00" /> : null}
          {operationKind === "project" ? <InputField label="Upcoming deadline" value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-08-24T17:00:00+03:00" /> : null}
          {customers.length ? <View style={{ gap: 7 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "800" }}>{config.terminology.customers}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              <Pressable onPress={() => setCustomerId(null)}><Badge label={config.operatingModel === "care" ? "Unlinked patient" : config.operatingModel === "project" ? "Unlinked client" : "Walk-in"} tone={!customerId ? "success" : "primary"} /></Pressable>
              {customers.slice(0, 8).map((customer) => <Pressable key={customer.id} onPress={() => setCustomerId(customer.id)}><Badge label={customer.name} tone={customerId === customer.id ? "success" : "primary"} /></Pressable>)}
            </View>
          </View> : null}
          {employees.length && operationKind !== "order" ? <View style={{ gap: 7 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "800" }}>Assign staff</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              <Pressable onPress={() => setStaffId(null)}><Badge label="Unassigned" tone={!staffId ? "success" : "primary"} /></Pressable>
              {employees.filter((employee) => employee.isActive).slice(0, 8).map((employee) => <Pressable key={employee.id} onPress={() => setStaffId(employee.id)}><Badge label={employee.fullName} tone={staffId === employee.id ? "success" : "primary"} /></Pressable>)}
            </View>
          </View> : null}
          {operationKind === "order" || config.operatingModel === "hospitality" ? <View style={{ gap: 8 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "800" }}>{config.operatingModel === "hospitality" ? "Stay charges" : "Order items"}</Text>
            {items.map((item, index) => <View key={item.name + index} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text style={{ color: tokens.colors.textSecondary, flex: 1 }}>{item.quantity} × {item.name}</Text><Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{(item.quantity * item.unitPrice).toFixed(2)}</Text></View>)}
            <InputField label={config.capabilities.menu ? "Menu item" : "Item name"} value={itemName} onChangeText={setItemName} placeholder={config.capabilities.menu ? "Chicken burger" : "Item name"} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><InputField label="Qty" value={itemQuantity} onChangeText={setItemQuantity} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><InputField label="Unit price" value={itemPrice} onChangeText={setItemPrice} keyboardType="numeric" /></View>
            </View>
            <PrimaryButton title="Add item" variant="secondary" onPress={() => {
              if (!itemName.trim() || Number(itemQuantity) <= 0 || Number(itemPrice) < 0) return;
              setItems((current) => [...current, { name: itemName.trim(), quantity: Number(itemQuantity), unitPrice: Number(itemPrice) }]);
              setItemName(""); setItemQuantity("1"); setItemPrice("0");
            }} />
          </View> : null}
          <InputField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
          <PrimaryButton title={saving ? "Saving..." : "Save " + config.workspace.primaryEntity} onPress={() => void saveOperation()} loading={saving} />
        </View>
      </SimpleModal>
    </Screen>
  );
}

function operationKindForConfig(config: ReturnType<typeof resolveBusinessTypeConfig>): BusinessOperationKind {
  if (config.capabilities.projects) return "project";
  if (config.capabilities.appointments && !config.capabilities.workOrders) return "appointment";
  if (config.capabilities.workOrders) return "work_order";
  return "order";
}

function operationStatusLabel(status: string, isOrder: boolean, isHospitality = false) {
  if (isHospitality) {
    if (status === "confirmed" || status === "open") return "Reserved";
    if (status === "in_progress" || status === "preparing") return "Checked in";
    if (status === "ready") return "In stay";
    if (status === "completed") return "Checked out";
  }
  if (!isOrder) return status.replace("_", " ");
  if (status === "open") return "Open";
  if (status === "preparing") return "Preparing";
  if (status === "ready") return "Ready";
  if (status === "completed") return "Served / picked up";
  return status.replace("_", " ");
}
