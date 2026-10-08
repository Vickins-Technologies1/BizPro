import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { isBusinessOperationStatusTransitionAllowed, type BusinessOperationStatus } from "@vbo/shared";
import { buildBranchMatch, resolveReadBranchId, type BranchScope } from "../../common/branch-scope";
import { BusinessOperation, BusinessOperationDocument } from "../business-operations.schemas";

const OPERATION_KINDS = ["order", "appointment", "work_order", "project"] as const;
const OPERATION_STATUSES = ["draft", "open", "preparing", "ready", "confirmed", "in_progress", "completed", "cancelled"] as const;

@Injectable()
export class BusinessOperationsService {
  constructor(@InjectModel(BusinessOperation.name) private readonly operationModel: Model<BusinessOperationDocument>) {}

  list(businessId: string, kind?: string, status?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    if (kind && OPERATION_KINDS.includes(kind as (typeof OPERATION_KINDS)[number])) filter.kind = kind;
    if (status && OPERATION_STATUSES.includes(status as (typeof OPERATION_STATUSES)[number])) filter.status = status;
    return this.operationModel.find(filter).sort({ scheduledAt: 1, createdAt: -1 }).lean();
  }

  async create(input: Partial<BusinessOperation> & { businessId: string; kind: BusinessOperation["kind"]; title: string }) {
    if (!OPERATION_KINDS.includes(input.kind)) throw new BadRequestException("Unsupported operation kind");
    if (input.externalId) {
      const existing = await this.operationModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) return existing;
    }
    return this.operationModel.create({
      ...input,
      status: input.status ?? (input.kind === "appointment" ? "confirmed" : "open"),
      scheduledAt: input.scheduledAt ?? null,
      items: input.items ?? [],
      total: input.total ?? 0,
      deletedAt: null
    });
  }

  async update(businessId: string, id: string, patch: Partial<BusinessOperation>) {
    const { businessId: _ignoredBusinessId, externalId: _ignoredExternalId, ...safePatch } = patch;
    if (safePatch.status) {
      if (!OPERATION_STATUSES.includes(safePatch.status as (typeof OPERATION_STATUSES)[number])) {
        throw new BadRequestException("Unsupported operation status");
      }
      const identityFilter = Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
      const current = await this.operationModel.findOne({ ...identityFilter, businessId, deletedAt: null }).lean();
      if (!current) throw new NotFoundException("Business operation not found");
      if (!isBusinessOperationStatusTransitionAllowed(current.status as BusinessOperationStatus, safePatch.status as BusinessOperationStatus)) {
        throw new BadRequestException(`Invalid operation transition: ${current.status} -> ${safePatch.status}`);
      }
    }
    const identityFilter = Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
    const updated = await this.operationModel.findOneAndUpdate({ ...identityFilter, businessId, deletedAt: null }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Business operation not found");
    return updated;
  }

  async archive(businessId: string, id: string) {
    const identityFilter = Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
    const updated = await this.operationModel.findOneAndUpdate({ ...identityFilter, businessId, deletedAt: null }, { deletedAt: new Date(), status: "cancelled" }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Business operation not found");
    return updated;
  }
}
