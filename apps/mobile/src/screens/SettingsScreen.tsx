import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Badge, Card, GradientHeader, PrimaryButton, Screen, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { listQueuedActions, type OfflineQueueEntry } from "@/services/offlineQueue";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { formatPermissionLabel, formatRoleLabel, getEffectivePermissions, hasPermission, resolveIndustryModule } from "@shared";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncProgress = useAppStore((state) => state.syncProgress);
  const themeMode = useAppStore((state) => state.themeMode);
  const syncNow = useAppStore((state) => state.syncNow);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const logout = useAppStore((state) => state.logout);
  const [queuedActions, setQueuedActions] = React.useState<OfflineQueueEntry[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [savingTheme, setSavingTheme] = React.useState<"light" | "dark" | null>(null);
  const permissions = getEffectivePermissions(user);
  const canManageEmployees = hasPermission(user, "manageEmployees");
  const roleLabel = user?.roleLabel ?? formatRoleLabel(user?.role);
  const industry = resolveIndustryModule({ industryKey: business?.industryKey, businessType: business?.businessType });

  React.useEffect(() => {
    let cancelled = false;
    async function loadQueuedActions() {
      if (!business?.id) {
        setQueuedActions([]);
        return;
      }
      const entries = await listQueuedActions(business.id);
      if (!cancelled) {
        setQueuedActions(entries);
      }
    }
    loadQueuedActions().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [business?.id, pendingSync]);

  return (
    <Screen>
      <GradientHeader
        title="Settings"
        subtitle="Business profile, sync status, and device security"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Business snapshot</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{business?.name}</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{industry.label}</Text>
          <Text style={{ color: tokens.colors.textMuted, lineHeight: 18, fontSize: 12 }}>{industry.description}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label={industry.label} tone="success" />
            <Badge label={`Plan ${business?.planTier?.toUpperCase()}`} tone="primary" />
            <Badge label={`Currency ${business?.currency}`} tone="success" />
            <Badge label={`Sync ${pendingSync}`} tone={pendingSync ? "warning" : "success"} />
            <Badge label={roleLabel} tone="primary" />
          </View>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Signed in as {user?.fullName ?? "Unknown"}. Use this page to check the device, change the theme, or open employee management.
          </Text>
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Branch scope</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Owners can switch between a consolidated view and any branch. Other roles stay on their assigned branch so the workspace remains scoped correctly.
          </Text>
          {user?.role === "owner" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {branches.length > 1 ? (
                <Tag label="Consolidated view" tone="primary" selected={selectedBranchId === null} onPress={() => void setSelectedBranchId(null)} />
              ) : null}
              {branches.map((branch) => (
                <Tag
                  key={branch.id}
                  label={branch.name}
                  tone={branch.isDefault ? "success" : "primary"}
                  selected={selectedBranchId === branch.id}
                  onPress={() => void setSelectedBranchId(branch.id)}
                />
              ))}
            </View>
          ) : (
            <Badge label={branches.find((branch) => branch.id === selectedBranchId)?.name ?? branches[0]?.name ?? "Assigned branch"} tone="primary" />
          )}
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Account access</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            {user?.role === "owner"
              ? "Owner accounts have full business control."
              : user?.role === "manager"
                ? "Manager accounts can run the business day to day with limited admin control."
                : "Employee accounts are trimmed down to operational work only."}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {permissions.slice(0, 6).map((permission) => (
              <Badge key={permission} label={formatPermissionLabel(permission)} tone="primary" />
            ))}
          </View>
          {canManageEmployees ? (
            <PrimaryButton title="Open employee workspace" variant="secondary" onPress={() => navigation.navigate("Employees")} />
          ) : null}
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Theme</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Light mode is the default. Dark mode stays off unless you turn it on here.</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              { label: "Light", value: "light" as const },
              { label: "Dark", value: "dark" as const }
            ].map((option) => {
              const selected = themeMode === option.value;
              return (
                <View key={option.value} style={{ flex: 1 }}>
                  <Tag
                    label={savingTheme === option.value ? "Saving..." : option.label}
                    tone="primary"
                    selected={selected}
                    fullWidth
                    onPress={() => {
                      setSavingTheme(option.value);
                      setThemeMode(option.value)
                        .catch((error) => {
                          Alert.alert("Theme update failed", error instanceof Error ? error.message : "Unable to save theme preference");
                        })
                        .finally(() => setSavingTheme(null));
                    }}
                  />
                </View>
              );
            })}
          </View>
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Inventory administration</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Open the master records and logistics screens for brands, suppliers, purchase orders, and stock transfers.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: "45%" }}>
              <PrimaryButton title="Brands" variant="secondary" onPress={() => navigation.navigate("Brands")} />
            </View>
            <View style={{ flex: 1, minWidth: "45%" }}>
              <PrimaryButton title="Suppliers" variant="secondary" onPress={() => navigation.navigate("Suppliers")} />
            </View>
            <View style={{ flex: 1, minWidth: "45%" }}>
              <PrimaryButton title="Purchase orders" variant="secondary" onPress={() => navigation.navigate("PurchaseOrders")} />
            </View>
            <View style={{ flex: 1, minWidth: "45%" }}>
              <PrimaryButton title="Stock transfers" variant="secondary" onPress={() => navigation.navigate("StockTransfers")} />
            </View>
          </View>
        </Card>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Queued offline actions</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
                These actions were saved on the device and will replay automatically when sync runs.
              </Text>
            </View>
            <Badge label={`${queuedActions.length} queued`} tone={queuedActions.length ? "warning" : "success"} />
          </View>
          {syncProgress ? (
            <View
              style={{
                gap: 8,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                backgroundColor: tokens.colors.surfaceAlt
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Synchronization in progress</Text>
                <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
                  {syncProgress.completed}/{syncProgress.total}
                </Text>
              </View>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
                {syncProgress.currentLabel ?? "Preparing the next queued action"}
              </Text>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: tokens.colors.border, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${Math.max(8, Math.min(100, Math.round((syncProgress.completed / Math.max(syncProgress.total, 1)) * 100)))}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: tokens.colors.primaryStrong
                  }}
                />
              </View>
            </View>
          ) : null}
          {queuedActions.length ? (
            <View style={{ gap: 10 }}>
              {queuedActions.map((action) => (
                <View
                  key={action.id}
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
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatQueueLabel(action)}</Text>
                    <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatQueueTime(action.createdAt)}</Text>
                  </View>
                  <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
                    {formatQueueSummary(action)}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={`Attempts ${action.attempts}`} tone={action.attempts ? "warning" : "primary"} />
                    <Badge label={formatQueueBranch(action, branches)} tone="primary" />
                    {action.lastError ? <Badge label="Needs retry" tone="danger" /> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Nothing is waiting to sync right now.
            </Text>
          )}
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Device actions</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Keep the device in sync or sign out when you are done. These actions are always available here.
          </Text>
          <View style={{ gap: 10 }}>
            <PrimaryButton
              title={syncing ? "Syncing..." : "Sync now"}
              loading={syncing}
              onPress={() => {
                setSyncing(true);
                syncNow()
                  .catch((error) => Alert.alert("Sync failed", error instanceof Error ? error.message : "Unable to sync now"))
                  .finally(() => setSyncing(false));
              }}
            />
            <PrimaryButton
              title={loggingOut ? "Signing out..." : "Logout"}
              variant="danger"
              loading={loggingOut}
              onPress={() => {
                setLoggingOut(true);
                logout()
                  .catch((error) => Alert.alert("Logout failed", error instanceof Error ? error.message : "Unable to sign out"))
                  .finally(() => setLoggingOut(false));
              }}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function formatQueueLabel(action: OfflineQueueEntry) {
  switch (action.kind) {
    case "createCategory":
      return "Create category";
    case "createProduct":
      return "Create product";
    case "adjustStock":
      return "Adjust stock";
    case "createCustomer":
      return "Create customer";
    case "createExpense":
      return "Create expense";
    case "recordCustomerPayment":
      return "Record payment";
    case "createSale":
      return "Create sale";
  }
}

function formatQueueSummary(action: OfflineQueueEntry) {
  switch (action.kind) {
    case "createCategory":
      return action.payload.name;
    case "createProduct":
      return `${action.payload.name} • ${action.payload.unit}`;
    case "adjustStock":
      return `${action.payload.quantityDelta > 0 ? "Add" : "Remove"} ${Math.abs(action.payload.quantityDelta)} units for product ${action.payload.productId}`;
    case "createCustomer":
      return action.payload.name;
    case "createExpense":
      return `${action.payload.note} • ${action.payload.amount}`;
    case "recordCustomerPayment":
      return `${action.payload.amount} via ${action.payload.method}`;
    case "createSale":
      return `${action.payload.receiptNumber} • ${action.payload.items.length} items`;
  }
}

function formatQueueTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }
  return date.toLocaleString();
}

function formatQueueBranch(action: OfflineQueueEntry, branches: Array<{ id: string; name: string }>) {
  const branchId = (action.payload as { branchId?: string | null } | undefined)?.branchId ?? null;
  if (!branchId) {
    return "Business-wide";
  }
  return branches.find((branch) => branch.id === branchId)?.name ?? `Branch ${branchId}`;
}
