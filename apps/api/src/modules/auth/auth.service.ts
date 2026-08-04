import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model, Types } from "mongoose";
import bcrypt from "bcryptjs";
import { Business, BusinessDocument, Branch, BranchDocument, Device, DeviceDocument, Subscription, SubscriptionDocument, SubscriptionPlan, SubscriptionPlanDocument, User, UserDocument } from "../schemas";
import { RegisterDto, LoginDto } from "./dto";

type AuthTokenResponse = {
  accessToken: string;
  user: {
    id: string;
    businessId: string;
    role: string;
    fullName: string;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    businessType: string;
    currency: string;
    planTier: string;
    billingStatus: string;
  };
};

type RegisterResponse = AuthTokenResponse & {
  setup: {
    businessId: string;
    branchId: string;
    ownerUserId: string;
    deviceId: string;
    subscriptionPlanCode: string;
  };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(SubscriptionPlan.name) private readonly planModel: Model<SubscriptionPlanDocument>,
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    try {
      const businessName = dto.businessName.trim();
      const branchName = dto.branchName.trim();
      const ownerName = dto.ownerName.trim();
      const phone = this.normalizePhone(dto.phone);
      const currency = (dto.currency ?? "KES").trim().toUpperCase();
      const businessExternalId = dto.businessId?.trim() || null;
      const slug = this.slugify(businessName);

      this.logger.log(
        `Auth register started businessName="${businessName}" businessType="${dto.businessType}" planTier="${dto.planTier}" phone="${this.maskPhone(phone)}" externalBusinessId="${businessExternalId ?? "none"}"`
      );

      const exists = await this.businessModel.findOne({ slug, deletedAt: null }).lean();
      if (exists) throw new BadRequestException("Business already exists");
      if (!phone) throw new BadRequestException("Phone is required");

      const business = await this.businessModel.create({
        externalId: businessExternalId,
        name: businessName,
        slug,
        businessType: dto.businessType,
        currency,
        planTier: dto.planTier,
        billingStatus: "trial",
        graceEndsAt: null,
        deletedAt: null
      });
      const effectiveBusinessId = business.externalId ?? business._id.toString();
      const branch = await this.branchModel.create({
        businessId: effectiveBusinessId,
        name: branchName,
        code: "MAIN",
        isDefault: true,
        deletedAt: null
      });
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const pin = dto.cashierPin?.trim() || null;
      const pinHash = pin ? await bcrypt.hash(pin, 10) : null;
      const owner = await this.userModel.create({
        businessId: effectiveBusinessId,
        branchId: branch._id.toString(),
        fullName: ownerName,
        phone,
        passwordHash,
        pinHash,
        role: "owner",
        isActive: true,
        deletedAt: null
      });
      const device = await this.deviceModel.create({
        businessId: effectiveBusinessId,
        deviceName: "Owner setup",
        platform: "android",
        trusted: true,
        lastSeenAt: new Date(),
        deletedAt: null
      });
      await this.ensureSubscriptionPlan(dto.planTier);
      const subscription = await this.subscriptionModel.create({
        businessId: effectiveBusinessId,
        planCode: dto.planTier,
        status: "trial",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        expiresAt: null,
        graceEndsAt: null
      });
      this.logger.log(
        `Auth register succeeded businessId="${effectiveBusinessId}" branchId="${branch._id.toString()}" ownerUserId="${owner._id.toString()}" deviceId="${device._id.toString()}" subscriptionId="${subscription._id.toString()}"`
      );
      return {
        ...this.issueToken(owner, business, effectiveBusinessId),
        setup: {
          businessId: effectiveBusinessId,
          branchId: branch._id.toString(),
          ownerUserId: owner._id.toString(),
          deviceId: device._id.toString(),
          subscriptionPlanCode: subscription.planCode
        }
      };
    } catch (error) {
      this.logger.error(
        `Auth register failed businessName="${dto.businessName?.trim?.() ?? "unknown"}" phone="${this.maskPhone(this.normalizePhone(dto.phone ?? ""))}" error="${error instanceof Error ? error.message : String(error)}"`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  async login(dto: LoginDto) {
    try {
      const identifier = dto.identifier.trim();
      const businessId = dto.businessId?.trim() || null;
      this.logger.log(
        `Auth login started identifier="${this.maskPhone(this.normalizePhone(identifier))}" businessId="${businessId ?? "none"}"`
      );
      const user = await this.findUser(identifier, businessId);
      if (!user || !user.isActive) {
        this.logger.warn(
          `Auth login rejected identifier="${this.maskPhone(this.normalizePhone(identifier))}" businessId="${businessId ?? "none"}" reason="user_not_found_or_inactive"`
        );
        throw new UnauthorizedException("Invalid credentials");
      }
      const matchesPassword = user.passwordHash ? await bcrypt.compare(dto.passwordOrPin, user.passwordHash) : false;
      const matchesPin = user.pinHash ? await bcrypt.compare(dto.passwordOrPin, user.pinHash) : false;
      if (!matchesPassword && !matchesPin) {
        this.logger.warn(
          `Auth login rejected identifier="${this.maskPhone(this.normalizePhone(identifier))}" businessId="${businessId ?? "none"}" userId="${String(user._id)}" reason="password_or_pin_mismatch"`
        );
        throw new UnauthorizedException("Invalid credentials");
      }
      const business = await this.findBusiness(user.businessId);
      if (!business || business.deletedAt) {
        this.logger.warn(
          `Auth login rejected identifier="${this.maskPhone(this.normalizePhone(identifier))}" businessId="${businessId ?? "none"}" userId="${String(user._id)}" reason="business_not_found_or_deleted"`
        );
        throw new UnauthorizedException("Business not found");
      }
      const response = this.issueToken(user, business, user.businessId);
      this.logger.log(
        `Auth login succeeded identifier="${this.maskPhone(this.normalizePhone(identifier))}" businessId="${response.user.businessId}" userId="${response.user.id}" role="${response.user.role}"`
      );
      return response;
    } catch (error) {
      this.logger.error(
        `Auth login failed identifier="${this.maskPhone(this.normalizePhone(dto.identifier))}" businessId="${dto.businessId?.trim() || "none"}" error="${error instanceof Error ? error.message : String(error)}"`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
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
  ): AuthTokenResponse {
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
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

  private normalizePhone(value: string) {
    return value.replace(/[^\d+]/g, "").trim();
  }

  private maskPhone(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "empty";
    if (trimmed.length <= 4) return `${"*".repeat(trimmed.length - 1)}${trimmed.slice(-1)}`;
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
  }

  private async findUser(identifier: string, businessId?: string | null) {
    const trimmed = identifier.trim();
    const phone = this.normalizePhone(trimmed);
    const businessFilter = businessId ? { businessId } : {};

    if (phone) {
      const byPhone = await this.userModel.findOne({ deletedAt: null, ...businessFilter, phone }).lean();
      if (byPhone) return byPhone;
    }

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fullName = new RegExp(`^${escaped}$`, "i");
    return this.userModel.findOne({ deletedAt: null, ...businessFilter, fullName }).lean();
  }
}
