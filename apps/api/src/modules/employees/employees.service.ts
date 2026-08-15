import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Model } from "mongoose";
import { ACCESS_PERMISSIONS, ROLE_ACCESS, ROLE_PRESETS, formatRoleLabel, type AccessPermission, type UserRole } from "@vbo/shared";
import { AuditLog, AuditLogDocument, User, UserDocument } from "../schemas";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";

type EmployeeInput = {
  businessId: string;
  branchId?: string | null;
  fullName: string;
  phone?: string | null;
  password: string;
  pin?: string | null;
  role: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive?: boolean;
};

type EmployeePatch = {
  branchId?: string | null;
  fullName?: string;
  phone?: string | null;
  role?: UserRole;
  roleLabel?: string | null;
  permissions?: AccessPermission[] | null;
  isActive?: boolean;
};

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>
  ) {}

  async list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const employees = await this.userModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
    return employees.map((employee) => this.sanitizeEmployee(employee));
  }

  async listAuditLogs(businessId: string) {
    return this.auditLogModel.find({ businessId, entityType: "employee" }).sort({ createdAt: -1 }).limit(100).lean();
  }

  async create(actor: { sub: string; businessId: string; role?: string }, input: EmployeeInput) {
    const branchId = resolveWriteBranchId({ role: actor.role ?? null, branchId: input.branchId ?? null }, input.branchId ?? null);
    const ownerId = await this.resolveBusinessOwnerId(input.businessId);
    const permissions = this.normalizePermissions(input.role, input.permissions);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const pinHash = input.pin?.trim() ? await bcrypt.hash(input.pin.trim(), 10) : null;
    const roleLabel = this.normalizeRoleLabel(input.role, input.roleLabel);
    const employee = await this.userModel.create({
      businessId: input.businessId,
      ownerId,
      branchId,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() ?? null,
      passwordHash,
      pinHash,
      role: input.role,
      roleLabel,
      permissions,
      isActive: input.isActive ?? true,
      suspendedAt: null,
      suspensionReason: null,
      deletedAt: null
    });
    await this.audit(actor, input.businessId, employee._id.toString(), "employee.create", {
      fullName: employee.fullName,
      role: employee.role,
      roleLabel: employee.roleLabel,
      ownerId: employee.ownerId ?? null,
      permissions: employee.permissions ?? [],
      isActive: employee.isActive
    });
    return this.sanitizeEmployee(employee.toObject());
  }

  async update(actor: { sub: string; businessId: string; role?: string; branchId?: string | null }, id: string, input: EmployeePatch) {
    const branchId = resolveReadBranchId({ role: actor.role ?? null, branchId: actor.branchId ?? null }, input.branchId ?? null);
    const employee = await this.userModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null, ...buildBranchMatch(branchId) });
    if (!employee) throw new NotFoundException("Employee not found");

    if (input.role === "owner" && actor.role !== "owner") {
      throw new BadRequestException("Only the business owner can assign owner access");
    }

    if (typeof input.fullName === "string") employee.fullName = input.fullName.trim();
    if (input.phone !== undefined) employee.phone = input.phone?.trim() || null;
    if (input.branchId !== undefined && actor.role === "owner") employee.branchId = input.branchId ?? null;
    if (input.role) employee.role = input.role;
    if (input.roleLabel !== undefined) employee.roleLabel = input.roleLabel?.trim() || null;
    if (input.permissions !== undefined) employee.permissions = this.normalizePermissions(employee.role, input.permissions);
    if (employee.role !== "owner" && !employee.ownerId) {
      employee.ownerId = await this.resolveBusinessOwnerId(employee.businessId);
    }
    if (typeof input.isActive === "boolean") {
      employee.isActive = input.isActive;
      employee.suspendedAt = input.isActive ? null : new Date();
      employee.suspensionReason = input.isActive ? null : employee.suspensionReason ?? "Updated by admin";
    }

    await employee.save();
    await this.audit(actor, employee.businessId, employee._id.toString(), "employee.update", {
      fullName: employee.fullName,
      role: employee.role,
      roleLabel: employee.roleLabel,
      ownerId: employee.ownerId ?? null,
      permissions: employee.permissions ?? [],
      isActive: employee.isActive,
      branchId: employee.branchId ?? null
    });
    return this.sanitizeEmployee(employee.toObject());
  }

  async suspend(actor: { sub: string; businessId: string; role?: string; branchId?: string | null }, id: string, reason?: string | null) {
    const employee = await this.userModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null, ...buildBranchMatch(resolveReadBranchId({ role: actor.role ?? null, branchId: actor.branchId ?? null }, actor.branchId ?? null)) });
    if (!employee) throw new NotFoundException("Employee not found");
    if (String(employee._id) === actor.sub) throw new BadRequestException("You cannot suspend your own account");
    employee.isActive = false;
    employee.suspendedAt = new Date();
    employee.suspensionReason = reason?.trim() || "Suspended by owner";
    await employee.save();
    await this.audit(actor, employee.businessId, employee._id.toString(), "employee.suspend", {
      reason: employee.suspensionReason
    });
    return this.sanitizeEmployee(employee.toObject());
  }

  async restore(actor: { sub: string; businessId: string; role?: string; branchId?: string | null }, id: string) {
    const employee = await this.userModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null, ...buildBranchMatch(resolveReadBranchId({ role: actor.role ?? null, branchId: actor.branchId ?? null }, actor.branchId ?? null)) });
    if (!employee) throw new NotFoundException("Employee not found");
    employee.isActive = true;
    employee.suspendedAt = null;
    employee.suspensionReason = null;
    await employee.save();
    await this.audit(actor, employee.businessId, employee._id.toString(), "employee.restore", {});
    return this.sanitizeEmployee(employee.toObject());
  }

  async remove(actor: { sub: string; businessId: string; role?: string; branchId?: string | null }, id: string) {
    const employee = await this.userModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null, ...buildBranchMatch(resolveReadBranchId({ role: actor.role ?? null, branchId: actor.branchId ?? null }, actor.branchId ?? null)) });
    if (!employee) throw new NotFoundException("Employee not found");
    if (String(employee._id) === actor.sub) throw new BadRequestException("You cannot delete your own account");
    employee.deletedAt = new Date();
    employee.isActive = false;
    employee.suspendedAt = new Date();
    employee.suspensionReason = "Deleted by owner";
    await employee.save();
    await this.audit(actor, employee.businessId, employee._id.toString(), "employee.delete", {});
    return this.sanitizeEmployee(employee.toObject());
  }

  async resetCredentials(actor: { sub: string; businessId: string; role?: string; branchId?: string | null }, id: string, input: { password?: string | null; pin?: string | null }) {
    const employee = await this.userModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null, ...buildBranchMatch(resolveReadBranchId({ role: actor.role ?? null, branchId: actor.branchId ?? null }, actor.branchId ?? null)) });
    if (!employee) throw new NotFoundException("Employee not found");

    let tempPassword: string | null = null;
    if (!input.password?.trim() && !input.pin?.trim()) {
      tempPassword = this.generateTemporaryPassword();
      employee.passwordHash = await bcrypt.hash(tempPassword, 10);
    } else if (input.password?.trim()) {
      employee.passwordHash = await bcrypt.hash(input.password.trim(), 10);
    }

    if (input.pin !== undefined) {
      const trimmedPin = input.pin?.trim() || null;
      employee.pinHash = trimmedPin ? await bcrypt.hash(trimmedPin, 10) : null;
    }

    await employee.save();
    await this.audit(actor, employee.businessId, employee._id.toString(), "employee.reset_credentials", {
      passwordReset: Boolean(input.password?.trim() || tempPassword),
      pinReset: input.pin !== undefined
    });

    return {
      employee: this.sanitizeEmployee(employee.toObject()),
      temporaryPassword: tempPassword
    };
  }

  catalog() {
    return {
      permissions: ACCESS_PERMISSIONS,
      roles: ROLE_PRESETS.map((preset) => ({
        role: preset.role,
        label: preset.label,
        description: preset.description,
        permissions: [...preset.permissions]
      }))
    };
  }

  private normalizePermissions(role: UserRole, permissions?: AccessPermission[] | null) {
    if (role === "owner") return [...ACCESS_PERMISSIONS];
    if (permissions === undefined || permissions === null) return ROLE_ACCESS[role];
    return [...new Set(permissions)];
  }

  private normalizeRoleLabel(role: UserRole, roleLabel?: string | null) {
    if (roleLabel?.trim()) return roleLabel.trim();
    return formatRoleLabel(role);
  }

  private generateTemporaryPassword() {
    return randomBytes(6).toString("hex");
  }

  private async resolveBusinessOwnerId(businessId: string) {
    const owner = await this.userModel.findOne({ businessId, role: "owner", deletedAt: null }).select("_id ownerId").lean();
    if (!owner?._id) {
      throw new NotFoundException("Business owner not found");
    }
    return owner.ownerId ? String(owner.ownerId) : String(owner._id);
  }

  private sanitizeEmployee(employee: object) {
    const { passwordHash, pinHash, ...rest } = employee as { passwordHash?: unknown; pinHash?: unknown; [key: string]: unknown };
    return rest;
  }

  private async audit(
    actor: { sub: string; businessId: string; role?: string },
    businessId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>
  ) {
    await this.auditLogModel.create({
      businessId,
      actorId: actor.sub,
      entityType: "employee",
      entityId,
      action,
      payload
    });
  }
}
