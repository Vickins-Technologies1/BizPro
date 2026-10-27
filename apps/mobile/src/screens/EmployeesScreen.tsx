import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  AppScrollView,
  AppVirtualizedList,
  Badge,
  EmptyState,
  GradientHeader,
  InputField,
  PrimaryButton,
  Screen,
  SimpleModal,
} from "@/components/Primitives";
import { SearchField } from "@/components/DesignSystem";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import {
  ACCESS_PERMISSIONS,
  ROLE_ACCESS,
  ROLE_PRESETS,
  formatPermissionLabel,
  formatRoleLabel,
  getEffectivePermissions,
  hasPermission,
  type AccessPermission,
  type UserRole
} from "@shared";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeCatalog,
  listEmployeeAuditLogs,
  listEmployees,
  resetEmployeeCredentials,
  restoreEmployee,
  suspendEmployee,
  updateEmployee,
  type AuditLogRecord,
  type EmployeeRecord,
  type EmployeeCatalog
} from "@/services/apiClient";

type EmployeeDraft = {
  fullName: string;
  phone: string;
  branchId: string;
  role: UserRole;
  roleLabel: string;
  permissions: AccessPermission[];
  isActive: boolean;
  password: string;
  pin: string;
};

type AuditScope = "all" | "access" | "credentials" | "status";

