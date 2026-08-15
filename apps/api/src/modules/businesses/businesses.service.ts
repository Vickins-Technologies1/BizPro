import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Business, BusinessDocument, Branch, BranchDocument } from "../schemas";
import { resolveIndustryKey } from "@vbo/shared";

@Injectable()
export class BusinessesService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>
  ) {}

  list() {
    return this.businessModel.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async get(id: string) {
    const business = await this.businessModel.findById(id).lean();
    if (!business) throw new NotFoundException("Business not found");
    const branches = await this.branchModel.find({ businessId: id, deletedAt: null }).lean();
    return { business, branches };
  }

  create(input: Partial<Business> & { name: string; slug: string; businessType: Business["businessType"]; currency?: string; planTier: Business["planTier"] }) {
    return this.businessModel.create({
      ...input,
      industryKey: input.industryKey ?? resolveIndustryKey({ industryKey: input.industryKey, businessType: input.businessType }),
      currency: input.currency ?? "KES",
      billingStatus: "trial",
      graceEndsAt: null,
      deletedAt: null
    });
  }

  async update(id: string, patch: Partial<Business>) {
    const nextPatch = { ...patch };
    if (typeof nextPatch.businessType === "string" && nextPatch.industryKey == null) {
      nextPatch.industryKey = resolveIndustryKey({ businessType: nextPatch.businessType });
    }
    const updated = await this.businessModel.findByIdAndUpdate(id, nextPatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Business not found");
    return updated;
  }
}
