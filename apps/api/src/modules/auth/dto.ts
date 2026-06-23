import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { BusinessType, PlanTier, UserRole } from "@vbo/shared";

export class RegisterDto {
  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsString()
  ownerName!: string;

  @IsString()
  phone!: string;

  @MinLength(6)
  password!: string;

  @IsString()
  businessName!: string;

  @IsIn(["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant"])
  businessType!: BusinessType;

  @IsIn(["lite", "standard", "pro"])
  planTier!: PlanTier;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  branchName!: string;

  @IsString()
  @IsOptional()
  cashierPin?: string;
}

export class LoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  passwordOrPin!: string;

  @IsOptional()
  @IsIn(["owner", "manager", "cashier"])
  role?: UserRole;
}
