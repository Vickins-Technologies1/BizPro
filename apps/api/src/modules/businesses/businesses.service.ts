import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Business, BusinessDocument, Branch, BranchDocument } from "../schemas";
import { resolveIndustryKey } from "@vbo/shared";
import { buildBusinessLookup } from "../../common/business-lookup";

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
    const business = await this.businessModel.findOne(buildBusinessLookup(id)).lean();
    if (!business) throw new NotFoundException("Business not found");
    const businessId = String((business as { externalId?: string | null; _id?: unknown }).externalId ?? (business as { _id?: unknown })._id);
    const branches = await this.branchModel.find({ businessId, deletedAt: null }).lean();
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
    const updated = await this.businessModel.findOneAndUpdate(buildBusinessLookup(id), nextPatch, { new: true }).lean();
    if (!updated) throw new NotFoundException("Business not found");
    return updated;
  }

  async suspend(id: string, reason?: string | null) {
    const business = await this.businessModel.findOne(buildBusinessLookup(id));
    if (!business) throw new NotFoundException("Business not found");
    if (business.billingStatus !== "suspended") {
      business.platformPriorBillingStatus = business.billingStatus === "active" || business.billingStatus === "past_due" ? business.billingStatus : "trial";
    }
    business.billingStatus = "suspended";
    business.platformSuspendedAt = new Date();
    business.platformSuspensionReason = reason?.trim().slice(0, 500) || "Suspended by platform administrator";
    await business.save();
    return business.toObject();
  }

  async reactivate(id: string) {
    const business = await this.businessModel.findOne(buildBusinessLookup(id));
    if (!business) throw new NotFoundException("Business not found");
    if (business.billingStatus === "suspended") {
      business.billingStatus = business.platformPriorBillingStatus ?? "trial";
    }
    business.platformSuspendedAt = null;
    business.platformSuspensionReason = null;
    business.platformPriorBillingStatus = null;
    await business.save();
    return business.toObject();
  }
}