export function EmployeesScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const branches = useAppStore((state) => state.branches);
  const canManageEmployees = hasPermission(user, "manageEmployees");
  const permissions = getEffectivePermissions(user);

  const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);
  const [catalog, setCatalog] = React.useState<EmployeeCatalog | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [auditScope, setAuditScope] = React.useState<AuditScope>("access");
  const [auditSearch, setAuditSearch] = React.useState("");
  const [draftModalVisible, setDraftModalVisible] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<EmployeeDraft>(() => createDraft("cashier"));
  const [resetPassword, setResetPassword] = React.useState("");
  const [resetPin, setResetPin] = React.useState("");
  const [suspendReason, setSuspendReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [acting, setActing] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "warning" | "danger"; message: string } | null>(null);
  const deferredSearch = React.useDeferredValue(search);
  const deferredAuditSearch = React.useDeferredValue(auditSearch);

  const selectedEmployee = React.useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );
  const roleCatalog = catalog?.roles ?? fallbackRoleCatalog();
  const permissionCatalog = catalog?.permissions ?? ACCESS_PERMISSIONS;
  const businessOwner = employees.find((employee) => employee.role === "owner") ?? null;
  const effectiveOwnerName = businessOwner?.fullName ?? user?.fullName ?? "Business owner";

  const filteredEmployees = React.useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      if (!query) return true;
      const haystack = [employee.fullName, employee.phone ?? "", employee.branchId ?? "", employee.roleLabel ?? employee.role].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, employees]);

  const filteredAuditLogs = React.useMemo(() => {
    const query = deferredAuditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (!matchesAuditScope(log.action, auditScope)) return false;
      if (!query) return true;
      const payloadText = JSON.stringify(log.payload ?? {}).toLowerCase();
      return [log.action, log.actorId, log.entityId, payloadText].join(" ").toLowerCase().includes(query);
    });
  }, [auditLogs, auditScope, deferredAuditSearch]);

  const metrics = React.useMemo(() => {
    const active = employees.filter((employee) => employee.isActive).length;
    const suspended = employees.filter((employee) => !employee.isActive).length;
    const custom = employees.filter((employee) => !isPreset(employee.role, employee.permissions ?? ROLE_ACCESS[employee.role])).length;
    return { active, suspended, custom };
  }, [employees]);

  React.useEffect(() => {
    if (!canManageEmployees) return;
    void refreshWorkspace();
  }, [canManageEmployees, selectedBranchId]);

  React.useEffect(() => {
    if (!selectedEmployee) return;
    if (mode !== "edit") return;
    setDraft(employeeToDraft(selectedEmployee));
    setSuspendReason(selectedEmployee.suspensionReason ?? "");
    setResetPassword("");
    setResetPin("");
  }, [mode, selectedEmployee]);

  async function refreshWorkspace() {
    setRefreshing(true);
    setError(null);
    try {
      const [employeeList, permissionCatalogResponse, auditList] = await Promise.all([
        listEmployees(selectedBranchId),
        getEmployeeCatalog(),
        listEmployeeAuditLogs()
      ]);
      setEmployees(employeeList);
      setCatalog(permissionCatalogResponse);
      setAuditLogs(auditList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load employees");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openCreate() {
    setMode("create");
    setSelectedEmployeeId(null);
    setDraft(createDraft("cashier", selectedBranchId ?? user?.branchId ?? null));
    setSuspendReason("");
    setResetPassword("");
    setResetPin("");
    setFeedback(null);
    setDraftModalVisible(true);
  }

  async function openEdit(employee: EmployeeRecord) {
    setMode("edit");
    setSelectedEmployeeId(employee.id);
    setDraft(employeeToDraft(employee));
    setSuspendReason(employee.suspensionReason ?? "");
    setResetPassword("");
    setResetPin("");
    setFeedback(null);
    setDraftModalVisible(true);
  }

  async function handleSave() {
    if (!business || !canManageEmployees) return;
    if (!draft.fullName.trim()) {
      setFeedback({ tone: "danger", message: "Employee name is required." });
      return;
    }

    if (mode === "create" && !draft.password.trim()) {
      setFeedback({ tone: "danger", message: "Initial password is required for new employees." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      if (mode === "create") {
        await createEmployee({
          branchId: normalizeMaybeString(draft.branchId),
          fullName: draft.fullName.trim(),
          phone: normalizeMaybeString(draft.phone),
          password: draft.password.trim(),
          pin: normalizeMaybeString(draft.pin),
          role: draft.role,
          roleLabel: normalizeMaybeString(draft.roleLabel),
          permissions: draft.permissions,
          isActive: draft.isActive
        });
        setFeedback({ tone: "success", message: `${draft.fullName.trim()} was created successfully.` });
      } else if (selectedEmployeeId) {
        await updateEmployee(selectedEmployeeId, {
          branchId: normalizeMaybeString(draft.branchId),
          fullName: draft.fullName.trim(),
          phone: normalizeMaybeString(draft.phone),
          role: draft.role,
          roleLabel: normalizeMaybeString(draft.roleLabel),
          permissions: draft.permissions,
          isActive: draft.isActive
        });
        setFeedback({ tone: "success", message: `${draft.fullName.trim()} was updated successfully.` });
      }

      await refreshWorkspace();
      setDraftModalVisible(false);
    } catch (err) {
      setFeedback({ tone: "danger", message: err instanceof Error ? err.message : "Unable to save employee" });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetCredentials() {
    if (!selectedEmployeeId) return;

    if (!resetPassword.trim() && !resetPin.trim()) {
      const confirmed = await confirmMobile("No password or PIN was entered. Generate a temporary password?");
      if (!confirmed) return;
    }

    setActing(true);
    setFeedback(null);
    try {
      const result = await resetEmployeeCredentials(selectedEmployeeId, {
        password: normalizeMaybeString(resetPassword),
        pin: normalizeMaybeString(resetPin)
      });
      setResetPassword("");
      setResetPin("");
      setFeedback(
        result.temporaryPassword
          ? {
              tone: "warning",
              message: `Temporary password for ${selectedEmployee?.fullName ?? "employee"}: ${result.temporaryPassword}`
            }
          : { tone: "success", message: `Credentials updated for ${selectedEmployee?.fullName ?? "employee"}.` }
      );
      await refreshWorkspace();
    } catch (err) {
      setFeedback({ tone: "danger", message: err instanceof Error ? err.message : "Unable to reset credentials" });
    } finally {
      setActing(false);
    }
  }

  async function handleSuspendOrRestore() {
    if (!selectedEmployeeId || !selectedEmployee) return;

    setActing(true);
    setFeedback(null);
    try {
      if (selectedEmployee.isActive) {
        await suspendEmployee(selectedEmployeeId, suspendReason.trim() || null);
        setFeedback({ tone: "warning", message: `${selectedEmployee.fullName} was suspended.` });
      } else {
        await restoreEmployee(selectedEmployeeId);
        setFeedback({ tone: "success", message: `${selectedEmployee.fullName} was restored.` });
      }
      await refreshWorkspace();
    } catch (err) {
      setFeedback({ tone: "danger", message: err instanceof Error ? err.message : "Unable to update access state" });
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!selectedEmployeeId || !selectedEmployee) return;
    const confirmed = await confirmMobile(`Delete ${selectedEmployee.fullName} from active access?`);
    if (!confirmed) return;

    setActing(true);
    setFeedback(null);
    try {
      await deleteEmployee(selectedEmployeeId);
      setFeedback({ tone: "warning", message: `${selectedEmployee.fullName} was removed from active access.` });
      setSelectedEmployeeId(null);
      setDraftModalVisible(false);
      await refreshWorkspace();
    } catch (err) {
      setFeedback({ tone: "danger", message: err instanceof Error ? err.message : "Unable to delete employee" });
    } finally {
      setActing(false);
    }
  }

  if (!canManageEmployees) {
    return (
      <Screen>
        <GradientHeader title="Employees" subtitle="Business-owner access" right={<Ionicons name="people-outline" size={26} color={tokens.colors.text} />} />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Employee management restricted"
            subtitle="This account does not have permission to manage employee access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Employees"
        subtitle={`${effectiveOwnerName} owns this workspace`}
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppVirtualizedList
        refreshing={refreshing}
        onRefresh={refreshWorkspace}
        data={filteredEmployees}
        keyExtractor={(employee) => employee.id}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>Team directory</Text>
                <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                  {selectedBranchId ? branches.find((branch) => branch.id === selectedBranchId)?.name ?? "Selected branch" : "All authorized branches"} · Owner: {effectiveOwnerName}
                </Text>
              </View>
              <PrimaryButton title="Add employee" onPress={openCreate} />
            </View>
            {error ? <Text style={{ color: tokens.colors.danger, fontSize: 12 }}>{error}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {[["Employees", employees.length, tokens.colors.text], ["Active", metrics.active, tokens.colors.success], ["Suspended", metrics.suspended, tokens.colors.warning], ["Custom", metrics.custom, tokens.colors.primaryStrong]].map(([label, value, color]) => (
                <Text key={String(label)} style={{ color: color as string, fontSize: 11, fontWeight: "700" }}>{label} <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text></Text>
              ))}
              <Text style={{ color: tokens.colors.textMuted, fontSize: 11 }}>{permissions.length} permissions on your account</Text>
            </View>
            <SearchField value={search} onChangeText={setSearch} placeholder="Name, phone, branch, or role" accessibilityLabel="Search employees" />
            {loading ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>Loading employee workspace…</Text> : null}
            {feedback ? <Text style={{ color: feedback.tone === "danger" ? tokens.colors.danger : feedback.tone === "warning" ? tokens.colors.warning : tokens.colors.success, fontSize: 12 }}>{feedback.message}</Text> : null}
          </View>
        }
        renderItem={({ item: employee }) => {
          const isCurrent = employee.id === selectedEmployeeId;
          const summaryPermissions = employee.permissions ?? ROLE_ACCESS[employee.role];
          return (
            <Pressable
              onPress={() => {
                setSelectedEmployeeId(employee.id);
                openEdit(employee);
              }}
              style={{ paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderColor: tokens.colors.border, backgroundColor: isCurrent ? tokens.colors.surfaceAlt : "transparent", gap: 7 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>{employee.fullName}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>
                    {employee.roleLabel ?? formatPresetLabel(employee.role)} · {employee.phone ?? "No phone"} · {branches.find((branch) => branch.id === employee.branchId)?.name ?? employee.branchId ?? "Main branch"}
                  </Text>
                </View>
                <Badge label={employee.isActive ? "active" : "suspended"} tone={employee.isActive ? "success" : "warning"} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Badge label={`${summaryPermissions.length} permissions`} tone="primary" />
                <Badge label={employee.ownerId ? "Owner linked" : "No owner link"} tone="success" />
                <Badge label={isPreset(employee.role, summaryPermissions) ? "preset" : "custom"} tone="warning" />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={search ? "No matching employees" : "No team members yet"}
            subtitle={search ? "Try a different search term." : "Add the first team member to start sharing access."}
            action={<PrimaryButton title="Add first employee" onPress={openCreate} />}
          />
        }
        ListFooterComponent={
          <View style={{ gap: 10, marginTop: 12, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderColor: tokens.colors.border }}>
            <View>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>Access history</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, marginTop: 3 }}>Access changes, credential resets, and employee status events.</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {([
                ["access", "Access"],
                ["credentials", "Credentials"],
                ["status", "Suspensions"],
                ["all", "All"]
              ] as Array<[AuditScope, string]>).map(([scope, label]) => (
                <Pressable key={scope} onPress={() => setAuditScope(scope)}>
                  <Badge label={label} tone={auditScope === scope ? "success" : "primary"} />
                </Pressable>
              ))}
            </View>
            <SearchField value={auditSearch} onChangeText={setAuditSearch} placeholder="Employee, action, or actor" accessibilityLabel="Search access history" />
            {filteredAuditLogs.length ? (
              filteredAuditLogs.map((log) => (
                <View key={log.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: tokens.colors.border, gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{formatAuditTitle(log)}</Text>
                    <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{log.action}</Text>
                  </View>
                  <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{summarizeAudit(log)}</Text>
                  <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{new Date(log.createdAt).toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: tokens.colors.textSecondary }}>No audit events match the current filters.</Text>
            )}
          </View>
        }
        contentContainerStyle={{ gap: 0, paddingBottom: 24 }}
      />

      <SimpleModal
        visible={draftModalVisible}
        title={mode === "edit" ? `Edit ${selectedEmployee?.fullName ?? "employee"}` : "Add employee"}
        onClose={() => setDraftModalVisible(false)}
      >
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <InputField label="Full name" value={draft.fullName} onChangeText={(value) => setDraft((current) => ({ ...current, fullName: value }))} />
          <InputField label="Phone" value={draft.phone} onChangeText={(value) => setDraft((current) => ({ ...current, phone: value }))} />
          <InputField label="Branch ID" value={draft.branchId} onChangeText={(value) => setDraft((current) => ({ ...current, branchId: value }))} />
          <InputField label="Display label" value={draft.roleLabel} onChangeText={(value) => setDraft((current) => ({ ...current, roleLabel: value }))} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {roleCatalog.map((roleOption) => (
              <Pressable
                key={roleOption.role}
                onPress={() => applyRolePreset(roleOption.role, setDraft)}
              >
                <Badge label={roleOption.label} tone={draft.role === roleOption.role ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          {mode === "create" ? (
            <>
              <InputField
                label="Initial password"
                value={draft.password}
                onChangeText={(value) => setDraft((current) => ({ ...current, password: value }))}
                secureTextEntry
              />
              <InputField label="Optional PIN" value={draft.pin} onChangeText={(value) => setDraft((current) => ({ ...current, pin: value }))} keyboardType="numeric" />
            </>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => setDraft((current) => ({ ...current, isActive: !current.isActive }))}
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.isActive }}
              accessibilityLabel="Employee access status"
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                backgroundColor: draft.isActive ? "rgba(16,185,129,0.12)" : tokens.colors.surfaceAlt
              }}
            >
              <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{draft.isActive ? "Active" : "Suspended"}</Text>
            </Pressable>
            <Text style={{ color: tokens.colors.textSecondary, flex: 1 }}>Toggle employee access without removing the profile.</Text>
          </View>
          <View style={{ gap: 3, paddingTop: 4 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "800" }}>Permissions</Text>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
              {draft.role === "owner" ? "Owner permissions are fixed and cannot be edited here." : "Selected permissions are saved with this employee’s access profile."}
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {permissionCatalog.map((permission) => {
              const checked = draft.role === "owner" || draft.permissions.includes(permission);
              const disabled = draft.role === "owner";
              return (
                <Pressable
                  key={permission}
                  onPress={() => {
                    if (disabled) return;
                    setDraft((current) => ({ ...current, permissions: togglePermission(current.permissions, permission) }));
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled }}
                  accessibilityLabel={formatPermissionLabel(permission)}
                  style={{ opacity: disabled ? 0.7 : 1 }}
                >
                  <Badge label={formatPermissionLabel(permission)} tone={checked ? "success" : "primary"} />
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
            Selected preset: {presetLabelFor(draft.role, draft.permissions)}
          </Text>
          <PrimaryButton title={saving ? "Saving..." : mode === "edit" ? "Save changes" : "Add employee"} onPress={handleSave} loading={saving} />
          {mode === "edit" ? (
            <View style={{ gap: 10, paddingTop: 8 }}>
              <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Credential reset</Text>
              <InputField label="New password" value={resetPassword} onChangeText={setResetPassword} secureTextEntry />
              <InputField label="New PIN" value={resetPin} onChangeText={setResetPin} keyboardType="numeric" />
              <PrimaryButton title={acting ? "Resetting..." : "Reset credentials"} variant="secondary" onPress={handleResetCredentials} loading={acting} />
              <InputField label="Suspension reason" value={suspendReason} onChangeText={setSuspendReason} placeholder="Optional reason" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <PrimaryButton
                  title={selectedEmployee?.isActive ? "Suspend" : "Restore"}
                  variant="secondary"
                  onPress={handleSuspendOrRestore}
                  loading={acting}
                />
                <PrimaryButton title="Delete" variant="danger" onPress={handleDelete} loading={acting} />
              </View>
            </View>
          ) : null}
        </AppScrollView>
      </SimpleModal>
    </Screen>
  );
}

function createDraft(role: UserRole, branchId?: string | null): EmployeeDraft {
  return {
    fullName: "",
    phone: "",
    branchId: branchId ?? "",
    role,
    roleLabel: formatPresetLabel(role),
    permissions: [...ROLE_ACCESS[role]],
    isActive: true,
    password: "",
    pin: ""
  };
}

function employeeToDraft(employee: EmployeeRecord): EmployeeDraft {
  return {
    fullName: employee.fullName,
    phone: employee.phone ?? "",
    branchId: employee.branchId ?? "",
    role: employee.role,
    roleLabel: employee.roleLabel ?? formatPresetLabel(employee.role),
    permissions: employee.permissions ? [...employee.permissions] : [...ROLE_ACCESS[employee.role]],
    isActive: employee.isActive,
    password: "",
    pin: ""
  };
}

function fallbackRoleCatalog() {
  return ROLE_PRESETS.map((preset) => ({
    role: preset.role,
    label: preset.label,
    description: preset.description,
    permissions: [...ROLE_ACCESS[preset.role]]
  }));
}

function formatPresetLabel(role: UserRole) {
  return formatRoleLabel(role);
}

function applyRolePreset(role: UserRole, setDraft: React.Dispatch<React.SetStateAction<EmployeeDraft>>) {
  setDraft((current) => ({
    ...current,
    role,
    roleLabel: formatPresetLabel(role),
    permissions: [...ROLE_ACCESS[role]]
  }));
}

function togglePermission(current: AccessPermission[], permission: AccessPermission) {
  return current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission];
}

function isPreset(role: UserRole, permissions: AccessPermission[]) {
  return ROLE_ACCESS[role].slice().sort().join("|") === permissions.slice().sort().join("|");
}

function presetLabelFor(role: UserRole, permissions: AccessPermission[]) {
  const preset = (Object.keys(ROLE_ACCESS) as UserRole[]).find((candidate) => isPreset(candidate, permissions));
  return preset ? formatPresetLabel(preset) : role === "owner" ? "Owner" : "Custom";
}

function matchesAuditScope(action: string, scope: AuditScope) {
  if (scope === "all") return true;
  if (scope === "access") return action === "employee.create" || action === "employee.update";
  if (scope === "credentials") return action === "employee.reset_credentials";
  return action === "employee.suspend" || action === "employee.restore" || action === "employee.delete";
}

function formatAuditTitle(log: AuditLogRecord) {
  switch (log.action) {
    case "employee.create":
      return "Employee created";
    case "employee.update":
      return "Employee updated";
    case "employee.suspend":
      return "Employee suspended";
    case "employee.restore":
      return "Employee restored";
    case "employee.reset_credentials":
      return "Credentials reset";
    case "employee.delete":
      return "Employee deleted";
    default:
      return log.action;
  }
}

function summarizeAudit(log: AuditLogRecord) {
  const payload = log.payload ?? {};
  const name = typeof payload.fullName === "string" ? payload.fullName : "Employee";
  switch (log.action) {
    case "employee.create":
      return `${name} was added to the team.`;
    case "employee.update":
      return `${name} profile or permissions were updated.`;
    case "employee.suspend":
      return `${name} was suspended${typeof payload.reason === "string" && payload.reason.trim() ? `: ${payload.reason}` : "."}`;
    case "employee.restore":
      return `${name} was restored to active access.`;
    case "employee.reset_credentials":
      return `${name} had credentials reset${payload.temporaryPassword ? " with a temporary password" : ""}.`;
    case "employee.delete":
      return `${name} was removed from active access.`;
    default:
      return JSON.stringify(payload);
  }
}

function normalizeMaybeString(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function confirmMobile(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm action", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}
