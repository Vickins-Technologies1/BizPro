import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditLog, AuditLogDocument, Branch, BranchDocument, Business, BusinessDocument, Customer, CustomerDocument, Expense, ExpenseDocument, Product, ProductDocument, Sale, SaleDocument, User, UserDocument } from "../schemas";
import { buildBranchMatch, type BranchScope } from "../../common/branch-scope";

type BranchActor = {
  sub?: string;
  businessId: string;
  role?: string | null;
  branchId?: string | null;
};

type BranchInput = {
  businessId: string;
  name: string;
  code: string;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  managerId?: string | null;
  description?: string | null;
  status?: "active" | "inactive";
  isDefault?: boolean;
};

type BranchPatch = Partial<Omit<BranchInput, "businessId">>;

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>
  ) {}

  async list(businessId: string, scope: BranchScope = {}) {
    const branches = await this.branchModel.find({ businessId, deletedAt: null }).sort({ isDefault: -1, createdAt: 1 }).lean();
    if (!branches.length) return [];

    const accessibleBranches = scope.role === "owner" ? branches : branches.filter((branch) => String(branch._id) === scope.branchId);
    const summaryRows = await Promise.all(accessibleBranches.map((branch) => this.enrichBranch(branch, businessId)));
    return summaryRows.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
  }

  async create(actor: BranchActor, input: BranchInput) {
    this.assertCanManageBranches(actor);
    const code = this.normalizeCode(input.code);
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Branch name is required.");
    if (!code) throw new BadRequestException("Branch code is required.");
    await this.assertUniqueCode(input.businessId, code);

    const manager = await this.resolveManager(input.businessId, input.managerId ?? null);
    const shouldBeDefault = Boolean(input.isDefault) || !(await this.hasActiveDefaultBranch(input.businessId));
    if (shouldBeDefault) {
      await this.branchModel.updateMany({ businessId: input.businessId, isDefault: true, deletedAt: null }, { $set: { isDefault: false } });
    }

    const createdBranches = await this.branchModel.create([
      {
        businessId: input.businessId,
        name,
        code,
        location: input.location?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        managerId: manager?._id ? String(manager._id) : null,
        managerName: manager?.fullName ?? null,
        description: input.description?.trim() || null,
        status: input.status ?? "active",
        isDefault: shouldBeDefault,
        deletedAt: null
      }
    ]);
    const branch = createdBranches[0];
    if (!branch) {
      throw new Error("Failed to create branch.");
    }

    await this.audit(actor, input.businessId, String(branch._id), "branch.create", {
      name: branch.name,
      code: branch.code,
      status: branch.status,
      managerId: branch.managerId ?? null
    });

    return this.enrichBranch(branch.toObject(), input.businessId);
  }

  async update(actor: BranchActor, id: string, patch: BranchPatch) {
    this.assertCanManageBranches(actor);
    const branch = await this.branchModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null });
    if (!branch) throw new NotFoundException("Branch not found");

    if (patch.code !== undefined) {
      const code = this.normalizeCode(patch.code);
      if (!code) throw new BadRequestException("Branch code is required.");
      await this.assertUniqueCode(actor.businessId, code, String(branch._id));
      branch.code = code;
    }
    if (patch.name !== undefined) branch.name = patch.name.trim() || branch.name;
    if (patch.location !== undefined) branch.location = patch.location?.trim() || null;
    if (patch.phone !== undefined) branch.phone = patch.phone?.trim() || null;
    if (patch.email !== undefined) branch.email = patch.email?.trim() || null;
    if (patch.description !== undefined) branch.description = patch.description?.trim() || null;
    if (patch.managerId !== undefined) {
      const manager = await this.resolveManager(actor.businessId, patch.managerId ?? null);
      branch.managerId = manager?._id ? String(manager._id) : null;
      branch.managerName = manager?.fullName ?? null;
    }
    if (patch.status !== undefined) {
      if (patch.status === "inactive" && branch.isDefault) {
        await this.ensureAnotherDefaultBranch(actor.businessId, String(branch._id));
      }
      branch.status = patch.status;
    }
    if (patch.isDefault !== undefined && patch.isDefault) {
      await this.branchModel.updateMany({ businessId: actor.businessId, isDefault: true, deletedAt: null }, { $set: { isDefault: false } });
      branch.isDefault = true;
    }

    await branch.save();
    await this.audit(actor, actor.businessId, String(branch._id), "branch.update", {
      name: branch.name,
      code: branch.code,
      status: branch.status,
      managerId: branch.managerId ?? null,
      isDefault: branch.isDefault
    });

    return this.enrichBranch(branch.toObject(), actor.businessId);
  }

  async deactivate(actor: BranchActor, id: string) {
    this.assertCanManageBranches(actor);
    const branch = await this.branchModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null });
    if (!branch) throw new NotFoundException("Branch not found");
    if (branch.status === "inactive") return this.enrichBranch(branch.toObject(), actor.businessId);
    await this.ensureAnotherDefaultBranch(actor.businessId, String(branch._id));
    branch.status = "inactive";
    if (branch.isDefault) {
      branch.isDefault = false;
    }
    await branch.save();
    await this.audit(actor, actor.businessId, String(branch._id), "branch.deactivate", {
      name: branch.name,
      code: branch.code
    });
    return this.enrichBranch(branch.toObject(), actor.businessId);
  }

  async activate(actor: BranchActor, id: string) {
    this.assertCanManageBranches(actor);
    const branch = await this.branchModel.findOne({ _id: id, businessId: actor.businessId, deletedAt: null });
    if (!branch) throw new NotFoundException("Branch not found");
    branch.status = "active";
    if (!(await this.hasActiveDefaultBranch(actor.businessId))) {
      branch.isDefault = true;
    }
    await branch.save();
    await this.audit(actor, actor.businessId, String(branch._id), "branch.activate", {
      name: branch.name,
      code: branch.code
    });
    return this.enrichBranch(branch.toObject(), actor.businessId);
  }

  async ensureDefaultBranches() {
    const businesses = await this.branchModel.distinct("businessId", { deletedAt: null });
    const activeBusinessIds = new Set(businesses.map((businessId) => String(businessId)));
    const allBusinesses = await this.businessModel.find({ deletedAt: null }).lean();
    for (const business of allBusinesses as Array<{ _id: unknown; externalId?: string | null; name: string; slug?: string }>) {
      const businessId = String(business.externalId ?? business._id);
      if (activeBusinessIds.has(businessId)) continue;
      const branchName = `${business.name} Main Branch`;
    const createdBranches = await this.branchModel.create([
        {
          businessId,
          name: branchName,
          code: "MAIN",
          location: null,
          phone: null,
          email: null,
          managerId: null,
          managerName: null,
          description: "Default branch created during migration.",
          status: "active",
          isDefault: true,
          deletedAt: null
        }
      ]);
      const defaultBranch = createdBranches[0];
      if (!defaultBranch) {
        throw new Error("Failed to create default branch.");
      }

      await Promise.all([
        this.productModel.updateMany({ businessId, branchId: null, deletedAt: null }, { $set: { branchId: String(defaultBranch._id) } }),
        this.saleModel.updateMany({ businessId, branchId: null, deletedAt: null }, { $set: { branchId: String(defaultBranch._id) } }),
        this.expenseModel.updateMany({ businessId, branchId: null, deletedAt: null }, { $set: { branchId: String(defaultBranch._id) } }),
        this.customerModel.updateMany({ businessId, branchId: null, deletedAt: null }, { $set: { branchId: String(defaultBranch._id) } }),
        this.userModel.updateMany({ businessId, branchId: null, deletedAt: null, role: { $ne: "owner" } }, { $set: { branchId: String(defaultBranch._id) } })
      ]);
    }
  }

  private assertCanManageBranches(actor: BranchActor) {
    if (actor.role !== "owner") {
      throw new ForbiddenException("You do not have permission to manage branches.");
    }
  }

  private async assertUniqueCode(businessId: string, code: string, branchId?: string) {
    const existing = await this.branchModel.findOne({
      businessId,
      code,
      deletedAt: null,
      ...(branchId ? { _id: { $ne: branchId } } : {})
    }).lean();
    if (existing) {
      throw new BadRequestException("Branch code must be unique within the business.");
    }
  }

  private async resolveManager(businessId: string, managerId: string | null) {
    if (!managerId) return null;
    const manager = await this.userModel.findOne({ _id: managerId, businessId, deletedAt: null }).lean();
    if (!manager) {
      throw new BadRequestException("Manager must belong to this business.");
    }
    return manager;
  }

  private async hasActiveDefaultBranch(businessId: string) {
    const count = await this.branchModel.countDocuments({ businessId, isDefault: true, status: "active", deletedAt: null });
    return count > 0;
  }

  private async ensureAnotherDefaultBranch(businessId: string, excludedBranchId: string) {
    const currentDefault = await this.branchModel.findOne({ businessId, isDefault: true, status: "active", deletedAt: null, _id: { $ne: excludedBranchId } }).lean();
    if (currentDefault) return;
    const fallback = await this.branchModel.findOne({ businessId, status: "active", deletedAt: null, _id: { $ne: excludedBranchId } }).sort({ createdAt: 1 }).lean();
    if (!fallback) {
      throw new BadRequestException("At least one active branch must remain available.");
    }
    await this.branchModel.updateMany({ businessId, isDefault: true, deletedAt: null, _id: { $ne: excludedBranchId } }, { $set: { isDefault: false } });
    await this.branchModel.updateOne({ _id: fallback._id }, { $set: { isDefault: true } });
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  private async enrichBranch(branch: any, businessId: string) {
    const branchId = String(branch._id);
    const [salesAgg, products, staffCount, manager] = await Promise.all([
      this.saleModel.aggregate([
        { $match: { businessId, deletedAt: null, ...buildBranchMatch(branchId) } },
        { $group: { _id: null, salesTotal: { $sum: "$grandTotal" }, salesCount: { $sum: 1 } } }
      ]),
      this.productModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean(),
      this.userModel.countDocuments({ businessId, deletedAt: null, branchId }),
      branch.managerId ? this.userModel.findOne({ _id: branch.managerId, businessId, deletedAt: null }).lean() : null
    ]);

    const [salesRow] = salesAgg as Array<{ salesTotal?: number; salesCount?: number }>;
    const lowStockCount = products.filter((product) => Number(product.stockOnHand ?? 0) <= Number(product.lowStockThreshold ?? 0)).length;
    return {
      id: branch.externalId ?? branch.id ?? String(branch._id),
      businessId: branch.businessId,
      name: branch.name,
      code: branch.code,
      location: branch.location ?? null,
      phone: branch.phone ?? null,
      email: branch.email ?? null,
      description: branch.description ?? null,
      managerId: branch.managerId ?? null,
      managerName: manager?.fullName ?? branch.managerName ?? null,
      status: branch.status ?? "active",
      isDefault: Boolean(branch.isDefault),
      salesTotal: Number(salesRow?.salesTotal ?? 0),
      salesCount: Number(salesRow?.salesCount ?? 0),
      inventoryCount: products.length,
      lowStockCount,
      staffCount: Number(staffCount ?? 0),
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
      deletedAt: branch.deletedAt ?? null
    };
  }

  private async audit(actor: BranchActor, businessId: string, entityId: string, action: string, payload: Record<string, unknown>) {
    if (!actor.sub) return;
    await this.auditLogModel.create({
      businessId,
      actorId: actor.sub,
      entityType: "branch",
      entityId,
      action,
      payload
    });
  }
}
