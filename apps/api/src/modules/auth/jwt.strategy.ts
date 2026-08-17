import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { getEffectivePermissions, type AccessPermission } from "@vbo/shared";
import { Business, BusinessDocument, User, UserDocument } from "../schemas";
import { Model } from "mongoose";
import { findBusinessByIdentifier } from "../../common/business-lookup";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") ?? "change-me"
    });
  }

  async validate(payload: { sub: string; businessId: string; branchId?: string | null; role: string; fullName: string; permissions?: AccessPermission[]; roleLabel?: string | null }) {
    const user = await this.userModel.findOne({ _id: payload.sub, businessId: payload.businessId, deletedAt: null }).lean();
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Session is no longer valid");
    }
    const business = await findBusinessByIdentifier(this.businessModel, payload.businessId);
    if (!business) {
      throw new UnauthorizedException("Business is no longer available");
    }

    return {
      sub: String(user._id),
      businessId: user.businessId,
      branchId: user.branchId ?? null,
      role: user.role,
      fullName: user.fullName,
      ownerId: user.ownerId ?? null,
      permissions: getEffectivePermissions(user),
      roleLabel: user.roleLabel ?? null
    };
  }
}
