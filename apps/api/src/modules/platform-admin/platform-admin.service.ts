import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model, Types } from "mongoose";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  AuditLog, Business, Device, PaymentReconciliationLog, Subscription, SubscriptionPlan,
  SyncCheckpoint, SyncEvent, User, type BusinessDocument, type DeviceDocument,
  type PaymentReconciliationLogDocument, type SubscriptionDocument, type SubscriptionPlanDocument,
  type SyncCheckpointDocument, type SyncEventDocument, type UserDocument
} from "../schemas";
import { BusinessesService } from "../businesses/businesses.service";
import { EmployeesService } from "../employees/employees.service";
import { DevicesService } from "../devices/devices.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { SyncService } from "../sync/sync.service";
import {
  PlatformAdminAuditLog, PlatformAdminLoginEvent, PlatformRequestMetric, PlatformSettings,
  PlatformSupportTicket, PlatformSystemError, type PlatformAdminAuditLogDocument,
  type PlatformAdminLoginEventDocument, type PlatformRequestMetricDocument,
  type PlatformSettingsDocument, type PlatformSupportTicketDocument, type PlatformSystemErrorDocument
} from "./platform-admin.schemas";
import { PlatformAdminIdentity } from "../../common/platform-admin.guard";
import { redactSensitiveText } from "../../common/secret-redaction";

