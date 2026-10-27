import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppScrollView, Badge, Card, GradientHeader, Screen, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import type { ThemePreference } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { listQueuedActions, type OfflineQueueEntry } from "@/services/offlineQueue";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { formatPermissionLabel, formatRoleLabel, getEffectivePermissions, hasPermission, resolveBusinessTypeConfig, resolveIndustryModule } from "@shared";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncProgress = useAppStore((state) => state.syncProgress);
  const syncNow = useAppStore((state) => state.syncNow);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const logout = useAppStore((state) => state.logout);
  const themePreference = useAppStore((state) => state.themePreference);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const [queuedActions, setQueuedActions] = React.useState<OfflineQueueEntry[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const permissions = getEffectivePermissions(user);
  const canManageEmployees = hasPermission(user, "manageEmployees");
  const roleLabel = user?.roleLabel ?? formatRoleLabel(user?.role);
  const industry = resolveIndustryModule({ industryKey: business?.industryKey, businessType: business?.businessType });
  const activeBranches = branches.filter((branch) => branch.status !== "inactive");
  const canManageBranches = hasPermission(user, "manageBranches");
  const canManageInventory = hasPermission(user, "manageInventory");
  const canManageSuppliers = hasPermission(user, "manageSuppliers");
  const businessConfig = resolveBusinessTypeConfig({ industryKey: business?.industryKey, businessType: business?.businessType });
  const inventoryLinks = [
    ...(canManageInventory && businessConfig.capabilities.inventory ? [{ label: "Brands", icon: "color-palette-outline" as const, route: "Brands" }] : []),
    ...(canManageSuppliers && businessConfig.capabilities.suppliers ? [{ label: "Suppliers", icon: "briefcase-outline" as const, route: "Suppliers" }] : []),
    ...(canManageInventory && (businessConfig.capabilities.inventory || businessConfig.capabilities.purchasing) ? [
      { label: "Purchase orders", icon: "document-text-outline" as const, route: "PurchaseOrders" },
      { label: "Stock transfers", icon: "swap-horizontal-outline" as const, route: "StockTransfers" }
    ] : [])
  ];

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
        subtitle="Profile, sync, and security"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        <Card style={{ gap: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.primaryStrong }}>
              <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>{(business?.name ?? "B").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11, fontWeight: "800" }}>Business snapshot</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "900" }}>{business?.name}</Text>
            </View>
            <Badge label={roleLabel} tone="primary" />
          </View>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>{industry.label} · Signed in as {user?.fullName ?? "Unknown"}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Badge label={`Plan ${business?.planTier?.toUpperCase()}`} tone="primary" />
            <Badge label={business?.currency ?? "Currency unavailable"} tone="success" />
            <Badge label={pendingSync ? `${pendingSync} pending sync` : "Synced"} tone={pendingSync ? "warning" : "success"} />
          </View>
        </Card>
        <Card style={{ gap: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.primary + "18" }}>
              <Ionicons name="contrast-outline" size={20} color={tokens.colors.primaryStrong} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Appearance</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>Use system, light, or dark appearance.</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["light", "dark", "system"] as ThemePreference[]).map((option) => (
              <Tag
                key={option}
                label={option === "system" ? "System" : option === "dark" ? "Dark" : "Light"}
                tone="primary"
                selected={themePreference === option}
                onPress={() => void setThemeMode(option)}
                style={{ flex: 1, justifyContent: "center", paddingVertical: 10 }}
              />
            ))}
          </View>
        </Card>
        <Card style={{ gap: 8, padding: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>Workspace</Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>Active branch data scope</Text>
          {user?.role === "owner" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {activeBranches.length > 1 ? (
                <Tag label="Consolidated view" tone="primary" selected={selectedBranchId === null} onPress={() => void setSelectedBranchId(null)} />
              ) : null}
              {activeBranches.map((branch) => (
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
            <Badge label={branches.find((branch) => branch.id === selectedBranchId)?.name ?? activeBranches[0]?.name ?? branches[0]?.name ?? "Assigned branch"} tone="primary" />
          )}
        </Card>
        {canManageBranches ? (
          <Card style={{ gap: 6, padding: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>Branch administration</Text>
            <SettingsNavRow label="Manage branches" icon="business-outline" onPress={() => navigation.navigate("Branches")} />
          </Card>
        ) : null}
        <Card style={{ gap: 9, padding: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>Account access</Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
            {user?.role === "owner"
              ? "Owner accounts have full business control."
              : user?.role === "manager"
                ? "Manager accounts can run the business day to day with limited admin control."
                : "Employee accounts are trimmed down to operational work only."}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {permissions.slice(0, 5).map((permission) => (
              <Badge key={permission} label={formatPermissionLabel(permission)} tone="primary" />
            ))}
          </View>
          {canManageEmployees ? (
            <SettingsNavRow label="Manage employees" icon="people-outline" onPress={() => navigation.navigate("Employees")} />
          ) : null}
        </Card>
        {inventoryLinks.length ? <Card style={{ gap: 6, padding: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>Business management</Text>
          {inventoryLinks.map((link, index) => <SettingsNavRow key={link.route} label={link.label} icon={link.icon} last={index === inventoryLinks.length - 1} onPress={() => navigation.navigate(link.route)} />)}
        </Card> : null}
        <Card style={{ gap: 10, padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>Queued offline actions</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>Saved locally until sync resumes.</Text>
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
        <Card style={{ gap: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.primary + "18" }}>
              <Ionicons name="shield-checkmark-outline" size={20} color={tokens.colors.primaryStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>Device & account</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>Synchronization and session controls</Text>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <SettingsNavRow
              label={syncing ? "Syncing…" : "Sync now"}
              icon="sync-outline"
              disabled={syncing}
              onPress={() => {
                setSyncing(true);
                syncNow()
                  .catch((error) => Alert.alert("Sync failed", error instanceof Error ? error.message : "Unable to sync now"))
                  .finally(() => setSyncing(false));
              }}
            />
            <SettingsNavRow
              label={loggingOut ? "Signing out…" : "Sign out"}
              icon="log-out-outline"
              tone="danger"
              disabled={loggingOut}
              onPress={() => {
                setLoggingOut(true);
                logout()
                  .catch((error) => Alert.alert("Logout failed", error instanceof Error ? error.message : "Unable to sign out"))
                  .finally(() => setLoggingOut(false));
              }}
            />
          </View>
        </Card>
      </AppScrollView>
    </Screen>
  );
}

function SettingsNavRow({
  label,
  icon,
  onPress,
  disabled = false,
  last = false,
  tone = "default"
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  last?: boolean;
  tone?: "default" | "danger";
}) {
  const color = tone === "danger" ? tokens.colors.danger : tokens.colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: disabled ? 0.55 : pressed ? 0.72 : 1,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.colors.border
      })}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ flex: 1, color: tone === "danger" ? tokens.colors.danger : tokens.colors.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={tokens.colors.textMuted} />
    </Pressable>
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
