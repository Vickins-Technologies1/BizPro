import { fetchJson } from "./api";
import { ACCESS_PERMISSIONS, ROLE_ACCESS, ROLE_PRESETS, formatRoleLabel, type AccessPermission, type UserRole } from "@vbo/shared";

export type AdminBusiness = {
  _id: string;
  externalId?: string | null;
  name: string;
  slug: string;
  businessType: string;
  currency: string;
  planTier: string;
  billingStatus: string;
  createdAt: string;
};

export function resolveBusinessId(business: AdminBusiness) {
  return business.externalId ?? business._id;
}

export type AdminDevice = {
  _id: string;
  deviceName: string;
  platform: string;
  trusted: boolean;
  lastSeenAt?: string | null;
};

export type AdminSubscription = {
  _id: string;
  planCode: string;
  status: string;
  expiresAt?: string | null;
};

export type AdminSyncHealth = {
  pendingEvents: number;
  checkpoints: Array<{ lastPulledAt?: string | null; lastPushedAt?: string | null; serverCursor?: string | null }>;
};

export type AdminReconciliationLog = {
  _id: string;
  reference: string;
  status: string;
  createdAt: string;
};

export type PermissionCatalog = {
  permissions: AccessPermission[];
  roles: Array<{ role: UserRole; label: string; description?: string; permissions: AccessPermission[] }>;
};

export type EmployeeRecord = {
  _id: string;
  businessId: string;
  ownerId?: string | null;
  branchId?: string | null;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuditLogRecord = {
  _id: string;
  businessId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type EmployeeCreateInput = {
  fullName: string;
  phone?: string | null;
  branchId?: string | null;
  password: string;
  pin?: string | null;
  role: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive?: boolean;
};

export type EmployeeUpdateInput = {
  fullName?: string;
  phone?: string | null;
  branchId?: string | null;
  role?: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive?: boolean;
};

export function buildPermissionSet(role: UserRole, permissions?: AccessPermission[] | null) {
  if (permissions !== undefined && permissions !== null) {
    return [...new Set(permissions)];
  }
  return [...ROLE_ACCESS[role]];
}

export async function listBusinesses() {
  return fetchJson<AdminBusiness[]>("/businesses");
}

export async function listBusinessEmployees(businessId: string) {
  return fetchJson<EmployeeRecord[]>(`/support/employees?businessId=${encodeURIComponent(businessId)}`);
}

export async function getEmployeeCatalog() {
  return fetchJson<PermissionCatalog>("/support/employees/catalog");
}

export async function listBusinessAuditLogs(businessId: string) {
  return fetchJson<AuditLogRecord[]>(`/audit?businessId=${encodeURIComponent(businessId)}`);
}

export async function createBusinessEmployee(businessId: string, input: EmployeeCreateInput) {
  return fetchJson<EmployeeRecord>(`/support/employees?businessId=${encodeURIComponent(businessId)}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateBusinessEmployee(businessId: string, employeeId: string, input: EmployeeUpdateInput) {
  return fetchJson<EmployeeRecord>(`/support/employees/${encodeURIComponent(employeeId)}?businessId=${encodeURIComponent(businessId)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function suspendBusinessEmployee(businessId: string, employeeId: string, reason?: string | null) {
  return fetchJson<EmployeeRecord>(`/support/employees/${encodeURIComponent(employeeId)}/suspend?businessId=${encodeURIComponent(businessId)}`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "" })
  });
}

export async function restoreBusinessEmployee(businessId: string, employeeId: string) {
  return fetchJson<EmployeeRecord>(`/support/employees/${encodeURIComponent(employeeId)}/restore?businessId=${encodeURIComponent(businessId)}`, {
    method: "POST"
  });
}

export async function resetBusinessEmployeeCredentials(
  businessId: string,
  employeeId: string,
  input: { password?: string | null; pin?: string | null }
) {
  return fetchJson<{ employee: EmployeeRecord; temporaryPassword: string | null }>(
    `/support/employees/${encodeURIComponent(employeeId)}/reset-credentials?businessId=${encodeURIComponent(businessId)}`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export async function deleteBusinessEmployee(businessId: string, employeeId: string) {
  return fetchJson<EmployeeRecord>(`/support/employees/${encodeURIComponent(employeeId)}?businessId=${encodeURIComponent(businessId)}`, {
    method: "DELETE"
  });
}

export function formatPresetLabel(role: UserRole) {
  return role === "owner" ? "Business Owner" : formatRoleLabel(role);
}

export function cloneRolePermissions(role: UserRole) {
  return [...ROLE_ACCESS[role]];
}

export function summarizePermissions(permissions: AccessPermission[] | null | undefined) {
  const active = permissions ?? [];
  return `${active.length}/${ACCESS_PERMISSIONS.length}`;
}
