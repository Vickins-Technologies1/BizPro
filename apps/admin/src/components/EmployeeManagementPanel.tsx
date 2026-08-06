"use client";

import React from "react";
import { ACCESS_PERMISSIONS, ROLE_ACCESS, formatPermissionLabel, type AccessPermission, type UserRole } from "@vbo/shared";
import { DashboardCard } from "./DashboardCard";
import {
  type AdminBusiness,
  type AuditLogRecord,
  type EmployeeRecord,
  type PermissionCatalog,
  createBusinessEmployee,
  deleteBusinessEmployee,
  formatPresetLabel,
  resolveBusinessId,
  resetBusinessEmployeeCredentials,
  restoreBusinessEmployee,
  suspendBusinessEmployee,
  updateBusinessEmployee
} from "../lib/admin-api";

type DraftEmployee = {
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

type Props = {
  business: AdminBusiness | null;
  employees: EmployeeRecord[];
  catalog: PermissionCatalog | null;
  auditLogs: AuditLogRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
};

export function EmployeeManagementPanel({ business, employees, catalog, auditLogs, loading, error, onRefresh }: Props) {
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftEmployee>(() => createDraft("cashier"));
  const [saving, setSaving] = React.useState(false);
  const [credentialSaving, setCredentialSaving] = React.useState(false);
  const [destroying, setDestroying] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [auditScope, setAuditScope] = React.useState<AuditScope>("access");
  const [auditSearch, setAuditSearch] = React.useState("");
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "warning" | "danger"; message: string } | null>(null);
  const [resetPassword, setResetPassword] = React.useState("");
  const [resetPin, setResetPin] = React.useState("");
  const [suspendReason, setSuspendReason] = React.useState("");

  const businessId = business ? resolveBusinessId(business) : null;
  const selectedEmployee = employees.find((employee) => employee._id === selectedEmployeeId) ?? null;
  const businessOwner = employees.find((employee) => employee.role === "owner") ?? null;
  const permissionCatalog = catalog?.permissions ?? ACCESS_PERMISSIONS;
  const roleCatalog = catalog?.roles ?? [
    { role: "owner" as const, label: "Business Owner", permissions: ROLE_ACCESS.owner },
    { role: "manager" as const, label: "Manager", permissions: ROLE_ACCESS.manager },
    { role: "cashier" as const, label: "Cashier", permissions: ROLE_ACCESS.cashier }
  ];
  const filteredEmployees = employees.filter((employee) => {
    const haystack = [employee.fullName, employee.phone ?? "", employee.branchId ?? "", employee.roleLabel ?? employee.role].join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
  const filteredAudit = React.useMemo(() => {
    const normalized = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditScope !== "all" && !matchesAuditScope(log.action, auditScope)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const payloadText = JSON.stringify(log.payload ?? {}).toLowerCase();
      const composite = [log.action, log.actorId, log.entityId, payloadText].join(" ").toLowerCase();
      return composite.includes(normalized);
    });
  }, [auditLogs, auditSearch, auditScope]);

  const employeeMetrics = React.useMemo(() => {
    const active = employees.filter((employee) => employee.isActive).length;
    const suspended = employees.filter((employee) => !employee.isActive).length;
    const permissionChanges = auditLogs.filter((log) => log.action === "employee.create" || log.action === "employee.update").length;
    return { active, suspended, permissionChanges };
  }, [auditLogs, employees]);

  React.useEffect(() => {
    if (!business) {
      return;
    }
    setMode("create");
    setSelectedEmployeeId(null);
    setDraft(createDraft("cashier"));
    setResetPassword("");
    setResetPin("");
    setSuspendReason("");
    setFeedback(null);
    setSearch("");
    setAuditScope("access");
    setAuditSearch("");
  }, [businessId]);

  React.useEffect(() => {
    if (!selectedEmployee) {
      return;
    }

    if (mode !== "edit") {
      return;
    }

    setDraft(employeeToDraft(selectedEmployee));
    setResetPassword("");
    setResetPin("");
    setSuspendReason(selectedEmployee.suspensionReason ?? "");
  }, [mode, selectedEmployee]);

  if (!business) {
    return (
      <DashboardCard title="Employee management" accent="rgba(59,130,246,0.4)">
        <div style={{ color: "var(--text-secondary)" }}>Select a business to view employee records, permission presets, and audit history.</div>
      </DashboardCard>
    );
  }

  async function handleSave() {
    if (!businessId) {
      setFeedback({ tone: "danger", message: "Choose a business before creating or editing employees." });
      return;
    }

    if (!draft.fullName.trim()) {
      setFeedback({ tone: "danger", message: "Employee name is required." });
      return;
    }

    if (mode === "create" && !draft.password.trim()) {
      setFeedback({ tone: "danger", message: "A password is required for new employees." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      if (mode === "create") {
        await createBusinessEmployee(businessId, {
          fullName: draft.fullName.trim(),
          phone: normalizeValue(draft.phone),
          branchId: normalizeValue(draft.branchId),
          password: draft.password.trim(),
          pin: normalizeValue(draft.pin),
          role: draft.role,
          roleLabel: normalizeValue(draft.roleLabel),
          permissions: draft.permissions,
          isActive: draft.isActive
        });
        setFeedback({ tone: "success", message: `${draft.fullName.trim()} was created successfully.` });
        setDraft(createDraft("cashier"));
      } else if (selectedEmployeeId) {
        await updateBusinessEmployee(businessId, selectedEmployeeId, {
          fullName: draft.fullName.trim(),
          phone: normalizeValue(draft.phone),
          branchId: normalizeValue(draft.branchId),
          role: draft.role,
          roleLabel: normalizeValue(draft.roleLabel),
          permissions: draft.permissions,
          isActive: draft.isActive
        });
        setFeedback({ tone: "success", message: `${draft.fullName.trim()} was updated successfully.` });
      }

      await onRefresh();
    } catch (error) {
      setFeedback({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save employee" });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetCredentials() {
    if (!businessId || !selectedEmployeeId) {
      return;
    }

    if (!resetPassword.trim() && !resetPin.trim()) {
      const confirmed = confirmDialog("No password or PIN was entered. Biz Pro will generate a temporary password. Continue?");
      if (!confirmed) {
        return;
      }
    }

    setCredentialSaving(true);
    setFeedback(null);
    try {
      const result = await resetBusinessEmployeeCredentials(businessId, selectedEmployeeId, {
        password: normalizeValue(resetPassword),
        pin: normalizeValue(resetPin)
      });
      setFeedback(
        result.temporaryPassword
          ? { tone: "warning", message: `Temporary password generated for ${selectedEmployee?.fullName ?? "employee"}: ${result.temporaryPassword}` }
          : { tone: "success", message: `Credentials updated for ${selectedEmployee?.fullName ?? "employee"}.` }
      );
      setResetPassword("");
      setResetPin("");
      await onRefresh();
    } catch (error) {
      setFeedback({ tone: "danger", message: error instanceof Error ? error.message : "Unable to reset credentials" });
    } finally {
      setCredentialSaving(false);
    }
  }

  async function handleSuspend() {
    if (!businessId || !selectedEmployeeId) {
      return;
    }

    setCredentialSaving(true);
    setFeedback(null);
    try {
      await suspendBusinessEmployee(businessId, selectedEmployeeId, suspendReason.trim() || null);
      setFeedback({ tone: "warning", message: `${selectedEmployee?.fullName ?? "Employee"} was suspended.` });
      await onRefresh();
    } catch (error) {
      setFeedback({ tone: "danger", message: error instanceof Error ? error.message : "Unable to suspend employee" });
    } finally {
      setCredentialSaving(false);
    }
  }

  async function handleRestore() {
    if (!businessId || !selectedEmployeeId) {
      return;
    }

    setCredentialSaving(true);
    setFeedback(null);
    try {
      await restoreBusinessEmployee(businessId, selectedEmployeeId);
      setFeedback({ tone: "success", message: `${selectedEmployee?.fullName ?? "Employee"} was restored.` });
      await onRefresh();
    } catch (error) {
      setFeedback({ tone: "danger", message: error instanceof Error ? error.message : "Unable to restore employee" });
    } finally {
      setCredentialSaving(false);
    }
  }

  async function handleDelete() {
    if (!businessId || !selectedEmployeeId) {
      return;
    }

    const confirmed = confirmDialog("Delete this employee permanently from active access?");
    if (!confirmed) {
      return;
    }

    setDestroying(true);
    setFeedback(null);
    try {
      await deleteBusinessEmployee(businessId, selectedEmployeeId);
      setFeedback({ tone: "warning", message: `${selectedEmployee?.fullName ?? "Employee"} was deleted from active access.` });
      setSelectedEmployeeId(null);
      setMode("create");
      setDraft(createDraft("cashier"));
      setResetPassword("");
      setResetPin("");
      setSuspendReason("");
      await onRefresh();
    } catch (error) {
      setFeedback({ tone: "danger", message: error instanceof Error ? error.message : "Unable to delete employee" });
    } finally {
      setDestroying(false);
    }
  }

  return (
    <DashboardCard title="Employee management" accent="rgba(59,130,246,0.4)">
      <div style={{ display: "grid", gap: 16 }}>
        <div style={styles.summaryRow}>
          {[
            ["Employees", String(employees.length)],
            ["Active", String(employeeMetrics.active)],
            ["Suspended", String(employeeMetrics.suspended)],
            ["Permission changes", String(employeeMetrics.permissionChanges)]
          ].map(([label, value]) => (
            <div key={label} style={styles.metricPill}>
              <div style={styles.metricLabel}>{label}</div>
              <div style={styles.metricValue}>{value}</div>
            </div>
          ))}
        </div>

        {feedback ? <div style={{ ...styles.feedback, ...feedbackToneStyles[feedback.tone] }}>{feedback.message}</div> : null}

        <div style={styles.workspaceGrid}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>Employee list</div>
              <div style={styles.panelSubtitle}>Create, edit, suspend, restore, and remove access for the selected business.</div>
              <div style={styles.ownerNote}>Owned by: {businessOwner?.fullName ?? "Business owner"}</div>
            </div>
              <button type="button" style={styles.primaryButton} onClick={() => startCreate(setMode, setSelectedEmployeeId, setDraft, setResetPassword, setResetPin, setSuspendReason)}>
                New employee
              </button>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search name, phone, role, or branch"
              style={styles.input}
            />

            <div style={styles.list}>
              {filteredEmployees.length ? (
                filteredEmployees.map((employee) => {
                  const permissions = employee.permissions ?? ROLE_ACCESS[employee.role];
                  const selected = employee._id === selectedEmployeeId;
                  return (
                    <button
                      key={employee._id}
                      type="button"
                      onClick={() => selectEmployee(employee, setMode, setSelectedEmployeeId, setDraft, setResetPassword, setResetPin, setSuspendReason)}
                      style={{ ...styles.employeeRow, ...(selected ? styles.employeeRowSelected : {}) }}
                    >
                      <div style={styles.employeeRowTop}>
                        <div style={{ minWidth: 0 }}>
                          <div style={styles.employeeName}>{employee.fullName}</div>
                          <div style={styles.employeeSubline}>
                            {employee.roleLabel ?? formatPresetLabel(employee.role)} • {employee.phone ?? "No phone"} • {employee.branchId ?? "Main branch"}
                          </div>
                        </div>
                        <span style={{ ...styles.statusBadge, ...(employee.isActive ? styles.statusActive : styles.statusSuspended) }}>
                          {employee.isActive ? "Active" : "Suspended"}
                        </span>
                      </div>

                      <div style={styles.employeeMetaRow}>
                        <span style={styles.metaChip}>{permissions.length} permissions</span>
                        <span style={styles.metaChip}>{employee.role}</span>
                        <span style={styles.metaChip}>{employee.permissions ? "custom" : "preset"}</span>
                        <span style={styles.metaChip}>{employee.ownerId === businessOwner?._id ? "business owner owned" : "owner linked"}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div style={styles.emptyState}>No employees match your search.</div>
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelTitle}>{mode === "edit" ? `Edit ${selectedEmployee?.fullName ?? "employee"}` : "Create employee"}</div>
                <div style={styles.panelSubtitle}>
                  Build a role preset, then refine the permission set when the default access shape needs to be tighter.
                </div>
              </div>
              {selectedEmployee ? (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setMode("create");
                    setSelectedEmployeeId(null);
                    setDraft(createDraft("cashier"));
                    setResetPassword("");
                    setResetPin("");
                    setSuspendReason("");
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div style={styles.formGrid}>
              <input
                value={draft.fullName}
                onChange={(event) => setDraft((current) => ({ ...current, fullName: event.currentTarget.value }))}
                placeholder="Full name"
                style={styles.input}
              />
              <input
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.currentTarget.value }))}
                placeholder="Phone number"
                style={styles.input}
              />
              <input
                value={draft.branchId}
                onChange={(event) => setDraft((current) => ({ ...current, branchId: event.currentTarget.value }))}
                placeholder="Branch ID"
                style={styles.input}
              />
              <select
                value={draft.role}
                onChange={(event) => applyPreset(event.currentTarget.value as UserRole, setDraft)}
                style={styles.input}
              >
                {roleCatalog.map((entry) => (
                  <option key={entry.role} value={entry.role}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <input
                value={draft.roleLabel}
                onChange={(event) => setDraft((current) => ({ ...current, roleLabel: event.currentTarget.value }))}
                placeholder="Role label"
                style={styles.input}
              />
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => setDraft((current) => ({ ...current, isActive: event.currentTarget.checked }))}
                />
                <span>Active account</span>
              </label>
            </div>

            {mode === "create" ? (
              <div style={styles.formGrid}>
                <input
                  value={draft.password}
                  onChange={(event) => setDraft((current) => ({ ...current, password: event.currentTarget.value }))}
                  placeholder="Initial password"
                  type="password"
                  style={styles.input}
                />
                <input
                  value={draft.pin}
                  onChange={(event) => setDraft((current) => ({ ...current, pin: event.currentTarget.value }))}
                  placeholder="Optional PIN"
                  inputMode="numeric"
                  style={styles.input}
                />
              </div>
            ) : null}

            <div style={styles.presetRow}>
              {roleCatalog.map((entry) => (
                <button key={entry.role} type="button" style={styles.chipButton} onClick={() => applyPreset(entry.role, setDraft)}>
                  {entry.label}
                </button>
              ))}
              <button type="button" style={styles.chipButton} onClick={() => setDraft((current) => ({ ...current, permissions: [...new Set(current.permissions)] }))}>
                Custom access
              </button>
            </div>

            <div style={styles.permissionGrid}>
              {permissionCatalog.map((permission) => {
                const checked = draft.role === "owner" || draft.permissions.includes(permission);
                const ownerLocked = draft.role === "owner";
                return (
                  <label key={permission} style={{ ...styles.permissionChip, ...(checked ? styles.permissionChipActive : {}) }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={ownerLocked}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          permissions: togglePermission(current.permissions, permission)
                        }))
                      }
                    />
                    <span>{formatPermissionLabel(permission)}</span>
                  </label>
                );
              })}
            </div>

            <div style={styles.helperRow}>
              <div>
                <div style={styles.helperLabel}>Current preset</div>
                <div style={styles.helperValue}>{presetNameFor(draft.role, draft.permissions)}</div>
              </div>
              <div>
                <div style={styles.helperLabel}>Permission count</div>
                <div style={styles.helperValue}>{draft.role === "owner" ? ACCESS_PERMISSIONS.length : draft.permissions.length}</div>
              </div>
            </div>

            <button type="button" style={styles.primaryButton} disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create employee"}
            </button>

            {mode === "edit" ? (
              <div style={styles.credentialBlock}>
                <div style={styles.blockTitle}>Credential reset</div>
                <div style={styles.formGrid}>
                  <input
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.currentTarget.value)}
                    placeholder="New password"
                    type="password"
                    style={styles.input}
                  />
                  <input
                    value={resetPin}
                    onChange={(event) => setResetPin(event.currentTarget.value)}
                    placeholder="New PIN"
                    inputMode="numeric"
                    style={styles.input}
                  />
                </div>
                <button type="button" style={styles.secondaryButton} disabled={credentialSaving} onClick={handleResetCredentials}>
                  {credentialSaving ? "Resetting..." : "Reset credentials"}
                </button>
              </div>
            ) : null}

            {mode === "edit" ? (
              <div style={styles.dangerActions}>
                <div style={styles.blockTitle}>Access controls</div>
                <input
                  value={suspendReason}
                  onChange={(event) => setSuspendReason(event.currentTarget.value)}
                  placeholder="Suspension reason"
                  style={styles.input}
                />
                <div style={styles.actionRow}>
                  {selectedEmployee?.isActive ? (
                    <button type="button" style={styles.secondaryButton} disabled={credentialSaving} onClick={handleSuspend}>
                      {credentialSaving ? "Working..." : "Suspend"}
                    </button>
                  ) : (
                    <button type="button" style={styles.secondaryButton} disabled={credentialSaving} onClick={handleRestore}>
                      {credentialSaving ? "Working..." : "Restore"}
                    </button>
                  )}
                  <button type="button" style={styles.dangerButton} disabled={destroying} onClick={handleDelete}>
                    {destroying ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <section style={styles.auditShell}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>Audit log viewer</div>
              <div style={styles.panelSubtitle}>Permission changes, lifecycle updates, credential resets, and support-console actions for this business.</div>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={onRefresh}>
              Refresh
            </button>
          </div>

          <div style={styles.auditToolbar}>
            {([
              ["all", "All activity"],
              ["access", "Access changes"],
              ["credentials", "Credentials"],
              ["status", "Suspensions"]
            ] as Array<[AuditScope, string]>).map(([scope, label]) => (
              <button
                key={scope}
                type="button"
                onClick={() => setAuditScope(scope)}
                style={{ ...styles.filterButton, ...(auditScope === scope ? styles.filterButtonActive : {}) }}
              >
                {label}
              </button>
            ))}
            <input
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.currentTarget.value)}
              placeholder="Search audit entries"
              style={{ ...styles.input, minWidth: 240, flex: 1 }}
            />
          </div>

          {loading ? <div style={styles.emptyState}>Loading employee workspace...</div> : null}
          {error ? <div style={{ ...styles.feedback, ...feedbackToneStyles.danger }}>{error}</div> : null}

          <div style={styles.auditList}>
            {filteredAudit.length ? (
              filteredAudit.map((log) => (
                <article key={log._id} style={styles.auditRow}>
                  <div style={styles.auditRowTop}>
                    <div>
                      <div style={styles.auditTitle}>{formatAuditTitle(log)}</div>
                      <div style={styles.auditBody}>{summarizeAudit(log)}</div>
                    </div>
                    <span style={styles.auditAction}>{log.action}</span>
                  </div>
                  <div style={styles.auditMeta}>
                    <span>Actor: {log.actorId}</span>
                    <span>Entity: {log.entityId}</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </article>
              ))
            ) : (
              <div style={styles.emptyState}>No audit events match the current filter.</div>
            )}
          </div>
        </section>
      </div>
    </DashboardCard>
  );
}

function createDraft(role: UserRole): DraftEmployee {
  return {
    fullName: "",
    phone: "",
    branchId: "",
    role,
    roleLabel: formatPresetLabel(role),
    permissions: [...ROLE_ACCESS[role]],
    isActive: true,
    password: "",
    pin: ""
  };
}

function employeeToDraft(employee: EmployeeRecord): DraftEmployee {
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

function selectEmployee(
  employee: EmployeeRecord,
  setMode: React.Dispatch<React.SetStateAction<"create" | "edit">>,
  setSelectedEmployeeId: React.Dispatch<React.SetStateAction<string | null>>,
  setDraft: React.Dispatch<React.SetStateAction<DraftEmployee>>,
  setResetPassword: React.Dispatch<React.SetStateAction<string>>,
  setResetPin: React.Dispatch<React.SetStateAction<string>>,
  setSuspendReason: React.Dispatch<React.SetStateAction<string>>
) {
  setMode("edit");
  setSelectedEmployeeId(employee._id);
  setDraft(employeeToDraft(employee));
  setResetPassword("");
  setResetPin("");
  setSuspendReason(employee.suspensionReason ?? "");
}

function startCreate(
  setMode: React.Dispatch<React.SetStateAction<"create" | "edit">>,
  setSelectedEmployeeId: React.Dispatch<React.SetStateAction<string | null>>,
  setDraft: React.Dispatch<React.SetStateAction<DraftEmployee>>,
  setResetPassword: React.Dispatch<React.SetStateAction<string>>,
  setResetPin: React.Dispatch<React.SetStateAction<string>>,
  setSuspendReason: React.Dispatch<React.SetStateAction<string>>
) {
  setMode("create");
  setSelectedEmployeeId(null);
  setDraft(createDraft("cashier"));
  setResetPassword("");
  setResetPin("");
  setSuspendReason("");
}

function applyPreset(role: UserRole, setDraft: React.Dispatch<React.SetStateAction<DraftEmployee>>) {
  setDraft((current) => ({
    ...current,
    role,
    roleLabel: formatPresetLabel(role),
    permissions: [...ROLE_ACCESS[role]]
  }));
}

function togglePermission(current: AccessPermission[], permission: AccessPermission) {
  if (permission === "manageSettings" || permission === "manageEmployees") {
    // Keep the control surface permissive; these can still be removed manually from a custom preset.
  }

  if (current.includes(permission)) {
    return current.filter((item) => item !== permission);
  }

  return [...current, permission];
}

function normalizeValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function confirmDialog(message: string) {
  return typeof globalThis !== "undefined" && "confirm" in globalThis
    ? (globalThis as { confirm?: (value: string) => boolean }).confirm?.(message) ?? true
    : true;
}

function presetNameFor(role: UserRole, permissions: AccessPermission[]) {
  const current = permissions.slice().sort().join("|");
  const preset = (Object.keys(ROLE_ACCESS) as UserRole[]).find((candidate) => ROLE_ACCESS[candidate].slice().sort().join("|") === current);
  return preset ? formatPresetLabel(preset) : role === "owner" ? "Business Owner" : "Custom";
}

function matchesAuditScope(action: string, scope: AuditScope) {
  if (scope === "all") {
    return true;
  }

  if (scope === "access") {
    return action === "employee.create" || action === "employee.update";
  }

  if (scope === "credentials") {
    return action === "employee.reset_credentials";
  }

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
  const safe = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
  const role = safe(payload.role) ?? safe(payload.roleLabel);
  const fullName = safe(payload.fullName) ?? "Employee";

  switch (log.action) {
    case "employee.create":
      return `${fullName} was added${role ? ` as ${role}` : ""}.`;
    case "employee.update":
      return `${fullName} permissions and profile details were updated.`;
    case "employee.suspend":
      return `${fullName} was suspended${safe(payload.reason) ? ` because "${payload.reason}"` : ""}.`;
    case "employee.restore":
      return `${fullName} was restored to active access.`;
    case "employee.reset_credentials":
      return `${fullName} had credentials reset${payload.passwordReset ? " with a password change" : ""}${payload.pinReset ? " and PIN refresh" : ""}.`;
    case "employee.delete":
      return `${fullName} was removed from active access.`;
    default:
      return JSON.stringify(payload);
  }
}

const feedbackToneStyles = {
  success: {
    borderColor: "rgba(16,185,129,0.35)",
    background: "rgba(16,185,129,0.12)",
    color: "var(--text)"
  },
  warning: {
    borderColor: "rgba(245,158,11,0.35)",
    background: "rgba(245,158,11,0.12)",
    color: "var(--text)"
  },
  danger: {
    borderColor: "rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.12)",
    color: "var(--text)"
  }
} as const;

const styles = {
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12
  },
  metricPill: {
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 14px",
    display: "grid",
    gap: 4
  },
  metricLabel: {
    color: "var(--text-muted)",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  metricValue: {
    fontSize: 20,
    fontFamily: "var(--font-grotesk)",
    fontWeight: 700
  },
  feedback: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid",
    fontSize: 14,
    lineHeight: 1.5
  },
  workspaceGrid: {
    display: "grid",
    gridTemplateColumns: "1.05fr 1.15fr",
    gap: 16
  },
  panel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.02)"
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    fontFamily: "var(--font-grotesk)"
  },
  panelSubtitle: {
    color: "var(--text-secondary)",
    fontSize: 13,
    lineHeight: 1.5,
    marginTop: 4
  },
  list: {
    display: "grid",
    gap: 10,
    maxHeight: 620,
    overflow: "auto",
    paddingRight: 2
  },
  employeeRow: {
    width: "100%",
    textAlign: "left" as const,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    background: "rgba(255,255,255,0.02)",
    padding: 14,
    display: "grid",
    gap: 10,
    cursor: "pointer"
  },
  employeeRowSelected: {
    borderColor: "rgba(59,130,246,0.45)",
    background: "rgba(59,130,246,0.12)"
  },
  employeeRowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start"
  },
  employeeName: {
    fontWeight: 800,
    fontSize: 16
  },
  employeeSubline: {
    marginTop: 4,
    color: "var(--text-muted)",
    fontSize: 13,
    lineHeight: 1.4
  },
  statusBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap" as const
  },
  statusActive: {
    background: "rgba(16,185,129,0.12)",
    color: "var(--text)"
  },
  statusSuspended: {
    background: "rgba(245,158,11,0.12)",
    color: "var(--text)"
  },
  employeeMetaRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8
  },
  metaChip: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--text-secondary)"
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(10,16,28,0.96)",
    color: "var(--text)",
    padding: "12px 14px",
    outline: "none"
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "var(--text-secondary)",
    fontSize: 14
  },
  presetRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8
  },
  chipButton: {
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer"
  },
  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8
  },
  permissionChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--text-secondary)"
  },
  permissionChipActive: {
    borderColor: "rgba(59,130,246,0.35)",
    background: "rgba(59,130,246,0.08)",
    color: "var(--text)"
  },
  helperRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12
  },
  helperLabel: {
    color: "var(--text-muted)",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  helperValue: {
    marginTop: 4,
    fontWeight: 700
  },
  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #2563eb, #38bdf8)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer"
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: "12px 16px",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    fontWeight: 700,
    cursor: "pointer"
  },
  dangerButton: {
    border: "1px solid rgba(239,68,68,0.35)",
    borderRadius: 14,
    padding: "12px 16px",
    background: "rgba(239,68,68,0.12)",
    color: "var(--text)",
    fontWeight: 800,
    cursor: "pointer"
  },
  credentialBlock: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)"
  },
  dangerActions: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(239,68,68,0.28)",
    background: "rgba(239,68,68,0.08)"
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10
  },
  blockTitle: {
    fontWeight: 800,
    fontSize: 14
  },
  auditShell: {
    display: "grid",
    gap: 14
  },
  auditToolbar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    alignItems: "center"
  },
  filterButton: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--text-secondary)",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer"
  },
  filterButtonActive: {
    background: "rgba(59,130,246,0.15)",
    borderColor: "rgba(59,130,246,0.35)",
    color: "var(--text)"
  },
  auditList: {
    display: "grid",
    gap: 10,
    maxHeight: 440,
    overflow: "auto"
  },
  auditRow: {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)"
  },
  auditRowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start"
  },
  auditTitle: {
    fontWeight: 800
  },
  auditBody: {
    color: "var(--text-secondary)",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 1.4
  },
  auditAction: {
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "var(--text-muted)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "6px 10px",
    whiteSpace: "nowrap" as const
  },
  auditMeta: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    color: "var(--text-muted)",
    fontSize: 12
  },
  emptyState: {
    padding: 16,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.12)",
    color: "var(--text-secondary)",
    background: "rgba(255,255,255,0.02)"
  },
  ownerNote: {
    marginTop: 6,
    color: "var(--text-muted)",
    fontSize: 12
  }
} as const;
