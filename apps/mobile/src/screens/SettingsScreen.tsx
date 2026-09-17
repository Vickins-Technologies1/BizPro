import React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { AppScrollView, Badge, Card, GradientHeader, PrimaryButton, Screen, Tag } from "@/components/Primitives";
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
  const syncNow = useAppStore((state) => state.syncNow);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const logout = useAppStore((state) => state.logout);
  const [queuedActions, setQueuedActions] = React.useState<OfflineQueueEntry[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const permissions = getEffectivePermissions(user);
  const canManageEmployees = hasPermission(user, "manageEmployees");
  const roleLabel = user?.roleLabel ?? formatRoleLabel(user?.role);
  const industry = resolveIndustryModule({ industryKey: business?.industryKey, businessType: business?.businessType });
  const activeBranches = branches.filter((branch) => branch.status !== "inactive");
  const canManageBranches = hasPermission(user, "manageBranches");

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
        <Card style={{ gap: 8, padding: 14 }}>
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label={industry.label} tone="success" />
            <Badge label={`Plan ${business?.planTier?.toUpperCase()}`} tone="primary" />
            <Badge label={`Currency ${business?.currency}`} tone="success" />
            <Badge label={`Sync ${pendingSync}`} tone={pendingSync ? "warning" : "success"} />
            <Badge label={roleLabel} tone="primary" />
          </View>
        </Card>
        <Card style={{ gap: 9, padding: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>Branch scope</Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>Choose the workspace data scope.</Text>
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
          <Card style={{ gap: 10, padding: 14 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>Branch administration</Text>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Create new branches, adjust branch settings, and control active locations.
            </Text>
            <PrimaryButton title="Open branch management" variant="secondary" onPress={() => navigation.navigate("Branches")} />
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
            {permissions.slice(0, 6).map((permission) => (
              <Badge key={permission} label={formatPermissionLabel(permission)} tone="primary" />
            ))}
          </View>
          {canManageEmployees ? (
            <PrimaryButton title="Open employee workspace" variant="secondary" onPress={() => navigation.navigate("Employees")} />
          ) : null}
        </Card>
        <Card style={{ gap: 10, padding: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "900" }}>Inventory administration</Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>Manage records and logistics.</Text>
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
        <Card style={{ gap: 12, borderColor: tokens.colors.primary + "30" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tokens.colors.primary + "18" }}>
              <Ionicons name="shield-checkmark-outline" size={20} color={tokens.colors.primaryStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Device actions</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>Keep this workspace current and secure.</Text>
            </View>
          </View>
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
      </AppScrollView>
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
