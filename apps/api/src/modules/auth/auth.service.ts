import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model, Types } from "mongoose";
import bcrypt from "bcryptjs";
import { Business, BusinessDocument, Branch, BranchDocument, Device, DeviceDocument, Subscription, SubscriptionDocument, SubscriptionPlan, SubscriptionPlanDocument, User, UserDocument } from "../schemas";
import { RegisterDto, LoginDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(SubscriptionPlan.name) private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.businessModel.findOne({ slug: this.slugify(dto.businessName), deletedAt: null }).lean();
    if (exists) throw new BadRequestException("Business already exists");

    const business = await this.businessModel.create({
      externalId: dto.businessId ?? null,
      name: dto.businessName,
      slug: this.slugify(dto.businessName),
      businessType: dto.businessType,
      currency: dto.currency ?? "KES",
      planTier: dto.planTier,
      billingStatus: "trial",
      graceEndsAt: null,
      deletedAt: null
    });
    const effectiveBusinessId = business.externalId ?? business._id.toString();
    const branch = await this.branchModel.create({
      businessId: effectiveBusinessId,
      name: dto.branchName,
      code: "MAIN",
      isDefault: true,
      deletedAt: null
    });
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const pinHash = dto.cashierPin ? await bcrypt.hash(dto.cashierPin, 10) : null;
    const owner = await this.userModel.create({
      businessId: effectiveBusinessId,
      branchId: branch._id.toString(),
      fullName: dto.ownerName,
      phone: dto.phone,
      passwordHash,
      pinHash,
      role: "owner",
      isActive: true,
      deletedAt: null
    });
    await this.deviceModel.create({
      businessId: effectiveBusinessId,
      deviceName: "Owner setup",
      platform: "android",
      trusted: true,
      lastSeenAt: new Date(),
      deletedAt: null
    });
    await this.ensureSubscriptionPlan(dto.planTier);
    await this.subscriptionModel.create({
      businessId: effectiveBusinessId,
      planCode: dto.planTier,
      status: "trial",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      expiresAt: null,
      graceEndsAt: null
      });
    return this.issueToken(owner, business, effectiveBusinessId);
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({
      deletedAt: null,
      $or: [{ phone: dto.identifier }, { fullName: dto.identifier }]
    });
    if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");
    const matchesPassword = user.passwordHash ? await bcrypt.compare(dto.passwordOrPin, user.passwordHash) : false;
    const matchesPin = user.pinHash ? await bcrypt.compare(dto.passwordOrPin, user.pinHash) : false;
    if (!matchesPassword && !matchesPin) throw new UnauthorizedException("Invalid credentials");
    const business = await this.findBusiness(user.businessId);
    if (!business || business.deletedAt) throw new UnauthorizedException("Business not found");
    return this.issueToken(user, business, user.businessId);
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new UnauthorizedException("Session not found");
    const business = await this.findBusiness(user.businessId);
    if (!business) throw new UnauthorizedException("Business not found");
    return { user, business };
  }

  private issueToken(
    user: { _id: unknown; businessId: string; role: string; fullName: string },
    business: { _id: unknown; externalId?: string | null; name: string; slug: string; businessType: string; currency: string; planTier: string; billingStatus: string },
    businessIdOverride?: string
  ) {
    const businessId = businessIdOverride ?? user.businessId;
    const payload = {
      sub: String(user._id),
      businessId,
      role: user.role,
      fullName: user.fullName
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: String(user._id),
        businessId,
        role: user.role,
        fullName: user.fullName
      },
      business: {
        id: business.externalId ?? String(business._id),
        name: business.name,
        slug: business.slug,
        businessType: business.businessType,
        currency: business.currency,
        planTier: business.planTier,
        billingStatus: business.billingStatus
      }
    };
  }

  private async findBusiness(identifier: string) {
    const candidates: Array<Record<string, unknown>> = [{ externalId: identifier }];
    if (Types.ObjectId.isValid(identifier)) {
      candidates.push({ _id: new Types.ObjectId(identifier) });
    }
    return this.businessModel.findOne({ deletedAt: null, $or: candidates }).lean();
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  private async ensureSubscriptionPlan(planCode: string) {
    const plan = await this.planModel.findOne({ code: planCode }).lean();
    if (plan) return plan;
    return this.planModel.create({
      code: planCode,
      name: planCode.toUpperCase(),
      monthlyPrice: planCode === "lite" ? 300 : planCode === "standard" ? 600 : 1000,
      active: true
    });
  }
}