const PAGE_MAX = 100;
const STATUS_VALUES = ["TRIAL", "ACTIVE", "EXPIRED", "PAST_DUE", "CANCELLED"] as const;

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name) private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(SyncEvent.name) private readonly syncEventModel: Model<SyncEventDocument>,
    @InjectModel(SyncCheckpoint.name) private readonly checkpointModel: Model<SyncCheckpointDocument>,
    @InjectModel(PaymentReconciliationLog.name) private readonly reconciliationModel: Model<PaymentReconciliationLogDocument>,
    @InjectModel(PlatformAdminAuditLog.name) private readonly adminAuditModel: Model<PlatformAdminAuditLogDocument>,
    @InjectModel(PlatformAdminLoginEvent.name) private readonly loginEventModel: Model<PlatformAdminLoginEventDocument>,
    @InjectModel(PlatformSystemError.name) private readonly errorModel: Model<PlatformSystemErrorDocument>,
    @InjectModel(PlatformRequestMetric.name) private readonly metricModel: Model<PlatformRequestMetricDocument>,
    @InjectModel(PlatformSettings.name) private readonly settingsModel: Model<PlatformSettingsDocument>,
    @InjectModel(PlatformSupportTicket.name) private readonly ticketModel: Model<PlatformSupportTicketDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<any>,
    @InjectConnection() private readonly connection: Connection,
    private readonly businesses: BusinessesService,
    private readonly employees: EmployeesService,
    private readonly devices: DevicesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly sync: SyncService
  ) {}

  async dashboard(range = "30d") {
    const since = this.rangeStart(range);
    const now = new Date();
    const [businessTotal, activeBusinesses, suspendedBusinesses, newBusinesses, industries, userTotal, employeeTotal, suspendedUsers, subscriptionCounts, planCounts, deviceTotal, activeDevices, pendingSync, failedSync, unresolvedErrors, latestErrors, latestAudit, metrics, reconciliationCount] = await Promise.all([
      this.businessModel.countDocuments({ deletedAt: null }),
      this.businessModel.countDocuments({ deletedAt: null, billingStatus: "active" }),
      this.businessModel.countDocuments({ deletedAt: null, billingStatus: "suspended" }),
      this.businessModel.countDocuments({ deletedAt: null, createdAt: { $gte: since } }),
      this.businessModel.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: { $ifNull: ["$industryKey", "$businessType"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      this.userModel.countDocuments({ deletedAt: null }),
      this.userModel.countDocuments({ deletedAt: null, role: { $ne: "owner" } }),
      this.userModel.countDocuments({ deletedAt: null, isActive: false }),
      this.subscriptionModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.subscriptionModel.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$planCode", count: { $sum: 1 }, expectedMonthlyAmount: { $sum: "$monthlyPrice" } } }]),
      this.deviceModel.countDocuments({ deletedAt: null }),
      this.deviceModel.countDocuments({ deletedAt: null, lastSeenAt: { $gte: new Date(now.getTime() - 7 * 86400000) } }),
      this.syncEventModel.countDocuments({ status: "pending" }),
      this.syncEventModel.countDocuments({ status: "failed" }),
      this.errorModel.countDocuments({ status: { $ne: "resolved" } }),
      this.errorModel.find({}).sort({ lastOccurrence: -1 }).limit(8).lean(),
      this.adminAuditModel.find({}).sort({ createdAt: -1 }).limit(8).lean(),
      this.metricModel.find({ bucketStart: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } }).lean(),
      this.reconciliationModel.countDocuments({})
    ]);
    const requestCount = metrics.reduce((sum, row) => sum + row.requestCount, 0);
    const errorCount = metrics.reduce((sum, row) => sum + row.errorCount, 0);
    const duration = metrics.reduce((sum, row) => sum + row.totalDurationMs, 0);
    const subscriptionsByStatus = Object.fromEntries(subscriptionCounts.map((row: { _id: string; count: number }) => [row._id, row.count]));
    return {
      generatedAt: now.toISOString(),
      range,
      businesses: { total: businessTotal, active: activeBusinesses, suspended: suspendedBusinesses, newInRange: newBusinesses, byIndustry: industries.map((row: { _id: string; count: number }) => ({ industry: row._id || "Unspecified", count: row.count })) },
      users: { totalRegistered: userTotal, employees: employeeTotal, suspendedAccounts: suspendedUsers, dailyActive: unavailable("No reliable user activity events are stored yet"), monthlyActive: unavailable("No reliable user activity events are stored yet") },
      subscriptions: { byStatus: subscriptionsByStatus, active: subscriptionsByStatus.ACTIVE ?? 0, expired: subscriptionsByStatus.EXPIRED ?? 0, trial: subscriptionsByStatus.TRIAL ?? 0, planDistribution: planCounts, expectedMonthlyValue: { available: true, amount: planCounts.reduce((sum: number, row: { expectedMonthlyAmount: number }) => sum + row.expectedMonthlyAmount, 0), basis: "Active subscription list price; not recognized revenue" } },
      payments: { received: unavailable("The current repository has no verified platform subscription payment ledger"), failed: unavailable("The current repository has no verified platform subscription payment ledger"), pending: unavailable("The current repository has no verified platform subscription payment ledger"), reconciliationRecords: reconciliationCount },
      devices: { total: deviceTotal, activeLast7Days: activeDevices, offlineOrInactive: Math.max(0, deviceTotal - activeDevices), inactivityWindowDays: 7 },
      synchronization: { pending: pendingSync, failed: failedSync },
      errors: { unresolved: unresolvedErrors, recent: latestErrors },
      api: { processAvailability: this.connection.readyState === 1 ? "healthy" : "unavailable", database: this.connection.readyState === 1 ? "connected" : "unavailable", requestCountLastHour: requestCount, errorCountLastHour: errorCount, averageResponseMs: requestCount ? Math.round(duration / requestCount) : null, errorRate: requestCount ? errorCount / requestCount : null, uptime: unavailable("No external uptime monitor is configured") },
      recentActivity: latestAudit
    };
  }

  async listBusinesses(query: { page?: number | undefined; limit?: number | undefined; search?: string | undefined; industry?: string | undefined; status?: string | undefined; subscriptionStatus?: string | undefined; from?: string | undefined; to?: string | undefined }) {
    const page = this.page(query.page); const limit = this.limit(query.limit);
    const match: Record<string, unknown> = { deletedAt: null };
    const clauses: unknown[] = [];
    if (query.search?.trim()) {
      const safe = escapeRegex(query.search.trim().slice(0, 100));
      clauses.push({ $or: [{ name: { $regex: safe, $options: "i" } }, { slug: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }, { phone: { $regex: safe, $options: "i" } }] });
    }
    if (query.industry) clauses.push({ $or: [{ industryKey: query.industry }, { businessType: query.industry }] });
    if (clauses.length) match.$and = clauses;
    if (query.status) match.billingStatus = query.status;
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from && Number.isFinite(Date.parse(query.from))) createdAt.$gte = new Date(query.from);
      if (query.to && Number.isFinite(Date.parse(query.to))) createdAt.$lte = new Date(query.to);
      if (Object.keys(createdAt).length) match.createdAt = createdAt;
    }
    const basePipeline: any[] = [
      { $match: match },
      { $addFields: { resolvedBusinessId: { $ifNull: ["$externalId", { $toString: "$_id" }] } } },
      { $lookup: { from: "subscriptions", let: { bid: "$resolvedBusinessId" }, pipeline: [{ $match: { $expr: { $eq: ["$businessId", "$$bid"] } } }, { $sort: { createdAt: -1 } }, { $limit: 1 }], as: "currentSubscription" } },
      { $addFields: { currentSubscription: { $arrayElemAt: ["$currentSubscription", 0] } } }
    ];
    if (query.subscriptionStatus) basePipeline.push({ $match: { "currentSubscription.status": query.subscriptionStatus.toUpperCase() } });
    const [facet] = await this.businessModel.aggregate([...basePipeline, { $facet: { rows: [{ $sort: { createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: "count" }] } }]);
    const rows = facet?.rows ?? [];
    const ids = rows.map((business: any) => business.resolvedBusinessId);
    const owners = ids.length ? await this.userModel.find({ businessId: { $in: ids }, role: "owner", deletedAt: null }).select("businessId fullName phone").lean() : [];
    const ownerByBusiness = new Map(owners.map((owner: any) => [owner.businessId, { name: owner.fullName, phone: owner.phone ?? null }]));
    return { items: rows.map((row: any) => ({ ...row, owner: ownerByBusiness.get(row.resolvedBusinessId) ?? null })), page, limit, total: facet?.total?.[0]?.count ?? 0 };
  }

  async businessDetail(id: string) {
    const { business, branches } = await this.businesses.get(id);
    const businessId = String(business.externalId ?? business._id);
    const [employees, deviceRows, subscription, sync, payments, activity] = await Promise.all([
      this.employees.list(businessId), this.devices.list(businessId), this.subscriptions.current(businessId),
      this.syncOverview(businessId), this.reconciliationModel.find({ businessId }).sort({ createdAt: -1 }).limit(100).lean(),
      this.auditLogModel.find({ businessId }).sort({ createdAt: -1 }).limit(100).lean()
    ]);
    const owner = employees.find((employee: any) => employee.role === "owner") ?? null;
    return { business, businessId, owner, branches, employees, devices: deviceRows, subscription, synchronization: sync, payments: { available: false, records: payments, reason: "These are reconciliation logs, not a verified subscription payment ledger" }, activity };
  }
  async businessActivity(id: string) {
    const businessId = await this.canonicalBusinessId(id);
    return this.auditLogModel.find({ businessId }).sort({ createdAt: -1 }).limit(250).lean();
  }

  async updateBusiness(id: string, patch: { name?: string; email?: string | null; phone?: string | null; address?: string | null; industryKey?: string | null }, admin: PlatformAdminIdentity, requestId?: string | null) {
    const before = await this.businesses.get(id);
    const allowed = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const updated = await this.businesses.update(id, allowed as any);
    await this.audit(admin, "business.update", "business", id, {
      changedFields: Object.keys(allowed),
      before: { name: before.business.name, email: before.business.email, phone: before.business.phone, address: before.business.address, industryKey: before.business.industryKey },
      after: { name: updated.name, email: updated.email, phone: updated.phone, address: updated.address, industryKey: updated.industryKey }
    }, requestId);
    return updated;
  }

  async suspendBusiness(id: string, reason: string | undefined, admin: PlatformAdminIdentity, requestId?: string | null) {
    const before = await this.businesses.get(id);
    const updated = await this.businesses.suspend(id, reason);
    await this.audit(admin, "business.suspend", "business", id, { before: { billingStatus: before.business.billingStatus }, after: { billingStatus: updated.billingStatus, reason: updated.platformSuspensionReason } }, requestId);
    return updated;
  }

  async restoreBusiness(id: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    const before = await this.businesses.get(id);
    const updated = await this.businesses.reactivate(id);
    await this.audit(admin, "business.restore", "business", id, { before: { billingStatus: before.business.billingStatus }, after: { billingStatus: updated.billingStatus } }, requestId);
    return updated;
  }

  async listEmployees(businessId: string) { return this.employees.list(await this.canonicalBusinessId(businessId)); }
  async createEmployee(businessId: string, input: any, admin: PlatformAdminIdentity, requestId?: string | null) {
    const canonicalId = await this.canonicalBusinessId(businessId);
    const employee = await this.employees.create({ sub: admin.id, businessId: canonicalId, role: "owner" }, { ...input, businessId: canonicalId });
    const employeeId = String((employee as any)._id ?? (employee as any).id ?? "unknown");
    await this.audit(admin, "employee.create", "employee", employeeId, { businessId: canonicalId, role: input.role, changedFields: ["identity", "role"] }, requestId);
    return employee;
  }
  async changeEmployee(businessId: string, employeeId: string, action: "update" | "suspend" | "restore" | "reset", input: any, admin: PlatformAdminIdentity, requestId?: string | null) {
    const canonicalId = await this.canonicalBusinessId(businessId);
    const actor = { sub: admin.id, businessId: canonicalId, role: "owner" };
    const updated = action === "update" ? await this.employees.update(actor, employeeId, input)
      : action === "suspend" ? await this.employees.suspend(actor, employeeId, input.reason)
        : action === "restore" ? await this.employees.restore(actor, employeeId)
          : await this.employees.resetCredentials(actor, employeeId, input);
    const safeFields = Object.keys(input ?? {}).filter((key) => !/password|pin|secret|token/i.test(key));
    await this.audit(admin, `employee.${action}`, "employee", employeeId, { businessId: canonicalId, changedFields: action === "reset" ? ["credentials"] : safeFields }, requestId);
    return updated;
  }
  async removeEmployee(businessId: string, employeeId: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    const canonicalId = await this.canonicalBusinessId(businessId);
    const result = await this.employees.remove({ sub: admin.id, businessId: canonicalId, role: "owner" }, employeeId);
    await this.audit(admin, "employee.remove", "employee", employeeId, { businessId: canonicalId }, requestId);
    return result;
  }

  listSubscriptions(query: { page?: number | undefined; limit?: number | undefined; status?: string | undefined; search?: string | undefined }) {
    const page = this.page(query.page); const limit = this.limit(query.limit); const filter: Record<string, unknown> = {};
    if (query.status && (STATUS_VALUES as readonly string[]).includes(query.status.toUpperCase())) filter.status = query.status.toUpperCase();
    if (query.search?.trim()) filter.businessId = { $regex: escapeRegex(query.search.trim().slice(0, 100)), $options: "i" };
    return this.paginate(this.subscriptionModel, filter, page, limit);
  }
  listPlans() { return this.subscriptions.plans(); }
  async setSubscriptionPlan(businessId: string, planCode: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(planCode)) throw new BadRequestException("Invalid subscription plan");
    const business = await this.businesses.get(businessId);
    const canonicalId = String(business.business.externalId ?? business.business._id);
    const before = await this.subscriptionModel.findOne({ businessId: canonicalId }).sort({ createdAt: -1 }).lean();
    const updated = await this.subscriptions.setPlan(canonicalId, planCode as any);
    await this.audit(admin, "subscription.plan_change", "subscription", canonicalId, { before: before ? { planCode: before.planCode, status: before.status, paymentStatus: before.paymentStatus } : null, after: { planCode: updated.planCode, status: updated.status, paymentStatus: updated.paymentStatus } }, requestId);
    return updated;
  }
  async extendSubscription(businessId: string, days: number, admin: PlatformAdminIdentity, requestId?: string | null) {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new BadRequestException("Extension must be between 1 and 365 days");
    const business = await this.businesses.get(businessId); const canonicalId = String(business.business.externalId ?? business.business._id);
    const subscription = await this.subscriptionModel.findOne({ businessId: canonicalId }).sort({ createdAt: -1 });
    if (!subscription) throw new NotFoundException("Subscription not found");
    const before = subscription.expiresAt ?? subscription.trialEndsAt ?? null;
    const from = before && before > new Date() ? before : new Date();
    subscription.expiresAt = new Date(from.getTime() + days * 86400000);
    if (subscription.status === "EXPIRED" || subscription.status === "TRIAL") subscription.status = "ACTIVE";
    await subscription.save();
    await this.audit(admin, "subscription.extend", "subscription", canonicalId, { before: { expiresAt: before, status: "unchanged-or-prior" }, after: { expiresAt: subscription.expiresAt, status: subscription.status, days } }, requestId);
    return subscription.toObject();
  }

  listDevices(query: { page?: number | undefined; limit?: number | undefined; search?: string | undefined; businessId?: string | undefined; status?: string | undefined }) {
    const page = this.page(query.page); const limit = this.limit(query.limit); const filter: Record<string, unknown> = { deletedAt: null };
    if (query.businessId) filter.businessId = query.businessId;
    if (query.search?.trim()) filter.$or = [{ deviceName: { $regex: escapeRegex(query.search.trim()), $options: "i" } }, { deviceKey: { $regex: escapeRegex(query.search.trim()), $options: "i" } }, { businessId: { $regex: escapeRegex(query.search.trim()), $options: "i" } }];
    if (query.status === "active") filter.lastSeenAt = { $gte: new Date(Date.now() - 7 * 86400000) };
    if (query.status === "inactive") filter.$or = [...(Array.isArray(filter.$or) ? filter.$or as unknown[] : []), { lastSeenAt: null }, { lastSeenAt: { $lt: new Date(Date.now() - 7 * 86400000) } }];
    return this.paginate(this.deviceModel, filter, page, limit, { updatedAt: -1 });
  }
  async revokeDevice(id: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    const device = await this.deviceModel.findOne({ $or: [{ _id: this.objectId(id) }, { deviceKey: id }], deletedAt: null });
    if (!device) throw new NotFoundException("Device not found");
    device.deletedAt = new Date(); await device.save();
    await this.audit(admin, "device.revoke", "device", id, { businessId: device.businessId, warning: "Future sync is blocked; unsynchronized data remains on the device" }, requestId);
    return { id, revokedAt: device.deletedAt, businessId: device.businessId, unsyncedLocalDataPreserved: true };
  }

  async listSyncEvents(query: { page?: number | undefined; limit?: number | undefined; status?: string | undefined; businessId?: string | undefined; deviceId?: string | undefined; search?: string | undefined }) {
    const page = this.page(query.page); const limit = this.limit(query.limit); const filter: Record<string, unknown> = {};
    if (query.status && ["pending", "failed", "applied", "retrying", "sent"].includes(query.status)) filter.status = query.status;
    if (query.businessId) filter.businessId = query.businessId;
    if (query.deviceId) filter.deviceId = query.deviceId;
    if (query.search?.trim()) filter.$or = [{ eventId: { $regex: escapeRegex(query.search.trim()), $options: "i" } }, { entityType: { $regex: escapeRegex(query.search.trim()), $options: "i" } }, { lastError: { $regex: escapeRegex(query.search.trim()), $options: "i" } }];
    return this.paginate(this.syncEventModel, filter, page, limit, { serverReceivedAt: -1 });
  }
  async listReconciliationLogs(query: { page?: number | undefined; limit?: number | undefined; businessId?: string | undefined; status?: string | undefined }) {
    const filter: any = {};
    if (query.businessId) filter.businessId = query.businessId;
    if (query.status) filter.status = query.status;
    return this.paginate(this.reconciliationModel, filter, this.page(query.page), this.limit(query.limit), { createdAt: -1 });
  }
  async retrySyncEvent(id: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    const result = await this.sync.retryFailedEvent(id);
    await this.audit(admin, "sync.retry", "sync_event", id, { businessId: result.businessId, deviceId: result.deviceId, status: result.status, retryCount: result.retryCount }, requestId);
    return result;
  }
  async syncOverview(businessId: string) {
    const [pending, failed, applied, checkpoints] = await Promise.all([
      this.syncEventModel.countDocuments({ businessId, status: "pending" }), this.syncEventModel.countDocuments({ businessId, status: "failed" }),
      this.syncEventModel.countDocuments({ businessId, status: "applied" }), this.checkpointModel.find({ businessId }).sort({ updatedAt: -1 }).lean()
    ]);
    return { pending, failed, applied, checkpoints, latestSuccessfulPush: latestDate(checkpoints.map((row) => row.lastPushedAt)), latestSuccessfulPull: latestDate(checkpoints.map((row) => row.lastPulledAt)), latestSuccessfulSync: latestDate(checkpoints.flatMap((row) => [row.lastPulledAt, row.lastPushedAt])) };
  }

  listErrors(query: { page?: number | undefined; limit?: number | undefined; status?: string | undefined; severity?: string | undefined; source?: string | undefined; search?: string | undefined }) {
    const page = this.page(query.page); const limit = this.limit(query.limit); const filter: Record<string, unknown> = {};
    if (query.status && ["open", "investigating", "resolved"].includes(query.status)) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.source) filter.source = query.source;
    if (query.search?.trim()) filter.$or = [{ title: { $regex: escapeRegex(query.search.trim()), $options: "i" } }, { message: { $regex: escapeRegex(query.search.trim()), $options: "i" } }, { businessId: query.search.trim() }];
    return this.paginate(this.errorModel, filter, page, limit, { lastOccurrence: -1 });
  }
  async getError(id: string) { const error = await this.errorModel.findOne({ $or: [{ errorId: id }, { _id: this.objectId(id) }] }).lean(); if (!error) throw new NotFoundException("Error record not found"); return error; }
  async updateError(id: string, input: { status?: string; assignedTo?: string | null; resolutionComment?: string | null }, admin: PlatformAdminIdentity, requestId?: string | null) {
    if (input.status && !["open", "investigating", "resolved"].includes(input.status)) throw new BadRequestException("Invalid incident status");
    const error = await this.errorModel.findOne({ $or: [{ errorId: id }, { _id: this.objectId(id) }] }); if (!error) throw new NotFoundException("Error record not found");
    const before = { status: error.status, assignedTo: error.assignedTo ?? null };
    if (input.status) error.status = input.status as any;
    if (input.assignedTo !== undefined) error.assignedTo = input.assignedTo?.trim() || null;
    if (input.resolutionComment !== undefined) error.resolutionComment = input.resolutionComment?.trim().slice(0, 2000) || null;
    await error.save(); await this.audit(admin, "incident.update", "error", id, { before, after: { status: error.status, assignedTo: error.assignedTo ?? null } }, requestId); return error.toObject();
  }
  async addErrorNote(id: string, body: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    const error = await this.errorModel.findOne({ $or: [{ errorId: id }, { _id: this.objectId(id) }] }); if (!error) throw new NotFoundException("Error record not found");
    const note = body.trim().slice(0, 4000); if (!note) throw new BadRequestException("Note cannot be empty");
    error.internalNotes.push({ adminId: admin.id, email: admin.email, body: note, createdAt: new Date() }); await error.save();
    await this.audit(admin, "incident.note", "error", id, { noteLength: note.length }, requestId);
    return error.toObject();
  }
  async ingestError(input: any) {
    const title = sanitize(input.title ?? input.message ?? "Application error", 240);
    const message = sanitize(input.message ?? title, 4000);
    const source = ["api", "mobile", "admin", "database", "sync", "background", "payment", "integration"].includes(input.source) ? input.source : "api";
    const severity = ["critical", "high", "medium", "low"].includes(input.severity) ? input.severity : "medium";
    const fingerprint = createHash("sha256").update(`${source}|${input.module ?? ""}|${title}|${message}`).digest("hex");
    const now = new Date(); const errorId = `err_${randomBytes(10).toString("hex")}`;
    const requestId = typeof input.requestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(input.requestId) ? input.requestId : null;
    return this.errorModel.findOneAndUpdate({ fingerprint, environment: sanitize(input.environment ?? process.env.NODE_ENV ?? "production", 40) }, { $set: { lastOccurrence: now, status: "open", requestId }, $inc: { occurrenceCount: 1 }, $setOnInsert: {
      errorId, fingerprint, title, message, severity, source, environment: sanitize(input.environment ?? process.env.NODE_ENV ?? "production", 40), module: input.module ? sanitize(input.module, 120) : null,
      endpoint: input.endpoint ? sanitize(input.endpoint, 240) : null, httpStatus: Number.isInteger(input.httpStatus) ? input.httpStatus : null,
      stackTrace: input.stackTrace ? sanitize(input.stackTrace, 12000) : null, businessId: safeId(input.businessId), deviceId: safeId(input.deviceId), appVersion: input.appVersion ? sanitize(input.appVersion, 80) : null,
      occurrenceCount: 0, firstOccurrence: now, lastOccurrence: now, assignedTo: null, internalNotes: []
    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  }

  async recordRequestMetric(input: { route: string; method: string; statusCode: number; durationMs: number; at?: Date }) {
    const at = input.at ?? new Date();
    const bucketStart = new Date(Math.floor(at.getTime() / 60_000) * 60_000);
    const route = sanitize(input.route, 240);
    const method = input.method.toUpperCase().slice(0, 10);
    const durationMs = Math.max(0, Math.min(120_000, Math.round(input.durationMs)));
    await this.metricModel.updateOne(
      { route, method, bucketStart },
      { $inc: { requestCount: 1, errorCount: input.statusCode >= 500 ? 1 : 0, totalDurationMs: durationMs }, $max: { maxDurationMs: durationMs }, $set: { lastStatusCode: input.statusCode } },
      { upsert: true }
    );
  }

  health() {
    return { checkedAt: new Date().toISOString(), apiProcess: "healthy", database: this.connection.readyState === 1 ? "healthy" : "unavailable", databaseReadyState: this.connection.readyState, externalUptime: unavailable("No external uptime monitor is configured"), backgroundJobs: unavailable("No background job runner is configured in this repository"), queue: unavailable("No queue service is configured in this repository"), webhooks: unavailable("Webhook processing is not aggregated into platform health yet"), email: unavailable("Delivery status is not persisted"), paymentCallbacks: unavailable("Callback processing is not aggregated into platform health yet") };
  }
  async apiMetrics(range = "1h") {
    const since = this.rangeStart(range); const rows = await this.metricModel.find({ bucketStart: { $gte: since } }).sort({ bucketStart: 1 }).lean();
    const byRoute = new Map<string, any>();
    for (const row of rows) { const key = `${row.method} ${row.route}`; const value = byRoute.get(key) ?? { route: row.route, method: row.method, requestCount: 0, errorCount: 0, durationMs: 0, maxDurationMs: 0 }; value.requestCount += row.requestCount; value.errorCount += row.errorCount; value.durationMs += row.totalDurationMs; value.maxDurationMs = Math.max(value.maxDurationMs, row.maxDurationMs); byRoute.set(key, value); }
    return { range, available: true, items: [...byRoute.values()].map((row) => ({ ...row, averageResponseMs: row.requestCount ? Math.round(row.durationMs / row.requestCount) : 0, errorRate: row.requestCount ? row.errorCount / row.requestCount : 0 })) };
  }
  async report(name: string, from?: string, to?: string) {
    const match = this.dateRangeMatch(from, to);
    if (name === "business-growth") return this.businessModel.aggregate([{ $match: { deletedAt: null, ...match } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    if (name === "subscriptions") return this.subscriptionModel.aggregate([{ $group: { _id: { status: "$status", plan: "$planCode" }, count: { $sum: 1 }, expectedMonthlyValue: { $sum: "$monthlyPrice" } } }, { $sort: { count: -1 } }]);
    if (name === "sync") return this.syncEventModel.aggregate([{ $match: match }, { $group: { _id: { status: "$status", entityType: "$entityType" }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    if (name === "errors") return this.errorModel.aggregate([{ $match: { ...match } }, { $group: { _id: { severity: "$severity", status: "$status", source: "$source" }, count: { $sum: "$occurrenceCount" } } }, { $sort: { count: -1 } }]);
    if (name === "api-performance") return this.apiMetrics("30d");
    if (name === "revenue" || name === "payments") return { available: false, reason: "The current repository has no verified platform subscription payment ledger; reconciliation logs are not recognized revenue", items: [] };
    if (name === "user-activity" || name === "employee-activity" || name === "retention" || name === "churn") return { available: false, reason: "The required activity and subscription history is not retained in the current data model", items: [] };
    throw new NotFoundException("Unknown report");
  }

  async listTickets(query: { page?: number | undefined; limit?: number | undefined; status?: string | undefined; priority?: string | undefined; search?: string | undefined }) { const filter: any = {}; if (query.status) filter.status = query.status; if (query.priority) filter.priority = query.priority; if (query.search) filter.$or = [{ subject: { $regex: escapeRegex(query.search.slice(0, 100)), $options: "i" } }, { ticketNumber: { $regex: escapeRegex(query.search.slice(0, 100)), $options: "i" } }]; return this.paginate(this.ticketModel, filter, this.page(query.page), this.limit(query.limit), { updatedAt: -1 }); }
  async createTicket(input: any, admin: PlatformAdminIdentity, requestId?: string | null) {
    const ticket = await this.ticketModel.create({ ticketNumber: `DIRA-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`, ...input, history: [{ actorId: admin.id, action: "created", createdAt: new Date() }], internalNotes: [] });
    await this.audit(admin, "support.ticket.create", "support_ticket", ticket.ticketNumber, { subject: ticket.subject, category: ticket.category }, requestId); return ticket.toObject();
  }
  async updateTicket(id: string, input: any, admin: PlatformAdminIdentity, requestId?: string | null) {
    const ticket = await this.ticketModel.findOne({ $or: [{ ticketNumber: id }, { _id: this.objectId(id) }] }); if (!ticket) throw new NotFoundException("Support ticket not found");
    const before = { status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo ?? null };
    const changes: any = {}; for (const key of ["status", "priority", "assignedTo"]) if (input[key] !== undefined) changes[key] = input[key];
    Object.assign(ticket, changes); ticket.history.push({ actorId: admin.id, action: "updated", createdAt: new Date(), details: Object.keys(changes).join(", ") }); await ticket.save();
    await this.audit(admin, "support.ticket.update", "support_ticket", ticket.ticketNumber, { before, after: { status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo ?? null } }, requestId);
    return ticket.toObject();
  }
  async addTicketNote(id: string, body: string, admin: PlatformAdminIdentity, requestId?: string | null) {
    const ticket = await this.ticketModel.findOne({ $or: [{ ticketNumber: id }, { _id: this.objectId(id) }] }); if (!ticket) throw new NotFoundException("Support ticket not found");
    const note = body.trim().slice(0, 4000); if (!note) throw new BadRequestException("Note cannot be empty");
    ticket.internalNotes.push({ adminId: admin.id, email: admin.email, body: note, createdAt: new Date() });
    ticket.history.push({ actorId: admin.id, action: "note_added", createdAt: new Date() });
    await ticket.save();
    await this.audit(admin, "support.ticket.note", "support_ticket", ticket.ticketNumber, { noteLength: note.length }, requestId);
    return ticket.toObject();
  }

  async getSettings() { return await this.settingsModel.findOne({ key: "platform" }).lean() ?? { key: "platform", available: true, maintenanceMode: false, maintenanceMessage: null, latestAppVersion: null, minimumAppVersion: null, announcement: null, featureFlags: {}, operationalLimits: {} }; }
  async updateSettings(input: any, admin: PlatformAdminIdentity, requestId?: string | null) {
    const allowed = ["maintenanceMode", "maintenanceMessage", "latestAppVersion", "minimumAppVersion", "announcement", "featureFlags", "operationalLimits"];
    const patch: any = {}; for (const key of allowed) if (input[key] !== undefined) patch[key] = input[key];
    if (patch.maintenanceMode !== undefined && typeof patch.maintenanceMode !== "boolean") throw new BadRequestException("maintenanceMode must be boolean");
    for (const key of ["maintenanceMessage", "latestAppVersion", "minimumAppVersion", "announcement"]) if (patch[key] !== undefined && patch[key] !== null && typeof patch[key] !== "string") throw new BadRequestException(`${key} must be text`);
    if (patch.operationalLimits) { for (const [key, value] of Object.entries(patch.operationalLimits)) if (!/^[A-Za-z0-9_-]{1,50}$/.test(key) || typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new BadRequestException("Operational limits must contain non-negative numeric values"); }
    if (patch.featureFlags) { for (const [key, value] of Object.entries(patch.featureFlags)) if (!/^[A-Za-z0-9_-]{1,50}$/.test(key) || typeof value !== "boolean") throw new BadRequestException("Feature flags must contain boolean values"); }
    const before = await this.getSettings(); const saved = await this.settingsModel.findOneAndUpdate({ key: "platform" }, { $set: { ...patch, updatedBy: admin.id }, $setOnInsert: { key: "platform" } }, { upsert: true, new: true }).lean();
    await this.audit(admin, "settings.update", "platform_settings", "platform", { changedFields: Object.keys(patch), maintenanceMode: { before: before.maintenanceMode, after: saved?.maintenanceMode } }, requestId); return saved;
  }
  async listAudit(query: { page?: number | undefined; limit?: number | undefined; actorId?: string | undefined; action?: string | undefined }) { const filter: any = {}; if (query.actorId) filter.actorId = query.actorId; if (query.action) filter.action = query.action; return this.paginate(this.adminAuditModel, filter, this.page(query.page), this.limit(query.limit), { createdAt: -1 }); }
  async listLoginEvents(query: { page?: number | undefined; limit?: number | undefined; email?: string | undefined }) { return this.paginate(this.loginEventModel, query.email ? { email: query.email.toLowerCase() } : {}, this.page(query.page), this.limit(query.limit), { createdAt: -1 }); }

  async listAdminUsers() {
    const rows = await this.connection.collection("user").find({}, { projection: { name: 1, email: 1, emailVerified: 1, role: 1, title: 1, isActive: 1, createdAt: 1, updatedAt: 1 } }).sort({ createdAt: -1 }).limit(1000).toArray();
    return rows.map((row: any) => ({ id: String(row.id ?? row._id), name: row.name, email: row.email, emailVerified: row.emailVerified, role: row.role ?? "read_only", title: row.title ?? null, isActive: row.isActive !== false, createdAt: row.createdAt, updatedAt: row.updatedAt }));
  }
  async createAdminUser(input: { name: string; email: string; role: string; passwordHash: string }, current: PlatformAdminIdentity, requestId?: string | null) {
    const email = input.email.trim().toLowerCase();
    const role = input.role;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new BadRequestException("A valid administrator email is required");
    if (!/^(super_admin|operations_admin|finance_admin|support_admin|developer|read_only)$/.test(role)) throw new BadRequestException("Invalid platform administrator role");
    if (!/^\$argon2id\$/.test(input.passwordHash) || input.passwordHash.length > 512) throw new BadRequestException("A valid Argon2id password hash is required");

    const userId = new Types.ObjectId();
    const now = new Date();
    const user = {
      _id: userId,
      name: input.name.trim().slice(0, 120),
      email,
      emailVerified: true,
      image: null,
      role,
      isActive: true,
      title: null,
      createdAt: now,
      updatedAt: now
    };
    const account = {
      _id: new Types.ObjectId(),
      accountId: userId.toString(),
      providerId: "credential",
      userId,
      password: input.passwordHash,
      createdAt: now,
      updatedAt: now
    };
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const users = this.connection.collection("user");
        if (await users.findOne({ email }, { session })) throw new ConflictException("An administrator with this email already exists");
        await users.insertOne(user as any, { session });
        await this.connection.collection("account").insertOne(account as any, { session });
      });
    } finally {
      await session.endSession();
    }
    await this.audit(current, "platform_admin.create", "platform_admin", userId.toString(), { email, role }, requestId);
    return { id: userId.toString(), name: user.name, email, emailVerified: true, role, title: null, isActive: true, createdAt: now };
  }
  async updateAdminUser(id: string, input: any, current: PlatformAdminIdentity, requestId?: string | null) {
    if (id === current.id && input.isActive === false) throw new BadRequestException("You cannot deactivate your own administrator account");
    if (id === current.id && input.role && input.role !== current.role) throw new BadRequestException("You cannot change your own administrator role");
    if (input.role && !["super_admin", "operations_admin", "finance_admin", "support_admin", "developer", "read_only"].includes(input.role)) throw new BadRequestException("Invalid platform administrator role");
    const filter: any = { $or: [{ id }, ...(Types.ObjectId.isValid(id) ? [{ _id: new Types.ObjectId(id) }] : [])] };
    const before = await this.connection.collection("user").findOne(filter); if (!before) throw new NotFoundException("Administrator not found");
    const patch: any = {}; for (const field of ["role", "title", "isActive"]) if (input[field] !== undefined) patch[field] = input[field];
    await this.connection.collection("user").updateOne(filter, { $set: { ...patch, updatedAt: new Date() } });
    let revokedSessionCount = 0;
    if (input.isActive !== undefined || input.role !== undefined) {
      const result = await this.connection.collection("session").deleteMany({ userId: before._id });
      revokedSessionCount = result.deletedCount ?? 0;
    }
    await this.audit(current, "platform_admin.update", "platform_admin", id, { before: { role: before.role, isActive: before.isActive }, after: patch, revokedSessionCount }, requestId);
    return { id, ...patch };
  }
  async revokeAdminSessions(id: string, current: PlatformAdminIdentity, requestId?: string | null) {
    const user = await this.connection.collection("user").findOne({ $or: [{ id }, ...(Types.ObjectId.isValid(id) ? [{ _id: new Types.ObjectId(id) }] : [])] }, { projection: { _id: 1 } });
    if (!user) throw new NotFoundException("Administrator not found");
    const result = await this.connection.collection("session").deleteMany({ userId: user._id });
    await this.audit(current, "platform_admin.revoke_sessions", "platform_admin", id, { revokedSessionCount: result.deletedCount ?? 0 }, requestId); return { revokedSessionCount: result.deletedCount ?? 0 };
  }

  async audit(admin: PlatformAdminIdentity, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown>, requestId?: string | null) {
    const safe = JSON.parse(JSON.stringify(metadata, (_key, value) => typeof value === "string" ? sanitize(value, 2000) : value));
    return this.adminAuditModel.create({ actorId: admin.id, actorEmail: admin.email, actorRole: admin.role, action, targetType, targetId, requestId: requestId?.slice(0, 128) ?? null, metadata: safe });
  }

  private async canonicalBusinessId(id: string) { const { business } = await this.businesses.get(id); return String(business.externalId ?? business._id); }
  private page(value?: number) { return Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1; }
  private limit(value?: number) { return Math.min(PAGE_MAX, Math.max(1, Number.isInteger(Number(value)) ? Number(value) : 25)); }
  private rangeStart(range: string) { const days = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : range === "30d" ? 30 : 30; return new Date(Date.now() - days * 86400000); }
  private dateRangeMatch(from?: string, to?: string) { const createdAt: any = {}; if (from && Number.isFinite(Date.parse(from))) createdAt.$gte = new Date(from); if (to && Number.isFinite(Date.parse(to))) createdAt.$lte = new Date(to); return Object.keys(createdAt).length ? { createdAt } : {}; }
  private objectId(id: string) { return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : new Types.ObjectId(); }
  private async paginate(model: any, filter: any, page: number, limit: number, sort: any = { createdAt: -1 }) { const [items, total] = await Promise.all([model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter)]); return { items, page, limit, total, pages: Math.ceil(total / limit) }; }
}

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function sanitize(value: unknown, max: number) { return redactSensitiveText(value, max); }
function safeId(value: unknown) { return typeof value === "string" && /^[A-Za-z0-9._:-]{1,160}$/.test(value) ? value : null; }
function unavailable(reason: string) { return { available: false, reason }; }
function latestDate(values: Array<Date | null | undefined>) { const valid = values.filter((value): value is Date => Boolean(value)).map((value) => new Date(value).getTime()).filter(Number.isFinite); return valid.length ? new Date(Math.max(...valid)).toISOString() : null; }
