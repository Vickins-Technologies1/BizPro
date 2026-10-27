import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, AppVirtualizedList, Badge, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { hasPermission, type Branch } from "@shared";
import { formatMoney } from "@/utils/money";
import { activateBranch, createBranch, deactivateBranch, listBranches, updateBranch } from "@/services/apiClient";
import { SearchField } from "@/components/DesignSystem";

type BranchDraft = {
  name: string;
  code: string;
  location: string;
  phone: string;
  email: string;
  managerId: string;
  description: string;
  status: Branch["status"];
  isDefault: boolean;
};

export function BranchesScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const syncBranches = useAppStore((state) => state.syncBranches);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const canManageBranches = hasPermission(user, "manageBranches");

  const [items, setItems] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [modalVisible, setModalVisible] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selectedBranch, setSelectedBranch] = React.useState<Branch | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<BranchDraft>(() => emptyDraft());
  const deferredSearch = React.useDeferredValue(search);

  const filteredBranches = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return items.filter((branch) => {
      if (!query) return true;
      return [branch.name, branch.code, branch.location ?? "", branch.managerName ?? "", branch.status, branch.description ?? ""].join(" ").toLowerCase().includes(query);
    });
  }, [deferredSearch, items]);

  React.useEffect(() => {
    if (!canManageBranches) return;
    void refreshBranches();
  }, [canManageBranches]);

  async function refreshBranches() {
    setRefreshing(true);
    try {
      const next = await listBranches();
      setItems(next);
      await syncBranches(next);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to load branches");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreate() {
    setMode("create");
    setSelectedBranch(null);
    setDraft(emptyDraft());
    setFeedback(null);
    setModalVisible(true);
  }

  function openEdit(branch: Branch) {
    setMode("edit");
    setSelectedBranch(branch);
    setDraft(branchToDraft(branch));
    setFeedback(null);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!business) return;
    if (!draft.name.trim() || !draft.code.trim()) {
      setFeedback("Branch name and code are required.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (mode === "create") {
        await createBranch({
          businessId: business.id,
          name: draft.name.trim(),
          code: draft.code.trim(),
          location: normalizeMaybeString(draft.location),
          phone: normalizeMaybeString(draft.phone),
          email: normalizeMaybeString(draft.email),
          managerId: normalizeMaybeString(draft.managerId),
          description: normalizeMaybeString(draft.description),
          status: draft.status,
          isDefault: draft.isDefault
        });
        setFeedback("Branch created successfully.");
      } else if (selectedBranch) {
        await updateBranch(selectedBranch.id, {
          name: draft.name.trim(),
          code: draft.code.trim(),
          location: normalizeMaybeString(draft.location),
          phone: normalizeMaybeString(draft.phone),
          email: normalizeMaybeString(draft.email),
          managerId: normalizeMaybeString(draft.managerId),
          description: normalizeMaybeString(draft.description),
          status: draft.status,
          isDefault: draft.isDefault
        });
        setFeedback("Branch updated successfully.");
      }
      await refreshBranches();
      setModalVisible(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save branch");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(branch: Branch) {
    const confirmed = await confirmAction(`Deactivate ${branch.name}?`);
    if (!confirmed) return;
    setSaving(true);
    setFeedback(null);
    try {
      await deactivateBranch(branch.id);
      setFeedback(`${branch.name} was deactivated.`);
      await refreshBranches();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to deactivate branch");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(branch: Branch) {
    setSaving(true);
    setFeedback(null);
    try {
      await activateBranch(branch.id);
      setFeedback(`${branch.name} was reactivated.`);
      await refreshBranches();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to activate branch");
    } finally {
      setSaving(false);
    }
  }

  async function focusBranch(branch: Branch) {
    await setSelectedBranchId(branch.id);
    navigation.navigate("Dashboard");
  }

  if (!canManageBranches) {
    return (
      <Screen>
        <GradientHeader title="Branches" subtitle="Business-owner access" right={<Ionicons name="business-outline" size={26} color={tokens.colors.text} />} />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Branch management restricted"
            subtitle="This account does not have permission to manage branches."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Branch Management"
        subtitle="Create, edit, and monitor branch-level operations."
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppVirtualizedList
        refreshing={refreshing}
        onRefresh={refreshBranches}
        data={filteredBranches}
        keyExtractor={(branch) => branch.id}
        ListHeaderComponent={
          <View style={{ gap: 9, paddingBottom: 10, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>{business?.name ?? "Dira OS"}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>Branch administration · {items.length} branches</Text>
                </View>
                <Badge label={`Workspace: ${resolveBranchName(branches, selectedBranchId)}`} tone="primary" />
              </View>
              {feedback ? <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{feedback}</Text> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <PrimaryButton title="Add Branch" onPress={openCreate} />
                <PrimaryButton title={refreshing ? "Refreshing..." : "Refresh"} variant="secondary" onPress={refreshBranches} />
                <PrimaryButton title="Branch selector" variant="secondary" onPress={() => navigation.navigate("Launchpad")} />
              </View>
            </View>
            <SearchField value={search} onChangeText={setSearch} placeholder="Name, code, manager, or location" accessibilityLabel="Search branches" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: tokens.colors.success, fontSize: 10, fontWeight: "700" }}>{items.filter((branch) => branch.status === "active").length} active</Text>
              <Text style={{ color: tokens.colors.textMuted, fontSize: 10, fontWeight: "700" }}>{items.filter((branch) => branch.status === "inactive").length} inactive</Text>
            </View>
          </View>
        }
        renderItem={({ item: branch }) => (
          <View style={{ gap: 7, paddingVertical: 11, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "800" }}>{branch.name} <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "500" }}>· {branch.code}</Text></Text>
                <Text numberOfLines={1} style={{ color: tokens.colors.textSecondary, fontSize: 10 }}>{branch.location ?? branch.managerName ?? "No location details"}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                {selectedBranchId === branch.id ? <Badge label="Current" tone="primary" /> : null}
                <Badge label={branch.status === "active" ? "Active" : "Inactive"} tone={branch.status === "active" ? "success" : "warning"} />
              </View>
            </View>
            <Text style={{ color: tokens.colors.textMuted, fontSize: 10 }} numberOfLines={1}>
              {branch.managerName ?? "Unassigned"} · {branch.staffCount ?? 0} staff · {branch.inventoryCount ?? 0} products{branch.isDefault ? " · Default" : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }}>Sales <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{formatMoney(branch.salesTotal ?? 0, business?.currency)}</Text></Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 10 }}>Transactions <Text style={{ color: tokens.colors.text, fontWeight: "700" }}>{branch.salesCount ?? 0}</Text></Text>
              <Text style={{ color: branch.lowStockCount ? tokens.colors.warning : tokens.colors.textSecondary, fontSize: 10 }}>Low stock <Text style={{ fontWeight: "700" }}>{branch.lowStockCount ?? 0}</Text></Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Pressable onPress={() => void focusBranch(branch)} accessibilityRole="button" accessibilityLabel={selectedBranchId === branch.id ? `Open ${branch.name} workspace` : `Switch workspace to ${branch.name}`} style={{ minHeight: 38, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 10, backgroundColor: selectedBranchId === branch.id ? tokens.colors.surfaceAlt : tokens.colors.primaryAction }}>
                <Text style={{ color: selectedBranchId === branch.id ? tokens.colors.text : tokens.colors.primaryActionText, fontSize: 11, fontWeight: "800" }}>{selectedBranchId === branch.id ? "Current workspace" : "Switch workspace"}</Text>
              </Pressable>
              <Pressable onPress={() => openEdit(branch)} accessibilityRole="button" accessibilityLabel={`Edit ${branch.name}`} hitSlop={6} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}><Ionicons name="create-outline" size={17} color={tokens.colors.primaryStrong} /></Pressable>
              <Pressable onPress={async () => { await setSelectedBranchId(branch.id); navigation.navigate("Reports"); }} accessibilityRole="button" accessibilityLabel={`View ${branch.name} reports`} hitSlop={6} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}><Ionicons name="bar-chart-outline" size={17} color={tokens.colors.textSecondary} /></Pressable>
              <Pressable onPress={async () => { await setSelectedBranchId(branch.id); navigation.navigate("Employees"); }} accessibilityRole="button" accessibilityLabel={`View ${branch.name} staff`} hitSlop={6} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}><Ionicons name="people-outline" size={17} color={tokens.colors.textSecondary} /></Pressable>
              {branch.status === "active" ? (
                <Pressable onPress={() => void handleDeactivate(branch)} accessibilityRole="button" accessibilityLabel={`Deactivate ${branch.name}`} hitSlop={6} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}><Ionicons name="power-outline" size={17} color={tokens.colors.danger} /></Pressable>
              ) : (
                <Pressable onPress={() => void handleActivate(branch)} accessibilityRole="button" accessibilityLabel={`Reactivate ${branch.name}`} hitSlop={6} style={{ minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: tokens.colors.border }}><Ionicons name="refresh-outline" size={17} color={tokens.colors.success} /></Pressable>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <EmptyState title="Loading branches" subtitle="Retrieving branch records and summaries." icon="business-outline" />
          ) : (
            <EmptyState
              title={search ? "No matching branches" : "No branches yet"}
              subtitle={search ? "Try a different search term." : "Add the first branch to start managing multi-branch operations."}
              action={<PrimaryButton title="Add Branch" onPress={openCreate} />}
              icon="business-outline"
            />
          )
        }
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      />

      <SimpleModal visible={modalVisible} title={mode === "edit" ? "Edit branch" : "Add branch"} onClose={() => setModalVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <InputField label="Branch name" value={draft.name} onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <InputField label="Branch code" value={draft.code} onChangeText={(value) => setDraft((current) => ({ ...current, code: value.toUpperCase() }))} helperText="Code must be unique within the business." />
          <InputField label="Location / address" value={draft.location} onChangeText={(value) => setDraft((current) => ({ ...current, location: value }))} />
          <InputField label="Phone" value={draft.phone} onChangeText={(value) => setDraft((current) => ({ ...current, phone: value }))} />
          <InputField label="Email" value={draft.email} onChangeText={(value) => setDraft((current) => ({ ...current, email: value }))} />
          <InputField label="Manager ID" value={draft.managerId} onChangeText={(value) => setDraft((current) => ({ ...current, managerId: value }))} helperText="Assign the staff user who manages this branch." />
          <InputField label="Description" value={draft.description} onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))} multiline numberOfLines={3} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["active", "inactive"] as Branch["status"][]).map((status) => (
              <Pressable key={status} onPress={() => setDraft((current) => ({ ...current, status }))}>
                <Badge label={status === "active" ? "Active" : "Inactive"} tone={draft.status === status ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setDraft((current) => ({ ...current, isDefault: !current.isDefault }))} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: draft.isDefault ? `${tokens.colors.primary}18` : tokens.colors.surfaceAlt }}>
            <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{draft.isDefault ? "Default branch" : "Set as default branch"}</Text>
          </Pressable>
          <PrimaryButton title={saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create branch"} onPress={handleSave} loading={saving} />
        </AppScrollView>
      </SimpleModal>
    </Screen>
  );
}

function emptyDraft(): BranchDraft {
  return {
    name: "",
    code: "",
    location: "",
    phone: "",
    email: "",
    managerId: "",
    description: "",
    status: "active",
    isDefault: false
  };
}

function branchToDraft(branch: Branch): BranchDraft {
  return {
    name: branch.name,
    code: branch.code,
    location: branch.location ?? "",
    phone: branch.phone ?? "",
    email: branch.email ?? "",
    managerId: branch.managerId ?? "",
    description: branch.description ?? "",
    status: branch.status ?? "active",
    isDefault: branch.isDefault
  };
}

function normalizeMaybeString(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function resolveBranchName(branches: Branch[], selectedBranchId: string | null) {
  if (!selectedBranchId) return "All branches";
  return branches.find((branch) => branch.id === selectedBranchId)?.name ?? "Assigned branch";
}

function confirmAction(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm action", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}
