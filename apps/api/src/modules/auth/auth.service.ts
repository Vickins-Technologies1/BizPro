import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { ClientSession, Connection, Model, Types } from "mongoose";
import bcrypt from "bcryptjs";
import { ROLE_ACCESS, getEffectivePermissions, resolveIndustryKey, type AccessPermission } from "@vbo/shared";
import { AuditLog, AuditLogDocument, Business, BusinessDocument, Branch, BranchDocument, Device, DeviceDocument, Subscription, SubscriptionDocument, SubscriptionPlan, SubscriptionPlanDocument, User, UserDocument } from "../schemas";
import { RegisterDto, LoginDto } from "./dto";
import { runInTransaction } from "../../common/mongo-transaction";

type AuthTokenResponse = {
  accessToken: string;
  user: {
    id: string;
    businessId: string;
    branchId?: string | null;
    role: string;
    fullName: string;
    ownerId?: string | null;
    roleLabel?: string | null;
    permissions?: AccessPermission[];
  };
  branches?: Array<{
    id: string;
    businessId: string;
    name: string;
    code: string;
    isDefault: boolean;
  }>;
  business: {
    id: string;
    name: string;
    slug: string;
    industryKey: string;
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
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectConnection() private readonly connection: Connection,
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
      const industryKey = resolveIndustryKey({ industryKey: dto.industryKey, businessType: dto.businessType });

      this.logger.log(
        `Auth register started businessName="${businessName}" businessType="${dto.businessType}" industryKey="${industryKey}" planTier="${dto.planTier}" phone="${this.maskPhone(phone)}" externalBusinessId="${businessExternalId ?? "none"}"`
      );

      const exists = await this.businessModel.findOne({ slug, deletedAt: null }).lean();
      if (exists) throw new BadRequestException("Business already exists");
      if (!phone) throw new BadRequestException("Phone is required");

      const { business, branch, owner, device, subscription } = await runInTransaction(this.connection, async (session) => {
        const createdBusiness = (await this.businessModel.create(
          [
            {
              externalId: businessExternalId,
              name: businessName,
              slug,
              industryKey,
              businessType: dto.businessType,
              currency,
              planTier: dto.planTier,
              billingStatus: "trial",
              graceEndsAt: null,
              deletedAt: null
            }
          ],
          { session }
        ))[0]!;
        const effectiveBusinessId = createdBusiness.externalId ?? createdBusiness._id.toString();
        const createdBranch = (await this.branchModel.create(
          [
            {
              businessId: effectiveBusinessId,
              name: branchName,
              code: "MAIN",
              isDefault: true,
              deletedAt: null
            }
          ],
          { session }
        ))[0]!;
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const pin = dto.cashierPin?.trim() || null;
        const pinHash = pin ? await bcrypt.hash(pin, 10) : null;
        const createdOwner = (await this.userModel.create(
          [
            {
              businessId: effectiveBusinessId,
              ownerId: null,
              branchId: createdBranch._id.toString(),
              fullName: ownerName,
              phone,
              passwordHash,
              pinHash,
              role: "owner",
              roleLabel: "Owner",
              permissions: [...ROLE_ACCESS.owner],
              isActive: true,
              suspendedAt: null,
              suspensionReason: null,
              deletedAt: null
            }
          ],
          { session }
        ))[0]!;
        createdOwner.ownerId = createdOwner._id.toString();
        await createdOwner.save({ session });
        const createdDevice = (await this.deviceModel.create(
          [
            {
              businessId: effectiveBusinessId,
              deviceName: "Owner setup",
              platform: "android",
              trusted: true,
              lastSeenAt: new Date(),
              deletedAt: null
            }
          ],
          { session }
        ))[0]!;
        await this.ensureSubscriptionPlan(dto.planTier, session);
        const createdSubscription = (await this.subscriptionModel.create(
          [
            {
              businessId: effectiveBusinessId,
              planCode: dto.planTier,
              status: "trial",
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              expiresAt: null,
              graceEndsAt: null
            }
          ],
          { session }
        ))[0]!;
        return {
          business: createdBusiness,
          branch: createdBranch,
          owner: createdOwner,
          device: createdDevice,
          subscription: createdSubscription
        };
      });
      const effectiveBusinessId = business.externalId ?? business._id.toString();
      this.logger.log(
        `Auth register succeeded businessId="${effectiveBusinessId}" branchId="${branch._id.toString()}" ownerUserId="${owner._id.toString()}" deviceId="${device._id.toString()}" subscriptionId="${subscription._id.toString()}"`
      );
      await this.auditAuthEvent({
        businessId: effectiveBusinessId,
        actorId: owner._id.toString(),
        entityType: "business",
        entityId: effectiveBusinessId,
        action: "auth.register",
        payload: {
          businessName: business.name,
          branchId: branch._id.toString(),
          ownerUserId: owner._id.toString(),
          planTier: business.planTier,
          industryKey: business.industryKey ?? null
        }
      });
      return {
        ...this.issueToken(owner, business, effectiveBusinessId),
        branches: [
          {
            id: branch._id.toString(),
            businessId: effectiveBusinessId,
            name: branch.name,
            code: branch.code,
            isDefault: branch.isDefault
          }
        ],
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
      await this.auditAuthEvent({
        businessId: response.user.businessId,
        actorId: response.user.id,
        entityType: "session",
        entityId: response.user.id,
        action: "auth.login",
        payload: {
          role: response.user.role,
          branchId: response.user.branchId ?? null,
          roleLabel: response.user.roleLabel ?? null
        }
      });
      this.logger.log(
        `Auth login succeeded identifier="${this.maskPhone(this.normalizePhone(identifier))}" businessId="${response.user.businessId}" userId="${response.user.id}" role="${response.user.role}"`
      );
      return {
        ...response,
        branches: await this.loadBranches(user.businessId)
      };
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
    return {
      user: this.normalizeUser(user),
      business: this.normalizeBusiness(business),
      branches: await this.loadBranches(user.businessId)
    };
  }

  private issueToken(
    user: { _id: unknown; businessId: string; branchId?: string | null; role: string; fullName: string; ownerId?: string | null; permissions?: AccessPermission[] | null; roleLabel?: string | null },
    business: { _id: unknown; externalId?: string | null; name: string; slug: string; industryKey?: string | null; businessType: string; currency: string; planTier: string; billingStatus: string },
    businessIdOverride?: string
  ): AuthTokenResponse {
    const businessId = businessIdOverride ?? user.businessId;
    const permissions = getEffectivePermissions(user);
    const payload = {
      sub: String(user._id),
      businessId,
      branchId: user.branchId ?? null,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId ?? null,
      permissions,
      roleLabel: user.roleLabel ?? null
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: String(user._id),
        businessId,
        branchId: user.branchId ?? null,
        role: user.role,
        fullName: user.fullName,
        ownerId: user.ownerId ?? null,
        roleLabel: user.roleLabel ?? null,
        permissions
      },
      business: {
        ...this.normalizeBusiness(business)
      }
    };
  }

  private normalizeUser(
    user: { _id: unknown; businessId: string; branchId?: string | null; role: string; fullName: string; ownerId?: string | null; permissions?: AccessPermission[] | null; roleLabel?: string | null }
  ) {
    return {
      id: String(user._id),
      businessId: user.businessId,
      branchId: user.branchId ?? null,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId ?? null,
      roleLabel: user.roleLabel ?? null,
      permissions: getEffectivePermissions(user)
    };
  }

  private normalizeBusiness(business: { _id: unknown; externalId?: string | null; name: string; slug: string; industryKey?: string | null; businessType: string; currency: string; planTier: string; billingStatus: string }) {
    return {
      id: business.externalId ?? String(business._id),
      name: business.name,
      slug: business.slug,
      industryKey: resolveIndustryKey({ industryKey: business.industryKey, businessType: business.businessType }),
      businessType: business.businessType,
      currency: business.currency,
      planTier: business.planTier,
      billingStatus: business.billingStatus
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

  private async ensureSubscriptionPlan(planCode: string, session?: ClientSession | null) {
    const planQuery = this.planModel.findOne({ code: planCode });
    if (session) {
      planQuery.session(session);
    }
    const plan = await planQuery.lean();
    if (plan) return plan;
    const createdPlans = await this.planModel.create(
      [
        {
          code: planCode,
          name: planCode.toUpperCase(),
          monthlyPrice: planCode === "lite" ? 300 : planCode === "standard" ? 600 : 1000,
          active: true
        }
      ],
      session ? { session } : undefined
    );
    return createdPlans[0]!;
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
      const byPhone = await this.userModel.findOne({ deletedAt: null, ...businessFilter, phone }).select("+passwordHash +pinHash").lean();
      if (byPhone) return byPhone;
    }

    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fullName = new RegExp(`^${escaped}$`, "i");
    return this.userModel.findOne({ deletedAt: null, ...businessFilter, fullName }).select("+passwordHash +pinHash").lean();
  }

  private async loadBranches(businessId: string) {
    const branches = await this.branchModel.find({ businessId, deletedAt: null }).sort({ isDefault: -1, createdAt: 1 }).lean();
    return branches.map((branch) => ({
      id: String(branch._id),
      businessId: branch.businessId,
      name: branch.name,
      code: branch.code,
      isDefault: Boolean(branch.isDefault)
    }));
  }

  private async auditAuthEvent(input: {
    businessId: string;
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
  }) {
    await this.auditLogModel.create({
      businessId: input.businessId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: {
        ...input.payload,
        timestamp: new Date().toISOString()
      }
    });
  }
}
