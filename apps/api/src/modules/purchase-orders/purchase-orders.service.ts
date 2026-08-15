import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PurchaseOrder, PurchaseOrderDocument } from "../schemas";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";

@Injectable()
export class PurchaseOrdersService {
  constructor(@InjectModel(PurchaseOrder.name) private readonly purchaseOrderModel: Model<PurchaseOrderDocument>) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.purchaseOrderModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: Partial<PurchaseOrder> & { businessId: string; orderNumber: string; orderDate: Date }, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (input.externalId) {
      const existing = await this.purchaseOrderModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return this.purchaseOrderModel.create({ ...input, branchId, deletedAt: null, status: input.status ?? "draft", items: input.items ?? [] });
  }

  async update(businessId: string, id: string, patch: Partial<PurchaseOrder>, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, patch.branchId ?? null);
    const { businessId: _ignoredBusinessId, branchId: _ignoredBranchId, ...safePatch } = patch;
    const updated = await this.purchaseOrderModel.findOneAndUpdate({ _id: id, businessId, ...buildBranchMatch(branchId) }, safePatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Purchase order not found");
    return updated;
  }

  async archive(businessId: string, id: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const updated = await this.purchaseOrderModel.findOneAndUpdate({ _id: id, businessId, ...buildBranchMatch(branchId) }, { deletedAt: new Date(), status: "cancelled" }, { new: true }).lean();
    if (!updated) throw new NotFoundException("Purchase order not found");
    return updated;
  }
}
